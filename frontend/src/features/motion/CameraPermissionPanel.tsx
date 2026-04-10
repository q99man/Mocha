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
  buildDurableProgressCompletionStrategyLabel,
  buildDurableProgressElapsedTimeLabel,
  buildDurableProgressFailureAction,
  buildDurableProgressHeadline,
  buildDurableProgressOriginalFileLabel,
  buildDurableProgressRetryWindowLabel,
  buildDurableProgressSummary,
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
    'Check the runtime state first, then upload a real attempt video for scoring.',
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
      setSessionError(error instanceof Error ? error.message : 'Failed to load the runtime state.');
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
      setMessage('Camera access is not available in this browser.');
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
      setMessage('Camera access is ready. You can move to the upload step now.');
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
    setMessage('Upload a real attempt video to start analysis and scoring.');
  }

  function continueWithoutCamera() {
    setFlowStage('upload');
    setMessage('Continuing without camera. Upload a real attempt video when ready.');
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
      setUploadError('Select a video file first.');
      return;
    }
    if (sessionState && !sessionState.uploadEnabled) {
      setUploadError('Uploads are currently disabled for this challenge state.');
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
      setMessage(response.processingNotice ?? 'Upload accepted. Review the result below.');

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
      setUploadError(error instanceof Error ? error.message : 'Failed to upload the attempt video.');
    } finally {
      if (mountedRef.current) {
        setUploadLoading(false);
      }
    }
  }

  async function loadPendingJobProgress() {
    if (!pendingTrackingId) {
      setUploadError('No tracking id is available for this upload yet.');
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
        setUploadError(error instanceof Error ? error.message : 'Failed to refresh durable progress.');
      }
    } finally {
      if (mountedRef.current) {
        setTrackingProgressLoading(false);
      }
    }
  }

  async function completePendingAttempt() {
    if (!pendingTrackingId) {
      setUploadError('No tracking id is available for manual completion.');
      return;
    }

    setPendingCompletionLoading(true);
    setUploadError(null);

    const request: AsyncPendingCompletionRequest = {
      challengeId,
      trackingId: pendingTrackingId,
      notes: `Manual completion for ${challengeTitle}`,
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
      setMessage(response.processingNotice ?? 'Manual completion finished.');
      await loadMotionSessionState({ silent: true });
    } catch (error) {
      if (mountedRef.current) {
        setUploadError(error instanceof Error ? error.message : 'Failed to complete the pending upload.');
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
      setUploadError('Failed to copy the tracking id.');
    }
  }

  return (
    <section className="camera-panel">
      <div className="camera-panel__header">
        <div>
          <p className="camera-panel__eyebrow">Camera Ready</p>
          <h2>{challengeTitle} start console</h2>
          <p className="camera-panel__message">{message}</p>
        </div>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => void loadMotionSessionState({ silent: true })}
        >
          {sessionRefreshing || sessionLoading ? 'Refreshing...' : 'Refresh session'}
        </button>
      </div>

      <div className="camera-panel__status">
        <span>Runtime state</span>
        <strong>{sessionState?.runtimeState ?? 'Checking runtime'}</strong>
      </div>

      {sessionError ? <p className="camera-panel__error">{sessionError}</p> : null}

      {recentRuntimeTrace.length > 0 ? (
        <div className="camera-runtime-feed">
          <h3>Recent runtime trace</h3>
          <ul>
            {recentRuntimeTrace.map((item, index) => (
              <li key={`${item.runtimeState}-${item.recordedAt}-${index}`} className="camera-runtime-feed__item">
                <strong>{item.runtimeState}</strong>
                <span>{item.source ?? 'TRACKER'}</span>
                <span>{formatRuntimeRecordedAt(item.recordedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="camera-panel__grid">
        <article className="camera-panel__card">
          <h3>1. Camera check</h3>
          <p>Camera permission is optional. You can continue to the upload step without it.</p>
          <div className="camera-panel__video-shell">
            <video ref={videoRef} autoPlay muted playsInline className="camera-panel__video" />
          </div>
          <div className="camera-panel__actions">
            <button type="button" className="button" onClick={() => void requestCameraAccess()}>
              Check camera
            </button>
            {canOpenUploadStage ? (
              <button type="button" className="button button--secondary" onClick={moveToUploadStage}>
                Open upload step
              </button>
            ) : null}
            {canContinueWithoutCamera ? (
              <button type="button" className="button button--ghost" onClick={continueWithoutCamera}>
                Continue without camera
              </button>
            ) : null}
          </div>
          <p className="camera-panel__meta">Camera state: {cameraStateLabel(cameraState)}</p>
        </article>
      </div>

      {flowStage === 'upload' ? (
        <article className="camera-panel__card camera-panel__card--wide">
          <h3>2. Upload attempt video</h3>
          <p>Select a real challenge video and submit it for analysis and scoring.</p>
          <div className="camera-panel__upload-box">
            <input type="file" accept="video/*" onChange={onSelectVideo} />
            <button
              type="button"
              className="button"
              onClick={() => void submitAttemptVideo()}
              disabled={uploadLoading || (sessionState ? !sessionState.uploadEnabled : false)}
            >
              {uploadLoading ? 'Uploading...' : 'Upload video'}
            </button>
          </div>
          {selectedVideo ? <p className="camera-panel__meta">Selected file: {selectedVideo.name}</p> : null}
          {uploadError ? <p className="camera-panel__error">{uploadError}</p> : null}

          {uploadedAttempt ? (
            <div className="camera-panel__result-box">
              <div className="camera-panel__result-header">
                <h4>{uploadedAttempt.resultHeadline}</h4>
                <span className="camera-panel__pill">{uploadedAttempt.processingMode ?? 'SYNC_INLINE'}</span>
                <span className="camera-panel__pill">
                  {uploadedAttempt.processingComplete ? 'Completed' : 'Pending'}
                </span>
              </div>
              <p>{uploadedAttempt.resultSummary}</p>
              <p className="camera-panel__meta">{uploadedAttempt.processingNotice}</p>
              {uploadedAttemptBreakdownSummary ? (
                <div className="camera-panel__breakdown">
                  <strong>{uploadedAttemptBreakdownSummary}</strong>
                  {uploadedAttempt.scoreDeltaFromPrevious != null ? (
                    <p className="camera-panel__meta">
                      Compared with previous scored run: {uploadedAttempt.scoreDeltaFromPrevious >= 0 ? '+' : ''}{uploadedAttempt.scoreDeltaFromPrevious} pts
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
                  <Link to={`/attempts/${uploadedAttemptResultId}/result`}>Open result page</Link>
                </p>
              ) : (
                <p className="camera-panel__meta">Result id will appear after processing completes.</p>
              )}
            </div>
          ) : null}

          {pendingUploadAwaitingCompletion || pendingJobProgress ? (
            <div className="camera-panel__pending-box">
              <div className="camera-panel__pending-header">
                <div>
                  <h4>{buildDurableProgressHeadline(pendingJobProgress)}</h4>
                  <p>{buildPendingPanelSummary(pendingJobProgress, uploadedAttempt)}</p>
                </div>
                <span className="camera-panel__pill">{pendingJobProgress?.status ?? 'PENDING'}</span>
              </div>

              {buildPendingPanelNotice(pendingJobProgress, uploadedAttempt) ? (
                <p className="camera-panel__meta">{buildPendingPanelNotice(pendingJobProgress, uploadedAttempt)}</p>
              ) : null}

              {pendingJobProgress?.status === 'FAILED' ? (
                <p className="camera-panel__error">
                  Next step: {buildDurableProgressFailureAction(pendingJobProgress.failureAction)}
                </p>
              ) : null}

              <ul className="detail-list">
                <li>
                  <strong>trackingId</strong>
                  {pendingTrackingId ?? 'Not available yet'}
                </li>
                <li>
                  <strong>completion strategy</strong>
                  {buildDurableProgressCompletionStrategyLabel(pendingJobProgress?.completionStrategy)}
                </li>
                <li>
                  <strong>elapsed</strong>
                  {buildDurableProgressElapsedTimeLabel(pendingJobProgress?.elapsedSeconds)}
                </li>
                <li>
                  <strong>retry window</strong>
                  {buildDurableProgressRetryWindowLabel(pendingJobProgress)}
                </li>
                <li>
                  <strong>original file</strong>
                  {pendingJobProgress
                    ? buildDurableProgressOriginalFileLabel(pendingJobProgress)
                    : selectedVideo?.name ?? 'unknown'}
                </li>
              </ul>

              <div className="camera-panel__actions camera-panel__actions--utility">
                <button type="button" className="button button--ghost" onClick={() => void copyTrackingId()}>
                  {trackingIdCopied ? 'Tracking id copied' : 'Copy tracking id'}
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => void loadPendingJobProgress()}
                  disabled={trackingProgressLoading}
                >
                  {trackingProgressLoading ? 'Refreshing...' : 'Refresh progress'}
                </button>
                {pendingJobProgress?.status !== 'COMPLETED' ? (
                  <button
                    type="button"
                    className="button"
                    onClick={() => void completePendingAttempt()}
                    disabled={pendingCompletionLoading}
                  >
                    {pendingCompletionLoading ? 'Completing...' : 'Complete manually'}
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
  return `${challengeTitle} attempt video upload`;
}

function buildSessionMessage(state: MotionSessionState) {
  if (state.uploadEnabled) {
    return 'The challenge is ready for upload and scoring.';
  }
  if (state.readinessState === 'REFERENCE_PENDING') {
    return 'Reference analysis is still pending for this challenge.';
  }
  return 'Check the current runtime state before uploading.';
}

function buildPendingPanelSummary(
  progress: AttemptVideoProcessingJobProgress | null,
  uploadedAttempt: AttemptVideoResult | null,
) {
  if (progress) {
    return buildDurableProgressSummary(progress);
  }

  if (uploadedAttempt?.processingMode === 'ASYNC_JOB_PENDING' && !uploadedAttempt.processingComplete) {
    return 'Upload accepted. Waiting for the first durable progress snapshot.';
  }

  return 'Processing state is being refreshed.';
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
      return 'Camera ready';
    case 'denied':
      return 'Permission denied';
    case 'unavailable':
      return 'Camera unavailable';
    case 'error':
      return 'Camera error';
    default:
      return 'Idle';
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
      return 'Camera permission was denied. You can continue without camera access.';
    case 'unavailable':
      return 'No camera device is available. You can continue without camera access.';
    default:
      return 'Camera access failed. You can continue without camera access.';
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
