import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import {
  deletePoseLandmarkerModel,
  getActivePoseLandmarkerAsset,
  getPoseLandmarkerAssets,
  uploadPoseLandmarkerModel,
} from '../shared/api/adminApi';
import {
  analyzeChallengeReference,
  createChallenge,
  deleteChallenge,
  getAdminChallenges,
  updateChallenge,
  updateChallengeActive,
} from '../shared/api/challengeApi';
import {
  formatDifficulty,
  parseDifficulty,
  getDifficultyOptions,
} from '../features/challenges/difficulty';
import { CompactConfirmDialog } from '../shared/components/CompactConfirmDialog';
import { CompactFileField } from '../shared/components/CompactFileField';
import { Pagination } from '../shared/components/Pagination';
import type { ModelAsset } from '../shared/types/admin';
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

type ChallengeStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type ChallengeSortOption = 'NEWEST' | 'OLDEST' | 'TITLE_ASC' | 'TITLE_DESC';
type ConfirmDialogState =
  | { kind: 'NONE' }
  | { kind: 'DELETE_ASSET'; asset: ModelAsset }
  | { kind: 'DELETE_CHALLENGE'; challenge: Challenge };

const CHALLENGES_PER_PAGE = 6;
const ASSETS_PER_PAGE = 5;
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

