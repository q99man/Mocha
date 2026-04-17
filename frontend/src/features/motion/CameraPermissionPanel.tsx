import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  completeAsyncPendingAttempt,
  getAttemptVideoProcessingProgressByTrackingId,
  uploadAttemptVideo,
} from '../../shared/api/attemptApi';
import { getMotionSessionState } from '../../shared/api/motionApi';
import {
  buildDurableProgressCompletionStrategyLabel,
  buildDurableProgressElapsedTimeLabel,
  buildDurableProgressHeadline,
  buildDurableProgressNextStep,
  buildDurableProgressOriginalFileLabel,
  buildDurableProgressStatusTag,
  buildDurableProgressSummary,
  buildDurableProgressTone,
} from '../../shared/presentation/durableProgress';
import type {
  AsyncPendingCompletionRequest,
  AttemptBreakdownArea,
  AttemptVideoProcessingJobProgress,
  AttemptVideoResult,
} from '../../shared/types/attempt';
import type { MotionSessionState } from '../../shared/types/motion';

type CameraState = 'idle' | 'ready' | 'denied' | 'unavailable' | 'error';
type FlowStage = 'camera' | 'upload';

type CameraPermissionPanelProps = {
  challengeId: number;
  challengeTitle: string;
};

export function CameraPermissionPanel({ challengeId, challengeTitle }: CameraPermissionPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const trackingCopyTimerRef = useRef<number | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [flowStage, setFlowStage] = useState<FlowStage>('camera');
  const [sessionState, setSessionState] = useState<MotionSessionState | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('현재 상태를 확인한 뒤 시도 영상을 업로드해 주세요.');

  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedAttempt, setUploadedAttempt] = useState<AttemptVideoResult | null>(null);

  const [pendingCompletionLoading, setPendingCompletionLoading] = useState(false);
  const [trackingProgressLoading, setTrackingProgressLoading] = useState(false);
  const [pendingJobProgress, setPendingJobProgress] = useState<AttemptVideoProcessingJobProgress | null>(null);
  const [trackingIdCopied, setTrackingIdCopied] = useState(false);

  const pendingTrackingId = pendingJobProgress?.trackingId ?? uploadedAttempt?.pendingTrackingId ?? null;
  const uploadedAttemptResultId = uploadedAttempt?.attemptId ?? pendingJobProgress?.resultAttemptId ?? null;
  const canContinueWithoutCamera =
    cameraState === 'denied' || cameraState === 'unavailable' || cameraState === 'error';
  const canOpenUploadStage = cameraState === 'ready' || canContinueWithoutCamera;
  const pendingUploadAwaitingCompletion =
    uploadedAttempt?.processingMode === 'ASYNC_JOB_PENDING' && uploadedAttempt.processingComplete === false;
  const recentRuntimeTrace = useMemo(
    () => (sessionState?.serverRuntimeTrace ?? []).slice(0, 2),
    [sessionState?.serverRuntimeTrace],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadMotionSessionState({ silent: false });

    return () => {
      mountedRef.current = false;
      stopCameraStream();
      if (trackingCopyTimerRef.current != null) {
        window.clearTimeout(trackingCopyTimerRef.current);
      }
    };
  }, [challengeId]);

  async function loadMotionSessionState(options?: { silent?: boolean }) {
    if (options?.silent) {
      setSessionRefreshing(true);
    } else {
      setSessionLoading(true);
    }
    setSessionError(null);

    try {
      const nextState = await getMotionSessionState(challengeId);
      if (!mountedRef.current) {
        return;
      }
      setSessionState(nextState);
      setMessage(nextState.message || buildSessionMessage(nextState));
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setSessionError(error instanceof Error ? error.message : '현재 세션 상태를 불러오지 못했습니다.');
    } finally {
      if (!mountedRef.current) {
        return;
      }
      setSessionLoading(false);
      setSessionRefreshing(false);
    }
  }

  async function requestCameraAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unavailable');
      setMessage('현재 브라우저에서는 카메라 접근을 지원하지 않습니다.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      stopCameraStream();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraState('ready');
      setMessage('카메라 확인이 완료되었습니다. 이제 업로드 단계로 넘어갈 수 있습니다.');
    } catch (error) {
      const nextState = resolveCameraErrorState(error);
      setCameraState(nextState);
      setMessage(buildCameraErrorMessage(nextState));
    }
  }

  function stopCameraStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function moveToUploadStage() {
    setFlowStage('upload');
    setMessage('시도 영상을 업로드하면 분석과 채점이 시작됩니다.');
  }

  function continueWithoutCamera() {
    setFlowStage('upload');
    setMessage('카메라 없이 진행합니다. 준비된 영상을 바로 업로드해 주세요.');
  }

  function onSelectVideo(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedVideo(nextFile);
    setUploadError(null);
    setUploadedAttempt(null);
    setPendingJobProgress(null);
    setTrackingIdCopied(false);
  }

  async function submitAttemptVideo() {
    if (!selectedVideo) {
      setUploadError('먼저 업로드할 영상을 선택해 주세요.');
      return;
    }

    if (sessionState && !sessionState.uploadEnabled) {
      setUploadError('현재 상태에서는 영상 업로드를 진행할 수 없습니다.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setUploadedAttempt(null);
    setPendingJobProgress(null);

    try {
      const response = await uploadAttemptVideo({
        challengeId,
        notes: buildUploadNote(challengeTitle),
        attemptVideo: selectedVideo,
      });

      if (!mountedRef.current) {
        return;
      }

      setUploadedAttempt(response);
      setMessage(response.processingNotice ?? '업로드가 접수되었습니다. 아래에서 처리 상태를 확인할 수 있습니다.');

      if (response.pendingTrackingId) {
        const progress = await getAttemptVideoProcessingProgressByTrackingId(response.pendingTrackingId);
        if (mountedRef.current) {
          setPendingJobProgress(progress);
          setMessage(buildPendingPanelSummary(progress, response));
        }
      }

      await loadMotionSessionState({ silent: true });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setUploadError(error instanceof Error ? error.message : '시도 영상을 업로드하지 못했습니다.');
    } finally {
      if (mountedRef.current) {
        setUploadLoading(false);
      }
    }
  }

  async function loadPendingJobProgress() {
    if (!pendingTrackingId) {
      setUploadError('아직 추적용 ID가 생성되지 않았습니다.');
      return;
    }

    setTrackingProgressLoading(true);

    try {
      const progress = await getAttemptVideoProcessingProgressByTrackingId(pendingTrackingId);
      if (!mountedRef.current) {
        return;
      }

      setPendingJobProgress(progress);
      setMessage(buildPendingPanelSummary(progress, uploadedAttempt));

      if (progress.status === 'COMPLETED' && progress.resultAttemptId && uploadedAttempt) {
        setUploadedAttempt({
          ...uploadedAttempt,
          attemptId: progress.resultAttemptId,
          processingComplete: true,
          processingNotice: progress.processingNotice ?? uploadedAttempt.processingNotice,
        });
      }

      await loadMotionSessionState({ silent: true });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setUploadError(error instanceof Error ? error.message : '처리 상태를 새로 불러오지 못했습니다.');
    } finally {
      if (mountedRef.current) {
        setTrackingProgressLoading(false);
      }
    }
  }

  async function completePendingAttempt() {
    if (!pendingTrackingId) {
      setUploadError('수동 완료에 필요한 추적 ID가 없습니다.');
      return;
    }

    setPendingCompletionLoading(true);
    setUploadError(null);

    const request: AsyncPendingCompletionRequest = {
      challengeId,
      trackingId: pendingTrackingId,
      notes: `${challengeTitle} 수동 완료`,
    };

    try {
      const response = await completeAsyncPendingAttempt(request);
      if (!mountedRef.current) {
        return;
      }

      setUploadedAttempt(response);
      setPendingJobProgress((current) =>
        current
          ? {
              ...current,
              status: 'COMPLETED',
              resultAttemptId: response.attemptId,
              processingNotice: response.processingNotice,
            }
          : current,
      );
      setMessage(response.processingNotice ?? '수동 완료가 반영되었습니다.');

      await loadMotionSessionState({ silent: true });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setUploadError(error instanceof Error ? error.message : '대기 중인 업로드를 완료 처리하지 못했습니다.');
    } finally {
      if (mountedRef.current) {
        setPendingCompletionLoading(false);
      }
    }
  }

  async function copyTrackingId() {
    if (!pendingTrackingId) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setUploadError('현재 환경에서는 ID 복사를 지원하지 않습니다.');
      return;
    }

    try {
      await navigator.clipboard.writeText(pendingTrackingId);
      if (!mountedRef.current) {
        return;
      }

      setTrackingIdCopied(true);
      if (trackingCopyTimerRef.current != null) {
        window.clearTimeout(trackingCopyTimerRef.current);
      }
      trackingCopyTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) {
          setTrackingIdCopied(false);
        }
      }, 1500);
    } catch {
      setUploadError('추적 ID를 복사하지 못했습니다.');
    }
  }

  return (
    <section className="glass-page">
      <div className="glass-panel">
        <div className="glass-toolbar">
          <div>
            <span className="glass-intro__eyebrow">챌린지 시작</span>
            <h3 className="glass-section-title">{challengeTitle} 시작</h3>
            <p className="glass-toolbar__note">{message}</p>
          </div>
          <button
            type="button"
            className="button-link button-link--secondary"
            onClick={() => void loadMotionSessionState({ silent: true })}
          >
            {sessionRefreshing || sessionLoading ? '새로고침 중...' : '상태 새로고침'}
          </button>
        </div>

        <div className="glass-inline-meta">
          <span>런타임 {sessionState?.runtimeState ?? '불러오는 중'}</span>
          <span>업로드 {sessionState?.uploadEnabled ? '가능' : '대기'}</span>
          <span>촬영 {sessionState?.recordingEnabled ? '가능' : '대기'}</span>
          <span>최근 시도 {sessionState?.latestAttemptId ? `#${sessionState.latestAttemptId}` : '없음'}</span>
        </div>

        {recentRuntimeTrace.length > 0 ? (
          <div className="glass-inline-meta">
            {recentRuntimeTrace.map((item, index) => (
              <span key={`${item.runtimeState}-${item.recordedAt}-${index}`}>
                {item.runtimeState} / {formatRuntimeRecordedAt(item.recordedAt)}
              </span>
            ))}
          </div>
        ) : null}

        {sessionError ? <p className="review-composer__message review-composer__message--error">{sessionError}</p> : null}
      </div>

      <div className="glass-camera-grid">
        <article className="glass-panel glass-panel--nested">
          <div className="glass-toolbar">
            <div>
              <h3 className="glass-section-title">1. 카메라 확인</h3>
              <p className="glass-toolbar__note">카메라 미리보기는 선택 사항이며, 확인 후 바로 업로드 단계로 넘어갈 수 있습니다.</p>
            </div>
            <span className={`glass-badge${cameraState === 'ready' ? ' is-accent' : ''}`}>
              {cameraStateLabel(cameraState)}
            </span>
          </div>

          <div className="glass-video-shell">
            <video ref={videoRef} autoPlay muted playsInline className="glass-video" />
            {cameraState !== 'ready' ? (
              <div className="glass-video-shell__placeholder">
                <strong>카메라 미리보기</strong>
                <p>권한이 허용되면 이 영역에 미리보기가 표시됩니다.</p>
              </div>
            ) : null}
          </div>

          <div className="inline-actions">
            <button type="button" className="button-link" onClick={() => void requestCameraAccess()}>
              카메라 확인
            </button>
            {canOpenUploadStage ? (
              <button type="button" className="button-link button-link--secondary" onClick={moveToUploadStage}>
                업로드 단계로 이동
              </button>
            ) : null}
          </div>
        </article>

        <article className={`glass-panel glass-panel--nested${flowStage === 'upload' ? '' : ' glass-panel--muted'}`}>
          <div className="glass-toolbar">
            <div>
              <h3 className="glass-section-title">2. 영상 업로드</h3>
              <p className="glass-toolbar__note">실제 시도 영상 1개만 선택하면 분석과 채점이 순서대로 진행됩니다.</p>
            </div>
            <span className={`glass-badge${flowStage === 'upload' ? ' is-accent' : ''}`}>
              {flowStage === 'upload' ? '준비됨' : '대기'}
            </span>
          </div>

          {canContinueWithoutCamera && flowStage !== 'upload' ? (
            <div className="glass-inline-meta">
              <span>카메라 없이 업로드만 진행할 수 있습니다.</span>
            </div>
          ) : null}

          <label className="glass-field">
            <span>시도 영상</span>
            <input type="file" accept="video/*" onChange={onSelectVideo} disabled={flowStage !== 'upload'} />
          </label>

          {selectedVideo ? (
            <div className="glass-inline-meta">
              <span>{selectedVideo.name}</span>
              <span>{formatFileSize(selectedVideo.size)}</span>
            </div>
          ) : null}

          <div className="inline-actions">
            {canContinueWithoutCamera && flowStage !== 'upload' ? (
              <button type="button" className="button-link button-link--secondary" onClick={continueWithoutCamera}>
                카메라 없이 진행
              </button>
            ) : null}
            <button
              type="button"
              className="button-link"
              onClick={() => void submitAttemptVideo()}
              disabled={flowStage !== 'upload' || uploadLoading || (sessionState ? !sessionState.uploadEnabled : false)}
            >
              {uploadLoading ? '업로드 중...' : '영상 업로드'}
            </button>
          </div>

          {uploadError ? <p className="review-composer__message review-composer__message--error">{uploadError}</p> : null}
        </article>
      </div>

      {uploadedAttempt ? (
        <article className="glass-panel">
          <div className="glass-toolbar">
            <div>
              <h3 className="glass-section-title">업로드 결과</h3>
              <p className="glass-toolbar__note">{uploadedAttempt.resultHeadline}</p>
            </div>
            <div className="glass-list-item__actions">
              <span className="glass-badge">{uploadedAttempt.processingMode === 'ASYNC_JOB_PENDING' ? '비동기 처리' : '즉시 처리'}</span>
              <span className={`glass-badge${uploadedAttempt.processingComplete ? ' is-accent' : ''}`}>
                {uploadedAttempt.processingComplete ? '완료' : '대기'}
              </span>
            </div>
          </div>

          <p className="glass-list-item__description">{uploadedAttempt.resultSummary}</p>

          <div className="glass-summary-grid">
            <div className="glass-summary-card">
              <span>점수</span>
              <strong>{uploadedAttempt.scoreAvailable ? `${uploadedAttempt.score}점` : '산출 전'}</strong>
            </div>
            <div className="glass-summary-card">
              <span>분석 요약</span>
              <strong>{buildAttemptAreaSummary(uploadedAttempt.strongestArea, uploadedAttempt.weakestArea)}</strong>
            </div>
            <div className="glass-summary-card">
              <span>파일</span>
              <strong>{uploadedAttempt.videoOriginalFileName}</strong>
            </div>
          </div>

          {uploadedAttempt.processingNotice ? <p className="glass-toolbar__note">{uploadedAttempt.processingNotice}</p> : null}

          {uploadedAttemptResultId ? (
            <div className="inline-actions">
              <Link className="button-link" to={`/attempts/${uploadedAttemptResultId}/result`}>
                결과 페이지 보기
              </Link>
            </div>
          ) : null}
        </article>
      ) : null}

      {pendingUploadAwaitingCompletion || pendingJobProgress ? (
        <article className={`glass-panel glass-progress-card glass-progress-card--${buildDurableProgressTone(pendingJobProgress)}`}>
          <div className="glass-toolbar">
            <div>
              <h3 className="glass-section-title">{buildDurableProgressHeadline(pendingJobProgress)}</h3>
              <p className="glass-toolbar__note">{buildPendingPanelSummary(pendingJobProgress, uploadedAttempt)}</p>
            </div>
            <span className="glass-badge is-accent">{buildDurableProgressStatusTag(pendingJobProgress)}</span>
          </div>

          <div className="glass-inline-meta">
            <span>{buildDurableProgressNextStep(pendingJobProgress)}</span>
            <span>{buildDurableProgressCompletionStrategyLabel(pendingJobProgress?.completionStrategy)}</span>
            <span>{buildDurableProgressElapsedTimeLabel(pendingJobProgress?.elapsedSeconds)}</span>
            <span>
              {pendingJobProgress ? buildDurableProgressOriginalFileLabel(pendingJobProgress) : selectedVideo?.name ?? '파일 없음'}
            </span>
          </div>

          {pendingTrackingId ? (
            <div className="glass-inline-meta">
              <span>추적 ID {pendingTrackingId}</span>
            </div>
          ) : null}

          <div className="inline-actions">
            <button
              type="button"
              className="button-link button-link--secondary"
              onClick={() => void loadPendingJobProgress()}
              disabled={trackingProgressLoading}
            >
              {trackingProgressLoading ? '확인 중...' : '진행 상태 확인'}
            </button>
            <button type="button" className="button-link button-link--secondary" onClick={() => void copyTrackingId()}>
              {trackingIdCopied ? '복사 완료' : '추적 ID 복사'}
            </button>
            {pendingJobProgress?.status !== 'COMPLETED' ? (
              <button
                type="button"
                className="button-link"
                onClick={() => void completePendingAttempt()}
                disabled={pendingCompletionLoading}
              >
                {pendingCompletionLoading ? '완료 처리 중...' : '수동 완료'}
              </button>
            ) : null}
            {uploadedAttemptResultId ? (
              <Link className="button-link" to={`/attempts/${uploadedAttemptResultId}/result`}>
                결과 보기
              </Link>
            ) : null}
          </div>
        </article>
      ) : null}
    </section>
  );
}

