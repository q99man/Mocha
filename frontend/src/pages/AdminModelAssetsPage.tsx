import { useEffect, useMemo, useState } from 'react';

import { CompactToast } from '../shared/components/CompactToast';

import { formatDifficulty, parseDifficulty } from '../features/challenges/difficulty';
import { AdminAssetsSection } from '../features/admin/AdminAssetsSection';
import { AdminChallengeEditorModal } from '../features/admin/AdminChallengeEditorModal';
import { AdminChallengesSection } from '../features/admin/AdminChallengesSection';
import { CompactConfirmDialog } from '../shared/components/CompactConfirmDialog';
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
  const modelSummary = activeAsset ? `현재 활성 모델 ${activeAsset.originalFileName}` : '현재 활성 모델이 없습니다.';
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
    setDeletingId(challenge.id);
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

  const clearAllMessages = () => {
    setUploadSuccess(null);
    setChallengeSuccess(null);
    setAnalysisMessage(null);
    setUploadError(null);
    setAnalysisError(null);
    setError(null);
  };

  const activeMessage = uploadSuccess || challengeSuccess || analysisMessage;
  const activeError = uploadError || analysisError || error;

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
              <button className="button-link button-link--secondary button-link--compact" type="button" onClick={() => void loadAdminData()}>
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
          <CompactToast
            message={activeMessage || activeError}
            type={activeError ? 'error' : 'success'}
            onClose={clearAllMessages}
          />

          <AdminAssetsSection
            loading={loading}
            assets={assets}
            activeAsset={activeAsset}
            modelSummary={modelSummary}
            selectedModelFile={selectedModelFile}
            versionLabel={versionLabel}
            uploading={uploading}
            deletingAssetId={deletingAssetId}
            expandedAssetId={expandedAssetId}
            assetPage={assetPage}
            assetTotalPages={assetTotalPages}
            setVersionLabel={setVersionLabel}
            onSelectModelFile={(file) => {
              setSelectedModelFile(file);
              setUploadError(null);
              setUploadSuccess(null);
            }}
            onSubmitModel={handleModelSubmit}
            onToggleAssetRow={handleAssetRowToggle}
            onConfirmDeleteAsset={(asset) => setConfirmDialog({ kind: 'DELETE_ASSET', asset })}
            onAssetPageChange={setAssetPage}
            buildActiveDescription={buildActiveDescription}
            formatFileSize={formatFileSize}
            formatDateTime={formatDateTime}
            formatDateTimeFull={formatDateTimeFull}
          />

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
            deletingId={deletingId}
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
        </section>
      </div>

      <CompactConfirmDialog
        open={confirmDialog.kind !== 'NONE'}
        title={confirmDialog.kind === 'DELETE_ASSET' ? '모델 삭제' : '챌린지 삭제'}
        description={
          confirmDialog.kind === 'DELETE_ASSET'
            ? `"${confirmDialog.asset.originalFileName}" 모델을 삭제합니다. 활성 모델이라면 상태를 정리하고 다른 최신 모델이 자동으로 활성화될 수 있습니다.`
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
    </>
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
