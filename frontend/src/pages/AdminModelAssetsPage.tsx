import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getActivePoseLandmarkerAsset,
  getPoseLandmarkerAssets,
  uploadPoseLandmarkerModel,
} from '../shared/api/adminApi';
import { analyzeChallengeReference, createChallenge, getChallenges } from '../shared/api/challengeApi';
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

  const [challengeForm, setChallengeForm] = useState(initialChallengeForm);
  const [selectedReferenceVideo, setSelectedReferenceVideo] = useState<File | null>(null);
  const [challengeSubmitting, setChallengeSubmitting] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [challengeSuccess, setChallengeSuccess] = useState<string | null>(null);
  const [createdChallengeId, setCreatedChallengeId] = useState<number | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    void loadAdminData();
  }, []);

  const readyChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady),
    [challenges],
  );

  async function loadAdminData() {
    setLoading(true);
    setError(null);

    try {
      const [assetList, active, challengeList] = await Promise.all([
        getPoseLandmarkerAssets(),
        getActivePoseLandmarkerAsset().catch(() => null),
        getChallenges(),
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

  function handleReferenceVideoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedReferenceVideo(file);
    setChallengeError(null);
    setChallengeSuccess(null);
  }

  async function handleChallengeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedReferenceVideo) {
      setChallengeError('레퍼런스 영상을 먼저 선택해 주세요.');
      return;
    }

    setChallengeSubmitting(true);
    setChallengeError(null);
    setChallengeSuccess(null);
    setAnalysisMessage(null);
    setAnalysisError(null);

    try {
      const created = await createChallenge({
        title: challengeForm.title,
        description: challengeForm.description,
        category: challengeForm.category,
        difficulty: challengeForm.difficulty,
        thumbnailUrl: challengeForm.thumbnailUrl,
        guideVideoUrl: challengeForm.guideVideoUrl,
        durationSec: Number(challengeForm.durationSec),
        referenceVideo: selectedReferenceVideo,
      });
      setCreatedChallengeId(created.id);
      setChallengeSuccess(`챌린지 생성 완료: ${created.title} (#${created.id})`);
      setChallengeForm(initialChallengeForm);
      setSelectedReferenceVideo(null);
      await loadAdminData();
    } catch (submitError) {
      setChallengeError(submitError instanceof Error ? submitError.message : '챌린지 생성에 실패했습니다.');
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
              <button className="button-link button-link--secondary" type="button" onClick={() => void loadAdminData()} disabled={loading}>
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
              <h2>실제 레퍼런스 챌린지 생성</h2>
              <p>실제 레퍼런스 영상을 업로드해 새 챌린지를 만들고, 이후 같은 화면에서 바로 분석까지 실행할 수 있습니다.</p>
            </div>
          </div>

          <form className="admin-form" onSubmit={(event) => void handleChallengeSubmit(event)}>
            <label className="admin-form__field">
              <span>챌린지 제목</span>
              <input type="text" value={challengeForm.title} onChange={(event) => setChallengeForm((current) => ({ ...current, title: event.target.value }))} placeholder="예: 사이드 스텝 테스트" />
            </label>

            <label className="admin-form__field">
              <span>설명</span>
              <input type="text" value={challengeForm.description} onChange={(event) => setChallengeForm((current) => ({ ...current, description: event.target.value }))} placeholder="레퍼런스 동작 설명" />
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
              <span>레퍼런스 영상</span>
              <input type="file" accept="video/*" onChange={handleReferenceVideoChange} />
            </label>

            <div className="inline-actions">
              <button className="button-link" type="submit" disabled={challengeSubmitting}>
                {challengeSubmitting ? '생성 중...' : '챌린지 생성'}
              </button>
            </div>
          </form>

          {selectedReferenceVideo ? <p className="admin-form__hint">선택 영상: {selectedReferenceVideo.name}</p> : null}
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
              <p>레퍼런스 영상 업로드가 끝난 챌린지에서 실제 모션 프로필 생성을 실행합니다.</p>
            </div>
          </div>

          {analysisMessage ? <p className="admin-form__message admin-form__message--success">{analysisMessage}</p> : null}
          {analysisError ? <p className="admin-form__message admin-form__message--error">{analysisError}</p> : null}
          {error ? <p className="admin-form__message admin-form__message--error">{error}</p> : null}

          {loading ? (
            <p>챌린지 목록을 불러오는 중입니다.</p>
          ) : (
            <div className="admin-asset-list">
              {challenges.map((challenge) => (
                <article key={challenge.id} className={`admin-asset-card${challenge.referenceMotionProfileReady ? ' admin-asset-card--active' : ''}`}>
                  <div className="admin-asset-card__header">
                    <strong>{challenge.title}</strong>
                    <span className="pill">#{challenge.id}</span>
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
                      className="button-link"
                      type="button"
                      disabled={!challenge.referenceVideoUploaded || analyzingId === challenge.id}
                      onClick={() => void handleAnalyzeReference(challenge.id)}
                    >
                      {analyzingId === challenge.id ? '분석 중...' : '레퍼런스 분석 실행'}
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
