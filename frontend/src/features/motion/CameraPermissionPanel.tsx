import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  completeAsyncPendingAttempt,
  createAttempt,
  getAttemptVideoProcessingProgressByTrackingId,
  uploadAttemptVideo,
} from '../../shared/api/attemptApi';
import { getMotionSessionState } from '../../shared/api/motionApi';
import type {
  AsyncPendingCompletionRequest,
  AttemptSummary,
  AttemptVideoProcessingJobProgress,
  AttemptVideoResult,
  AttemptProcessingMode,
} from '../../shared/types/attempt';
import type { MotionSessionState } from '../../shared/types/motion';
import {
  buildDurableProgressCompletionLinkDescription,
  buildDurableProgressCompletionLinkLabel,
  buildDurableProgressCompletionStrategyLabel,
  buildDurableProgressElapsedTimeLabel,
  buildDurableProgressFailureAction,
  buildDurableProgressHeadline,
  buildDurableProgressOriginalFileLabel,
  buildDurableProgressRefreshMessage,
  buildDurableProgressRetryWindowLabel,
  buildDurableProgressSummary,
} from '../../shared/presentation/durableProgress';

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
  const [message, setMessage] = useState('카메라 준비 상태를 확인한 뒤, 결과 화면까지 바로 이어서 확인할 수 있습니다.');

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAttempt, setSavedAttempt] = useState<AttemptSummary | null>(null);

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
  const canContinueWithoutCamera = cameraState === 'denied' || cameraState === 'unavailable' || cameraState === 'error';
  const canOpenUploadStage = cameraState === 'ready' || canContinueWithoutCamera;
  const pendingUploadAwaitingCompletion =
    uploadedAttempt?.processingMode === 'ASYNC_JOB_PENDING' && uploadedAttempt.processingComplete === false;
  const recentRuntimeTrace = useMemo(
    () => (sessionState?.serverRuntimeTrace ?? []).slice(0, 3),
    [sessionState?.serverRuntimeTrace],
  );
  const pendingStageSummary = buildDurableProgressSummary(pendingJobProgress);
  const messageToneClass = buildMessageToneClass(pendingJobProgress, message);
  const serverStatusToneClass = buildServerStatusToneClass(pendingJobProgress);
  const processingJobToneClass = buildProcessingJobToneClass(pendingJobProgress);
  const processingJobActionToneClass = buildProcessingJobActionToneClass(pendingJobProgress);

  useEffect(() => {
    mountedRef.current = true;
    void loadMotionSessionState({ silent: false });

    return () => {
      mountedRef.current = false;
      stopStream();
    };
  }, [challengeId]);

  useEffect(() => {
    if (!pendingUploadAwaitingCompletion || !pendingTrackingId) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadPendingJobProgressByTrackingId(pendingTrackingId, { silent: true });
    }, 4000);

    return () => window.clearInterval(timer);
  }, [pendingTrackingId, pendingUploadAwaitingCompletion]);

  useEffect(() => {
    if (!trackingIdCopied) {
      return;
    }

    const timer = window.setTimeout(() => setTrackingIdCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [trackingIdCopied]);

  async function loadMotionSessionState({ silent }: { silent: boolean }) {
    if (!silent) {
      setSessionLoading(true);
    }
    setSessionRefreshing(silent);
    setSessionError(null);

    try {
      const nextState = await getMotionSessionState(challengeId);
      if (!mountedRef.current) {
        return;
      }
      setSessionState(nextState);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setSessionError(error instanceof Error ? error.message : '세션 상태를 다시 불러오지 못했습니다.');
    } finally {
      if (!mountedRef.current) {
        return;
      }
      setSessionLoading(false);
      setSessionRefreshing(false);
    }
  }

  function syncUploadedAttemptFromProgress(progress: AttemptVideoProcessingJobProgress) {
    setPendingJobProgress(progress);

    if (progress.status === 'COMPLETED' && progress.resultAttemptId) {
      setUploadedAttempt((current) => ({
        challengeId,
        challengeTitle,
        attemptId: progress.resultAttemptId,
        score: current?.score ?? 0,
        status: current?.status ?? '완료됨',
        resultSummary:
          current?.resultSummary ??
          progress.processingNotice ??
          '처리가 완료되어 결과 화면에서 바로 이어서 확인할 수 있습니다.',
        resultHeadline: current?.resultHeadline ?? '결과 준비 완료',
        analyzerName: current?.analyzerName ?? 'async-pending-completion',
        videoOriginalFileName: current?.videoOriginalFileName ?? progress.originalFileName ?? 'uploaded-video.mp4',
        videoContentType: current?.videoContentType ?? 'video/mp4',
        videoSize: current?.videoSize ?? 0,
        attemptedAt: current?.attemptedAt ?? new Date().toISOString(),
        scoreAvailable: true,
        processingMode: current?.processingMode ?? 'ASYNC_JOB_PENDING',
        processingComplete: true,
        processingNotice:
          progress.processingNotice ??
          '처리가 완료되어 결과 화면에서 바로 이어서 확인할 수 있습니다.',
        pendingTrackingId: null,
        resultSource: current?.resultSource ?? 'VIDEO_UPLOAD_AUTOSCORED',
      }));
      return;
    }

    setUploadedAttempt((current) => {
      if (!current || current.pendingTrackingId !== progress.trackingId) {
        return current;
      }

      return {
        ...current,
        processingMode: progress.processingMode,
        processingComplete: progress.status === 'COMPLETED',
        processingNotice: progress.processingNotice,
        pendingTrackingId: progress.status === 'COMPLETED' ? null : progress.trackingId,
      };
    });
  }

  async function loadPendingJobProgress() {
    if (!pendingTrackingId) {
      setMessage('다시 조회할 trackingId가 아직 없습니다.');
      return;
    }

    setTrackingProgressLoading(true);
    try {
      const progress = await getAttemptVideoProcessingProgressByTrackingId(pendingTrackingId);
      syncUploadedAttemptFromProgress(progress);
      setMessage(
        buildDurableProgressRefreshMessage(progress, {
          sourceLabel: 'trackingId direct progress',
        }),
      );
      await loadMotionSessionState({ silent: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '처리 상태를 다시 확인하지 못했습니다.');
    } finally {
      setTrackingProgressLoading(false);
    }
  }

  async function loadPendingJobProgressByTrackingId(trackingId: string, options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;
    if (!silent) {
      setTrackingProgressLoading(true);
    }

    try {
      const progress = await getAttemptVideoProcessingProgressByTrackingId(trackingId);
      syncUploadedAttemptFromProgress(progress);
      setMessage(buildProgressMessage(progress));
      await loadMotionSessionState({ silent: true });
    } catch (error) {
      if (!silent) {
        setMessage(error instanceof Error ? error.message : '추적 ID로 처리 상태를 다시 확인하지 못했습니다.');
      }
    } finally {
      if (!silent) {
        setTrackingProgressLoading(false);
      }
    }
  }

  async function requestCameraAccess() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unavailable');
        setMessage('이 브라우저에서는 카메라 확인을 지원하지 않습니다. 영상 업로드 흐름으로 계속 진행할 수 있습니다.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stopStream();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraState('ready');
      setMessage('카메라 준비를 확인했습니다. 업로드 단계로 이동해 다음 작업을 진행할 수 있습니다.');
    } catch (error) {
      handleCameraError(error);
    }
  }

  function handleCameraError(error: unknown) {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        setCameraState('denied');
        setMessage('카메라 권한이 거부되었습니다. 카메라 없이도 업로드 흐름을 계속 진행할 수 있습니다.');
        return;
      }
      if (error.name === 'NotFoundError') {
        setCameraState('unavailable');
        setMessage('연결된 카메라를 찾지 못했습니다. 준비 저장 또는 영상 업로드 흐름으로 계속 진행할 수 있습니다.');
        return;
      }
      if (error.name === 'NotReadableError') {
        setCameraState('error');
        setMessage('카메라를 지금 사용할 수 없습니다. 카메라 없이 계속하거나 잠시 후 다시 시도해 주세요.');
        return;
      }
    }

    setCameraState('error');
    setMessage('카메라 준비를 확인하지 못했습니다. 카메라 없이 계속하거나 잠시 후 다시 시도해 주세요.');
  }

  function moveToUploadStage() {
    setFlowStage('upload');
    setMessage('이제 영상 파일 업로드나 기록 저장 중 원하는 흐름을 이어서 진행할 수 있습니다.');
  }

  function continueWithoutCamera() {
    setFlowStage('upload');
    setMessage('카메라 없이 진행 중입니다. 기록 저장이나 실제 영상 업로드 중 원하는 작업을 선택해 주세요.');
  }

  async function saveAttempt(recordType: 'prepared' | 'completed') {
    setSaveLoading(true);
    setSaveError(null);

    try {
      const attempt = await createAttempt({
        challengeId,
        recordType,
        score: buildPreviewScore(recordType),
        notes: buildAttemptNote(recordType, challengeTitle),
      });
      setSavedAttempt(attempt);
      setMessage(
        recordType === 'prepared'
          ? '준비 기록을 저장했습니다. 이 버튼은 실제 DB 저장 동작입니다.'
          : '샘플 완료 기록을 저장했습니다. 이 버튼은 실제 DB 저장 동작입니다.',
      );
      await loadMotionSessionState({ silent: true });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '기록을 저장하지 못했습니다.');
    } finally {
      setSaveLoading(false);
    }
  }

  function onSelectVideo(event: ChangeEvent<HTMLInputElement>) {
    setSelectedVideo(event.target.files?.[0] ?? null);
  }

  async function submitAttemptVideo() {
    if (!selectedVideo) {
      setUploadError('업로드할 영상을 먼저 선택해 주세요.');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);
    setPendingJobProgress(null);
    setUploadedAttempt(null);

    try {
      const result = await uploadAttemptVideo({
        challengeId,
        attemptVideo: selectedVideo,
        notes: buildUploadNote(challengeTitle),
      });
      setUploadedAttempt(result);
      setMessage(
        result.processingComplete
          ? '영상 업로드와 자동 채점이 완료되었습니다. 결과 화면으로 바로 이동할 수 있습니다.'
          : '영상 업로드를 접수했습니다. trackingId 기반 후속 확인이 필요합니다.',
      );
      if (result.pendingTrackingId) {
        await loadPendingJobProgressByTrackingId(result.pendingTrackingId, { silent: true });
      }
      await loadMotionSessionState({ silent: true });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '영상을 업로드하지 못했습니다.');
    } finally {
      setUploadLoading(false);
    }
  }

  async function completePendingAttempt() {
    if (!pendingTrackingId) {
      setMessage('먼저 대기 중인 trackingId를 확인해 주세요.');
      return;
    }

    setPendingCompletionLoading(true);
    try {
      const request: AsyncPendingCompletionRequest = {
        trackingId: pendingTrackingId,
        challengeId,
        notes: buildUploadNote(challengeTitle),
      };
      const result = await completeAsyncPendingAttempt(request);
      setUploadedAttempt(result);
      setMessage('수동 완료 처리를 마쳤습니다. 결과 화면으로 바로 이동할 수 있습니다.');
      if (result.pendingTrackingId) {
        await loadPendingJobProgressByTrackingId(result.pendingTrackingId, { silent: true });
      } else {
        setPendingJobProgress(null);
      }
      await loadMotionSessionState({ silent: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '수동 완료 처리를 진행하지 못했습니다.');
    } finally {
      setPendingCompletionLoading(false);
    }
  }

  async function copyTrackingId() {
    if (!pendingTrackingId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(pendingTrackingId);
      setTrackingIdCopied(true);
    } catch {
      setMessage('trackingId를 복사하지 못했습니다. 직접 선택해서 복사해 주세요.');
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  return (
    <section className="camera-panel">
      <div className="camera-panel__header">
        <div>
          <p className="camera-panel__eyebrow">Camera Ready</p>
          <h2>{challengeTitle} 시작 준비</h2>
          <p className={`camera-panel__message ${messageToneClass}`}>{message}</p>
        </div>
        <button type="button" className="button button--ghost" onClick={() => void loadMotionSessionState({ silent: false })}>
          {sessionRefreshing || sessionLoading ? '세션 새로고침 중...' : '세션 새로고침'}
        </button>
      </div>

      <div className={`camera-panel__status ${serverStatusToneClass}`}>
        <span>현재 서버 상태</span>
        <strong>{sessionState?.runtimeState ?? '상태 확인 중'}</strong>
      </div>

      {sessionError ? <p className="camera-panel__error">{sessionError}</p> : null}

      {recentRuntimeTrace.length > 0 ? (
        <div className="camera-runtime-feed">
          <h3>최근 서버 상태 변화</h3>
          <ul>
            {recentRuntimeTrace.map((item, index) => {
              const warnClass = item.runtimeState === 'FAILED_RETRYABLE' ? ' camera-runtime-feed__item--warn' : '';
              return (
                <li key={`${item.runtimeState}-${item.recordedAt}-${index}`} className={`camera-runtime-feed__item${warnClass}`}>
                  <strong>{item.runtimeState}</strong>
                  <span>{runtimeSourceLabel(item.source)}</span>
                  <span>{formatRuntimeRecordedAt(item.recordedAt)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="camera-panel__grid">
        <article className="camera-panel__card">
          <h3>1. 카메라 확인 단계</h3>
          <p>카메라 권한만 점검합니다. 이 카드의 버튼은 DB 저장과 무관합니다.</p>
          <div className="camera-panel__video-shell">
            <video ref={videoRef} autoPlay muted playsInline className="camera-panel__video" />
          </div>
          <div className="camera-panel__actions">
            <button type="button" className="button" onClick={() => void requestCameraAccess()}>
              카메라 권한 확인
            </button>
            {canOpenUploadStage ? (
              <button type="button" className="button button--secondary" onClick={moveToUploadStage}>
                다음: 업로드 단계 열기
              </button>
            ) : null}
            {canContinueWithoutCamera ? (
              <button type="button" className="button button--ghost" onClick={continueWithoutCamera}>
                카메라 없이 계속
              </button>
            ) : null}
          </div>
          <p className="camera-panel__meta">카메라 상태: {cameraStateLabel(cameraState)}</p>
        </article>

        <article className="camera-panel__card">
          <h3>2. 빠른 기록 저장</h3>
          <p>이 카드의 버튼은 전부 실제 DB 저장입니다. 업로드 없이 준비/샘플 기록을 바로 남깁니다.</p>
          <div className="camera-panel__actions">
            <button type="button" className="button" onClick={() => void saveAttempt('prepared')} disabled={saveLoading}>
              {saveLoading ? '저장 중...' : '준비 기록 저장'}
            </button>
            <button type="button" className="button button--secondary" onClick={() => void saveAttempt('completed')} disabled={saveLoading}>
              샘플 완료 기록 저장
            </button>
          </div>
          {saveError ? <p className="camera-panel__error">{saveError}</p> : null}
          {savedAttempt ? (
            <p className="camera-panel__success">
              저장된 시도 #{savedAttempt.id} · <Link to={`/attempts/${savedAttempt.id}/result`}>결과 보기</Link>
            </p>
          ) : null}
        </article>
      </div>

      {flowStage === 'upload' ? (
        <article className="camera-panel__card camera-panel__card--wide">
          <h3>3. 실제 영상 업로드</h3>
          <p>이 카드에서는 실제 파일 업로드와 자동 채점 흐름이 진행됩니다.</p>
          <div className="camera-panel__upload-box">
            <input type="file" accept="video/*" onChange={onSelectVideo} />
            <button type="button" className="button" onClick={() => void submitAttemptVideo()} disabled={uploadLoading}>
              {uploadLoading ? '업로드 중...' : '영상 업로드'}
            </button>
          </div>
          {selectedVideo ? <p className="camera-panel__meta">선택한 파일: {selectedVideo.name}</p> : null}
          {uploadError ? <p className="camera-panel__error">{uploadError}</p> : null}

          {uploadedAttempt ? (
            <div className="camera-panel__result-box">
              <div className="camera-panel__result-header">
                <h4>{uploadedAttempt.resultHeadline}</h4>
                <span className="camera-panel__pill">{processingModeLabel(uploadedAttempt.processingMode)}</span>
                <span className="camera-panel__pill">{uploadedAttempt.processingComplete ? '처리 완료' : '처리 대기'}</span>
              </div>
              <p>{uploadedAttempt.resultSummary}</p>
              <p className="camera-panel__meta">{uploadedAttempt.processingNotice}</p>
              {uploadedAttemptResultId ? (
                <p className="camera-panel__success">
                  <Link to={`/attempts/${uploadedAttemptResultId}/result`}>결과 보기</Link>
                </p>
              ) : (
                <p className="camera-panel__meta">결과 화면은 처리 완료 뒤에 열립니다.</p>
              )}
            </div>
          ) : null}

          {pendingTrackingId ? (
            <div className={`processing-job-card ${processingJobToneClass}`}>
              <div className="processing-job-card__header">
                <div>
                  <p className="camera-panel__eyebrow">Processing Job</p>
                  <h4>{buildDurableProgressHeadline(pendingJobProgress)}</h4>
                </div>
                <span className="camera-panel__pill">{pendingJobProgress?.status ?? 'PENDING'}</span>
              </div>

              <p className="processing-job-card__summary">{pendingStageSummary}</p>
              <p className="camera-panel__meta">아래 버튼은 업로드 이후 상태 확인 또는 수동 완료 처리 버튼입니다.</p>

              <div className="tracking-id-row">
                <code>{pendingTrackingId}</code>
                <button type="button" className="button button--ghost" onClick={() => void copyTrackingId()}>
                  {trackingIdCopied ? '복사 완료' : 'trackingId 복사'}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => void loadPendingJobProgressByTrackingId(pendingTrackingId)}
                  disabled={trackingProgressLoading}
                >
                  {trackingProgressLoading ? '다시 조회 중...' : 'trackingId로 상태 다시 조회'}
                </button>
              </div>
              {trackingIdCopied ? (
                <p className="tracking-id-feedback">trackingId가 복사되었습니다. 다른 화면이나 수동 완료 처리에 사용할 수 있습니다.</p>
              ) : null}

              <ul className="processing-job-card__meta">
                <li>
                  <span>완료 방식</span>
                  <strong>{buildDurableProgressCompletionStrategyLabel(pendingJobProgress?.completionStrategy)}</strong>
                </li>
                <li>
                  <span>누적 처리 시간</span>
                  <strong>{buildDurableProgressElapsedTimeLabel(pendingJobProgress?.elapsedSeconds)}</strong>
                </li>
                <li>
                  <span>재시도 가능 여부</span>
                  <strong>{buildDurableProgressRetryWindowLabel(pendingJobProgress)}</strong>
                </li>
                <li>
                  <span>업로드 파일</span>
                  <strong>{buildDurableProgressOriginalFileLabel(pendingJobProgress)}</strong>
                </li>
              </ul>

              {pendingJobProgress?.failureCode ? <p className="camera-panel__meta">실패 코드: {pendingJobProgress.failureCode}</p> : null}
              {pendingJobProgress?.processingNotice ? <p className="camera-panel__meta">{pendingJobProgress.processingNotice}</p> : null}

              {pendingJobProgress?.status === 'FAILED' && pendingJobProgress.failureAction ? (
                <div className={`processing-job-action ${processingJobActionToneClass}`}>
                  <strong>다음 확인 작업</strong>
                  <p>{buildDurableProgressFailureAction(pendingJobProgress.failureAction)}</p>
                </div>
              ) : null}

              {pendingJobProgress?.status === 'COMPLETED' && pendingJobProgress.resultAttemptId ? (
                <div className="processing-job-result-link">
                  <strong>완료된 결과</strong>
                  <p>{buildDurableProgressCompletionLinkDescription()}</p>
                  <Link to={`/attempts/${pendingJobProgress.resultAttemptId}/result`}>{buildDurableProgressCompletionLinkLabel()}</Link>
                </div>
              ) : null}

              {pendingJobProgress?.status !== 'COMPLETED' ? (
                <div className="camera-panel__actions">
                  <button type="button" className="button button--secondary" onClick={() => void loadPendingJobProgress()} disabled={trackingProgressLoading}>
                    {trackingProgressLoading ? '상태 확인 중...' : '진행 상태 새로고침'}
                  </button>
                  <button type="button" className="button" onClick={() => void completePendingAttempt()} disabled={pendingCompletionLoading}>
                    {pendingCompletionLoading ? '완료 처리 중...' : '수동 완료 처리'}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}

function buildPreviewScore(recordType: 'prepared' | 'completed') {
  return recordType === 'prepared' ? 0 : 82;
}

function buildAttemptNote(recordType: 'prepared' | 'completed', challengeTitle: string) {
  return recordType === 'prepared'
    ? `${challengeTitle} 준비 상태를 저장한 테스트 기록입니다.`
    : `${challengeTitle} 샘플 완료 결과를 저장한 테스트 기록입니다.`;
}

function buildUploadNote(challengeTitle: string) {
  return `${challengeTitle} 영상 업로드 자동 채점 테스트 기록입니다.`;
}

function buildProgressMessage(progress: AttemptVideoProcessingJobProgress) {
  switch (progress.status) {
    case 'PENDING':
      return 'trackingId 기준으로 처리 대기 상태를 확인했습니다.';
    case 'PROCESSING':
      return 'trackingId 기준으로 분석과 채점이 진행 중입니다.';
    case 'COMPLETED':
      return 'trackingId 기준으로 처리 완료를 확인했습니다. 결과 화면으로 이동할 수 있습니다.';
    case 'FAILED':
      return buildFailureProgressMessage(progress);
    default:
      return 'trackingId 기준으로 최신 처리 상태를 다시 확인했습니다.';
  }
}

function buildFailureProgressMessage(progress: AttemptVideoProcessingJobProgress) {
  if (progress.failureSeverity === 'HIGH') {
    return `중요한 실패 상태를 확인했습니다. ${buildDurableProgressFailureAction(progress.failureAction)} 먼저 확인해 주세요.`;
  }

  return `재시도 가능한 실패 상태를 확인했습니다. ${buildDurableProgressFailureAction(progress.failureAction)} 먼저 확인해 주세요.`;
}

function buildMessageToneClass(progress: AttemptVideoProcessingJobProgress | null, message: string) {
  if (progress?.status === 'FAILED') {
    return progress.failureSeverity === 'HIGH'
      ? 'camera-panel__message camera-panel__message--danger'
      : 'camera-panel__message camera-panel__message--warn';
  }
  if (message.includes('실패') || message.includes('문제')) {
    return 'camera-panel__message camera-panel__message--warn';
  }
  return 'camera-panel__message';
}

function buildServerStatusToneClass(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return 'camera-panel__status';
  }
  if (progress.status === 'FAILED') {
    return progress.failureSeverity === 'HIGH'
      ? 'camera-panel__status camera-panel__status--danger'
      : 'camera-panel__status camera-panel__status--warn';
  }
  return 'camera-panel__status';
}

function buildProcessingJobToneClass(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return 'processing-job-card';
  }
  switch (progress.status) {
    case 'PENDING':
      return 'processing-job-card processing-job-card--pending';
    case 'PROCESSING':
      return 'processing-job-card processing-job-card--processing';
    case 'COMPLETED':
      return 'processing-job-card processing-job-card--completed';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH'
        ? 'processing-job-card processing-job-card--failed-high'
        : 'processing-job-card processing-job-card--failed-warn';
    default:
      return 'processing-job-card';
  }
}

function buildProcessingJobActionToneClass(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress || progress.status !== 'FAILED') {
    return 'processing-job-action';
  }
  return progress.failureSeverity === 'HIGH'
    ? 'processing-job-action processing-job-action--danger'
    : 'processing-job-action processing-job-action--warn';
}

function processingModeLabel(mode: AttemptProcessingMode | null | undefined) {
  switch (mode) {
    case 'SYNC_INLINE':
      return '동기 처리';
    case 'ASYNC_JOB_PENDING':
      return '비동기 대기';
    default:
      return '프로토타입 저장';
  }
}

function cameraStateLabel(cameraState: CameraState) {
  switch (cameraState) {
    case 'idle':
      return '권한 확인 전';
    case 'ready':
      return '카메라 준비 완료';
    case 'denied':
      return '권한 거부';
    case 'unavailable':
      return '장치 없음';
    case 'error':
      return '오류 발생';
    default:
      return '상태 확인 중';
  }
}

function runtimeSourceLabel(source: MotionSessionState['serverRuntimeTrace'][number]['source'] | null) {
  if (!source) {
    return '기록 없음';
  }
  switch (source) {
    case 'EVENT_BUS':
      return '이벤트 버스';
    case 'ASYNC_JOB':
      return '비동기 작업';
    case 'TRACKER':
      return '런타임 트래커';
    default:
      return source;
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


