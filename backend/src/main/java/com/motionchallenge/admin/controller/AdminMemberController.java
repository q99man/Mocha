package com.motionchallenge.admin.controller;

import com.motionchallenge.admin.dto.AdminMemberCreateRequest;
import com.motionchallenge.admin.dto.AdminMemberListResponse;
import com.motionchallenge.admin.dto.AdminMemberOverviewResponse;
import com.motionchallenge.admin.dto.AdminMemberSortOption;
import com.motionchallenge.admin.dto.AdminMemberSummaryResponse;
import com.motionchallenge.admin.dto.AdminMemberUpdateRequest;
import com.motionchallenge.admin.service.AdminMemberService;
import com.motionchallenge.member.entity.MemberAuthProvider;
import com.motionchallenge.member.entity.MemberRole;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/members")
public class AdminMemberController {

    private final AdminMemberService adminMemberService;

    public AdminMemberController(AdminMemberService adminMemberService) {
        this.adminMemberService = adminMemberService;
    }

    @GetMapping("/overview")
    public AdminMemberOverviewResponse getOverview() {
        return adminMemberService.getOverview();
    }

    @GetMapping
    public AdminMemberListResponse getMembers(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "8") int size,
            @RequestParam(required = false) MemberRole role,
            @RequestParam(required = false) MemberAuthProvider authProvider,
            @RequestParam(defaultValue = "NEWEST") AdminMemberSortOption sort,
            @RequestParam(required = false) String keyword) {
        return adminMemberService.getMembers(page, size, role, authProvider, sort, keyword);
    }

    @PostMapping
    public ResponseEntity<AdminMemberSummaryResponse> createMember(@Valid @RequestBody AdminMemberCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(adminMemberService.createMember(request));
    }

    @PatchMapping("/{memberId}")
    public AdminMemberSummaryResponse updateMember(
            @PathVariable Long memberId,
            @Valid @RequestBody AdminMemberUpdateRequest request) {
        return adminMemberService.updateMember(memberId, request);
    }

    @DeleteMapping("/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMember(@PathVariable Long memberId) {
        adminMemberService.deleteMember(memberId);
    }
}
