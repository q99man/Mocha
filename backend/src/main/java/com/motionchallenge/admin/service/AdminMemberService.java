package com.motionchallenge.admin.service;

import com.motionchallenge.admin.dto.AdminMemberCreateRequest;
import com.motionchallenge.admin.dto.AdminMemberOverviewResponse;
import com.motionchallenge.admin.dto.AdminMemberListResponse;
import com.motionchallenge.admin.dto.AdminMemberSortOption;
import com.motionchallenge.admin.dto.AdminMemberSummaryResponse;
import com.motionchallenge.admin.dto.AdminMemberUpdateRequest;
import com.motionchallenge.attempt.repository.AttemptProcessingJobRepository;
import com.motionchallenge.attempt.repository.AttemptRepository;
import com.motionchallenge.board.repository.BoardCommentRepository;
import com.motionchallenge.board.repository.BoardPostRepository;
import com.motionchallenge.member.entity.Member;
import com.motionchallenge.member.entity.MemberAuthProvider;
import com.motionchallenge.member.entity.MemberRole;
import com.motionchallenge.member.repository.MemberRepository;
import com.motionchallenge.member.service.CurrentMemberService;
import com.motionchallenge.review.repository.ReviewRepository;
import java.util.Locale;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class AdminMemberService {

    private final MemberRepository memberRepository;
    private final BoardPostRepository boardPostRepository;
    private final BoardCommentRepository boardCommentRepository;
    private final ReviewRepository reviewRepository;
    private final AttemptRepository attemptRepository;
    private final AttemptProcessingJobRepository attemptProcessingJobRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentMemberService currentMemberService;

    public AdminMemberService(
            MemberRepository memberRepository,
            BoardPostRepository boardPostRepository,
            BoardCommentRepository boardCommentRepository,
            ReviewRepository reviewRepository,
            AttemptRepository attemptRepository,
            AttemptProcessingJobRepository attemptProcessingJobRepository,
            PasswordEncoder passwordEncoder,
            CurrentMemberService currentMemberService) {
        this.memberRepository = memberRepository;
        this.boardPostRepository = boardPostRepository;
        this.boardCommentRepository = boardCommentRepository;
        this.reviewRepository = reviewRepository;
        this.attemptRepository = attemptRepository;
        this.attemptProcessingJobRepository = attemptProcessingJobRepository;
        this.passwordEncoder = passwordEncoder;
        this.currentMemberService = currentMemberService;
    }

    public AdminMemberOverviewResponse getOverview() {
        long totalCount = memberRepository.count();
        long adminCount = memberRepository.countByRole(MemberRole.ADMIN);
        long userCount = memberRepository.countByRole(MemberRole.USER);
        Long currentMemberId = currentMemberService.getCurrentMember().map(Member::getId).orElse(null);

        return new AdminMemberOverviewResponse(
                totalCount,
                adminCount,
                userCount,
                memberRepository.findTop6ByOrderByCreatedAtDesc().stream()
                        .map(member -> toSummary(member, currentMemberId, adminCount))
                        .toList());
    }

    public AdminMemberListResponse getMembers(
            int page,
            int size,
            MemberRole role,
            MemberAuthProvider authProvider,
            AdminMemberSortOption sort,
            String keyword) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, 20));
        AdminMemberSortOption resolvedSort = sort == null ? AdminMemberSortOption.NEWEST : sort;
        long adminCount = memberRepository.countByRole(MemberRole.ADMIN);
        Long currentMemberId = currentMemberService.getCurrentMember().map(Member::getId).orElse(null);
        Page<Member> result = memberRepository.search(
                role,
                authProvider,
                normalizeKeyword(keyword),
                PageRequest.of(safePage - 1, safeSize, resolvedSort.toSort()));

        return new AdminMemberListResponse(
                result.getContent().stream()
                        .map(member -> toSummary(member, currentMemberId, adminCount))
                        .toList(),
                result.getTotalElements(),
                safePage,
                safeSize);
    }

    @Transactional
    public AdminMemberSummaryResponse createMember(AdminMemberCreateRequest request) {
        String normalizedEmail = normalizeEmail(request.email());
        String normalizedDisplayName = normalizeDisplayName(request.displayName());
        if (memberRepository.existsByEmail(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 가입된 이메일입니다.");
        }

        Member saved = memberRepository.save(Member.local(
                normalizedEmail,
                passwordEncoder.encode(request.password().trim()),
                normalizedDisplayName,
                request.role()));

        long adminCount = memberRepository.countByRole(MemberRole.ADMIN);
        Long currentMemberId = currentMemberService.getCurrentMember().map(Member::getId).orElse(null);
        return toSummary(saved, currentMemberId, adminCount);
    }

    @Transactional
    public AdminMemberSummaryResponse updateMember(Long memberId, AdminMemberUpdateRequest request) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원 정보를 찾을 수 없습니다."));

        Long currentMemberId = currentMemberService.requireCurrentMember().getId();
        String normalizedEmail = normalizeEmail(request.email());
        String normalizedDisplayName = normalizeDisplayName(request.displayName());
        MemberRole nextRole = request.role();

        if (!member.getEmail().equals(normalizedEmail) && memberRepository.existsByEmail(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이미 가입된 이메일입니다.");
        }

        ensureAdminRoleCanChange(member, nextRole, currentMemberId);
        member.updateProfile(normalizedEmail, normalizedDisplayName, nextRole);

        if (request.password() != null && !request.password().trim().isEmpty()) {
            member.updatePasswordHash(passwordEncoder.encode(request.password().trim()));
        }

        long adminCount = memberRepository.countByRole(MemberRole.ADMIN);
        return toSummary(member, currentMemberId, adminCount);
    }

    @Transactional
    public void deleteMember(Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "회원 정보를 찾을 수 없습니다."));

        Long currentMemberId = currentMemberService.requireCurrentMember().getId();
        if (member.getId().equals(currentMemberId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 로그인한 관리자 계정은 삭제할 수 없습니다.");
        }
        if (member.getRole() == MemberRole.ADMIN && memberRepository.countByRole(MemberRole.ADMIN) <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "최소 한 명의 관리자 계정은 유지되어야 합니다.");
        }
        if (hasActivity(member.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "활동 이력이 있는 회원은 바로 삭제할 수 없습니다.");
        }

        memberRepository.delete(member);
    }

    private AdminMemberSummaryResponse toSummary(Member member, Long currentMemberId, long adminCount) {
        boolean self = currentMemberId != null && member.getId().equals(currentMemberId);
        boolean hasActivity = hasActivity(member.getId());
        boolean canDelete = !self && !hasActivity && !(member.getRole() == MemberRole.ADMIN && adminCount <= 1);
        return AdminMemberSummaryResponse.from(member, self, hasActivity, canDelete);
    }

    private void ensureAdminRoleCanChange(Member member, MemberRole nextRole, Long currentMemberId) {
        if (member.getRole() == MemberRole.ADMIN && nextRole != MemberRole.ADMIN && memberRepository.countByRole(MemberRole.ADMIN) <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "최소 한 명의 관리자 계정은 유지되어야 합니다.");
        }
        if (member.getId().equals(currentMemberId) && nextRole != MemberRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "현재 로그인한 관리자 계정의 권한은 해제할 수 없습니다.");
        }
    }

    private boolean hasActivity(Long memberId) {
        return boardPostRepository.existsByMemberId(memberId)
                || boardCommentRepository.existsByMemberId(memberId)
                || reviewRepository.existsByMemberId(memberId)
                || attemptRepository.existsByMemberId(memberId)
                || attemptProcessingJobRepository.existsByMemberId(memberId);
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이메일이 필요합니다.");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "이메일이 필요합니다.");
        }
        return normalized;
    }

    private String normalizeDisplayName(String displayName) {
        if (displayName == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "표시 이름이 필요합니다.");
        }
        String normalized = displayName.trim();
        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "표시 이름이 필요합니다.");
        }
        return normalized;
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null) {
            return null;
        }
        String normalized = keyword.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }
}
