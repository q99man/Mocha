import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { Pagination } from '../shared/components/Pagination';
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

const CHALLENGES_PER_PAGE = 6;
const ASSETS_PER_PAGE = 5;

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

  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
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
  const [challengePage, setChallengePage] = useState(1);
  const [assetPage, setAssetPage] = useState(1);

  useEffect(() => {
    void loadAdminData();
  }, []);

  const readyChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady),
    [challenges],
  );

  const activeChallenges = useMemo(() => challenges.filter((challenge) => challenge.isActive), [challenges]);

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
    if (!challengeModalOpen) {
      body.classList.remove('body--modal-open');
      return;
    }

    body.classList.add('body--modal-open');
    return () => {
      body.classList.remove('body--modal-open');
    };
  }, [challengeModalOpen]);

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

  function handleModelFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedModelFile(event.target.files?.[0] ?? null);
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
      `"${asset.originalFileName}" 모델을 삭제하시겠습니까?\n활성 모델이라면 상태를 정리하고, 다른 최신 모델이 있으면 자동으로 다시 활성화됩니다.`,
    );
    if (!confirmed) return;
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

  function openCreateChallengeModal() {
    setEditingChallengeId(null);
    setChallengeForm(initialChallengeForm);
    setSelectedReferenceVideo(null);
    setChallengeError(null);
    setChallengeModalOpen(true);
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
    setChallengeModalOpen(true);
  }

  function closeChallengeModal() {
    if (challengeSubmitting) return;
    setChallengeModalOpen(false);
    setEditingChallengeId(null);
    setChallengeForm(initialChallengeForm);
    setSelectedReferenceVideo(null);
    setChallengeError(null);
  }

  function handleReferenceVideoChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedReferenceVideo(event.target.files?.[0] ?? null);
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
        difficulty: challengeForm.difficulty,
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
    const confirmed = window.confirm(`정말로 "${challenge.title}" 챌린지를 삭제하시겠습니까?\n연결된 시도 기록과 업로드 파일도 함께 정리됩니다.`);
    if (!confirmed) return;
    setDeletingId(challenge.id);
    setAnalysisMessage(null);
    setAnalysisError(null);
    setChallengeSuccess(null);
    try {
      await deleteChallenge(challenge.id);
      setAnalysisMessage(`챌린지 삭제 완료: ${challenge.title} (#${challenge.id})`);
      if (createdChallengeId === challenge.id) setCreatedChallengeId(null);
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

  return (
    <>
      <div className="glass-page">
        <section className="glass-intro">
          <div>
            <span className="glass-intro__eyebrow">운영 허브</span>
            <h2>모델과 챌린지를 한 흐름으로 관리합니다</h2>
            <p>상단은 모델 등록과 자산 확인, 하단은 챌린지 상태 관리와 분석 실행에 집중하도록 재구성했습니다.</p>
          </div>
          <div className="glass-intro__meta">
            <div><span>활성 모델</span><strong>{activeAsset ? '1' : '0'}</strong></div>
            <div><span>활성 챌린지</span><strong>{String(activeChallenges.length).padStart(2, '0')}</strong></div>
            <div><span>분석 준비</span><strong>{String(readyChallenges.length).padStart(2, '0')}</strong></div>
          </div>
        </section>

        <section className="glass-panel">
          <div className="glass-form-grid">
            <form className="glass-panel glass-panel--nested glass-form" onSubmit={(event) => void handleModelSubmit(event)}>
              <div className="glass-toolbar">
                <div>
                  <h3 className="glass-section-title">모델 등록</h3>
                  <p className="glass-toolbar__note">새 `.task` 모델을 올리면 즉시 운영 자산으로 반영됩니다.</p>
                </div>
              </div>
              <label className="glass-field"><span>모델 파일</span><input type="file" accept=".task" onChange={handleModelFileChange} /></label>
              <label className="glass-field"><span>버전 라벨</span><input type="text" value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="예: lite-v1" /></label>
              <div className="inline-actions"><button className="button-link" type="submit" disabled={uploading}>{uploading ? '업로드 중...' : '모델 업로드'}</button></div>
              {selectedModelFile ? <p className="glass-toolbar__note">선택 파일: {selectedModelFile.name}</p> : null}
              {uploadSuccess ? <p className="review-composer__message review-composer__message--success">{uploadSuccess}</p> : null}
              {uploadError ? <p className="review-composer__message review-composer__message--error">{uploadError}</p> : null}
            </form>

            <div className="glass-panel glass-panel--nested">
              <div className="glass-toolbar">
                <div>
                  <h3 className="glass-section-title">모델 자산</h3>
                  <p className="glass-toolbar__note">등록된 모델 자산을 확인하고 필요 없는 항목은 바로 정리할 수 있습니다.</p>
                </div>
              </div>
              <div className="glass-inline-meta">
                <span>현재 모델 {activeAsset?.originalFileName ?? '없음'}</span>
                <span>{activeAsset ? buildActiveDescription(activeAsset) : '업로드 필요'}</span>
                {createdChallengeId ? <span>최근 생성 #{createdChallengeId}</span> : null}
              </div>
              {loading ? <div className="glass-panel glass-panel--nested glass-panel--empty"><strong>모델 자산을 불러오는 중입니다.</strong></div> : null}
              {!loading && pagedAssets.length === 0 ? <div className="glass-panel glass-panel--nested glass-panel--empty"><strong>등록된 모델 자산이 없습니다.</strong></div> : null}
              {!loading && pagedAssets.length > 0 ? (
                <div className="glass-list">
                  {pagedAssets.map((asset) => (
                    <article className="glass-list-item" key={asset.id}>
                      <div className="glass-list-item__content">
                        <div className="glass-list-item__header">
                          <div><span className="glass-list-item__eyebrow">모델 #{asset.id}</span><strong>{asset.originalFileName}</strong></div>
                          <span className={`glass-badge${asset.active ? ' is-accent' : ''}`}>{asset.active ? '활성' : '보관'}</span>
                        </div>
                        <div className="glass-inline-meta"><span>{asset.versionLabel ?? '버전 라벨 없음'}</span><span>{formatFileSize(asset.size)}</span><span>{new Date(asset.createdAt).toLocaleString('ko-KR')}</span></div>
                      </div>
                      <div className="glass-list-item__actions"><button className="button-link button-link--secondary" type="button" disabled={deletingAssetId === asset.id || uploading} onClick={() => void handleDeleteModelAsset(asset)}>{deletingAssetId === asset.id ? '삭제 중...' : '모델 삭제'}</button></div>
                    </article>
                  ))}
                </div>
              ) : null}
              <Pagination currentPage={assetPage} totalPages={assetTotalPages} onPageChange={setAssetPage} />
            </div>
          </div>
        </section>
        <section className="glass-panel">
          <div className="glass-toolbar">
            <div>
              <h3 className="glass-section-title">챌린지 관리</h3>
              <p className="glass-toolbar__note">필터링, 상태 변경, 분석 실행을 한 곳에서 관리하고 생성은 모달로 분리했습니다.</p>
            </div>
            <div className="inline-actions">
              <button className="button-link button-link--secondary" type="button" onClick={() => void loadAdminData()}>새로고침</button>
              <button className="button-link" type="button" onClick={openCreateChallengeModal}>챌린지 등록</button>
            </div>
          </div>

          {(analysisMessage || analysisError || error || challengeSuccess) ? (
            <div className="glass-status-stack">
              {analysisMessage ? <p className="review-composer__message review-composer__message--success">{analysisMessage}</p> : null}
              {challengeSuccess ? <p className="review-composer__message review-composer__message--success">{challengeSuccess}</p> : null}
              {analysisError ? <p className="review-composer__message review-composer__message--error">{analysisError}</p> : null}
              {error ? <p className="review-composer__message review-composer__message--error">{error}</p> : null}
            </div>
          ) : null}

          <div className="glass-toolbar glass-toolbar--stack">
            <div className="glass-toolbar__row">
              <label className="glass-select">
                <span>검색</span>
                <input type="text" value={challengeSearch} onChange={(event) => setChallengeSearch(event.target.value)} placeholder="제목, 설명, 카테고리, ID" />
              </label>
              <label className="glass-select">
                <span>카테고리</span>
                <select value={activeCategoryFilter} onChange={(event) => setActiveCategoryFilter(event.target.value)}>
                  {categoryOptions.map((category) => <option key={category} value={category}>{category === 'ALL' ? '전체' : category}</option>)}
                </select>
              </label>
              <label className="glass-select">
                <span>상태</span>
                <select value={activeStatusFilter} onChange={(event) => setActiveStatusFilter(event.target.value as ChallengeStatusFilter)}>
                  <option value="ALL">전체</option>
                  <option value="ACTIVE">활성</option>
                  <option value="INACTIVE">비활성</option>
                </select>
              </label>
              <label className="glass-select">
                <span>정렬</span>
                <select value={activeSort} onChange={(event) => setActiveSort(event.target.value as ChallengeSortOption)}>
                  <option value="NEWEST">최신순</option>
                  <option value="OLDEST">오래된순</option>
                  <option value="TITLE_ASC">제목 오름차순</option>
                  <option value="TITLE_DESC">제목 내림차순</option>
                </select>
              </label>
            </div>
            <p className="glass-toolbar__note">현재 조건에 맞는 챌린지 {filteredChallenges.length}개</p>
          </div>

          {loading ? <div className="glass-panel glass-panel--nested glass-panel--empty"><strong>챌린지 목록을 불러오는 중입니다.</strong></div> : null}
          {!loading && pagedChallenges.length === 0 ? <div className="glass-panel glass-panel--nested glass-panel--empty"><strong>조건에 맞는 챌린지가 없습니다.</strong></div> : null}
          {!loading && pagedChallenges.length > 0 ? (
            <div className="glass-list">
              {pagedChallenges.map((challenge) => (
                <article className="glass-list-item" key={challenge.id}>
                  <div className="glass-list-item__content">
                    <div className="glass-list-item__header">
                      <div><span className="glass-list-item__eyebrow">챌린지 #{challenge.id}</span><strong>{challenge.title}</strong></div>
                      <div className="glass-list-item__actions">
                        <span className={`glass-badge${challenge.isActive ? ' is-accent' : ''}`}>{challenge.isActive ? '활성' : '비활성'}</span>
                        <span className={`glass-badge${challenge.referenceMotionProfileReady ? ' is-accent' : ''}`}>{challenge.referenceMotionProfileReady ? '준비 완료' : '프로필 대기'}</span>
                      </div>
                    </div>
                    <p className="glass-list-item__description">{challenge.description}</p>
                    <div className="glass-inline-meta"><span>{challenge.category}</span><span>{challenge.difficulty}</span><span>영상 {challenge.referenceVideoUploaded ? '등록됨' : '없음'}</span><span>분석 {formatReferenceStatus(challenge.referenceAnalysisStatus)}</span></div>
                  </div>
                  <div className="glass-list-item__actions">
                    <Link className="button-link button-link--secondary" to={`/admin/challenges/${challenge.id}/analysis`}>분석 보기</Link>
                    <button className="button-link button-link--secondary" type="button" disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id} onClick={() => handleEditChallenge(challenge)}>수정</button>
                    <button className="button-link button-link--secondary" type="button" disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id} onClick={() => void handleToggleChallengeActive(challenge)}>{togglingId === challenge.id ? '변경 중...' : challenge.isActive ? '비활성' : '활성'}</button>
                    <button className="button-link" type="button" disabled={!challenge.referenceVideoUploaded || !challenge.isActive || analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id} onClick={() => void handleAnalyzeReference(challenge.id)}>{analyzingId === challenge.id ? '분석 중...' : '분석 실행'}</button>
                    <button className="button-link button-link--secondary" type="button" disabled={analyzingId === challenge.id || deletingId === challenge.id || togglingId === challenge.id} onClick={() => void handleDeleteChallenge(challenge)}>{deletingId === challenge.id ? '삭제 중...' : '삭제'}</button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          <Pagination currentPage={challengePage} totalPages={challengeTotalPages} onPageChange={setChallengePage} />
        </section>
      </div>

      {challengeModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="glass-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-modal-title">
              <div className="glass-modal__backdrop" onClick={closeChallengeModal} />
              <div className="glass-modal__panel">
                <form className="glass-panel glass-form" onSubmit={(event) => void handleChallengeSubmit(event)}>
                  <div className="glass-toolbar">
                    <div>
                      <h3 className="glass-section-title" id="challenge-modal-title">{editingChallengeId ? '챌린지 수정' : '챌린지 생성'}</h3>
                      <p className="glass-toolbar__note">{editingChallengeId ? '기본 정보를 수정하고 필요하면 레퍼런스 영상도 함께 교체합니다.' : '레퍼런스 영상을 등록해 새 챌린지를 생성합니다.'}</p>
                    </div>
                    <button className="button-link button-link--secondary" type="button" onClick={closeChallengeModal} disabled={challengeSubmitting}>닫기</button>
                  </div>
                  <label className="glass-field"><span>챌린지 제목</span><input type="text" value={challengeForm.title} onChange={(event) => setChallengeForm((current) => ({ ...current, title: event.target.value }))} placeholder="예: 사이드 스텝 테스트" /></label>
                  <label className="glass-field"><span>설명</span><textarea value={challengeForm.description} rows={4} onChange={(event) => setChallengeForm((current) => ({ ...current, description: event.target.value }))} placeholder="레퍼런스 동작 설명" /></label>
                  <div className="glass-form__split">
                    <label className="glass-field"><span>카테고리</span><input type="text" value={challengeForm.category} onChange={(event) => setChallengeForm((current) => ({ ...current, category: event.target.value }))} /></label>
                    <label className="glass-field"><span>난이도</span><input type="text" value={challengeForm.difficulty} onChange={(event) => setChallengeForm((current) => ({ ...current, difficulty: event.target.value }))} /></label>
                  </div>
                  <div className="glass-form__split">
                    <label className="glass-field"><span>길이(초)</span><input type="number" min={5} max={600} value={challengeForm.durationSec} onChange={(event) => setChallengeForm((current) => ({ ...current, durationSec: event.target.value }))} /></label>
                    <label className="glass-field"><span>썸네일 URL</span><input type="text" value={challengeForm.thumbnailUrl} onChange={(event) => setChallengeForm((current) => ({ ...current, thumbnailUrl: event.target.value }))} placeholder="선택" /></label>
                  </div>
                  <label className="glass-field"><span>가이드 영상 URL</span><input type="text" value={challengeForm.guideVideoUrl} onChange={(event) => setChallengeForm((current) => ({ ...current, guideVideoUrl: event.target.value }))} placeholder="선택" /></label>
                  <label className="glass-field"><span>{editingChallengeId ? '레퍼런스 영상 교체(선택)' : '레퍼런스 영상'}</span><input type="file" accept="video/*" onChange={handleReferenceVideoChange} /></label>
                  <div className="inline-actions">
                    <button className="button-link" type="submit" disabled={challengeSubmitting}>{challengeSubmitting ? (editingChallengeId ? '수정 중...' : '생성 중...') : editingChallengeId ? '수정 저장' : '챌린지 생성'}</button>
                    <button className="button-link button-link--secondary" type="button" onClick={closeChallengeModal} disabled={challengeSubmitting}>취소</button>
                  </div>
                  {selectedReferenceVideo ? <p className="glass-toolbar__note">선택 영상: {selectedReferenceVideo.name}</p> : null}
                  {editingChallengeId ? <p className="glass-toolbar__note">수정 중 챌린지 ID: #{editingChallengeId}</p> : null}
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

function formatReferenceStatus(status: string) {
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
