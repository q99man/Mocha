import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  completeAsyncPendingAttempt,
  createAttempt,
  uploadAttemptVideo,
} from '../../shared/api/attemptApi';
import { getMotionSessionState } from '../../shared/api/motionApi';
import type { MotionSessionState } from '../../shared/types/motion';
import type {
  AttemptRecordType,
  AttemptSummary,
  AttemptVideoResult,
} from '../../shared/types/attempt';

type CameraState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'missing'
  | 'unavailable'
  | 'unsupported'
  | 'error';

type FlowStage = 'camera-check' | 'camera-ready' | 'recording-placeholder';

type CameraPermissionPanelProps = {
  challengeId: number;
  challengeTitle?: string;
};

const DEFAULT_MESSAGE = '카메라 권한과 업로드 기반 도전 흐름을 확인하는 준비 단계입니다.';

export function CameraPermissionPanel({ challengeId, challengeTitle }: CameraPermissionPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [flowStage, setFlowStage] = useState<FlowStage>('camera-check');
  const [sessionState, setSessionState] = useState<MotionSessionState | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAttempt, setSavedAttempt] = useState<AttemptSummary | null>(null);

  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [pendingCompletionLoading, setPendingCompletionLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedAttempt, setUploadedAttempt] = useState<AttemptVideoResult | null>(null);
  const [trackingIdCopied, setTrackingIdCopied] = useState(false);

  const pendingUploadAwaitingCompletion =
    uploadedAttempt?.processingMode === 'ASYNC_JOB_PENDING' && !uploadedAttempt.processingComplete;
  const uploadedAttemptResultId = uploadedAttempt?.attemptId ?? null;
  const pendingTrackingId = uploadedAttempt?.pendingTrackingId ?? null;
  const recentRuntimeTrace = (sessionState?.serverRuntimeTrace ?? []).slice(-3).reverse();

  async function loadMotionSessionState(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    if (silent) {
      setSessionRefreshing(true);
    } else {
      setSessionLoading(true);
    }

    setSessionError(null);

    try {
      const response = await getMotionSessionState(challengeId);
      setSessionState(response);
      setMessage(response.message || DEFAULT_MESSAGE);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : '세션 준비 정보를 불러오지 못했습니다.');
    } finally {
      if (silent) {
        setSessionRefreshing(false);
      } else {
        setSessionLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadMotionSessionState();

    return () => {
      stopStream();
    };
  }, [challengeId]);

  useEffect(() => {
    if (!pendingUploadAwaitingCompletion) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadMotionSessionState({ silent: true });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [challengeId, pendingUploadAwaitingCompletion]);

  async function requestCameraAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setMessage('현재 브라우저에서는 카메라 기능을 지원하지 않습니다. 그래도 업로드 기반 흐름은 계속 확인할 수 있습니다.');
      return;
    }

    setCameraState('requesting');
    setSaveError(null);
    setUploadError(null);
    setMessage('카메라 권한을 요청하고 있습니다...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stopStream();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraState('granted');
      setFlowStage('camera-ready');
      setMessage('카메라 준비가 완료되었습니다. 다음 단계로 이동해 업로드 흐름을 확인할 수 있습니다.');
    } catch (error) {
      handleCameraError(error);
    }
  }

  function handleCameraError(error: unknown) {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          setCameraState('denied');
          setMessage('카메라 권한이 거부되었습니다. 브라우저 설정에서 다시 허용하거나 업로드 흐름만 먼저 확인해 주세요.');
          return;
        case 'NotFoundError':
          setCameraState('missing');
          setMessage('사용 가능한 카메라를 찾지 못했습니다. 카메라 없이도 업로드 기반 흐름은 계속 확인할 수 있습니다.');
          return;
        case 'NotReadableError':
          setCameraState('unavailable');
          setMessage('카메라 장치에 접근할 수 없습니다. 다른 앱 사용 여부를 확인하거나 업로드 흐름으로 계속 진행해 주세요.');
          return;
        default:
          setCameraState('error');
          setMessage('카메라를 준비하는 중 문제가 발생했습니다. 다시 시도하거나 업로드 흐름으로 계속 진행해 주세요.');
          return;
      }
    }

    setCameraState('error');
    setMessage('카메라를 준비하는 중 문제가 발생했습니다. 다시 시도하거나 업로드 흐름으로 계속 진행해 주세요.');
  }

  function moveToRecordingPlaceholder() {
    setFlowStage('recording-placeholder');
    setSaveError(null);
    setUploadError(null);
    setMessage('이 단계에서는 시도 비디오 업로드, 준비 상태 저장, 샘플 완료 결과 저장을 모두 확인할 수 있습니다.');
  }

  function continueWithoutCamera() {
    setFlowStage('recording-placeholder');
    setSaveError(null);
    setUploadError(null);
    setMessage('카메라 없이도 업로드와 결과 흐름을 계속 확인할 수 있습니다.');
  }

  async function saveAttempt(recordType: AttemptRecordType) {
    setSaveLoading(true);
    setSaveError(null);
    setUploadedAttempt(null);
    setTrackingIdCopied(false);

    try {
      const response = await createAttempt({
        challengeId,
        score: buildPreviewScore(recordType, cameraState),
        notes: buildAttemptNote(cameraState, recordType),
        recordType,
      });
      setSavedAttempt(response);
      setMessage(
        recordType === 'completed'
          ? '샘플 완료 결과가 저장되었습니다. 결과 화면에서 현재 preview 구조를 확인해 주세요.'
          : '준비 상태가 저장되었습니다. 결과 화면에서 다음 단계 흐름을 확인해 주세요.',
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '도전 기록을 저장하지 못했습니다.');
    } finally {
      setSaveLoading(false);
    }
  }

  async function submitAttemptVideo() {
    if (!selectedVideo) {
      setUploadError('업로드할 시도 비디오를 먼저 선택해 주세요.');
      return;
    }

    setUploadLoading(true);
    setPendingCompletionLoading(false);
    setTrackingIdCopied(false);
    setUploadError(null);
    setSavedAttempt(null);

    try {
      const response = await uploadAttemptVideo({
        challengeId,
        notes: buildVideoAttemptNote(cameraState),
        attemptVideo: selectedVideo,
      });
      setUploadedAttempt(response);
      await loadMotionSessionState({ silent: true });
      setMessage(
        response.processingComplete
          ? '시도 비디오 업로드와 자동 채점이 완료되었습니다. 결과 화면에서 점수와 요약을 확인해 주세요.'
          : '시도 비디오 업로드가 접수되었습니다. 현재는 비동기 대기 상태이며, 로컬 완료 처리로 다음 단계를 이어갈 수 있습니다.',
      );
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '시도 비디오를 업로드하지 못했습니다.');
    } finally {
      setUploadLoading(false);
    }
  }

  async function completePendingUpload() {
    setPendingCompletionLoading(true);
    setUploadError(null);

    try {
      const response = await completeAsyncPendingAttempt({
        challengeId,
        trackingId: pendingTrackingId ?? undefined,
        notes: buildVideoAttemptNote(cameraState),
      });
      setUploadedAttempt(response);
      setTrackingIdCopied(false);
      await loadMotionSessionState({ silent: true });
      setMessage('비동기 대기 업로드를 로컬 완료 처리로 마무리했습니다. 결과 화면에서 자동 채점 결과를 확인해 주세요.');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '대기 중인 업로드를 완료 처리하지 못했습니다.');
    } finally {
      setPendingCompletionLoading(false);
    }
  }

  async function copyPendingTrackingId() {
    if (!pendingTrackingId || !navigator.clipboard?.writeText) {
      setUploadError('추적 ID를 복사할 수 없는 환경입니다.');
      return;
    }

    try {
      await navigator.clipboard.writeText(pendingTrackingId);
      setTrackingIdCopied(true);
      setUploadError(null);
      window.setTimeout(() => setTrackingIdCopied(false), 1600);
    } catch {
      setUploadError('추적 ID 복사에 실패했습니다. 직접 선택해 복사해 주세요.');
    }
  }

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function resetCamera() {
    stopStream();
    setCameraState('idle');
    setFlowStage('camera-check');
    setSavedAttempt(null);
    setSelectedVideo(null);
    setUploadedAttempt(null);
    setTrackingIdCopied(false);
    setSaveError(null);
    setUploadError(null);
    setPendingCompletionLoading(false);
    setMessage(sessionState?.message ?? DEFAULT_MESSAGE);
  }

  const canContinueWithoutCamera = ['missing', 'unavailable', 'unsupported', 'denied', 'error'].includes(cameraState);

  return (
    <section className="panel">
      <h2>{challengeTitle ? `${challengeTitle} 준비 화면` : '카메라 준비 화면'}</h2>
      {sessionLoading ? <p>세션 준비 정보를 불러오는 중입니다...</p> : null}
      {!sessionLoading && sessionError ? <p>{sessionError}</p> : null}
      {!sessionLoading && !sessionError ? <p>{message}</p> : null}

      {sessionState ? (
        <>
          <div className="camera-panel__contract">
            <div className="camera-panel__status">
              <span className="pill">세션 상태</span>
              <strong>{sessionStateLabel(sessionState.sessionState)}</strong>
            </div>
            <div className="camera-panel__status">
              <span className="pill">다음 단계</span>
              <strong>{nextActionLabel(sessionState.nextAction)}</strong>
            </div>
            <div className="camera-panel__status">
              <span className="pill">서버 상태</span>
              <strong>{runtimeStateLabel(sessionState.runtimeState)}</strong>
            </div>
            {sessionState.latestAttemptId ? (
              <div className="camera-panel__status">
                <span className="pill">최근 결과</span>
                <strong>#{sessionState.latestAttemptId}</strong>
              </div>
            ) : null}
          </div>
          {recentRuntimeTrace.length > 0 ? (
            <div className="camera-runtime-feed">
              <strong>최근 서버 상태 변화</strong>
              <ul className="camera-runtime-feed__list">
                {recentRuntimeTrace.map((trace, index) => (
                  <li
                    className={`camera-runtime-feed__item${trace.runtimeState === 'FAILED_RETRYABLE' ? ' camera-runtime-feed__item--warn' : ''}`}
                    key={`${trace.runtimeState}-${trace.recordedAt ?? 'none'}-${index}`}
                  >
                    <span className="pill">{runtimeStateLabel(trace.runtimeState)}</span>
                    <span>{runtimeSourceLabel(trace.source)}</span>
                    <span>{formatRuntimeRecordedAt(trace.recordedAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="camera-panel__actions">
        <button
          className="button-link"
          type="button"
          onClick={requestCameraAccess}
          disabled={cameraState === 'requesting' || sessionLoading || Boolean(sessionError)}
        >
          {cameraState === 'requesting' ? '권한 요청 중...' : '카메라 권한 확인'}
        </button>
        <button
          className="button-link button-link--secondary"
          type="button"
          onClick={() => void loadMotionSessionState({ silent: true })}
          disabled={sessionLoading || sessionRefreshing}
        >
          {sessionRefreshing ? '세션 새로고침 중...' : '세션 상태 새로고침'}
        </button>
        {cameraState === 'granted' ? (
          <button className="button-link button-link--secondary" type="button" onClick={resetCamera}>
            다시 준비하기
          </button>
        ) : null}
        {canContinueWithoutCamera ? (
          <button className="button-link button-link--secondary" type="button" onClick={continueWithoutCamera}>
            카메라 없이 흐름 계속 보기
          </button>
        ) : null}
      </div>

      <div className="camera-panel__status">
        <span className="pill">카메라 상태</span>
        <strong>{cameraStateLabel(cameraState)}</strong>
      </div>

      {cameraState === 'granted' ? (
        <>
          <div className="camera-preview">
            <video ref={videoRef} className="camera-preview__video" autoPlay muted playsInline />
          </div>
          {flowStage === 'camera-ready' ? (
            <div className="session-placeholder">
              <span className="pill">준비 완료</span>
              <h3>도전 시작 전 확인</h3>
              <p>카메라 연결이 끝났습니다. 다음 단계로 이동해 비디오 업로드와 결과 흐름을 확인할 수 있습니다.</p>
              <div className="detail-flow">
                <div className="detail-flow__item">1. 카메라 구도 확인</div>
                <div className="detail-flow__item">2. 준비 상태 저장</div>
                <div className="detail-flow__item">3. 업로드 흐름 진입</div>
              </div>
              <div className="camera-panel__actions">
                <button className="button-link" type="button" onClick={moveToRecordingPlaceholder}>
                  다음 단계 미리 보기
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="camera-preview camera-preview--placeholder">
          <p>{cameraPlaceholderMessage(cameraState)}</p>
        </div>
      )}

      {flowStage === 'recording-placeholder' ? (
        <div className="session-placeholder session-placeholder--active">
          <span className="pill">업로드 흐름</span>
          <h3>시도 비디오 업로드와 결과 연결</h3>
          <p>이 단계에서는 실제 시도 비디오 업로드, 준비 상태 저장, 샘플 완료 결과 저장을 모두 확인할 수 있습니다.</p>
          <ul className="detail-list">
            <li>
              <strong>실제 업로드 경로</strong>
              레퍼런스 분석이 끝난 챌린지에서 시도 비디오를 업로드하면 서버가 자동 채점을 수행합니다.
            </li>
            <li>
              <strong>프로토타입 확인 경로</strong>
              준비 상태 저장이나 샘플 완료 결과 저장으로 현재 화면 흐름을 먼저 검증할 수 있습니다.
            </li>
          </ul>

          <div className="upload-box">
            <label className="upload-box__label" htmlFor="attempt-video-input">시도 비디오 선택</label>
            <input
              id="attempt-video-input"
              className="upload-box__input"
              type="file"
              accept="video/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedVideo(file);
                setUploadError(null);
              }}
            />
            <p className="upload-box__hint">
              MP4 같은 일반적인 비디오 파일을 선택해 주세요. 현재는 로컬 저장과 mock 분석 기준으로 동작합니다.
            </p>
            {selectedVideo ? (
              <p className="upload-box__file">
                선택한 파일: <strong>{selectedVideo.name}</strong> ({formatBytes(selectedVideo.size)})
              </p>
            ) : null}
          </div>

          <div className="camera-panel__actions">
            <button className="button-link" type="button" onClick={() => void submitAttemptVideo()} disabled={uploadLoading}>
              {uploadLoading ? '비디오 업로드 중...' : '시도 비디오 업로드 및 자동 채점'}
            </button>
            <button
              className="button-link button-link--secondary"
              type="button"
              onClick={() => void saveAttempt('prepared')}
              disabled={saveLoading || uploadLoading}
            >
              {saveLoading ? '기록 저장 중...' : '준비 상태 저장'}
            </button>
            <button
              className="button-link button-link--secondary"
              type="button"
              onClick={() => void saveAttempt('completed')}
              disabled={saveLoading || uploadLoading}
            >
              {saveLoading ? '기록 저장 중...' : '샘플 완료 결과 저장'}
            </button>
          </div>
        </div>
      ) : null}

      {saveError ? <p>{saveError}</p> : null}
      {uploadError ? <p>{uploadError}</p> : null}

      {uploadedAttempt ? (
        <div className="camera-panel__saved">
          <span className="pill">자동 채점 결과</span>
          <p>
            <strong>{uploadedAttempt.resultHeadline}</strong>
          </p>
          <p>{uploadedAttempt.resultSummary}</p>
          <div className="archive-card__meta">
            <span className="pill">{uploadedAttempt.scoreAvailable ? '점수 사용 가능' : '점수 준비 중'}</span>
            <span className="pill">
              {uploadedAttempt.processingMode === 'SYNC_INLINE' ? '동기 처리' : '비동기 대기'}
            </span>
            <span className="pill">{uploadedAttempt.processingComplete ? '처리 완료' : '처리 대기'}</span>
            <span className="pill">{uploadedAttempt.analyzerName}</span>
            <span className="pill">{uploadedAttempt.videoOriginalFileName}</span>
          </div>
          {uploadedAttempt.processingNotice ? <p className="upload-box__hint">{uploadedAttempt.processingNotice}</p> : null}
          {pendingUploadAwaitingCompletion && pendingTrackingId ? (
            <>
              <div className="inline-actions tracking-id-row">
                <p className="upload-box__hint">
                  대기 추적 ID: <strong>{pendingTrackingId}</strong>
                </p>
                <button className="button-link button-link--secondary" type="button" onClick={() => void copyPendingTrackingId()}>
                  {trackingIdCopied ? '복사 완료' : '추적 ID 복사'}
                </button>
              </div>
              {trackingIdCopied ? (
                <p className="tracking-id-feedback">추적 ID가 클립보드에 복사되었습니다. 필요하면 로컬 완료 처리 전에 붙여 넣어 사용할 수 있습니다.</p>
              ) : null}
            </>
          ) : null}
          <p>
            점수: <strong>{uploadedAttempt.score}</strong>점
          </p>
          <div className="inline-actions">
            {pendingUploadAwaitingCompletion ? (
              <button
                className="button-link"
                type="button"
                onClick={() => void completePendingUpload()}
                disabled={pendingCompletionLoading}
              >
                {pendingCompletionLoading ? '로컬 완료 처리 중...' : '로컬 완료 처리'}
              </button>
            ) : uploadedAttemptResultId ? (
              <Link className="button-link" to={`/attempts/${uploadedAttemptResultId}/result`}>
                결과 화면 보기
              </Link>
            ) : (
              <span className="button-link button-link--disabled">결과 화면은 처리 완료 후 열립니다</span>
            )}
            <Link className="button-link button-link--secondary" to="/attempts">
              저장된 기록 보기
            </Link>
          </div>
        </div>
      ) : null}

      {savedAttempt ? (
        <div className="camera-panel__saved">
          <span className="pill">저장 완료</span>
          <p>기록 ID {savedAttempt.id}번이 저장되었습니다.</p>
          <p>
            현재 저장된 상태는 {savedAttempt.status}이고, 점수는 {savedAttempt.score}점입니다.
          </p>
          <div className="inline-actions">
            <Link className="button-link" to={`/attempts/${savedAttempt.id}/result`}>
              결과 화면 보기
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              저장된 기록 보기
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function buildPreviewScore(recordType: AttemptRecordType, cameraState: CameraState): number {
  if (recordType === 'prepared') {
    return 0;
  }

  return cameraState === 'granted' ? 82 : 68;
}

function buildAttemptNote(cameraState: CameraState, recordType: AttemptRecordType): string {
  if (recordType === 'completed') {
    return cameraState === 'granted'
      ? '샘플 simple scoring 결과를 반영한 완료 기록'
      : '카메라 없이 프로토타입 흐름에서 만든 샘플 완료 기록';
  }

  switch (cameraState) {
    case 'granted':
      return '카메라 권한 확인 후 준비 단계 진입';
    case 'missing':
      return '카메라 장치가 없는 상태에서 프로토타입 흐름 진행';
    case 'unavailable':
      return '카메라 장치 접근 불가 상태에서 프로토타입 흐름 진행';
    case 'unsupported':
      return '브라우저 미지원 환경에서 프로토타입 흐름 진행';
    case 'denied':
      return '카메라 권한 거부 상태에서 프로토타입 흐름 진행';
    default:
      return '카메라 없이 프로토타입 흐름 진행';
  }
}

function buildVideoAttemptNote(cameraState: CameraState): string {
  switch (cameraState) {
    case 'granted':
      return '카메라 준비 확인 후 시도 비디오 업로드';
    case 'missing':
      return '카메라가 없는 환경에서 시도 비디오 업로드';
    case 'unavailable':
      return '카메라 접근 불가 환경에서 시도 비디오 업로드';
    case 'unsupported':
      return '브라우저 미지원 환경에서 시도 비디오 업로드';
    case 'denied':
      return '카메라 권한 거부 후 시도 비디오 업로드';
    default:
      return '프로토타입 시작 화면에서 시도 비디오 업로드';
  }
}

function cameraPlaceholderMessage(state: CameraState): string {
  switch (state) {
    case 'missing':
      return '사용 가능한 카메라를 찾지 못했습니다. 그래도 업로드 기반 흐름은 계속 확인할 수 있습니다.';
    case 'unavailable':
      return '카메라 장치에 접근할 수 없습니다. 다른 앱 사용 여부를 확인하거나 업로드 흐름으로 계속 진행해 주세요.';
    case 'unsupported':
      return '현재 브라우저에서는 카메라 기능을 지원하지 않습니다. 그래도 프로토타입 흐름은 계속 진행할 수 있습니다.';
    case 'denied':
      return '카메라 권한이 거부된 상태입니다. 권한을 다시 허용하거나 업로드 흐름부터 확인해 주세요.';
    case 'error':
      return '카메라를 준비하는 중 문제가 발생했습니다. 다시 시도하거나 업로드 흐름으로 계속 진행해 주세요.';
    default:
      return '카메라 권한을 허용하면 현재 영역에 미리보기가 표시됩니다.';
  }
}

function cameraStateLabel(state: CameraState): string {
  switch (state) {
    case 'idle':
      return '대기 중';
    case 'requesting':
      return '권한 요청 중';
    case 'granted':
      return '준비 완료';
    case 'denied':
      return '권한 거부';
    case 'missing':
      return '카메라 없음';
    case 'unavailable':
      return '장치 사용 불가';
    case 'unsupported':
      return '브라우저 미지원';
    case 'error':
      return '오류 발생';
    default:
      return '상태 없음';
  }
}

function sessionStateLabel(state: MotionSessionState['sessionState']): string {
  switch (state) {
    case 'REFERENCE_PENDING':
      return '레퍼런스 분석 필요';
    case 'CAMERA_PERMISSION_REQUIRED':
      return '카메라 권한 필요';
    default:
      return '상태 없음';
  }
}

function nextActionLabel(action: MotionSessionState['nextAction']): string {
  switch (action) {
    case 'REVIEW_REFERENCE_STATUS':
      return '레퍼런스 분석 상태 확인';
    case 'REQUEST_CAMERA_PERMISSION':
      return '카메라 권한 확인';
    default:
      return '상태 없음';
  }
}

function runtimeStateLabel(state: MotionSessionState['runtimeState']): string {
  switch (state) {
    case 'UPLOAD_PENDING':
      return '업로드 대기';
    case 'UPLOAD_IN_PROGRESS':
      return '업로드 진행 중';
    case 'UPLOAD_STORED':
      return '업로드 저장 완료';
    case 'ANALYSIS_IN_PROGRESS':
      return '분석 진행 중';
    case 'SCORING_COMPLETED':
      return '채점 완료';
    case 'FAILED_RETRYABLE':
      return '다시 시도 가능한 오류';
    default:
      return '대기 중';
  }
}

function runtimeSourceLabel(source: MotionSessionState['serverRuntimeTrace'][number]['source']): string {
  switch (source) {
    case 'EVENT_BUS':
      return '이벤트 반영';
    case 'ASYNC_JOB':
      return '비동기 작업';
    case 'TRACKER':
      return '트래커 기록';
    default:
      return '서버 기록';
  }
}

function formatRuntimeRecordedAt(recordedAt: string | null): string {
  if (!recordedAt) {
    return '시간 정보 없음';
  }

  return new Date(recordedAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}