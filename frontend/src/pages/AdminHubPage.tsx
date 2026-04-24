import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';

import { AdminAssetsSection } from '../features/admin/AdminAssetsSection';
import { AdminChallengeEditorModal } from '../features/admin/AdminChallengeEditorModal';
import { AdminChallengesSection } from '../features/admin/AdminChallengesSection';
import { formatDifficulty, parseDifficulty } from '../features/challenges/difficulty';
import {
  createAdminMember,
  deleteAdminMember,
  deletePoseLandmarkerModel,
  getActivePoseLandmarkerAsset,
  getAdminMemberOverview,
  getAdminMembers,
  getPoseLandmarkerAssets,
  updateAdminMember,
  updatePoseLandmarkerModel,
  uploadPoseLandmarkerModel,
} from '../shared/api/adminApi';
import { getBoardOverview, getBoardPosts, removeBoardPost } from '../shared/api/boardApi';
import {
  analyzeChallengeReference,
  createChallenge,
  deleteChallenge,
  getAdminChallenges,
  updateChallenge,
  updateChallengeActive,
} from '../shared/api/challengeApi';
import {
  IconAdd,
  IconDelete,
  IconEdit,
  IconRefresh,
  IconSave,
  IconStatus,
  IconView,
} from '../shared/components/AdminIcons';
import { CompactFilterDropdown } from '../shared/components/CompactFilterDropdown';
import { CompactConfirmDialog } from '../shared/components/CompactConfirmDialog';
import { CompactToast } from '../shared/components/CompactToast';
import { Pagination } from '../shared/components/Pagination';
import { useAuth } from '../shared/auth/AuthProvider';
import type {
  AdminMemberCreateInput,
  AdminMemberListResponse,
  AdminMemberOverview,
  AdminMemberSummary,
  AdminMemberUpdateInput,
  ModelAsset,
} from '../shared/types/admin';
import type { BoardCategory, BoardOverview, BoardPostSourceType, BoardPostSummary } from '../shared/types/board';
import type { Challenge } from '../shared/types/challenge';

const initialChallengeForm = {
  title: '',
  description: '',
  category: '퍼포먼스',
  difficulty: '4',
  thumbnailUrl: '',
  guideVideoUrl: '',
  durationSec: '25',
};

const initialMemberForm: AdminMemberCreateInput = {
  email: '',
  displayName: '',
  password: '',
  role: 'USER',
};

type DashboardTab = 'challenges' | 'models' | 'members' | 'board';
type ChallengeStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type ChallengeSortOption = 'NEWEST' | 'OLDEST' | 'TITLE_ASC' | 'TITLE_DESC';
type MemberRoleFilter = 'ALL' | 'USER' | 'ADMIN';
type MemberAuthProviderFilter = 'ALL' | 'LOCAL' | 'GOOGLE' | 'KAKAO' | 'NAVER';
type MemberSortOption = 'NEWEST' | 'OLDEST' | 'NAME_ASC' | 'EMAIL_ASC' | 'PROVIDER_ASC';
type BoardCategoryFilter = 'ALL' | BoardCategory;
type BoardSourceFilter = 'ALL' | BoardPostSourceType;
type ConfirmDialogState =
  | { kind: 'NONE' }
  | { kind: 'DELETE_ASSET'; asset: ModelAsset }
  | { kind: 'DELETE_CHALLENGE'; challenge: Challenge }
  | { kind: 'DELETE_MEMBER'; member: AdminMemberSummary }
  | { kind: 'DELETE_POST'; post: BoardPostSummary };

const CHALLENGES_PER_PAGE = 10;
const ASSETS_PER_PAGE = 10;
const MEMBERS_PER_PAGE = 10;
const POSTS_PER_PAGE = 10;

const STATUS_FILTER_OPTIONS: Array<{ value: ChallengeStatusFilter; label: string }> = [
  { value: 'ALL', label: '전체' },
  { value: 'ACTIVE', label: '활성' },
  { value: 'INACTIVE', label: '비활성' },
];
const SORT_OPTIONS: Array<{ value: ChallengeSortOption; label: string }> = [
  { value: 'NEWEST', label: '최신순' },
  { value: 'OLDEST', label: '오래된순' },
  { value: 'TITLE_ASC', label: '제목 오름차순' },
  { value: 'TITLE_DESC', label: '제목 내림차순' },
];
const ADMIN_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: 'challenges', label: '챌린지관리' },
  { id: 'models', label: '모델관리' },
  { id: 'members', label: '회원관리' },
  { id: 'board', label: '게시판관리' },
];
const MEMBER_ROLE_OPTIONS: Array<{ value: MemberRoleFilter; label: string }> = [
  { value: 'ALL', label: '전체 권한' },
  { value: 'ADMIN', label: '관리자' },
  { value: 'USER', label: '회원' },
];
const MEMBER_AUTH_PROVIDER_OPTIONS: Array<{ value: MemberAuthProviderFilter; label: string }> = [
  { value: 'ALL', label: '전체 가입 방식' },
  { value: 'LOCAL', label: '로컬' },
  { value: 'KAKAO', label: '카카오' },
  { value: 'NAVER', label: '네이버' },
  { value: 'GOOGLE', label: '구글' },
];
const MEMBER_SORT_OPTIONS: Array<{ value: MemberSortOption; label: string }> = [
  { value: 'NEWEST', label: '최신순' },
  { value: 'OLDEST', label: '오래된순' },
  { value: 'NAME_ASC', label: '이름순' },
  { value: 'EMAIL_ASC', label: '이메일순' },
  { value: 'PROVIDER_ASC', label: '가입방식순' },
];
const MEMBER_FORM_ROLE_OPTIONS: Array<{ value: 'USER' | 'ADMIN'; label: string }> = [
  { value: 'USER', label: '회원' },
  { value: 'ADMIN', label: '관리자' },
];
const BOARD_CATEGORY_OPTIONS: Array<{ value: BoardCategoryFilter; label: string }> = [
  { value: 'ALL', label: '전체 분류' },
  { value: 'NOTICE', label: '공지' },
  { value: 'FREE', label: '자유' },
  { value: 'QNA', label: '질문' },
  { value: 'REVIEW', label: '후기' },
];
const BOARD_SOURCE_OPTIONS: Array<{ value: BoardSourceFilter; label: string }> = [
  { value: 'ALL', label: '전체 소스' },
  { value: 'GENERAL', label: '일반 글' },
  { value: 'REVIEW_SYNC', label: '후기 연동' },
];

