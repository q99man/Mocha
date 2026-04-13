import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  completeAsyncPendingAttempt,
  getAttemptVideoProcessingProgressByTrackingId,
  uploadAttemptVideo,
} from '../../shared/api/attemptApi';
import { getMotionSessionState } from '../../shared/api/motionApi';
import { buildAttemptBreakdownMetrics, buildAttemptBreakdownSummary } from '../../shared/presentation/attemptBreakdown';
import { buildAttemptCoachingTeaser } from '../../shared/presentation/attemptCoaching';
import {
  buildDurableProgressCalloutTitle,
  buildDurableProgressCompletionStrategyLabel,
  buildDurableProgressElapsedTimeLabel,
  buildDurableProgressFailureAction,
  buildDurableProgressHeadline,
  buildDurableProgressNextStep,
  buildDurableProgressOriginalFileLabel,
  buildDurableProgressRetryWindowLabel,
  buildDurableProgressStatusTag,
  buildDurableProgressSummary,
  buildDurableProgressTone,
} from '../../shared/presentation/durableProgress';
import type {
  AsyncPendingCompletionRequest,
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

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [flowStage, setFlowStage] = useState<FlowStage>('camera');
  const [sessionState, setSessionState] = useState<MotionSessionState | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>(
    '먼저 현재 실행 상태를 확인한 뒤 실제 시도 영상을 업로드해 채점을 진행해 주세요.',
  );

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
  const uploadedAttemptBreakdownSummary = uploadedAttempt ? buildAttemptBreakdownSummary(uploadedAttempt) : null;
  const uploadedAttemptBreakdownMetrics = uploadedAttempt ? buildAttemptBreakdownMetrics(uploadedAttempt) : [];
  const uploadedAttemptCoachingTeaser = uploadedAttempt ? buildAttemptCoachingTeaser(uploadedAttempt) : null;
  const canContinueWithoutCamera =
    cameraState === 'denied' || cameraState === 'unavailable' || cameraState === 'error';
  const canOpenUploadStage = cameraState === 'ready' || canContinueWithoutCamera;
  const pendingUploadAwaitingCompletion =
    uploadedAttempt?.processingMode === 'ASYNC_JOB_PENDING' && uploadedAttempt.processingComplete === false;
  const pendingProgressTone = buildDurableProgressTone(pendingJobProgress);
  const pendingProgressStatusTag = buildDurableProgressStatusTag(pendingJobProgress);
  const pendingProgressNextStep = buildDurableProgressNextStep(pendingJobProgress);
  const pendingProgressNotice = buildPendingPanelNotice(pendingJobProgress, uploadedAttempt);
  const recentRuntimeTrace = useMemo(
    () => (sessionState?.serverRuntimeTrace ?? []).slice(0, 3),
    [sessionState?.serverRuntimeTrace],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadMotionSessionState({ silent: false });

    return () => {
      mountedRef.current = false;
      stopCameraStream();
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
      setSessionError(error instanceof Error ? error.message : '실행 상태를 불러오지 못했습니다.');
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
      setMessage('이 브라우저에서는 카메라 접근을 사용할 수 없습니다.');
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
      setMessage('카메라 접근이 준비되었습니다. 이제 업로드 단계로 이동할 수 있습니다.');
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
    setMessage('실제 시도 영상을 업로드하면 분석과 채점이 시작됩니다.');
  }

  function continueWithoutCamera() {
    setFlowStage('upload');
    setMessage('카메라 없이 계속 진행합니다. 준비되면 실제 시도 영상을 업로드해 주세요.');
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
      setUploadError('먼저 영상 파일을 선택해 주세요.');
      return;
    }
    if (sessionState && !sessionState.uploadEnabled) {
      setUploadError('현재 이 챌린지 상태에서는 업로드를 진행할 수 없습니다.');
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
      setMessage(response.processingNotice ?? '업로드가 접수되었습니다. 아래에서 결과를 확인해 주세요.');

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
      setUploadError('아직 이 업로드에 대한 트래킹 ID가 없습니다.');
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
      if (mountedRef.current) {
        setUploadError(error instanceof Error ? error.message : '진행 상태를 새로고침하지 못했습니다.');
      }
    } finally {
      if (mountedRef.current) {
        setTrackingProgressLoading(false);
      }
    }
  }

  async function completePendingAttempt() {
    if (!pendingTrackingId) {
      setUploadError('수동 완료를 진행할 트래킹 ID가 없습니다.');
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
      setMessage(response.processingNotice ?? '수동 완료 처리가 끝났습니다.');
      await loadMotionSessionState({ silent: true });
    } catch (error) {
      if (mountedRef.current) {
        setUploadError(error instanceof Error ? error.message : '대기 중인 업로드를 완료 처리하지 못했습니다.');
      }
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

    try {
      await navigator.clipboard.writeText(pendingTrackingId);
      if (!mountedRef.current) {
        return;
      }
      setTrackingIdCopied(true);
      window.setTimeout(() => {
        if (mountedRef.current) {
          setTrackingIdCopied(false);
        }
      }, 1500);
    } catch {
      setUploadError('트래킹 ID를 복사하지 못했습니다.');
    }
  }

  return (
    <section className="camera-panel">
      <div className="camera-panel__header">
        <div>
          <p className="camera-panel__eyebrow">카메라 준비</p>
          <h2>{challengeTitle} 시작 콘솔</h2>
          <p className="camera-panel__message">{message}</p>
        </div>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => void loadMotionSessionState({ silent: true })}
        >
          {sessionRefreshing || sessionLoading ? '새로고침 중...' : '세션 새로고침'}
        </button>
      </div>

      <div className="camera-panel__status">
        <span>실행 상태</span>
        <strong>{sessionState?.runtimeState ?? '상태 확인 중'}</strong>
      </div>

      {sessionError ? <p className="camera-panel__error">{sessionError}</p> : null}

      {recentRuntimeTrace.length > 0 ? (
        <div className="camera-runtime-feed">
          <h3>최근 실행 기록</h3>
          <ul>
            {recentRuntimeTrace.map((item, index) => (
              <li key={`${item.runtimeState}-${item.recordedAt}-${index}`} className="camera-runtime-feed__item">
                <strong>{item.runtimeState}</strong>
                <span>{item.source ?? '추적기'}</span>
                <span>{formatRuntimeRecordedAt(item.recordedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="camera-panel__grid">
        <article className="camera-panel__card">
          <h3>1. 카메라 확인</h3>
          <p>카메라 권한은 선택 사항입니다. 없어도 업로드 단계로 계속 진행할 수 있습니다.</p>
          <div className="camera-panel__video-shell">
            <video ref={videoRef} autoPlay muted playsInline className="camera-panel__video" />
          </div>
          <div className="camera-panel__actions">
            <button type="button" className="button" onClick={() => void requestCameraAccess()}>
              카메라 확인
            </button>
            {canOpenUploadStage ? (
              <button type="button" className="button button--secondary" onClick={moveToUploadStage}>
                업로드 단계 열기
              </button>
            ) : null}
            {canContinueWithoutCamera ? (
              <button type="button" className="button button--ghost" onClick={continueWithoutCamera}>
                카메라 없이 진행
              </button>
            ) : null}
          </div>
          <p className="camera-panel__meta">카메라 상태: {cameraStateLabel(cameraState)}</p>
        </article>
      </div>

      {flowStage === 'upload' ? (
        <article className="camera-panel__card camera-panel__card--wide">
          <h3>2. 시도 영상 업로드</h3>
          <p>실제 챌린지 영상을 선택해 분석과 채점을 요청합니다.</p>
          <div className="camera-panel__upload-box">
            <input type="file" accept="video/*" onChange={onSelectVideo} />
            <button
              type="button"
              className="button"
              onClick={() => void submitAttemptVideo()}
              disabled={uploadLoading || (sessionState ? !sessionState.uploadEnabled : false)}
            >
              {uploadLoading ? '업로드 중...' : '영상 업로드'}
            </button>
          </div>
          {selectedVideo ? <p className="camera-panel__meta">선택 파일: {selectedVideo.name}</p> : null}
          {uploadError ? <p className="camera-panel__error">{uploadError}</p> : null}

          {uploadedAttempt ? (
            <div className="camera-panel__result-box">
              <div className="camera-panel__result-header">
                <h4>{uploadedAttempt.resultHeadline}</h4>
                <span className="camera-panel__pill">{uploadedAttempt.processingMode ?? 'SYNC_INLINE'}</span>
                <span className="camera-panel__pill">
                  {uploadedAttempt.processingComplete ? '완료' : '대기 중'}
                </span>
              </div>
              <p>{uploadedAttempt.resultSummary}</p>
              <p className="camera-panel__meta">{uploadedAttempt.processingNotice}</p>
              {uploadedAttemptBreakdownSummary ? (
                <div className="camera-panel__breakdown">
                  <strong>{uploadedAttemptBreakdownSummary}</strong>
                  {uploadedAttempt.scoreDeltaFromPrevious != null ? (
                    <p className="camera-panel__meta">
                      이전 채점 기록 대비: {uploadedAttempt.scoreDeltaFromPrevious >= 0 ? '+' : ''}{uploadedAttempt.scoreDeltaFromPrevious}점
                    </p>
                  ) : null}
                  {uploadedAttemptBreakdownMetrics.length > 0 ? (
                    <div className="camera-panel__breakdown-metrics">
                      {uploadedAttemptBreakdownMetrics.map((metric) => (
                        <span key={metric.label}>{metric.label} {metric.value}</span>
                      ))}
                    </div>
                  ) : null}
                  {uploadedAttemptCoachingTeaser ? <p className="camera-panel__coaching">{uploadedAttemptCoachingTeaser}</p> : null}
                </div>
              ) : null}
              {uploadedAttemptResultId ? (
                <p className="camera-panel__success">
                  <Link to={`/attempts/${uploadedAttemptResultId}/result`}>결과 페이지 열기</Link>
                </p>
              ) : (
                <p className="camera-panel__meta">처리가 완료되면 결과 ID가 표시됩니다.</p>
              )}
            </div>
          ) : null}

          {pendingUploadAwaitingCompletion || pendingJobProgress ? (
            <div className={`camera-panel__pending-box camera-panel__pending-box--${pendingProgressTone}`}>
              <div className="camera-panel__pending-header">
                <div>
                  <span className="camera-panel__pending-eyebrow">처리 작업</span>
                  <h4>{buildDurableProgressHeadline(pendingJobProgress)}</h4>
                  <p>{buildPendingPanelSummary(pendingJobProgress, uploadedAttempt)}</p>
                </div>
                <span className="camera-panel__pill">{pendingProgressStatusTag}</span>
              </div>

              <div className="camera-panel__pending-glance">
                <div className="camera-panel__pending-glance-item">
                  <span>Current state</span>
                  <strong>{pendingProgressStatusTag}</strong>
                </div>
                <div className="camera-panel__pending-glance-item">
                  <span>Next step</span>
                  <strong>{pendingProgressNextStep}</strong>
                </div>
              </div>

              {pendingProgressNotice ? <p className="camera-panel__pending-notice">{pendingProgressNotice}</p> : null}

              {pendingJobProgress?.status === 'FAILED' ? (
                <div className="processing-job-action processing-job-action--danger">
                  <strong>추천 다음 단계</strong>
                  <p>{buildDurableProgressFailureAction(pendingJobProgress.failureAction)}</p>
                </div>
              ) : null}

              {uploadedAttemptResultId ? (
                <div className="processing-job-result-link">
                  <strong>{buildDurableProgressCalloutTitle(pendingJobProgress)}</strong>
                  <p>{buildDurableProgressNextStep(pendingJobProgress)}</p>
                  <Link to={`/attempts/${uploadedAttemptResultId}/result`} className="button-link">
                    결과 페이지 열기
                  </Link>
                </div>
              ) : null}

              <ul className="detail-list camera-panel__pending-meta">
                <li>
                  <strong>트래킹 ID</strong>
                  {pendingTrackingId ?? '아직 없음'}
                </li>
                <li>
                  <strong>완료 방식</strong>
                  {buildDurableProgressCompletionStrategyLabel(pendingJobProgress?.completionStrategy)}
                </li>
                <li>
                  <strong>경과 시간</strong>
                  {buildDurableProgressElapsedTimeLabel(pendingJobProgress?.elapsedSeconds)}
                </li>
                <li>
                  <strong>재시도 여유</strong>
                  {buildDurableProgressRetryWindowLabel(pendingJobProgress)}
                </li>
                <li>
                  <strong>원본 파일</strong>
                  {pendingJobProgress
                    ? buildDurableProgressOriginalFileLabel(pendingJobProgress)
                    : selectedVideo?.name ?? '알 수 없음'}
                </li>
              </ul>

              <div className="camera-panel__actions camera-panel__actions--utility">
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => void loadPendingJobProgress()}
                  disabled={trackingProgressLoading}
                >
                  {trackingProgressLoading ? '새로고침 중...' : '진행 상태 새로고침'}
                </button>
                {uploadedAttemptResultId ? (
                  <Link to={`/attempts/${uploadedAttemptResultId}/result`} className="button button--ghost">
                    결과 열기
                  </Link>
                ) : null}
                <button type="button" className="button button--ghost" onClick={() => void copyTrackingId()}>
                  {trackingIdCopied ? '트래킹 ID 복사됨' : '트래킹 ID 복사'}
                </button>
                {pendingJobProgress?.status !== 'COMPLETED' ? (
                  <button
                    type="button"
                    className="button"
                    onClick={() => void completePendingAttempt()}
                    disabled={pendingCompletionLoading}
                  >
                    {pendingCompletionLoading ? '완료 처리 중...' : '수동 완료'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
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
    return '이 챌린지는 업로드와 채점을 진행할 준비가 되었습니다.';
  }
  if (state.readinessState === 'REFERENCE_PENDING') {
    return '이 챌린지는 아직 레퍼런스 분석이 완료되지 않았습니다.';
  }
  return '업로드 전에 현재 실행 상태를 먼저 확인해 주세요.';
}

function buildPendingPanelSummary(
  progress: AttemptVideoProcessingJobProgress | null,
  uploadedAttempt: AttemptVideoResult | null,
) {
  if (progress) {
    return buildDurableProgressSummary(progress);
  }

  if (uploadedAttempt?.processingMode === 'ASYNC_JOB_PENDING' && !uploadedAttempt.processingComplete) {
    return '업로드가 접수되었습니다. 첫 진행 상태 정보를 기다리는 중입니다.';
  }

  return '처리 상태를 새로 불러오고 있습니다.';
}

function buildPendingPanelNotice(
  progress: AttemptVideoProcessingJobProgress | null,
  uploadedAttempt: AttemptVideoResult | null,
) {
  return progress?.processingNotice ?? uploadedAttempt?.processingNotice ?? null;
}

function cameraStateLabel(cameraState: CameraState) {
  switch (cameraState) {
    case 'ready':
      return '카메라 준비 완료';
    case 'denied':
      return '권한 거부';
    case 'unavailable':
      return '카메라 사용 불가';
    case 'error':
      return '카메라 오류';
    default:
      return '대기 중';
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
      return '카메라 권한이 거부되었습니다. 카메라 없이 계속 진행할 수 있습니다.';
    case 'unavailable':
      return '사용 가능한 카메라 장치가 없습니다. 카메라 없이 계속 진행할 수 있습니다.';
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

  return date.toLocaleString('ko-KR');
}