function buildUploadNote(challengeTitle: string) {
  return `${challengeTitle} 시도 영상 업로드`;
}

function buildSessionMessage(state: MotionSessionState) {
  if (state.uploadEnabled) {
    return '현재 이 챌린지는 업로드와 채점이 가능한 상태입니다.';
  }

  if (state.readinessState === 'REFERENCE_PENDING') {
    return '레퍼런스 분석이 아직 완료되지 않았습니다.';
  }

  return '업로드 전에 현재 세션 상태를 먼저 확인해 주세요.';
}

function buildPendingPanelSummary(
  progress: AttemptVideoProcessingJobProgress | null,
  uploadedAttempt: AttemptVideoResult | null,
) {
  if (progress) {
    return buildDurableProgressSummary(progress);
  }

  if (uploadedAttempt?.processingMode === 'ASYNC_JOB_PENDING' && !uploadedAttempt.processingComplete) {
    return '업로드가 접수되었고 분석 작업이 시작되기를 기다리는 중입니다.';
  }

  return '처리 상태를 새로 불러오는 중입니다.';
}

function buildAttemptAreaSummary(
  strongestArea: AttemptBreakdownArea | null,
  weakestArea: AttemptBreakdownArea | null,
) {
  const parts: string[] = [];

  if (strongestArea) {
    parts.push(`강점 ${toAreaLabel(strongestArea)}`);
  }

  if (weakestArea) {
    parts.push(`보완 ${toAreaLabel(weakestArea)}`);
  }

  return parts.length > 0 ? parts.join(' / ') : '분석 대기 중';
}

function toAreaLabel(area: AttemptBreakdownArea) {
  switch (area) {
    case 'pose shape':
      return '포즈 형태';
    case 'pose timing':
      return '타이밍';
    case 'detection quality':
      return '인식 안정성';
    default:
      return area;
  }
}

function cameraStateLabel(cameraState: CameraState) {
  switch (cameraState) {
    case 'ready':
      return '준비됨';
    case 'denied':
      return '권한 거부';
    case 'unavailable':
      return '사용 불가';
    case 'error':
      return '오류';
    default:
      return '대기';
  }
}

function resolveCameraErrorState(error: unknown): CameraState {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'denied';
  }

  if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError')) {
    return 'unavailable';
  }

  return 'error';
}

function buildCameraErrorMessage(state: CameraState) {
  switch (state) {
    case 'denied':
      return '카메라 권한이 거부되었습니다. 카메라 없이도 업로드를 진행할 수 있습니다.';
    case 'unavailable':
      return '사용 가능한 카메라가 없습니다. 업로드 단계로 바로 넘어갈 수 있습니다.';
    default:
      return '카메라 접근에 실패했습니다. 카메라 없이 계속 진행할 수 있습니다.';
  }
}

function formatRuntimeRecordedAt(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