export function AdminModelAssetsPage() {
  const [assets, setAssets] = useState<ModelAsset[]>([]);
  const [activeAsset, setActiveAsset] = useState<ModelAsset | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedModelFile, setSelectedModelFile] = useState<File | null>(null);
  const [versionLabel, setVersionLabel] = useState('');
  const [deletingAssetId, setDeletingAssetId] = useState<number | null>(null);
  const [expandedAssetId, setExpandedAssetId] = useState<number | null>(null);

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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [challengePage, setChallengePage] = useState(1);
  const [assetPage, setAssetPage] = useState(1);
  const [expandedChallengeId, setExpandedChallengeId] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ kind: 'NONE' });

  useEffect(() => {
    void loadAdminData();
  }, []);

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
      if (challenge.category.trim()) categories.add(challenge.category);
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

  const challengeTotalPages = Math.max(1, Math.ceil(filteredChallenges.length / CHALLENGES_PER_PAGE));
  const assetTotalPages = Math.max(1, Math.ceil(assets.length / ASSETS_PER_PAGE));

  useEffect(() => {
    setChallengePage(1);
  }, [activeCategoryFilter, activeSort, activeStatusFilter, challengeSearch]);

  useEffect(() => {
    if (challengePage > challengeTotalPages) setChallengePage(challengeTotalPages);
  }, [challengePage, challengeTotalPages]);

  useEffect(() => {
    if (assetPage > assetTotalPages) setAssetPage(assetTotalPages);
  }, [assetPage, assetTotalPages]);

  useEffect(() => {
    const body = document.body;
    const modalOpen = challengeModalOpen || confirmDialog.kind !== 'NONE';
    if (!modalOpen) {
      body.classList.remove('body--modal-open');
      return;
    }

    body.classList.add('body--modal-open');
    return () => {
      body.classList.remove('body--modal-open');
    };
  }, [challengeModalOpen, confirmDialog]);

  const pagedChallenges = useMemo(() => {
    const startIndex = (challengePage - 1) * CHALLENGES_PER_PAGE;
    return filteredChallenges.slice(startIndex, startIndex + CHALLENGES_PER_PAGE);
  }, [challengePage, filteredChallenges]);

  const pagedAssets = useMemo(() => {
    const startIndex = (assetPage - 1) * ASSETS_PER_PAGE;
    return assets.slice(startIndex, startIndex + ASSETS_PER_PAGE);
  }, [assetPage, assets]);

  async function loadAdminData() {
    setLoading(true);
    setError(null);
    try {
      const [assetList, active, challengeList] = await Promise.all([
        getPoseLandmarkerAssets(),
        getActivePoseLandmarkerAsset().catch(() => null),
        getAdminChallenges(),
      ]);
      setAssets(assetList);
      setActiveAsset(active);
      setChallenges(challengeList);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '운영 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleModelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    if (challengeSubmitting) return;
    setChallengeModalOpen(false);
    setEditingChallengeId(null);
    setChallengeForm(initialChallengeForm);
    setChallengeDifficultyLevel('4');
    setSelectedReferenceVideo(null);
    setChallengeError(null);
  }

  async function handleChallengeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    setDeletingId(challenge.id);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setChallengeSuccess(null);
    try {
      await deleteChallenge(challenge.id);
      setAnalysisMessage(`챌린지 삭제 완료: ${challenge.title} (#${challenge.id})`);
      if (createdChallengeId === challenge.id) setCreatedChallengeId(null);
      if (expandedChallengeId === challenge.id) {
        setExpandedChallengeId(null);
      }
      await loadAdminData();
      return true;
    } catch (deleteError) {
      setAnalysisError(deleteError instanceof Error ? deleteError.message : '챌린지 삭제에 실패했습니다.');
      return false;
    } finally {
      setDeletingId(null);
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

  const modelSummary = activeAsset
    ? `현재 활성 모델 ${activeAsset.originalFileName}`
    : '현재 활성 모델이 없습니다.';
  const challengeSummary = `활성 ${activeChallenges.length}개 · 평가 준비 ${evaluationReadyChallenges.length}개 · 분석 대기 ${pendingAnalysisChallenges.length}개`;
  const confirmBusy =
    (confirmDialog.kind === 'DELETE_ASSET' && deletingAssetId === confirmDialog.asset.id) ||
    (confirmDialog.kind === 'DELETE_CHALLENGE' && deletingId === confirmDialog.challenge.id);
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
    }
  }

  return (
    <>
      <div className="glass-page board-page-compact">
        <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell admin-hub-compact">
          <div className="board-detail-compact__toolbar mypage-compact-header">
            <div>
              <h2 className="board-classic-title">운영 허브</h2>
              <p className="board-classic-summary">모델과 챌린지를 마이페이지 톤의 컴팩트한 목록으로 관리합니다.</p>
            </div>

            <div className="inline-actions">
              <button
                className="button-link button-link--secondary button-link--compact"
                type="button"
                onClick={() => void loadAdminData()}
              >
                새로고침
              </button>
              <button className="button-link button-link--compact" type="button" onClick={openCreateChallengeModal}>
                챌린지 등록
              </button>
            </div>
          </div>

          <div className="glass-chip-group mypage-compact-tabs admin-hub-compact__chips">
            <span className="glass-chip is-active">활성 모델 {activeAsset ? 1 : 0}</span>
            <span className="glass-chip">활성 챌린지 {activeChallenges.length}</span>
            <span className="glass-chip">평가 준비 {evaluationReadyChallenges.length}</span>
            {createdChallengeId ? <span className="glass-chip">최근 생성 #{createdChallengeId}</span> : null}
          </div>

          {(uploadSuccess || uploadError || analysisMessage || analysisError || error || challengeSuccess) ? (
            <div className="glass-status-stack">
              {uploadSuccess ? <p className="review-composer__message review-composer__message--success">{uploadSuccess}</p> : null}
              {challengeSuccess ? <p className="review-composer__message review-composer__message--success">{challengeSuccess}</p> : null}
              {analysisMessage ? <p className="review-composer__message review-composer__message--success">{analysisMessage}</p> : null}
              {uploadError ? <p className="review-composer__message review-composer__message--error">{uploadError}</p> : null}
              {analysisError ? <p className="review-composer__message review-composer__message--error">{analysisError}</p> : null}
              {error ? <p className="review-composer__message review-composer__message--error">{error}</p> : null}
            </div>
          ) : null}

          <section className="glass-panel glass-panel--nested admin-hub-compact__section">
            <div className="board-detail-compact__toolbar admin-hub-compact__section-header">
              <div>
                <h3 className="glass-section-title">모델 관리</h3>
                <p className="glass-toolbar__note">{modelSummary}</p>
              </div>
              <div className="board-detail-compact__meta">
                <span className="board-classic-badge">{assets.length}개 자산</span>
                <span className="board-classic-badge">{activeAsset ? '활성 모델 있음' : '모델 필요'}</span>
              </div>
            </div>

            <form className="admin-hub-compact__upload" onSubmit={(event) => void handleModelSubmit(event)}>
              <CompactFileField
                label="모델 파일"
                accept=".task"
                buttonLabel="모델 선택"
                emptyLabel=".task 모델 파일을 선택해 주세요."
                selectedFileName={selectedModelFile?.name ?? null}
                disabled={uploading}
                onSelect={(file) => {
                  setSelectedModelFile(file);
                  setUploadError(null);
                  setUploadSuccess(null);
                }}
              />
              <label className="mypage-inline-field">
                <span>버전 라벨</span>
                <input
                  type="text"
                  value={versionLabel}
                  onChange={(event) => setVersionLabel(event.target.value)}
                  placeholder="예: lite-v1"
                />
              </label>
              <div className="admin-hub-compact__upload-actions">
                <button className="button-link button-link--compact" type="submit" disabled={uploading}>
                  {uploading ? '업로드 중...' : '모델 업로드'}
                </button>
              </div>
            </form>

            {selectedModelFile ? (
              <p className="glass-toolbar__note admin-hub-compact__inline-note">선택 파일: {selectedModelFile.name}</p>
            ) : null}
            {activeAsset ? (
              <p className="glass-toolbar__note admin-hub-compact__inline-note">{buildActiveDescription(activeAsset)}</p>
            ) : null}

            {loading ? (
              <div className="glass-panel glass-panel--nested glass-panel--empty">
                <strong>모델 자산을 불러오는 중입니다.</strong>
              </div>
            ) : pagedAssets.length === 0 ? (
              <div className="glass-panel glass-panel--nested glass-panel--empty">
                <strong>등록된 모델 자산이 없습니다.</strong>
              </div>
            ) : (
              <div className="admin-hub-compact-table">
                <div className="admin-hub-compact-table__head admin-hub-compact-table__head--assets" role="presentation">
                  <span>상태</span>
                  <span>모델</span>
                  <span>버전</span>
                  <span>등록일</span>
                  <span>상세</span>
                </div>

                <div className="admin-hub-compact-table__body">
                  {pagedAssets.map((asset) => {
                    const isExpanded = expandedAssetId === asset.id;

                    return (
                      <Fragment key={asset.id}>
                        <article
                          className={`admin-hub-compact-row admin-hub-compact-row--assets${isExpanded ? ' is-expanded' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleAssetRowToggle(asset.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleAssetRowToggle(asset.id);
                            }
                          }}
                        >
                          <div className="admin-hub-compact-row__status">
                            <span className={`board-classic-badge${asset.active ? ' is-pinned' : ''}`}>
                              {asset.active ? '활성' : '보관'}
                            </span>
                          </div>
                          <div className="admin-hub-compact-row__title">
                            <strong>{asset.originalFileName}</strong>
                            <span>모델 #{asset.id} · {formatFileSize(asset.size)}</span>
                          </div>
                          <div className="admin-hub-compact-row__meta">{asset.versionLabel ?? '라벨 없음'}</div>
                          <div className="admin-hub-compact-row__date">{formatDateTime(asset.createdAt)}</div>
                          <div className="admin-hub-compact-row__actions">
                            <button
                              className="button-link button-link--secondary admin-hub-compact__action-btn"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAssetRowToggle(asset.id);
                              }}
                            >
                              {isExpanded ? '닫기' : '상세'}
                            </button>
                          </div>
                        </article>

                        {isExpanded ? (
                          <section className="admin-hub-compact__inline-detail">
                            <div className="admin-hub-compact__inline-header">
                              <div>
                                <strong>{asset.originalFileName}</strong>
                                <p>{asset.active ? '현재 운영 중인 활성 모델입니다.' : '보관 중인 모델 자산입니다.'}</p>
                              </div>
                              <div className="admin-hub-compact-row__actions admin-hub-compact-row__actions--wrap">
                                <button
                                  className="button-link button-link--secondary admin-hub-compact__action-btn admin-hub-compact__action-btn--danger"
                                  type="button"
                                  disabled={deletingAssetId === asset.id || uploading}
                                  onClick={() => setConfirmDialog({ kind: 'DELETE_ASSET', asset })}
                                >
                                  {deletingAssetId === asset.id ? '삭제 중...' : '모델 삭제'}
                                </button>
                              </div>
                            </div>

                            <div className="admin-hub-compact__inline-meta">
                              <span>버전 {asset.versionLabel ?? '라벨 없음'}</span>
                              <span>용량 {formatFileSize(asset.size)}</span>
                              <span>형식 {asset.contentType ?? '미지정'}</span>
                              <span>등록 {formatDateTimeFull(asset.createdAt)}</span>
                              <span>업데이트 {formatDateTimeFull(asset.updatedAt)}</span>
                            </div>

                            <div className="admin-hub-compact__inline-grid">
                              <div className="admin-hub-compact__inline-card">
                                <span>저장 경로</span>
                                <strong>{asset.storagePath}</strong>
                              </div>
                              <div className="admin-hub-compact__inline-card">
                                <span>실행 경로</span>
                                <strong>{asset.runtimePath}</strong>
                              </div>
                            </div>
                          </section>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            <Pagination currentPage={assetPage} totalPages={assetTotalPages} onPageChange={setAssetPage} />
          </section>

          <section className="glass-panel glass-panel--nested admin-hub-compact__section">
            <div className="board-detail-compact__toolbar admin-hub-compact__section-header">
              <div>
                <h3 className="glass-section-title">챌린지 관리</h3>
                <p className="glass-toolbar__note">{challengeSummary}</p>
              </div>
            </div>

            <div className="admin-hub-compact__filters">
              <label className="mypage-inline-field">
                <span>검색</span>
                <input
                  type="text"
                  value={challengeSearch}
                  onChange={(event) => setChallengeSearch(event.target.value)}
                  placeholder="제목, 설명, 카테고리, ID"
                />
              </label>
              <div className="admin-hub-compact__filter-group">
                <span className="admin-hub-compact__filter-label">카테고리</span>
                <div className="admin-hub-compact__filter-options" role="group" aria-label="카테고리 필터">
                  {categoryOptions.map((category) => {
                    const isActive = activeCategoryFilter === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        className={`admin-hub-compact__filter-option${isActive ? ' is-active' : ''}`}
                        onClick={() => setActiveCategoryFilter(category)}
                      >
                        {category === 'ALL' ? '전체' : category}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="admin-hub-compact__filter-group">
                <span className="admin-hub-compact__filter-label">상태</span>
                <div className="admin-hub-compact__filter-options" role="group" aria-label="상태 필터">
                  {STATUS_FILTER_OPTIONS.map((option) => {
                    const isActive = activeStatusFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`admin-hub-compact__filter-option${isActive ? ' is-active' : ''}`}
                        onClick={() => setActiveStatusFilter(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="admin-hub-compact__filter-group">
                <span className="admin-hub-compact__filter-label">정렬</span>
                <div className="admin-hub-compact__filter-options" role="group" aria-label="정렬 기준">
                  {SORT_OPTIONS.map((option) => {
                    const isActive = activeSort === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`admin-hub-compact__filter-option${isActive ? ' is-active' : ''}`}
                        onClick={() => setActiveSort(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="admin-hub-compact__filter-actions">
                <button
                  className="button-link button-link--secondary button-link--compact"
                  type="button"
                  onClick={resetChallengeFilters}
                >
                  필터 초기화
                </button>
              </div>
            </div>

            <p className="glass-toolbar__note admin-hub-compact__inline-note">
              현재 조건에 맞는 챌린지 {filteredChallenges.length}개
            </p>

            {loading ? (
              <div className="glass-panel glass-panel--nested glass-panel--empty">
                <strong>챌린지 목록을 불러오는 중입니다.</strong>
              </div>
            ) : pagedChallenges.length === 0 ? (
              <div className="glass-panel glass-panel--nested glass-panel--empty">
                <strong>조건에 맞는 챌린지가 없습니다.</strong>
              </div>
            ) : (
              <div className="admin-hub-compact-table">
                <div className="admin-hub-compact-table__head admin-hub-compact-table__head--challenges" role="presentation">
                  <span>상태</span>
                  <span>챌린지</span>
                  <span>난이도</span>
                  <span>분석</span>
                  <span>상세</span>
                </div>

                <div className="admin-hub-compact-table__body">
                  {pagedChallenges.map((challenge) => {
                    const isExpanded = expandedChallengeId === challenge.id;

                    return (
                      <Fragment key={challenge.id}>
                        <article
                          className={`admin-hub-compact-row admin-hub-compact-row--challenges${isExpanded ? ' is-expanded' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleChallengeRowToggle(challenge.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleChallengeRowToggle(challenge.id);
                            }
                          }}
                        >
                          <div className="admin-hub-compact-row__status admin-hub-compact-row__status--stack">
                            <span className={`board-classic-badge${challenge.isActive ? ' is-pinned' : ''}`}>
                              {challenge.isActive ? '활성' : '비활성'}
                            </span>
                            <span className={`board-classic-badge${challenge.referenceMotionProfileReady ? ' is-pinned' : ''}`}>
                              {getChallengeReadyLabel(challenge)}
                            </span>
                          </div>
                          <div className="admin-hub-compact-row__title">
                            <strong>{challenge.title}</strong>
                            <span>
                              #{challenge.id} · {challenge.category} · {challenge.description}
                            </span>
                          </div>
                          <div className="admin-hub-compact-row__metric">{formatDifficulty(challenge.difficulty)}</div>
                          <div className="admin-hub-compact-row__meta">
                            {formatReferenceStatus(challenge.referenceAnalysisStatus)}
                          </div>
                          <div className="admin-hub-compact-row__actions">
                            <button
                              className="button-link button-link--secondary admin-hub-compact__action-btn"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleChallengeRowToggle(challenge.id);
                              }}
                            >
                              {isExpanded ? '닫기' : '상세'}
                            </button>
                          </div>
                        </article>

                        {isExpanded ? (
                          <section className="admin-hub-compact__inline-detail">
                            <div className="admin-hub-compact__inline-header">
                              <div>
                                <strong>{challenge.title}</strong>
                                <p>{challenge.description}</p>
                              </div>
                              <div className="admin-hub-compact-row__actions admin-hub-compact-row__actions--wrap">
                                <Link
                                  className="button-link button-link--secondary admin-hub-compact__action-btn"
                                  to={`/admin/challenges/${challenge.id}/analysis`}
                                >
                                  분석 보기
                                </Link>
                                <button
                                  className="button-link button-link--secondary admin-hub-compact__action-btn"
                                  type="button"
                                  disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id}
                                  onClick={() => handleEditChallenge(challenge)}
                                >
                                  수정
                                </button>
                                <button
                                  className="button-link button-link--secondary admin-hub-compact__action-btn"
                                  type="button"
                                  disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id}
                                  onClick={() => void handleToggleChallengeActive(challenge)}
                                >
                                  {togglingId === challenge.id ? '변경 중...' : challenge.isActive ? '비활성' : '활성'}
                                </button>
                                <button
                                  className="button-link admin-hub-compact__action-btn"
                                  type="button"
                                  disabled={
                                    !activeAsset ||
                                    !challenge.referenceVideoUploaded ||
                                    !challenge.isActive ||
                                    analyzingId === challenge.id ||
                                    deletingId === challenge.id ||
                                    togglingId === challenge.id
                                  }
                                  onClick={() => void handleAnalyzeReference(challenge.id)}
                                >
                                  {analyzingId === challenge.id ? '분석 중...' : '분석 실행'}
                                </button>
                                <button
                                  className="button-link button-link--secondary admin-hub-compact__action-btn admin-hub-compact__action-btn--danger"
                                  type="button"
                                  disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id}
                                  onClick={() => setConfirmDialog({ kind: 'DELETE_CHALLENGE', challenge })}
                                >
                                  {deletingId === challenge.id ? '삭제 중...' : '삭제'}
                                </button>
                              </div>
                            </div>

                            <div className="admin-hub-compact__inline-meta">
                              <span>카테고리 {challenge.category}</span>
                              <span>난이도 {formatDifficulty(challenge.difficulty)}</span>
                              <span>길이 {challenge.durationSec}초</span>
                              <span>레퍼런스 영상 {challenge.referenceVideoUploaded ? '등록됨' : '없음'}</span>
                              <span>분석 {formatReferenceStatus(challenge.referenceAnalysisStatus)}</span>
                              <span>평가 {challenge.referenceMotionProfileReady && challenge.isActive ? '가능' : '준비 중'}</span>
                              <span>가이드 영상 {challenge.guideVideoUrl ? '연결됨' : '없음'}</span>
                            </div>

                            <div className="admin-hub-compact__inline-grid">
                              <div className="admin-hub-compact__inline-card">
                                <span>레퍼런스 파일</span>
                                <strong>{challenge.referenceVideoOriginalFileName ?? '등록된 파일이 없습니다.'}</strong>
                              </div>
                              <div className="admin-hub-compact__inline-card">
                                <span>최근 분석 시각</span>
                                <strong>{challenge.referenceAnalyzedAt ? formatDateTimeFull(challenge.referenceAnalyzedAt) : '아직 분석되지 않았습니다.'}</strong>
                              </div>
                              <div className="admin-hub-compact__inline-card">
                                <span>가이드 영상 URL</span>
                                <strong>{challenge.guideVideoUrl ?? '연결된 URL이 없습니다.'}</strong>
                              </div>
                              <div className="admin-hub-compact__inline-card">
                                <span>썸네일 URL</span>
                                <strong>{challenge.thumbnailUrl ?? '연결된 URL이 없습니다.'}</strong>
                              </div>
                            </div>

                            {challenge.latestRetrySummary ? (
                              <div className="admin-hub-compact__inline-grid admin-hub-compact__inline-grid--stats">
                                <div className="admin-hub-compact__inline-card">
                                  <span>최근 점수</span>
                                  <strong>{challenge.latestRetrySummary.latestScore}점</strong>
                                </div>
                                <div className="admin-hub-compact__inline-card">
                                  <span>최근 도전</span>
                                  <strong>{formatDateTimeFull(challenge.latestRetrySummary.latestAttemptedAt)}</strong>
                                </div>
                                <div className="admin-hub-compact__inline-card">
                                  <span>강점</span>
                                  <strong>{challenge.latestRetrySummary.strongestArea ?? '데이터 없음'}</strong>
                                </div>
                                <div className="admin-hub-compact__inline-card">
                                  <span>보완</span>
                                  <strong>{challenge.latestRetrySummary.weakestArea ?? '데이터 없음'}</strong>
                                </div>
                              </div>
                            ) : null}
                          </section>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            <Pagination currentPage={challengePage} totalPages={challengeTotalPages} onPageChange={setChallengePage} />
          </section>
        </section>
      </div>

      <CompactConfirmDialog
        open={confirmDialog.kind !== 'NONE'}
        title={confirmDialog.kind === 'DELETE_ASSET' ? '모델 삭제' : '챌린지 삭제'}
        description={
          confirmDialog.kind === 'DELETE_ASSET'
            ? `"${confirmDialog.kind === 'DELETE_ASSET' ? confirmDialog.asset.originalFileName : ''}" 모델을 삭제합니다. 활성 모델이라면 상태를 정리하고 다른 최신 모델이 자동으로 활성화될 수 있습니다.`
            : confirmDialog.kind === 'DELETE_CHALLENGE'
              ? `"${confirmDialog.challenge.title}" 챌린지를 삭제합니다. 연결된 시도 기록과 업로드 파일도 함께 정리됩니다.`
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

      {challengeModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="glass-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-modal-title">
              <div className="glass-modal__backdrop" onClick={closeChallengeModal} />
              <div className="glass-modal__panel admin-hub-compact__modal-panel">
                <form
                  className="glass-panel glass-form admin-hub-compact__modal-form"
                  onSubmit={(event) => void handleChallengeSubmit(event)}
                >
                  <div className="glass-toolbar admin-hub-compact__modal-header">
                    <div>
                      <h3 className="glass-section-title" id="challenge-modal-title">
                        {modalTitle}
                      </h3>
                      <p className="glass-toolbar__note">{modalDescription}</p>
                    </div>
                    <button
                      className="button-link button-link--secondary admin-hub-compact__modal-btn"
                      type="button"
                      onClick={closeChallengeModal}
                      disabled={challengeSubmitting}
                    >
                      닫기
                    </button>
                  </div>

                  <div className="admin-hub-compact__modal-summary">
                    <div className="admin-hub-compact__summary-card">
                      <span>작업 모드</span>
                      <strong>{editingChallengeId ? `수정 · #${editingChallengeId}` : '신규 등록'}</strong>
                    </div>
                    <div className="admin-hub-compact__summary-card">
                      <span>난이도 / 길이</span>
                      <strong>
                        {challengeDifficultyLevel} / {modalDurationLabel}
                      </strong>
                    </div>
                    <div className="admin-hub-compact__summary-card">
                      <span>가이드 / 썸네일</span>
                      <strong>
                        {modalGuideLabel} · {modalThumbnailLabel}
                      </strong>
                    </div>
                    <div className="admin-hub-compact__summary-card">
                      <span>레퍼런스 영상</span>
                      <strong>{modalReferenceLabel}</strong>
                    </div>
                  </div>

                  <div className="admin-hub-compact__modal-grid">
                    <div className="admin-hub-compact__modal-section-label admin-hub-compact__modal-field--full">
                      기본 정보
                    </div>
                    <label className="glass-field admin-hub-compact__modal-field admin-hub-compact__modal-field--full">
                      <span>챌린지 제목</span>
                      <input
                        type="text"
                        value={challengeForm.title}
                        onChange={(event) => setChallengeForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="예: 사이드 스텝 테스트"
                      />
                    </label>
                    <label className="glass-field admin-hub-compact__modal-field admin-hub-compact__modal-field--full">
                      <span>설명</span>
                      <textarea
                        value={challengeForm.description}
                        rows={4}
                        onChange={(event) =>
                          setChallengeForm((current) => ({ ...current, description: event.target.value }))
                        }
                        placeholder="레퍼런스 동작 설명"
                      />
                    </label>

                    <label className="glass-field admin-hub-compact__modal-field">
                      <span>카테고리</span>
                      <input
                        type="text"
                        value={challengeForm.category}
                        onChange={(event) =>
                          setChallengeForm((current) => ({ ...current, category: event.target.value }))
                        }
                      />
                    </label>
                    <label className="glass-field admin-hub-compact__modal-field">
                      <span>난이도</span>
                      <div className="admin-hub-compact__difficulty-field">
                        <div className="admin-hub-compact__difficulty-current">
                          <strong>{challengeDifficultyLevel}</strong>
                          <span>선택한 난이도</span>
                        </div>
                        <div className="admin-hub-compact__difficulty-picker" role="radiogroup" aria-label="난이도 선택">
                          {getDifficultyOptions().map((level) => {
                            const isActive = challengeDifficultyLevel === String(level);
                            return (
                              <button
                                key={level}
                                type="button"
                                className={`admin-hub-compact__difficulty-option${isActive ? ' is-active' : ''}`}
                                aria-pressed={isActive}
                                onClick={() => setChallengeDifficultyLevel(String(level))}
                              >
                                {level}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </label>
                    <label className="glass-field admin-hub-compact__modal-field">
                      <span>길이(초)</span>
                      <input
                        type="number"
                        min={5}
                        max={600}
                        value={challengeForm.durationSec}
                        onChange={(event) =>
                          setChallengeForm((current) => ({ ...current, durationSec: event.target.value }))
                        }
                      />
                    </label>

                    <div className="admin-hub-compact__modal-section-label admin-hub-compact__modal-field--full">
                      미디어 연결
                    </div>
                    <label className="glass-field admin-hub-compact__modal-field">
                      <span>썸네일 URL</span>
                      <input
                        type="text"
                        value={challengeForm.thumbnailUrl}
                        onChange={(event) =>
                          setChallengeForm((current) => ({ ...current, thumbnailUrl: event.target.value }))
                        }
                        placeholder="선택"
                      />
                    </label>
                    <label className="glass-field admin-hub-compact__modal-field">
                      <span>가이드 영상 URL</span>
                      <input
                        type="text"
                        value={challengeForm.guideVideoUrl}
                        onChange={(event) =>
                          setChallengeForm((current) => ({ ...current, guideVideoUrl: event.target.value }))
                        }
                        placeholder="선택"
                      />
                    </label>

                    <div className="admin-hub-compact__modal-section-label admin-hub-compact__modal-field--full">
                      레퍼런스 자료
                    </div>
                    <div className="admin-hub-compact__modal-field admin-hub-compact__modal-field--full">
                      <CompactFileField
                        label={editingChallengeId ? '레퍼런스 영상 교체(선택)' : '레퍼런스 영상'}
                        accept="video/*"
                        buttonLabel="영상 선택"
                        emptyLabel={editingChallengeId ? '기존 레퍼런스 영상을 유지합니다.' : '업로드할 영상을 선택해 주세요.'}
                        selectedFileName={selectedReferenceVideo?.name ?? null}
                        disabled={challengeSubmitting}
                        onSelect={(file) => {
                          setSelectedReferenceVideo(file);
                          setChallengeError(null);
                        }}
                      />
                    </div>
                  </div>

                  <div className="inline-actions admin-hub-compact__modal-actions">
                    <button className="button-link admin-hub-compact__modal-btn" type="submit" disabled={challengeSubmitting}>
                      {challengeSubmitting ? (editingChallengeId ? '수정 중...' : '생성 중...') : editingChallengeId ? '수정 저장' : '챌린지 생성'}
                    </button>
                    <button
                      className="button-link button-link--secondary admin-hub-compact__modal-btn"
                      type="button"
                      onClick={closeChallengeModal}
                      disabled={challengeSubmitting}
                    >
                      취소
                    </button>
                  </div>
                  {selectedReferenceVideo ? (
                    <p className="glass-toolbar__note admin-hub-compact__modal-note">선택 영상: {selectedReferenceVideo.name}</p>
                  ) : null}
                  {editingChallengeId ? (
                    <p className="glass-toolbar__note admin-hub-compact__modal-note">수정 중 챌린지 ID: #{editingChallengeId}</p>
                  ) : null}
                  {challengeError ? <p className="review-composer__message review-composer__message--error">{challengeError}</p> : null}
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function buildActiveDescription(asset: ModelAsset) {
  return `${asset.versionLabel ?? '버전 라벨 없음'} / ${formatFileSize(asset.size)} / ${new Date(asset.updatedAt).toLocaleString('ko-KR')}`;
}

function getChallengeReadyLabel(challenge: Challenge) {
  if (challenge.referenceMotionProfileReady && challenge.isActive) return '평가 준비';
  if (challenge.referenceMotionProfileReady) return '활성 대기';
  if (challenge.referenceVideoUploaded) return '분석 필요';
  return '영상 필요';
}

function formatReferenceStatus(status: string) {
  if (status === 'NOT_ANALYZED') return '미분석';
  if (status === 'ANALYZING') return '분석 중';
  if (status === 'COMPLETED') return '분석 완료';
  if (status === 'PENDING') return '대기';
  if (status === 'PROCESSING') return '처리 중';
  if (status === 'READY') return '준비 완료';
  if (status === 'FAILED') return '실패';
  return status;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
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
