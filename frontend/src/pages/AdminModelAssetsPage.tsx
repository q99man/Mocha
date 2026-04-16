import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deletePoseLandmarkerModel,
  getActivePoseLandmarkerAsset,
  getPoseLandmarkerAssets,
  uploadPoseLandmarkerModel,
} from '../shared/api/adminApi';
import { analyzeChallengeReference, createChallenge, deleteChallenge, getAdminChallenges, updateChallenge, updateChallengeActive } from '../shared/api/challengeApi';
import type { ModelAsset } from '../shared/types/admin';
import type { Challenge } from '../shared/types/challenge';

const initialChallengeForm = {
  title: '',
  description: '',
  category: '퍼포먼스',
  difficulty: '보통',
  thumbnailUrl: '',
  guideVideoUrl: '',
  durationSec: '25',
};

type ChallengeStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type ChallengeSortOption = 'NEWEST' | 'OLDEST' | 'TITLE_ASC' | 'TITLE_DESC';

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

  const [challengeForm, setChallengeForm] = useState(initialChallengeForm);
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

  useEffect(() => {
    void loadAdminData();
  }, []);

  const readyChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady),
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

    const filtered = challenges.filter((challenge) => {
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
    });

    return filtered.sort((left, right) => {
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

  function handleModelFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedModelFile(file);
    setUploadError(null);
    setUploadSuccess(null);
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

  async function handleDeleteModelAsset(asset: ModelAsset) {
    const confirmed = window.confirm(
      `"${asset.originalFileName}" 모델을 삭제하시겠습니까?\n활성 모델이면 런타임 모델도 함께 정리되고, 남아 있는 최신 모델이 있으면 자동으로 다시 활성화됩니다.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingAssetId(asset.id);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      await deletePoseLandmarkerModel(asset.id);
      setUploadSuccess(`모델 삭제 완료: ${asset.originalFileName}`);
      await loadAdminData();
    } catch (deleteError) {
      setUploadError(deleteError instanceof Error ? deleteError.message : '모델 삭제에 실패했습니다.');
    } finally {
      setDeletingAssetId(null);
    }
  }

  function handleReferenceVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedReferenceVideo(file);
    setChallengeError(null);
    setChallengeSuccess(null);
  }

  function handleEditChallenge(challenge: Challenge) {
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
    setSelectedReferenceVideo(null);
    setChallengeError(null);
    setChallengeSuccess(null);
    setAnalysisMessage(null);
    setAnalysisError(null);
  }

  function handleCancelChallengeEdit() {
    setEditingChallengeId(null);
    setChallengeForm(initialChallengeForm);
    setSelectedReferenceVideo(null);
    setChallengeError(null);
    setChallengeSuccess(null);
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
        difficulty: challengeForm.difficulty,
        thumbnailUrl: challengeForm.thumbnailUrl,
        guideVideoUrl: challengeForm.guideVideoUrl,
        durationSec: Number(challengeForm.durationSec),
      };

      if (editingChallengeId) {
        const updated = await updateChallenge(editingChallengeId, {
          ...payload,
          referenceVideo: selectedReferenceVideo,
        });
        setChallengeSuccess(`챌린지 수정 완료: ${updated.title} (#${updated.id})`);
        setEditingChallengeId(null);
      } else {
        const created = await createChallenge({
          ...payload,
          referenceVideo: selectedReferenceVideo!,
        });
        setCreatedChallengeId(created.id);
        setChallengeSuccess(`챌린지 생성 완료: ${created.title} (#${created.id})`);
      }
      setChallengeForm(initialChallengeForm);
      setSelectedReferenceVideo(null);
      await loadAdminData();
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
    const confirmed = window.confirm(`정말로 "${challenge.title}" 챌린지를 삭제하시겠습니까?\n연결된 시도 기록과 업로드 파일도 함께 정리됩니다.`);
    if (!confirmed) {
      return;
    }

    setDeletingId(challenge.id);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setChallengeSuccess(null);
    setChallengeError(null);

    try {
      await deleteChallenge(challenge.id);
      setAnalysisMessage(`챌린지 삭제 완료: ${challenge.title} (#${challenge.id})`);
      if (createdChallengeId === challenge.id) {
        setCreatedChallengeId(null);
      }
      if (editingChallengeId === challenge.id) {
        handleCancelChallengeEdit();
      }
      await loadAdminData();
    } catch (deleteError) {
      setAnalysisError(deleteError instanceof Error ? deleteError.message : '챌린지 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleChallengeActive(challenge: Challenge) {
    setTogglingId(challenge.id);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setChallengeSuccess(null);
    setChallengeError(null);

    try {
      const updated = await updateChallengeActive(challenge.id, !challenge.isActive);
      setAnalysisMessage(`챌린지 상태 변경 완료: ${updated.title} (#${updated.id}) / ${updated.isActive ? '활성' : '비활성'}`);
      if (editingChallengeId === challenge.id) {
        setEditingChallengeId(updated.id);
      }
      await loadAdminData();
    } catch (toggleError) {
      setAnalysisError(toggleError instanceof Error ? toggleError.message : '챌린지 상태 변경에 실패했습니다.');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="page admin-page">
      <section className="hero hero--detail">
        <div className="hero__content">
          <span className="hero__eyebrow">운영 / 운영 허브</span>
          <h2>운영 허브</h2>
          <p>모델 자산 업로드와 실제 레퍼런스 기반 챌린지 생성을 한 화면에서 관리합니다. 시드 프로필 대신 실제 레퍼런스 프로필을 만들 때 이 페이지를 사용하면 됩니다.</p>
          <div className="signal-panel">
            <span className="signal-panel__label">현재 활성 모델</span>
            <strong>{activeAsset ? activeAsset.originalFileName : '활성 모델 없음'}</strong>
            <p>{activeAsset ? buildActiveDescription(activeAsset) : '활성 모델이 없습니다. 먼저 Pose Landmarker .task 파일을 업로드해 주세요.'}</p>
          </div>
        </div>

        <div className="hero__aside">
          <article className="panel panel--section">
            <div className="section-heading">
              <span className="section-heading__code">운영</span>
              <div>
                <h2>운영 현황</h2>
                <p>실제 레퍼런스 기반으로 테스트 가능한 챌린지 수와 최근 모델 상태를 빠르게 확인합니다.</p>
              </div>
            </div>
            <div className="signal-grid">
              <div className="signal-grid__item">
                <span>활성 모델</span>
                <strong>{activeAsset ? '준비됨' : '없음'}</strong>
                <p>{activeAsset?.versionLabel ?? '모델 업로드 필요'}</p>
              </div>
              <div className="signal-grid__item">
                <span>준비된 챌린지</span>
                <strong>{readyChallenges.length}</strong>
                <p>레퍼런스 영상 + 모션 프로필 준비 완료</p>
              </div>
              <div className="signal-grid__item">
                <span>최근 생성</span>
                <strong>{createdChallengeId ? `#${createdChallengeId}` : '없음'}</strong>
                <p>{challengeSuccess ?? '이번 세션 생성 기록 없음'}</p>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="dashboard-grid admin-grid admin-grid--wide">
        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">01</span>
            <div>
              <h2>모델 업로드</h2>
              <p>Pose Landmarker `.task` 파일을 업로드하면 DB에 자산으로 등록하고 브리지 active 모델로 복사합니다.</p>
            </div>
          </div>

          <form className="admin-form" onSubmit={(event) => void handleModelSubmit(event)}>
            <label className="admin-form__field">
              <span>모델 파일</span>
              <input type="file" accept=".task" onChange={handleModelFileChange} />
            </label>

            <label className="admin-form__field">
              <span>버전 라벨</span>
              <input
                type="text"
                value={versionLabel}
                onChange={(event) => setVersionLabel(event.target.value)}
                placeholder="예: lite-v1"
              />
            </label>

            <div className="inline-actions">
              <button className="button-link" type="submit" disabled={uploading}>
                {uploading ? '업로드 중...' : '모델 업로드'}
              </button>
              <button
                className="button-link button-link--secondary"
                type="button"
                onClick={() => void loadAdminData()}
                disabled={loading || uploading || deletingAssetId !== null}
              >
                새로고침
              </button>
            </div>
          </form>

          {selectedModelFile ? <p className="admin-form__hint">선택 파일: {selectedModelFile.name}</p> : null}
          {uploadSuccess ? <p className="admin-form__message admin-form__message--success">{uploadSuccess}</p> : null}
          {uploadError ? <p className="admin-form__message admin-form__message--error">{uploadError}</p> : null}
        </article>

        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">02</span>
            <div>
              <h2>{editingChallengeId ? '챌린지 수정' : '실제 레퍼런스 챌린지 생성'}</h2>
              <p>
                {editingChallengeId
                  ? '기본 정보는 바로 수정할 수 있고, 새 레퍼런스 영상을 넣으면 분석 상태가 초기화됩니다.'
                  : '실제 레퍼런스 영상을 업로드해 새 챌린지를 만들고, 이후 같은 화면에서 바로 분석까지 실행할 수 있습니다.'}
              </p>
            </div>
          </div>

          <form className="admin-form" onSubmit={(event) => void handleChallengeSubmit(event)}>
            <label className="admin-form__field">
              <span>챌린지 제목</span>
              <input type="text" value={challengeForm.title} onChange={(event) => setChallengeForm((current) => ({ ...current, title: event.target.value }))} placeholder="예: 사이드 스텝 테스트" />
            </label>

            <label className="admin-form__field">
              <span>설명</span>
              <textarea value={challengeForm.description} onChange={(event) => setChallengeForm((current) => ({ ...current, description: event.target.value }))} placeholder="레퍼런스 동작 설명" rows={4} />
            </label>

            <div className="admin-form__split">
              <label className="admin-form__field">
                <span>카테고리</span>
                <input type="text" value={challengeForm.category} onChange={(event) => setChallengeForm((current) => ({ ...current, category: event.target.value }))} />
              </label>
              <label className="admin-form__field">
                <span>난이도</span>
                <input type="text" value={challengeForm.difficulty} onChange={(event) => setChallengeForm((current) => ({ ...current, difficulty: event.target.value }))} />
              </label>
            </div>

            <div className="admin-form__split">
              <label className="admin-form__field">
                <span>길이(초)</span>
                <input type="number" min={5} max={600} value={challengeForm.durationSec} onChange={(event) => setChallengeForm((current) => ({ ...current, durationSec: event.target.value }))} />
              </label>
              <label className="admin-form__field">
                <span>썸네일 URL</span>
                <input type="text" value={challengeForm.thumbnailUrl} onChange={(event) => setChallengeForm((current) => ({ ...current, thumbnailUrl: event.target.value }))} placeholder="선택" />
              </label>
            </div>

            <label className="admin-form__field">
              <span>가이드 영상 URL</span>
              <input type="text" value={challengeForm.guideVideoUrl} onChange={(event) => setChallengeForm((current) => ({ ...current, guideVideoUrl: event.target.value }))} placeholder="선택" />
            </label>

            <label className="admin-form__field">
              <span>{editingChallengeId ? '레퍼런스 영상 교체(선택)' : '레퍼런스 영상'}</span>
              <input type="file" accept="video/*" onChange={handleReferenceVideoChange} />
            </label>

            <div className="inline-actions">
              <button className="button-link" type="submit" disabled={challengeSubmitting}>
                {challengeSubmitting ? (editingChallengeId ? '수정 중...' : '생성 중...') : (editingChallengeId ? '챌린지 수정 저장' : '챌린지 생성')}
              </button>
              {editingChallengeId ? (
                <button className="button-link button-link--secondary" type="button" onClick={handleCancelChallengeEdit} disabled={challengeSubmitting}>
                  수정 취소
                </button>
              ) : null}
            </div>
          </form>

          {selectedReferenceVideo ? <p className="admin-form__hint">선택 영상: {selectedReferenceVideo.name}</p> : null}
          {editingChallengeId ? <p className="admin-form__hint">수정 중 챌린지 ID: #{editingChallengeId}</p> : null}
          {challengeSuccess ? <p className="admin-form__message admin-form__message--success">{challengeSuccess}</p> : null}
          {challengeError ? <p className="admin-form__message admin-form__message--error">{challengeError}</p> : null}
        </article>
      </section>

      <section className="dashboard-grid admin-grid admin-grid--wide">
        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">03</span>
            <div>
              <h2>레퍼런스 분석 실행</h2>
              <p>검색, 카테고리, 상태 필터와 정렬로 대상을 빠르게 찾고 레퍼런스 분석을 함께 관리합니다.</p>
            </div>
          </div>

          {analysisMessage ? <p className="admin-form__message admin-form__message--success">{analysisMessage}</p> : null}
          {analysisError ? <p className="admin-form__message admin-form__message--error">{analysisError}</p> : null}
          {error ? <p className="admin-form__message admin-form__message--error">{error}</p> : null}

          <div className="admin-filter-bar">
            <label className="admin-form__field admin-filter-bar__search">
              <span>검색</span>
              <input
                type="text"
                value={challengeSearch}
                onChange={(event) => setChallengeSearch(event.target.value)}
                placeholder="제목, 설명, 카테고리, ID 검색"
              />
            </label>
            <div className="admin-filter-bar__categories">
              <span className="admin-filter-bar__label">카테고리</span>
              <div className="archive-filter-group">
                {categoryOptions.map((category) => {
                  const isActive = activeCategoryFilter === category;
                  const count =
                    category === 'ALL'
                      ? challenges.length
                      : challenges.filter((challenge) => challenge.category === category).length;

                  return (
                    <button
                      key={category}
                      className={`archive-filter ${isActive ? 'archive-filter--active' : ''}`}
                      type="button"
                      onClick={() => setActiveCategoryFilter(category)}
                    >
                      <span>{category === 'ALL' ? '전체' : category}</span>
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="admin-filter-bar__categories">
              <span className="admin-filter-bar__label">상태</span>
              <div className="archive-filter-group">
                {[
                  { key: 'ALL', label: '전체', count: challenges.length },
                  { key: 'ACTIVE', label: '활성', count: challenges.filter((challenge) => challenge.isActive).length },
                  { key: 'INACTIVE', label: '비활성', count: challenges.filter((challenge) => !challenge.isActive).length },
                ].map((filter) => {
                  const isActive = activeStatusFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      className={`archive-filter ${isActive ? 'archive-filter--active' : ''}`}
                      type="button"
                      onClick={() => setActiveStatusFilter(filter.key as ChallengeStatusFilter)}
                    >
                      <span>{filter.label}</span>
                      <strong>{filter.count}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="admin-form__field admin-filter-bar__sort">
              <span>정렬</span>
              <select value={activeSort} onChange={(event) => setActiveSort(event.target.value as ChallengeSortOption)}>
                <option value="NEWEST">최신 등록순</option>
                <option value="OLDEST">오래된 등록순</option>
                <option value="TITLE_ASC">제목 오름차순</option>
                <option value="TITLE_DESC">제목 내림차순</option>
              </select>
            </label>
          </div>

          <p className="archive-filter__summary">
            <strong>{filteredChallenges.length}</strong>개 챌린지가 현재 필터와 정렬 기준에 맞습니다.
          </p>

          {loading ? (
            <p>챌린지 목록을 불러오는 중입니다.</p>
          ) : filteredChallenges.length === 0 ? (
            <p>검색 조건에 맞는 챌린지가 없습니다.</p>
          ) : (
            <div className="admin-asset-list">
              {filteredChallenges.map((challenge) => (
                <article key={challenge.id} className={`admin-asset-card${challenge.referenceMotionProfileReady ? ' admin-asset-card--active' : ''}`}>
                  <div className="admin-asset-card__header">
                    <strong>{challenge.title}</strong>
                    <div className="admin-asset-card__meta">
                      <span className={`pill ${challenge.isActive ? '' : 'pill--muted'}`}>{challenge.isActive ? '활성' : '비활성'}</span>
                      <span className="pill">#{challenge.id}</span>
                    </div>
                  </div>
                  <p>레퍼런스 영상: {challenge.referenceVideoUploaded ? '업로드됨' : '없음'}</p>
                  <p>분석 상태: {challenge.referenceAnalysisStatus}</p>
                  <p>프로필 상태: {challenge.referenceMotionProfileReady ? '준비됨' : '대기 중'}</p>
                  <div className="inline-actions">
                    <Link
                      className="button-link button-link--secondary"
                      to={`/admin/challenges/${challenge.id}/analysis`}
                    >
                      분석 상세 보기
                    </Link>
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id}
                      onClick={() => void handleToggleChallengeActive(challenge)}
                    >
                      {togglingId === challenge.id ? '변경 중...' : challenge.isActive ? '비활성으로 전환' : '활성으로 전환'}
                    </button>
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id}
                      onClick={() => handleEditChallenge(challenge)}
                    >
                      수정
                    </button>
                    <button
                      className="button-link"
                      type="button"
                      disabled={!challenge.referenceVideoUploaded || analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id || !challenge.isActive}
                      onClick={() => void handleAnalyzeReference(challenge.id)}
                    >
                      {analyzingId === challenge.id ? '분석 중...' : '레퍼런스 분석 실행'}
                    </button>
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id}
                      onClick={() => void handleDeleteChallenge(challenge)}
                    >
                      {deletingId === challenge.id ? '삭제 중...' : '챌린지 삭제'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="panel panel--section">
          <div className="section-heading">
            <span className="section-heading__code">04</span>
            <div>
              <h2>모델 이력</h2>
              <p>업로드된 모델 자산 목록입니다. 새 업로드가 자동으로 active 상태가 됩니다.</p>
            </div>
          </div>

          {loading ? (
            <p>모델 이력을 불러오는 중입니다.</p>
          ) : assets.length > 0 ? (
            <div className="admin-asset-list">
              {assets.map((asset) => (
                <article key={asset.id} className={`admin-asset-card${asset.active ? ' admin-asset-card--active' : ''}`}>
                  <div className="admin-asset-card__header">
                    <strong>{asset.originalFileName}</strong>
                    <span className="pill">{asset.active ? '활성' : '보관'}</span>
                  </div>
                  <p>{asset.versionLabel ? `버전 ${asset.versionLabel}` : '버전 라벨 없음'}</p>
                  <p>크기: {formatFileSize(asset.size)}</p>
                  <p>저장 시각: {new Date(asset.createdAt).toLocaleString('ko-KR')}</p>
                  <div className="inline-actions">
                    <button
                      className="button-link button-link--secondary"
                      type="button"
                      disabled={deletingAssetId === asset.id || uploading}
                      onClick={() => void handleDeleteModelAsset(asset)}
                    >
                      {deletingAssetId === asset.id ? '삭제 중...' : '모델 삭제'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>등록된 모델 자산이 아직 없습니다.</p>
          )}
        </article>
      </section>
    </div>
  );
}

function buildActiveDescription(asset: ModelAsset) {
  return `${asset.versionLabel ?? '버전 라벨 없음'} / ${formatFileSize(asset.size)} / ${new Date(asset.updatedAt).toLocaleString('ko-KR')}`;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} B`;
}