export function AdminHubPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [activeAsset, setActiveAsset] = useState<ModelAsset | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [memberOverview, setMemberOverview] = useState<AdminMemberOverview | null>(null);
  const [boardOverview, setBoardOverview] = useState<BoardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedModelFile, setSelectedModelFile] = useState<File | null>(null);
  const [versionLabel, setVersionLabel] = useState('');
  const [assetVersionDrafts, setAssetVersionDrafts] = useState<Record<number, string>>({});
  const [deletingAssetId, setDeletingAssetId] = useState<number | null>(null);
  const [updatingAssetId, setUpdatingAssetId] = useState<number | null>(null);
  const [expandedAssetId, setExpandedAssetId] = useState<number | null>(null);
  const [assetPage, setAssetPage] = useState(1);

  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [challengeForm, setChallengeForm] = useState(initialChallengeForm);
  const [challengeDifficultyLevel, setChallengeDifficultyLevel] = useState('4');
  const [selectedReferenceVideo, setSelectedReferenceVideo] = useState<File | null>(null);
  const [challengeSubmitting, setChallengeSubmitting] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [challengeSuccess, setChallengeSuccess] = useState<string | null>(null);
  const [createdChallengeId, setCreatedChallengeId] = useState<number | null>(null);
  const [editingChallengeId, setEditingChallengeId] = useState<number | null>(null);
  const [challengeSearch, setChallengeSearch] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('ALL');
  const [activeStatusFilter, setActiveStatusFilter] = useState<ChallengeStatusFilter>('ALL');
  const [activeSort, setActiveSort] = useState<ChallengeSortOption>('NEWEST');
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [deletingChallengeId, setDeletingChallengeId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [challengePage, setChallengePage] = useState(1);
  const [expandedChallengeId, setExpandedChallengeId] = useState<number | null>(null);

  const [members, setMembers] = useState<AdminMemberSummary[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberKeyword, setMemberKeyword] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<MemberRoleFilter>('ALL');
  const [memberAuthProviderFilter, setMemberAuthProviderFilter] = useState<MemberAuthProviderFilter>('ALL');
  const [memberSort, setMemberSort] = useState<MemberSortOption>('NEWEST');
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotalCount, setMemberTotalCount] = useState(0);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [memberEditing, setMemberEditing] = useState<AdminMemberSummary | null>(null);
  const [memberForm, setMemberForm] = useState<AdminMemberCreateInput>(initialMemberForm);
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<number | null>(null);

  const [boardPosts, setBoardPosts] = useState<BoardPostSummary[]>([]);
  const [boardPostsLoading, setBoardPostsLoading] = useState(false);
  const [boardKeyword, setBoardKeyword] = useState('');
  const [boardCategoryFilter, setBoardCategoryFilter] = useState<BoardCategoryFilter>('ALL');
  const [boardSourceFilter, setBoardSourceFilter] = useState<BoardSourceFilter>('ALL');
  const [boardPage, setBoardPage] = useState(1);
  const [boardTotalCount, setBoardTotalCount] = useState(0);
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);
  const [boardSuccess, setBoardSuccess] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ kind: 'NONE' });

  const activeTab = resolveAdminTab(searchParams.get('tab'));

  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set('tab', 'challenges');
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    void loadAdminData(true);
  }, []);

  useEffect(() => {
    const body = document.body;
    const modalOpen = challengeModalOpen || memberModalOpen || confirmDialog.kind !== 'NONE';

    if (!modalOpen) {
      body.classList.remove('body--modal-open');
      return;
    }

    body.classList.add('body--modal-open');
    return () => {
      body.classList.remove('body--modal-open');
    };
  }, [challengeModalOpen, confirmDialog, memberModalOpen]);

  useEffect(() => {
    if (activeTab === 'members') {
      void loadMembers();
    }
  }, [activeTab, memberAuthProviderFilter, memberKeyword, memberPage, memberRoleFilter, memberSort]);

  useEffect(() => {
    if (activeTab === 'board') {
      void loadBoardPosts();
    }
  }, [activeTab, boardKeyword, boardCategoryFilter, boardSourceFilter, boardPage]);

  const activeChallenges = useMemo(() => challenges.filter((challenge) => challenge.isActive), [challenges]);
  const pendingAnalysisChallenges = useMemo(
    () =>
      challenges.filter(
        (challenge) =>
          challenge.referenceVideoUploaded &&
          !challenge.referenceMotionProfileReady &&
          challenge.referenceAnalysisStatus !== 'ANALYZING',
      ),
    [challenges],
  );
  const evaluationReadyChallenges = useMemo(
    () =>
      challenges.filter(
        (challenge) => challenge.isActive && challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady,
      ),
    [challenges],
  );
  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    challenges.forEach((challenge) => {
      if (challenge.category.trim()) {
        categories.add(challenge.category);
      }
    });
    return ['ALL', ...Array.from(categories).sort((left, right) => left.localeCompare(right, 'ko-KR'))];
  }, [challenges]);

  const filteredChallenges = useMemo(() => {
    const normalizedSearch = challengeSearch.trim().toLowerCase();
    return challenges
      .filter((challenge) => {
        const matchesCategory = activeCategoryFilter === 'ALL' || challenge.category === activeCategoryFilter;
        const matchesStatus =
          activeStatusFilter === 'ALL' ||
          (activeStatusFilter === 'ACTIVE' && challenge.isActive) ||
          (activeStatusFilter === 'INACTIVE' && !challenge.isActive);
        const matchesSearch =
          normalizedSearch.length === 0 ||
          challenge.title.toLowerCase().includes(normalizedSearch) ||
          challenge.description.toLowerCase().includes(normalizedSearch) ||
          challenge.category.toLowerCase().includes(normalizedSearch) ||
          String(challenge.id).includes(normalizedSearch);
        return matchesCategory && matchesStatus && matchesSearch;
      })
      .sort((left, right) => {
        switch (activeSort) {
          case 'OLDEST':
            return left.id - right.id;
          case 'TITLE_ASC':
            return left.title.localeCompare(right.title, 'ko-KR');
          case 'TITLE_DESC':
            return right.title.localeCompare(left.title, 'ko-KR');
          case 'NEWEST':
          default:
            return right.id - left.id;
        }
      });
  }, [activeCategoryFilter, activeSort, activeStatusFilter, challengeSearch, challenges]);

  const pagedChallenges = useMemo(() => {
    const startIndex = (challengePage - 1) * CHALLENGES_PER_PAGE;
    return filteredChallenges.slice(startIndex, startIndex + CHALLENGES_PER_PAGE);
  }, [challengePage, filteredChallenges]);

  const challengeTotalPages = Math.max(1, Math.ceil(filteredChallenges.length / CHALLENGES_PER_PAGE));
  const assetTotalPages = Math.max(1, Math.ceil(assets.length / ASSETS_PER_PAGE));
  const memberTotalPages = Math.max(1, Math.ceil(memberTotalCount / MEMBERS_PER_PAGE));
  const boardTotalPages = Math.max(1, Math.ceil(boardTotalCount / POSTS_PER_PAGE));

  const modelSummary = activeAsset ? `현재 활성 모델 ${activeAsset.originalFileName}` : '현재 활성 모델이 없습니다.';
  const challengeSummary = `활성 ${activeChallenges.length}개 · 평가 준비 ${evaluationReadyChallenges.length}개 · 분석 대기 ${pendingAnalysisChallenges.length}개`;

  const confirmBusy =
    (confirmDialog.kind === 'DELETE_ASSET' && deletingAssetId === confirmDialog.asset.id) ||
    (confirmDialog.kind === 'DELETE_CHALLENGE' && deletingChallengeId === confirmDialog.challenge.id) ||
    (confirmDialog.kind === 'DELETE_MEMBER' && deletingMemberId === confirmDialog.member.id) ||
    (confirmDialog.kind === 'DELETE_POST' && deletingPostId === confirmDialog.post.id);

  const modalTitle = editingChallengeId ? '챌린지 수정' : '챌린지 생성';
  const modalDescription = editingChallengeId
    ? '기본 정보를 수정하고 필요하면 레퍼런스 영상도 함께 교체합니다.'
    : '레퍼런스 영상을 등록해 새 챌린지를 생성합니다.';
  const modalReferenceLabel = selectedReferenceVideo
    ? selectedReferenceVideo.name
    : editingChallengeId
      ? '기존 레퍼런스 유지'
      : '영상 선택 필요';
  const modalDurationLabel = Number(challengeForm.durationSec) > 0 ? `${challengeForm.durationSec}초` : '길이 미입력';
  const modalGuideLabel = challengeForm.guideVideoUrl.trim() ? '가이드 연결됨' : '가이드 URL 없음';
  const modalThumbnailLabel = challengeForm.thumbnailUrl.trim() ? '썸네일 연결됨' : '썸네일 URL 없음';

  useEffect(() => {
    setChallengePage(1);
  }, [activeCategoryFilter, activeSort, activeStatusFilter, challengeSearch]);

  useEffect(() => {
    if (challengePage > challengeTotalPages) {
      setChallengePage(challengeTotalPages);
    }
  }, [challengePage, challengeTotalPages]);

  useEffect(() => {
    if (assetPage > assetTotalPages) {
      setAssetPage(assetTotalPages);
    }
  }, [assetPage, assetTotalPages]);

  useEffect(() => {
    setMemberPage(1);
  }, [memberAuthProviderFilter, memberKeyword, memberRoleFilter, memberSort]);

  useEffect(() => {
    if (memberPage > memberTotalPages) {
      setMemberPage(memberTotalPages);
    }
  }, [memberPage, memberTotalPages]);

  useEffect(() => {
    setBoardPage(1);
  }, [boardKeyword, boardCategoryFilter, boardSourceFilter]);

  useEffect(() => {
    if (boardPage > boardTotalPages) {
      setBoardPage(boardTotalPages);
    }
  }, [boardPage, boardTotalPages]);

  async function loadAdminData(initialLoad = false) {
    if (initialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);
    try {
      const [assetList, active, challengeList, nextMemberOverview, nextBoardOverview] = await Promise.all([
        getPoseLandmarkerAssets(),
        getActivePoseLandmarkerAsset().catch(() => null),
        getAdminChallenges(),
        getAdminMemberOverview(),
        getBoardOverview(),
      ]);
      setAssets(assetList);
      setActiveAsset(active);
      setChallenges(challengeList);
      setMemberOverview(nextMemberOverview);
      setBoardOverview(nextBoardOverview);
      setAssetVersionDrafts(
        Object.fromEntries(assetList.map((asset) => [asset.id, asset.versionLabel ?? ''])),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '운영 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadMembers() {
    setMembersLoading(true);
    setMemberError(null);
    try {
      const response: AdminMemberListResponse = await getAdminMembers({
        page: memberPage,
        size: MEMBERS_PER_PAGE,
        role: memberRoleFilter,
        authProvider: memberAuthProviderFilter,
        sort: memberSort,
        keyword: memberKeyword,
      });
      setMembers(response.items);
      setMemberTotalCount(response.totalCount);
    } catch (loadError) {
      setMemberError(loadError instanceof Error ? loadError.message : '회원 목록을 불러오지 못했습니다.');
      setMembers([]);
      setMemberTotalCount(0);
    } finally {
      setMembersLoading(false);
    }
  }

  async function loadBoardPosts(pageOverride = boardPage) {
    setBoardPostsLoading(true);
    setBoardError(null);
    try {
      const response = await getBoardPosts({
        page: pageOverride,
        size: POSTS_PER_PAGE,
        category: boardCategoryFilter,
        sourceType: boardSourceFilter,
        keyword: boardKeyword,
      });
      const nextTotalPages = Math.max(1, Math.ceil(response.totalCount / POSTS_PER_PAGE));
      if (pageOverride > nextTotalPages) {
        setBoardPosts([]);
        setBoardTotalCount(response.totalCount);
        setBoardPage(nextTotalPages);
        return;
      }
      setBoardPosts(response.items);
      setBoardTotalCount(response.totalCount);
    } catch (loadError) {
      setBoardError(loadError instanceof Error ? loadError.message : '게시글 목록을 불러오지 못했습니다.');
      setBoardPosts([]);
      setBoardTotalCount(0);
    } finally {
      setBoardPostsLoading(false);
    }
  }

  async function handleModelSubmit() {
    if (!selectedModelFile) {
      setUploadError('.task 모델 파일을 먼저 선택해 주세요.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const uploaded = await uploadPoseLandmarkerModel(selectedModelFile, versionLabel);
      setUploadSuccess(`모델 업로드 완료: ${uploaded.originalFileName}`);
      setSelectedModelFile(null);
      setVersionLabel('');
      await loadAdminData();
    } catch (submitError) {
      setUploadError(submitError instanceof Error ? submitError.message : '모델 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveAsset(asset: ModelAsset) {
    setUpdatingAssetId(asset.id);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      await updatePoseLandmarkerModel(asset.id, {
        versionLabel: assetVersionDrafts[asset.id] ?? '',
      });
      setUploadSuccess(`모델 정보 저장 완료: ${asset.originalFileName}`);
      await loadAdminData();
    } catch (updateError) {
      setUploadError(updateError instanceof Error ? updateError.message : '모델 정보를 저장하지 못했습니다.');
    } finally {
      setUpdatingAssetId(null);
    }
  }

  async function handleActivateAsset(asset: ModelAsset) {
    setUpdatingAssetId(asset.id);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      await updatePoseLandmarkerModel(asset.id, { active: true });
      setUploadSuccess(`활성 모델 변경 완료: ${asset.originalFileName}`);
      await loadAdminData();
    } catch (updateError) {
      setUploadError(updateError instanceof Error ? updateError.message : '활성 모델 변경에 실패했습니다.');
    } finally {
      setUpdatingAssetId(null);
    }
  }

  function handleAssetRowToggle(assetId: number) {
    setExpandedAssetId((current) => (current === assetId ? null : assetId));
  }

  function handleChallengeRowToggle(challengeId: number) {
    setExpandedChallengeId((current) => (current === challengeId ? null : challengeId));
  }

  function resetChallengeFilters() {
    setChallengeSearch('');
    setActiveCategoryFilter('ALL');
    setActiveStatusFilter('ALL');
    setActiveSort('NEWEST');
  }

  async function handleDeleteModelAsset(asset: ModelAsset) {
    setDeletingAssetId(asset.id);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      await deletePoseLandmarkerModel(asset.id);
      setUploadSuccess(`모델 삭제 완료: ${asset.originalFileName}`);
      if (expandedAssetId === asset.id) {
        setExpandedAssetId(null);
      }
      await loadAdminData();
      return true;
    } catch (deleteError) {
      setUploadError(deleteError instanceof Error ? deleteError.message : '모델 삭제에 실패했습니다.');
      return false;
    } finally {
      setDeletingAssetId(null);
    }
  }

  function openCreateChallengeModal() {
    setEditingChallengeId(null);
    setChallengeForm(initialChallengeForm);
    setChallengeDifficultyLevel('4');
    setSelectedReferenceVideo(null);
    setChallengeError(null);
    setChallengeModalOpen(true);
  }

  function handleEditChallenge(challenge: Challenge) {
    const parsedDifficulty = parseDifficulty(challenge.difficulty);
    setEditingChallengeId(challenge.id);
    setChallengeForm({
      title: challenge.title,
      description: challenge.description,
      category: challenge.category,
      difficulty: challenge.difficulty,
      thumbnailUrl: challenge.thumbnailUrl ?? '',
      guideVideoUrl: challenge.guideVideoUrl ?? '',
      durationSec: String(challenge.durationSec),
    });
    setChallengeDifficultyLevel(String(parsedDifficulty));
    setSelectedReferenceVideo(null);
    setChallengeError(null);
    setChallengeModalOpen(true);
  }

  function closeChallengeModal() {
    if (challengeSubmitting) {
      return;
    }
    setChallengeModalOpen(false);
    setEditingChallengeId(null);
    setChallengeForm(initialChallengeForm);
    setChallengeDifficultyLevel('4');
    setSelectedReferenceVideo(null);
    setChallengeError(null);
  }

  async function handleChallengeSubmit() {
    if (!editingChallengeId && !selectedReferenceVideo) {
      setChallengeError('레퍼런스 영상을 먼저 선택해 주세요.');
      return;
    }
    setChallengeSubmitting(true);
    setChallengeError(null);
    setChallengeSuccess(null);
    setAnalysisMessage(null);
    setAnalysisError(null);
    try {
      const payload = {
        title: challengeForm.title,
        description: challengeForm.description,
        category: challengeForm.category,
        difficulty: String(parseDifficulty(challengeDifficultyLevel)),
        thumbnailUrl: challengeForm.thumbnailUrl,
        guideVideoUrl: challengeForm.guideVideoUrl,
        durationSec: Number(challengeForm.durationSec),
      };
      if (editingChallengeId) {
        const updated = await updateChallenge(editingChallengeId, { ...payload, referenceVideo: selectedReferenceVideo });
        setChallengeSuccess(`챌린지 수정 완료: ${updated.title} (#${updated.id})`);
      } else {
        const created = await createChallenge({ ...payload, referenceVideo: selectedReferenceVideo! });
        setCreatedChallengeId(created.id);
        setChallengeSuccess(`챌린지 생성 완료: ${created.title} (#${created.id})`);
      }
      await loadAdminData();
      closeChallengeModal();
    } catch (submitError) {
      setChallengeError(
        submitError instanceof Error
          ? submitError.message
          : editingChallengeId
            ? '챌린지 수정에 실패했습니다.'
            : '챌린지 생성에 실패했습니다.',
      );
    } finally {
      setChallengeSubmitting(false);
    }
  }

  async function handleAnalyzeReference(challengeId: number) {
    setAnalyzingId(challengeId);
    setAnalysisMessage(null);
    setAnalysisError(null);
    try {
      const result = await analyzeChallengeReference(challengeId);
      setAnalysisMessage(`레퍼런스 분석 완료: #${result.challengeId} / ${result.analyzerName ?? '분석기 정보 없음'}`);
      await loadAdminData();
    } catch (submitError) {
      setAnalysisError(submitError instanceof Error ? submitError.message : '레퍼런스 분석 실행에 실패했습니다.');
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleDeleteChallenge(challenge: Challenge) {
    setDeletingChallengeId(challenge.id);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setChallengeSuccess(null);
    try {
      await deleteChallenge(challenge.id);
      setAnalysisMessage(`챌린지 삭제 완료: ${challenge.title} (#${challenge.id})`);
      if (createdChallengeId === challenge.id) {
        setCreatedChallengeId(null);
      }
      if (expandedChallengeId === challenge.id) {
        setExpandedChallengeId(null);
      }
      await loadAdminData();
      return true;
    } catch (deleteError) {
      setAnalysisError(deleteError instanceof Error ? deleteError.message : '챌린지 삭제에 실패했습니다.');
      return false;
    } finally {
      setDeletingChallengeId(null);
    }
  }

  async function handleToggleChallengeActive(challenge: Challenge) {
    setTogglingId(challenge.id);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setChallengeSuccess(null);
    try {
      const updated = await updateChallengeActive(challenge.id, !challenge.isActive);
      setAnalysisMessage(`챌린지 상태 변경 완료: ${updated.title} (#${updated.id}) / ${updated.isActive ? '활성' : '비활성'}`);
      await loadAdminData();
    } catch (toggleError) {
      setAnalysisError(toggleError instanceof Error ? toggleError.message : '챌린지 상태 변경에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  }

  function openCreateMemberModal() {
    setMemberEditing(null);
    setMemberForm(initialMemberForm);
    setMemberError(null);
    setMemberModalOpen(true);
  }

  function openEditMemberModal(member: AdminMemberSummary) {
    setMemberEditing(member);
    setMemberForm({
      email: member.email,
      displayName: member.displayName,
      password: '',
      role: member.role,
    });
    setMemberError(null);
    setMemberModalOpen(true);
  }

  function closeMemberModal() {
    if (memberSubmitting) {
      return;
    }
    setMemberModalOpen(false);
    setMemberEditing(null);
    setMemberForm(initialMemberForm);
    setMemberError(null);
  }

  async function handleMemberSubmit() {
    setMemberSubmitting(true);
    setMemberError(null);
    setMemberSuccess(null);
    try {
      if (memberEditing) {
        const updateInput: AdminMemberUpdateInput = {
          email: memberForm.email,
          displayName: memberForm.displayName,
          role: memberForm.role,
          ...(memberForm.password.trim() ? { password: memberForm.password } : {}),
        };
        await updateAdminMember(memberEditing.id, updateInput);
        setMemberSuccess(`회원 정보 수정 완료: ${memberForm.displayName}`);
      } else {
        await createAdminMember(memberForm);
        setMemberSuccess(`회원 생성 완료: ${memberForm.displayName}`);
      }
      closeMemberModal();
      await Promise.all([loadAdminData(), loadMembers()]);
    } catch (submitError) {
      setMemberError(submitError instanceof Error ? submitError.message : '회원 정보를 저장하지 못했습니다.');
    } finally {
      setMemberSubmitting(false);
    }
  }

  async function handleDeleteMember(member: AdminMemberSummary) {
    setDeletingMemberId(member.id);
    setMemberError(null);
    setMemberSuccess(null);
    try {
      await deleteAdminMember(member.id);
      setMemberSuccess(`회원 삭제 완료: ${member.displayName}`);
      await Promise.all([loadAdminData(), loadMembers()]);
      return true;
    } catch (deleteError) {
      setMemberError(deleteError instanceof Error ? deleteError.message : '회원 삭제에 실패했습니다.');
      return false;
    } finally {
      setDeletingMemberId(null);
    }
  }

  async function handleDeleteBoardPost(post: BoardPostSummary) {
    setDeletingPostId(post.id);
    setBoardError(null);
    setBoardSuccess(null);
    try {
      await removeBoardPost(post.id);
      setBoardSuccess(`게시글 삭제 완료: ${post.title}`);
      const nextTotalCount = Math.max(0, boardTotalCount - 1);
      const nextPage = Math.min(boardPage, Math.max(1, Math.ceil(nextTotalCount / POSTS_PER_PAGE)));
      if (nextPage !== boardPage) {
        setBoardPage(nextPage);
      }
      await Promise.all([loadAdminData(), loadBoardPosts(nextPage)]);
      return true;
    } catch (deleteError) {
      setBoardError(deleteError instanceof Error ? deleteError.message : '게시글 삭제에 실패했습니다.');
      return false;
    } finally {
      setDeletingPostId(null);
    }
  }

  async function handleConfirmDialogSubmit() {
    if (confirmDialog.kind === 'DELETE_ASSET') {
      const success = await handleDeleteModelAsset(confirmDialog.asset);
      if (success) {
        setConfirmDialog({ kind: 'NONE' });
      }
      return;
    }

    if (confirmDialog.kind === 'DELETE_CHALLENGE') {
      const success = await handleDeleteChallenge(confirmDialog.challenge);
      if (success) {
        setConfirmDialog({ kind: 'NONE' });
      }
      return;
    }

    if (confirmDialog.kind === 'DELETE_MEMBER') {
      const success = await handleDeleteMember(confirmDialog.member);
      if (success) {
        setConfirmDialog({ kind: 'NONE' });
      }
      return;
    }

    if (confirmDialog.kind === 'DELETE_POST') {
      const success = await handleDeleteBoardPost(confirmDialog.post);
      if (success) {
        setConfirmDialog({ kind: 'NONE' });
      }
    }
  }

  function handleTabChange(tab: DashboardTab) {
    if (tab === activeTab) {
      return;
    }

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('tab', tab);
        return next;
      },
    );
  }

  const activeMessage = uploadSuccess || challengeSuccess || analysisMessage || memberSuccess || boardSuccess;
  const activeError = uploadError || analysisError || error || memberError || boardError;
  const clearAllMessages = () => {
    setUploadSuccess(null);
    setChallengeSuccess(null);
    setAnalysisMessage(null);
    setMemberSuccess(null);
    setBoardSuccess(null);
    setUploadError(null);
    setAnalysisError(null);
    setError(null);
    setMemberError(null);
    setBoardError(null);
  };

  return (
    <>
      <div className="glass-page board-page-compact">
        <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell admin-shell-compact">
          <div className="board-detail-compact__toolbar mypage-compact-header">
            <div>
              <h2 className="board-classic-title">운영 허브</h2>
            </div>

            <div className="inline-actions">
              <button className="button-link button-link--secondary button-link--compact admin-action-button" type="button" onClick={() => void loadAdminData()}>
                <IconRefresh />
                <span>{refreshing ? '새로고침 중...' : '새로고침'}</span>
              </button>
              {activeTab === 'challenges' ? (
                <button className="button-link button-link--compact admin-action-button" type="button" onClick={openCreateChallengeModal}>
                  <IconAdd />
                  <span>챌린지 등록</span>
                </button>
              ) : null}
              {activeTab === 'members' ? (
                <button className="button-link button-link--compact admin-action-button" type="button" onClick={openCreateMemberModal}>
                  <IconAdd />
                  <span>회원 생성</span>
                </button>
              ) : null}
              {activeTab === 'board' ? (
                <Link className="button-link button-link--compact admin-action-button" to="/board/new">
                  <IconEdit />
                  <span>글쓰기</span>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="board-compact-toolbar admin-shell-compact__toolbar">
            <div className="board-compact-filter-tabs admin-shell-compact__tabs" role="tablist" aria-label="운영 탭">
              {ADMIN_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`board-compact-tab${activeTab === tab.id ? ' is-active' : ''}`}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="board-compact-search admin-shell-compact__summary">
              <span className="board-compact-summary">관리자 {user?.displayName ?? '세션'} · 회원 {memberOverview?.totalCount ?? 0}명</span>
              <span className="board-compact-summary">게시글 {boardOverview?.totalCount ?? 0}개 · 활성 챌린지 {activeChallenges.length}개</span>
              <span className="board-compact-summary">평가 준비 {evaluationReadyChallenges.length}개 · 활성 모델 {activeAsset ? 1 : 0}</span>
            </div>
          </div>

          <CompactToast
            message={activeError || activeMessage}
            type={activeError ? 'error' : 'success'}
            onClose={clearAllMessages}
          />

          {loading ? (
            <div className="board-compact-empty">
              <strong>운영 데이터를 불러오는 중입니다.</strong>
              <p>허브 탭을 준비하고 있습니다.</p>
            </div>
          ) : null}

          {!loading && activeTab === 'challenges' ? (
            <AdminChallengesSection
              loading={loading}
              filteredChallenges={filteredChallenges}
              pagedChallenges={pagedChallenges}
              categoryOptions={categoryOptions}
              challengeSearch={challengeSearch}
              activeCategoryFilter={activeCategoryFilter}
              activeStatusFilter={activeStatusFilter}
              activeSort={activeSort}
              challengePage={challengePage}
              challengeTotalPages={challengeTotalPages}
              expandedChallengeId={expandedChallengeId}
              activeAssetReady={Boolean(activeAsset)}
              analyzingId={analyzingId}
              deletingId={deletingChallengeId}
              togglingId={togglingId}
              challengeSummary={challengeSummary}
              statusFilterOptions={STATUS_FILTER_OPTIONS}
              sortOptions={SORT_OPTIONS}
              setChallengeSearch={setChallengeSearch}
              onSelectCategoryFilter={setActiveCategoryFilter}
              onSelectStatusFilter={setActiveStatusFilter}
              onSelectSort={setActiveSort}
              onResetFilters={resetChallengeFilters}
              onToggleChallengeRow={handleChallengeRowToggle}
              onEditChallenge={handleEditChallenge}
              onToggleChallengeActive={handleToggleChallengeActive}
              onAnalyzeReference={handleAnalyzeReference}
              onConfirmDeleteChallenge={(challenge) => setConfirmDialog({ kind: 'DELETE_CHALLENGE', challenge })}
              onChallengePageChange={setChallengePage}
              formatDifficulty={formatDifficulty}
              formatReferenceStatus={formatReferenceStatus}
              formatDateTimeFull={formatDateTimeFull}
            />
          ) : null}

          {!loading && activeTab === 'models' ? (
            <AdminAssetsSection
              loading={loading}
              assets={assets}
              activeAsset={activeAsset}
              modelSummary={modelSummary}
              selectedModelFile={selectedModelFile}
              versionLabel={versionLabel}
              uploading={uploading}
              deletingAssetId={deletingAssetId}
              updatingAssetId={updatingAssetId}
              expandedAssetId={expandedAssetId}
              assetPage={assetPage}
              assetTotalPages={assetTotalPages}
              assetVersionDrafts={assetVersionDrafts}
              setVersionLabel={setVersionLabel}
              onSelectModelFile={(file) => {
                setSelectedModelFile(file);
                setUploadError(null);
                setUploadSuccess(null);
              }}
              onSubmitModel={handleModelSubmit}
              onToggleAssetRow={handleAssetRowToggle}
              onConfirmDeleteAsset={(asset) => setConfirmDialog({ kind: 'DELETE_ASSET', asset })}
              onChangeAssetVersionDraft={(assetId, value) =>
                setAssetVersionDrafts((current) => ({ ...current, [assetId]: value }))
              }
              onSaveAsset={handleSaveAsset}
              onActivateAsset={handleActivateAsset}
              onSelectActiveAsset={handleActivateAsset}
              onAssetPageChange={setAssetPage}
              buildActiveDescription={buildActiveDescription}
              formatFileSize={formatFileSize}
              formatDateTime={formatDateTime}
              formatDateTimeFull={formatDateTimeFull}
            />
          ) : null}

          {!loading && activeTab === 'members' ? (
            <section className="admin-hub-compact__section admin-shell-compact__section">
              <div className="board-detail-compact__toolbar admin-hub-compact__section-header">
                <div>
                  <h3 className="glass-section-title">회원 관리</h3>
                </div>
                <div className="board-detail-compact__meta">
                  <span className="board-classic-badge">{memberOverview?.totalCount ?? 0}명</span>
                  <span className="board-classic-badge is-pinned">관리자 {memberOverview?.adminCount ?? 0}명</span>
                  <span className="board-classic-badge">회원 {memberOverview?.userCount ?? 0}명</span>
                </div>
              </div>

              <div className="admin-hub-compact__filters admin-shell-compact__filters">
                <label className="mypage-inline-field admin-hub-compact__search-field">
                  <span>검색</span>
                  <div className="admin-hub-compact__search-input-wrap">
                    <input
                      type="text"
                      value={memberKeyword}
                      onChange={(event) => setMemberKeyword(event.target.value)}
                      placeholder="이메일, 표시 이름"
                    />
                    {memberKeyword ||
                    memberRoleFilter !== 'ALL' ||
                    memberAuthProviderFilter !== 'ALL' ||
                    memberSort !== 'NEWEST' ? (
                      <button
                        className="admin-hub-compact__search-clear"
                        type="button"
                        aria-label="회원 필터 초기화"
                        onClick={() => {
                          setMemberKeyword('');
                          setMemberRoleFilter('ALL');
                          setMemberAuthProviderFilter('ALL');
                          setMemberSort('NEWEST');
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </label>
                <CompactFilterDropdown
                  className="mypage-inline-field admin-hub-compact__filter-select"
                  label="권한"
                  value={memberRoleFilter}
                  options={MEMBER_ROLE_OPTIONS}
                  ariaLabel="회원 권한 필터"
                  onChange={setMemberRoleFilter}
                />
                <CompactFilterDropdown
                  className="mypage-inline-field admin-hub-compact__filter-select"
                  label="가입 방식"
                  value={memberAuthProviderFilter}
                  options={MEMBER_AUTH_PROVIDER_OPTIONS}
                  ariaLabel="회원 가입 방식 필터"
                  onChange={setMemberAuthProviderFilter}
                />
                <CompactFilterDropdown
                  className="mypage-inline-field admin-hub-compact__filter-select"
                  label="정렬"
                  value={memberSort}
                  options={MEMBER_SORT_OPTIONS}
                  ariaLabel="회원 정렬"
                  onChange={setMemberSort}
                />
              </div>

              {membersLoading ? (
                <div className="board-compact-empty">
                  <strong>회원 목록을 불러오는 중입니다.</strong>
                </div>
              ) : (
                <div className="admin-hub-compact-table">
                  <div className="admin-hub-compact-table__head admin-hub-compact-table__head--members" role="presentation">
                    <span>권한</span>
                    <span>회원</span>
                    <span>이메일</span>
                    <span>가입 방식</span>
                    <span>상태</span>
                    <span>관리</span>
                  </div>

                  <div className="admin-hub-compact-table__body">
                    {members.length === 0 ? (
                      <div className="board-compact-empty">
                        <strong>조건에 맞는 회원이 없습니다.</strong>
                      </div>
                    ) : (
                      members.map((member) => (
                        <article className="admin-hub-compact-row admin-hub-compact-row--members" key={member.id}>
                          <div className="admin-hub-compact-row__status">
                            <span className={`board-classic-badge ${member.role === 'ADMIN' ? 'is-warning' : 'is-info'}`}>
                              {member.role === 'ADMIN' ? '관리자' : '회원'}
                            </span>
                          </div>
                          <div className="admin-hub-compact-row__title">
                            <strong>{member.displayName}</strong>
                            <span>
                              회원 #{member.id} · 가입 {formatDateTime(member.createdAt)}
                            </span>
                          </div>
                          <div className="admin-hub-compact-row__meta">{member.email}</div>
                          <div className="admin-hub-compact-row__date">
                            <span className={`admin-auth-provider-badge admin-auth-provider-badge--${member.authProvider.toLowerCase()}`}>
                              {formatAuthProvider(member.authProvider)}
                            </span>
                          </div>
                          <div className="admin-hub-compact-row__metric">
                            {member.self ? '현재 계정' : member.hasActivity ? '이력 있음' : '삭제 가능'}
                          </div>
                          <div className="admin-hub-compact-row__actions admin-action-group admin-action-group--row">
                            <button
                              className="button-link button-link--secondary admin-hub-compact__action-btn admin-action-button"
                              type="button"
                              onClick={() => openEditMemberModal(member)}
                            >
                              <IconEdit />
                              <span>수정</span>
                            </button>
                            <button
                              className="button-link button-link--secondary admin-hub-compact__action-btn admin-action-button admin-hub-compact__action-btn--danger"
                              type="button"
                              disabled={!member.canDelete}
                              onClick={() => setConfirmDialog({ kind: 'DELETE_MEMBER', member })}
                            >
                              <IconDelete />
                              <span>삭제</span>
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              )}

              <Pagination currentPage={memberPage} totalPages={memberTotalPages} onPageChange={setMemberPage} />
            </section>
          ) : null}

          {!loading && activeTab === 'board' ? (
            <section className="admin-hub-compact__section admin-shell-compact__section">
              <div className="board-detail-compact__toolbar admin-hub-compact__section-header">
                <div>
                  <h3 className="glass-section-title">게시판 관리</h3>
                </div>
                <div className="board-detail-compact__meta">
                  <span className="board-classic-badge">전체 {boardOverview?.totalCount ?? 0}</span>
                  <span className="board-classic-badge is-warning">공지 {boardOverview?.noticeCount ?? 0}</span>
                  <span className="board-classic-badge is-info">자유 {boardOverview?.freeCount ?? 0}</span>
                  <span className="board-classic-badge is-danger">질문 {boardOverview?.qnaCount ?? 0}</span>
                  <span className="board-classic-badge is-success">후기 {boardOverview?.reviewCount ?? 0}</span>
                </div>
              </div>

              <div className="admin-hub-compact__filters admin-shell-compact__filters admin-shell-compact__filters--board">
                <label className="mypage-inline-field admin-hub-compact__search-field">
                  <span>검색</span>
                  <div className="admin-hub-compact__search-input-wrap">
                    <input
                      type="text"
                      value={boardKeyword}
                      onChange={(event) => setBoardKeyword(event.target.value)}
                      placeholder="제목, 내용, 챌린지"
                    />
                    {boardKeyword || boardCategoryFilter !== 'ALL' || boardSourceFilter !== 'ALL' ? (
                      <button
                        className="admin-hub-compact__search-clear"
                        type="button"
                        aria-label="게시판 필터 초기화"
                        onClick={() => {
                          setBoardKeyword('');
                          setBoardCategoryFilter('ALL');
                          setBoardSourceFilter('ALL');
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </label>
                <CompactFilterDropdown
                  className="mypage-inline-field admin-hub-compact__filter-select"
                  label="분류"
                  value={boardCategoryFilter}
                  options={BOARD_CATEGORY_OPTIONS}
                  ariaLabel="게시판 분류 필터"
                  onChange={setBoardCategoryFilter}
                />
                <CompactFilterDropdown
                  className="mypage-inline-field admin-hub-compact__filter-select"
                  label="소스"
                  value={boardSourceFilter}
                  options={BOARD_SOURCE_OPTIONS}
                  ariaLabel="게시판 소스 필터"
                  onChange={setBoardSourceFilter}
                />
              </div>

              {boardPostsLoading ? (
                <div className="board-compact-empty">
                  <strong>게시글 목록을 불러오는 중입니다.</strong>
                </div>
              ) : (
                <div className="admin-hub-compact-table">
                  <div className="admin-hub-compact-table__head admin-hub-compact-table__head--posts" role="presentation">
                    <span>분류</span>
                    <span>게시글</span>
                    <span>작성자</span>
                    <span>상태</span>
                    <span>관리</span>
                  </div>

                  <div className="admin-hub-compact-table__body">
                    {boardPosts.length === 0 ? (
                      <div className="board-compact-empty">
                        <strong>조건에 맞는 게시글이 없습니다.</strong>
                      </div>
                    ) : (
                      boardPosts.map((post) => {
                        const editable = post.sourceType === 'GENERAL';
                        return (
                          <article className="admin-hub-compact-row admin-hub-compact-row--posts" key={post.id}>
                            <div className="admin-hub-compact-row__status">
                              <span className={`board-classic-badge ${getCategoryBadgeClass(post)}`}>
                                {post.pinned ? '고정' : toBoardCategoryLabel(post.category)}
                              </span>
                            </div>
                            <div className="admin-hub-compact-row__title">
                              <strong>{post.title}</strong>
                              <span>
                                댓글 {post.commentCount} · 조회 {post.viewCount}
                              </span>
                            </div>
                            <div className="admin-hub-compact-row__meta">{post.authorDisplayName}</div>
                            <div className="admin-hub-compact-row__metric">
                              {editable ? '수동 관리' : '후기 연동'}
                            </div>
                            <div className="admin-hub-compact-row__actions admin-action-group admin-action-group--row">
                              <Link className="button-link button-link--secondary admin-hub-compact__action-btn admin-action-button" to={`/board/${post.id}`}>
                                <IconView />
                                <span>보기</span>
                              </Link>
                              {editable ? (
                                <Link className="button-link button-link--secondary admin-hub-compact__action-btn admin-action-button" to={`/board/${post.id}/edit`}>
                                  <IconEdit />
                                  <span>수정</span>
                                </Link>
                              ) : null}
                              <button
                                className="button-link button-link--secondary admin-hub-compact__action-btn admin-action-button admin-hub-compact__action-btn--danger"
                                type="button"
                                onClick={() => setConfirmDialog({ kind: 'DELETE_POST', post })}
                              >
                                <IconDelete />
                                <span>삭제</span>
                              </button>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <Pagination currentPage={boardPage} totalPages={boardTotalPages} onPageChange={setBoardPage} />
            </section>
          ) : null}
        </section>
      </div>

      <CompactConfirmDialog
        open={confirmDialog.kind !== 'NONE'}
        title={
          confirmDialog.kind === 'DELETE_ASSET'
            ? '모델 삭제'
            : confirmDialog.kind === 'DELETE_CHALLENGE'
              ? '챌린지 삭제'
              : confirmDialog.kind === 'DELETE_MEMBER'
                ? '회원 삭제'
                : confirmDialog.kind === 'DELETE_POST'
                  ? '게시글 삭제'
                  : ''
        }
        description={
          confirmDialog.kind === 'DELETE_ASSET'
            ? `"${confirmDialog.asset.originalFileName}" 모델을 삭제합니다. 활성 모델이라면 상태를 정리하고 다른 최신 모델이 자동으로 활성화될 수 있습니다.`
            : confirmDialog.kind === 'DELETE_CHALLENGE'
              ? `"${confirmDialog.challenge.title}" 챌린지를 삭제합니다. 연결된 시도 기록과 업로드 파일도 함께 정리됩니다.`
              : confirmDialog.kind === 'DELETE_MEMBER'
                ? `"${confirmDialog.member.displayName}" 회원을 삭제합니다. 활동 이력이 있는 계정은 삭제할 수 없습니다.`
                : confirmDialog.kind === 'DELETE_POST'
                  ? `"${confirmDialog.post.title}" 게시글을 삭제합니다. 댓글도 함께 정리됩니다.`
                  : ''
        }
        confirmLabel="삭제"
        cancelLabel="취소"
        tone="danger"
        busy={confirmBusy}
        onConfirm={() => void handleConfirmDialogSubmit()}
        onCancel={() => {
          if (!confirmBusy) {
            setConfirmDialog({ kind: 'NONE' });
          }
        }}
      />

      <AdminChallengeEditorModal
        open={challengeModalOpen}
        editingChallengeId={editingChallengeId}
        challengeSubmitting={challengeSubmitting}
        challengeForm={challengeForm}
        challengeDifficultyLevel={challengeDifficultyLevel}
        selectedReferenceVideo={selectedReferenceVideo}
        challengeError={challengeError}
        modalTitle={modalTitle}
        modalDescription={modalDescription}
        modalDurationLabel={modalDurationLabel}
        modalGuideLabel={modalGuideLabel}
        modalThumbnailLabel={modalThumbnailLabel}
        modalReferenceLabel={modalReferenceLabel}
        onClose={closeChallengeModal}
        onSubmit={handleChallengeSubmit}
        onSetChallengeForm={(updater) => setChallengeForm((current) => updater(current))}
        onSetDifficultyLevel={setChallengeDifficultyLevel}
        onSelectReferenceVideo={(file) => {
          setSelectedReferenceVideo(file);
          setChallengeError(null);
        }}
      />

      <AdminMemberEditorModal
        open={memberModalOpen}
        editing={memberEditing}
        memberForm={memberForm}
        memberSubmitting={memberSubmitting}
        memberError={memberError}
        onClose={closeMemberModal}
        onSubmit={handleMemberSubmit}
        onSetMemberForm={setMemberForm}
      />
    </>
  );
}

function AdminMemberEditorModal({
  open,
  editing,
  memberForm,
  memberSubmitting,
  memberError,
  onClose,
  onSubmit,
  onSetMemberForm,
}: {
  open: boolean;
  editing: AdminMemberSummary | null;
  memberForm: AdminMemberCreateInput;
  memberSubmitting: boolean;
  memberError: string | null;
  onClose: () => void;
  onSubmit: () => void;
  onSetMemberForm: Dispatch<SetStateAction<AdminMemberCreateInput>>;
}) {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="glass-modal" role="dialog" aria-modal="true" aria-labelledby="member-modal-title">
      <div className="glass-modal__backdrop" onClick={onClose} />
      <div className="glass-modal__panel admin-hub-compact__modal-panel">
        <form
          className="glass-panel glass-form admin-hub-compact__modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="glass-toolbar admin-hub-compact__modal-header">
            <div>
              <h3 className="glass-section-title" id="member-modal-title">
                {editing ? '회원 수정' : '회원 생성'}
              </h3>
              <p className="glass-toolbar__note">{editing ? '계정 정보와 권한을 수정합니다.' : '운영용 계정을 직접 생성합니다.'}</p>
            </div>
            <button
              className="button-link button-link--secondary admin-hub-compact__modal-btn"
              type="button"
              onClick={onClose}
              disabled={memberSubmitting}
            >
              닫기
            </button>
          </div>

          <div className="admin-hub-compact__modal-grid">
            <label className="glass-field admin-hub-compact__modal-field admin-hub-compact__modal-field--full">
              <span>이메일</span>
              <input
                type="email"
                value={memberForm.email}
                onChange={(event) => onSetMemberForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="member@example.com"
              />
            </label>
            <label className="glass-field admin-hub-compact__modal-field">
              <span>표시 이름</span>
              <input
                type="text"
                value={memberForm.displayName}
                onChange={(event) => onSetMemberForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="운영 계정 이름"
              />
            </label>
            <CompactFilterDropdown
              className="admin-hub-compact__modal-dropdown admin-hub-compact__modal-field admin-hub-compact__modal-field--dropdown"
              label="권한"
              value={memberForm.role}
              options={MEMBER_FORM_ROLE_OPTIONS}
              ariaLabel="회원 권한 선택"
              onChange={(value) => onSetMemberForm((current) => ({ ...current, role: value }))}
            />
            <label className="glass-field admin-hub-compact__modal-field admin-hub-compact__modal-field--full">
              <span>{editing ? '새 비밀번호(선택)' : '비밀번호'}</span>
              <input
                type="password"
                value={memberForm.password}
                onChange={(event) => onSetMemberForm((current) => ({ ...current, password: event.target.value }))}
                placeholder={editing ? '변경이 필요할 때만 입력' : '8자 이상'}
              />
            </label>
          </div>

          <div className="inline-actions admin-hub-compact__modal-actions">
            {/* memberEditing was not defined; using !!editing instead */}
            {(() => {
              const memberEditing = !!editing;
              return (
                <button className="button-link admin-hub-compact__modal-btn admin-action-button" type="submit" disabled={memberSubmitting}>
                  {memberEditing ? <IconSave /> : <IconAdd />}
                  <span>{memberSubmitting ? (memberEditing ? '수정 중...' : '생성 중...') : memberEditing ? '수정 저장' : '회원 생성'}</span>
                </button>
              );
            })()}
            <button
              className="button-link button-link--secondary admin-hub-compact__modal-btn"
              type="button"
              onClick={onClose}
              disabled={memberSubmitting}
            >
              취소
            </button>
          </div>

          {memberError ? <p className="review-composer__message review-composer__message--error">{memberError}</p> : null}
        </form>
      </div>
    </div>,
    document.body,
  );
}

function buildActiveDescription(asset: ModelAsset) {
  return `활성 모델: ${asset.originalFileName} · ${asset.versionLabel ?? '라벨 없음'}`;
}

function formatReferenceStatus(status: string) {
  switch (status) {
    case 'COMPLETED':
      return '완료';
    case 'ANALYZING':
      return '분석 중';
    case 'FAILED':
      return '실패';
    default:
      return '대기';
  }
}

function resolveAdminTab(value: string | null): DashboardTab {
  if (value === 'models' || value === 'members' || value === 'board') {
    return value;
  }
  return 'challenges';
}

function formatAuthProvider(value: 'LOCAL' | 'GOOGLE' | 'KAKAO' | 'NAVER') {
  switch (value) {
    case 'GOOGLE':
      return '구글';
    case 'KAKAO':
      return '카카오';
    case 'NAVER':
      return '네이버';
    case 'LOCAL':
    default:
      return '로컬';
  }
}

function toBoardCategoryLabel(category: BoardPostSummary['category']) {
  switch (category) {
    case 'NOTICE':
      return '공지';
    case 'FREE':
      return '자유';
    case 'QNA':
      return '질문';
    case 'REVIEW':
      return '후기';
    default:
      return category;
  }
}

function getCategoryBadgeClass(post: BoardPostSummary) {
  if (post.pinned) return 'is-warning';
  switch (post.category) {
    case 'NOTICE':
      return 'is-warning';
    case 'FREE':
      return 'is-info';
    case 'REVIEW':
      return 'is-success';
    case 'QNA':
      return 'is-danger';
    default:
      return 'is-info';
  }
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTimeFull(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
