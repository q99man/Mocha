import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createAttempt, uploadAttemptVideo } from '../../shared/api/attemptApi';
import { getMotionSessionState } from '../../shared/api/motionApi';
import { StatusGlyph } from '../../shared/components/StatusGlyph';
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

type FlowStage =
  | 'camera-check'
  | 'camera-ready'
  | 'countdown-ready'
  | 'recording-active'
  | 'recording-paused'
  | 'upload-waiting'
  | 'uploading'
  | 'upload-complete'
  | 'sample-save-complete';

type ServerSyncState = 'idle' | 'syncing' | 'synced' | 'error';

type RuntimeObservation = {
  runtimeState: MotionSessionState['runtimeState'];
  firstSeenAt: string;
  lastSeenAt: string;
  firstSeenAtMs: number;
  lastSeenAtMs: number;
  observationCount: number;
};

type CaptureSessionQuality = {
  score: number;
  status: 'full' | 'partial' | 'empty';
  recordedAt: number;
};

type CameraPermissionPanelProps = {
  challengeId: number;
  challengeTitle?: string;
};

const DEFAULT_MESSAGE =
  '카메라 권한을 확인하고, 실제 촬영과 업로드 결과 흐름으로 넘어가기 전 준비 구간을 점검합니다.';

const COUNTDOWN_START = 3;
const SIMULATED_UPLOAD_DURATION_MS = 1800;
const REFERENCE_PENDING_POLL_MS = 8000;
const RUNTIME_TRACE_POLL_MS = 900;
const HIGH_CAPTURE_POLL_MS = 600;
const TRANSIENT_CAPTURE_WINDOW_SECONDS = 2;
const CAPTURE_SCORE_STORAGE_KEY_PREFIX = 'mocha-runtime-capture-score';
const CAPTURE_SCORE_HISTORY_STORAGE_KEY_PREFIX = 'mocha-runtime-capture-score-history';
const CAPTURE_SESSION_QUALITY_STORAGE_KEY_PREFIX = 'mocha-runtime-capture-quality-history';
const CAPTURE_SCORE_HISTORY_LIMIT = 5;
const CAPTURE_REPRO_WINDOW = 3;

export function CameraPermissionPanel({
  challengeId,
  challengeTitle,
}: CameraPermissionPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const previousUploadLoadingRef = useRef(false);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [flowStage, setFlowStage] = useState<FlowStage>('camera-check');
  const [sessionState, setSessionState] = useState<MotionSessionState | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionRefreshing, setSessionRefreshing] = useState(false);
  const [lastSessionSyncedAt, setLastSessionSyncedAt] = useState<string | null>(null);
  const [runtimeHistory, setRuntimeHistory] = useState<RuntimeObservation[]>([]);
  const [bestCaptureScore, setBestCaptureScore] = useState(0);
  const [captureScoreHistory, setCaptureScoreHistory] = useState<number[]>([]);
  const [captureQualityHistory, setCaptureQualityHistory] = useState<CaptureSessionQuality[]>([]);
  const [serverSyncState, setServerSyncState] = useState<ServerSyncState>('idle');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAttempt, setSavedAttempt] = useState<AttemptSummary | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [recordedVideo, setRecordedVideo] = useState<File | null>(null);
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedAttempt, setUploadedAttempt] = useState<AttemptVideoResult | null>(null);
  const [recordingSupported, setRecordingSupported] = useState(
    typeof window !== 'undefined' ? typeof window.MediaRecorder !== 'undefined' : false,
  );
  const [countdownValue, setCountdownValue] = useState(COUNTDOWN_START);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  async function loadMotionSessionState(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    if (silent) {
      setSessionRefreshing(true);
    } else {
      setSessionLoading(true);
    }

    setSessionError(null);
    setServerSyncState('syncing');

    try {
      const response = await getMotionSessionState(challengeId);
      setSessionState(response);
      setMessage(response.message);
      setLastSessionSyncedAt(new Date().toLocaleTimeString('ko-KR'));
      setServerSyncState('synced');
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : '모션 세션 준비 정보를 불러오지 못했습니다.',
      );
      setServerSyncState('error');
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
    if (typeof window === 'undefined') {
      return;
    }

    const raw = window.localStorage.getItem(`${CAPTURE_SCORE_STORAGE_KEY_PREFIX}:${challengeId}`);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    setBestCaptureScore(Number.isFinite(parsed) ? parsed : 0);

    const historyRaw = window.localStorage.getItem(
      `${CAPTURE_SCORE_HISTORY_STORAGE_KEY_PREFIX}:${challengeId}`,
    );
    const parsedHistory = historyRaw ? parseCaptureScoreHistory(historyRaw) : [];
    setCaptureScoreHistory(parsedHistory);

    const qualityRaw = window.localStorage.getItem(
      `${CAPTURE_SESSION_QUALITY_STORAGE_KEY_PREFIX}:${challengeId}`,
    );
    const parsedQuality = qualityRaw ? parseCaptureSessionQualityHistory(qualityRaw) : [];
    setCaptureQualityHistory(parsedQuality);
  }, [challengeId]);

  useEffect(() => {
    const runtimeState = sessionState?.runtimeState;
    const shouldPollReferencePending = sessionState?.sessionState === 'REFERENCE_PENDING';
    const shouldPollRuntimeTrace =
      runtimeState === 'UPLOAD_IN_PROGRESS' ||
      runtimeState === 'UPLOAD_STORED' ||
      runtimeState === 'ANALYSIS_IN_PROGRESS' ||
      uploadLoading;

    if (!shouldPollReferencePending && !shouldPollRuntimeTrace) {
      return;
    }

    const intervalMs = uploadLoading
      ? HIGH_CAPTURE_POLL_MS
      : shouldPollRuntimeTrace
        ? RUNTIME_TRACE_POLL_MS
        : REFERENCE_PENDING_POLL_MS;
    const timer = window.setInterval(() => {
      void loadMotionSessionState({ silent: true });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [challengeId, sessionState?.sessionState, sessionState?.runtimeState, uploadLoading]);

  useEffect(() => {
    if (!sessionState) {
      return;
    }

    setRuntimeHistory((current) => {
      const now = Date.now();
      const nextSeenAt = new Date().toLocaleTimeString('ko-KR');
      if (current[0]?.runtimeState === sessionState.runtimeState) {
        return [
          {
            ...current[0],
            lastSeenAt: nextSeenAt,
            lastSeenAtMs: now,
            observationCount: current[0].observationCount + 1,
          },
          ...current.slice(1),
        ];
      }

      return [
        {
          runtimeState: sessionState.runtimeState,
          firstSeenAt: nextSeenAt,
          lastSeenAt: nextSeenAt,
          firstSeenAtMs: now,
          lastSeenAtMs: now,
          observationCount: 1,
        },
        ...current,
      ].slice(0, 6);
    });

    if (!shouldApplyRuntimeFlowMapping(flowStage)) {
      return;
    }

    const nextFlowStage = runtimeStateToFlowStage(sessionState.runtimeState, cameraState);
    if (nextFlowStage !== flowStage) {
      setFlowStage(nextFlowStage);
    }
  }, [sessionState, cameraState, flowStage]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentScore = runtimeCoverageScore(runtimeHistory);
    if (currentScore <= bestCaptureScore) {
      if (runtimeCoverageStatus(runtimeHistory) !== 'full') {
        return;
      }

      const currentHistory = captureScoreHistory;
      if (currentHistory[0] === currentScore) {
        return;
      }

      const nextHistory = [currentScore, ...currentHistory].slice(0, CAPTURE_SCORE_HISTORY_LIMIT);
      setCaptureScoreHistory(nextHistory);
      window.localStorage.setItem(
        `${CAPTURE_SCORE_HISTORY_STORAGE_KEY_PREFIX}:${challengeId}`,
        JSON.stringify(nextHistory),
      );
      return;
    }

    setBestCaptureScore(currentScore);
    window.localStorage.setItem(
      `${CAPTURE_SCORE_STORAGE_KEY_PREFIX}:${challengeId}`,
      String(currentScore),
    );

    const nextHistory =
      captureScoreHistory[0] === currentScore
        ? captureScoreHistory
        : [currentScore, ...captureScoreHistory].slice(0, CAPTURE_SCORE_HISTORY_LIMIT);
    setCaptureScoreHistory(nextHistory);
    window.localStorage.setItem(
      `${CAPTURE_SCORE_HISTORY_STORAGE_KEY_PREFIX}:${challengeId}`,
      JSON.stringify(nextHistory),
    );
  }, [runtimeHistory, bestCaptureScore, challengeId, captureScoreHistory]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      previousUploadLoadingRef.current = uploadLoading;
      return;
    }

    const wasUploading = previousUploadLoadingRef.current;
    previousUploadLoadingRef.current = uploadLoading;

    if (!wasUploading || uploadLoading || runtimeHistory.length === 0) {
      return;
    }

    const latestEntry: CaptureSessionQuality = {
      score: runtimeCoverageScore(runtimeHistory),
      status: runtimeCoverageStatus(runtimeHistory),
      recordedAt: Date.now(),
    };

    const currentHistory = captureQualityHistory;
    const previousEntry = currentHistory[0];
    if (
      previousEntry &&
      previousEntry.score === latestEntry.score &&
      previousEntry.status === latestEntry.status &&
      latestEntry.recordedAt - previousEntry.recordedAt < 5000
    ) {
      return;
    }

    const nextHistory = [latestEntry, ...currentHistory].slice(0, CAPTURE_SCORE_HISTORY_LIMIT);
    setCaptureQualityHistory(nextHistory);
    window.localStorage.setItem(
      `${CAPTURE_SESSION_QUALITY_STORAGE_KEY_PREFIX}:${challengeId}`,
      JSON.stringify(nextHistory),
    );
  }, [uploadLoading, runtimeHistory, captureQualityHistory, challengeId]);

  useEffect(() => {
    if (flowStage !== 'countdown-ready') {
      setCountdownValue(COUNTDOWN_START);
      return;
    }

    const timer = window.setInterval(() => {
      setCountdownValue((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setFlowStage('recording-active');
          setMessage('카운트다운이 끝났습니다. 이제 실제 촬영 HUD와 업로드 대기 흐름으로 이어집니다.');
          return COUNTDOWN_START;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [flowStage]);

  useEffect(() => {
    if (
      flowStage !== 'countdown-ready' &&
      flowStage !== 'recording-active' &&
      flowStage !== 'upload-waiting' &&
      flowStage !== 'uploading'
    ) {
      setSessionSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      setSessionSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [flowStage]);

  useEffect(() => {
    if (!uploadLoading) {
      if (flowStage !== 'upload-complete') {
        setUploadProgress(0);
      }
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(96, Math.round((elapsed / SIMULATED_UPLOAD_DURATION_MS) * 100));
      setUploadProgress(nextProgress);
    }, 120);

    return () => window.clearInterval(timer);
  }, [uploadLoading, flowStage]);

  useEffect(() => {
    if (!selectedVideo) {
      setSelectedVideoUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedVideo);
    setSelectedVideoUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedVideo]);

  useEffect(() => {
    if (flowStage !== 'recording-active' || cameraState !== 'granted' || !recordingSupported) {
      return;
    }

    const recorder = ensureRecorder();
    if (!recorder || recorder.state !== 'inactive') {
      return;
    }

    recordedChunksRef.current = [];
    setRecordedVideo(null);
    setSelectedVideo(null);
    recorder.start();
    setMessage('브라우저 녹화가 시작되었습니다. 촬영 HUD와 세션 타이머가 실제 카메라 세션과 함께 움직입니다.');
  }, [flowStage, cameraState, recordingSupported]);

  async function requestCameraAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported');
      setMessage(
        '현재 브라우저에서는 카메라 접근을 지원하지 않습니다. 대신 업로드 기반 자동 채점 흐름과 샘플 저장 흐름을 계속 확인할 수 있습니다.',
      );
      return;
    }

    setCameraState('requesting');
    setSaveError(null);
    setUploadError(null);
    setMessage('카메라 권한을 요청하고 있습니다...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      stopStream();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraState('granted');
      setFlowStage('camera-ready');
      void loadMotionSessionState({ silent: true });
      setMessage('카메라 준비가 완료되었습니다. 이제 카운트다운 HUD와 업로드 대기 흐름으로 이어집니다.');
    } catch (error) {
      handleCameraError(error);
    }
  }

  function handleCameraError(error: unknown) {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          setCameraState('denied');
          setMessage(
            '카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용하거나 카메라 없이 업로드 흐름만 먼저 확인할 수 있습니다.',
          );
          return;
        case 'NotFoundError':
          setCameraState('missing');
          setMessage(
            '사용 가능한 카메라를 찾지 못했습니다. 카메라 없이도 업로드 기반 자동 채점 흐름은 계속 진행할 수 있습니다.',
          );
          return;
        case 'NotReadableError':
          setCameraState('unavailable');
          setMessage(
            '카메라 장치를 지금 사용할 수 없습니다. 다른 앱 사용 여부를 확인하거나 업로드 흐름부터 먼저 진행해 주세요.',
          );
          return;
        default:
          setCameraState('error');
          setMessage(
            '카메라를 준비하는 중 문제가 발생했습니다. 다시 시도하거나 카메라 없이 업로드 흐름만 먼저 확인할 수 있습니다.',
          );
          return;
      }
    }

    setCameraState('error');
    setMessage(
      '카메라를 준비하는 중 문제가 발생했습니다. 다시 시도하거나 카메라 없이 업로드 흐름만 먼저 확인할 수 있습니다.',
    );
  }
  function moveToCountdownReady() {
    setFlowStage('countdown-ready');
    setSaveError(null);
    setUploadError(null);
    setSavedAttempt(null);
    setUploadedAttempt(null);
    setRecordedVideo(null);
    setSelectedVideo(null);
    setMessage('카운트다운 HUD를 시작합니다. 실제 녹화 진입 직전 리듬과 타이밍을 먼저 맞춥니다.');
  }

  function moveToUploadWaiting() {
    setFlowStage('upload-waiting');
    setSaveError(null);
    setUploadError(null);
    setMessage('업로드 대기 단계입니다. 시도 비디오를 선택하면 자동 채점 흐름으로 바로 연결됩니다.');
  }

  function continueWithoutCamera() {
    setFlowStage('upload-waiting');
    setSaveError(null);
    setUploadError(null);
    setMessage(
      '카메라 없이도 업로드 대기 단계로 이동했습니다. 비디오 업로드와 샘플 저장 흐름을 계속 확인할 수 있습니다.',
    );
  }

  function ensureRecorder(): MediaRecorder | null {
    const stream = streamRef.current;

    if (!stream || typeof window.MediaRecorder === 'undefined') {
      setRecordingSupported(false);
      setMessage('이 환경에서는 브라우저 녹화를 사용할 수 없습니다. 업로드 흐름만 계속 진행할 수 있습니다.');
      return null;
    }

    if (mediaRecorderRef.current) {
      return mediaRecorderRef.current;
    }

    try {
      const recorder = new MediaRecorder(stream, pickRecorderOptions());
      recordedChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const recordedFile = buildRecordedFile(recordedChunksRef.current);
        if (recordedFile) {
          setRecordedVideo(recordedFile);
          setSelectedVideo(recordedFile);
          setMessage('실제 브라우저 녹화가 종료되었습니다. 생성된 영상이 바로 업로드 검수 패널에 연결되었습니다.');
        }
      };
      mediaRecorderRef.current = recorder;
      return recorder;
    } catch {
      setRecordingSupported(false);
      setMessage('브라우저 녹화 세션을 초기화하지 못했습니다. 업로드 흐름만 계속 진행할 수 있습니다.');
      return null;
    }
  }

  function startRecordingSession() {
    const recorder = ensureRecorder();

    if (!recorder) {
      return;
    }

    recordedChunksRef.current = [];
    setRecordedVideo(null);
    setSelectedVideo(null);

    if (recorder.state === 'inactive') {
      recorder.start();
    } else if (recorder.state === 'paused') {
      recorder.resume();
    }

    setFlowStage('recording-active');
    setMessage('브라우저 녹화가 시작되었습니다. 촬영 HUD와 세션 타이머가 실제 카메라 세션과 함께 움직입니다.');
  }

  function pauseRecordingSession() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.pause();
    }
    setFlowStage('recording-paused');
    setMessage('녹화 세션이 일시정지되었습니다. 다시 시작하거나 업로드 대기 단계로 이동할 수 있습니다.');
  }

  function resumeRecordingSession() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'paused') {
      recorder.resume();
    }
    startRecordingSession();
  }

  function finishRecordingSession() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setFlowStage('upload-waiting');
    setMessage('녹화 세션이 종료되었습니다. 생성된 영상이 있으면 바로 업로드 대기 단계에서 사용할 수 있습니다.');
  }

  function clearSelectedVideo() {
    setSelectedVideo(null);
    setRecordedVideo(null);
    setUploadError(null);
    setMessage('선택한 영상을 비웠습니다. 새로 촬영하거나 다른 파일을 선택할 수 있습니다.');
  }

  async function saveAttempt(recordType: AttemptRecordType) {
    setSaveLoading(true);
    setSaveError(null);
    setUploadedAttempt(null);

    try {
      const response = await createAttempt({
        challengeId,
        score: buildPreviewScore(recordType, cameraState),
        notes: buildAttemptNote(cameraState, recordType),
        recordType,
      });
      setSavedAttempt(response);
      setSelectedVideo(null);
      setFlowStage('sample-save-complete');
      await loadMotionSessionState({ silent: true });
      setMessage(
        recordType === 'completed'
          ? '샘플 완료 결과가 저장되었습니다. 결과 화면에서 현재 scoring preview 구조를 확인할 수 있습니다.'
          : '준비 상태가 저장되었습니다. 결과 화면에서 다음 단계 흐름을 계속 확인할 수 있습니다.',
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '사전 기록을 저장하지 못했습니다.');
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
    setRuntimeHistory([]);
    setUploadError(null);
    setSavedAttempt(null);
    setFlowStage('uploading');
    setUploadProgress(8);

    try {
      const response = await uploadAttemptVideo({
        challengeId,
        notes: buildVideoAttemptNote(cameraState),
        attemptVideo: selectedVideo,
      });
      setUploadedAttempt(response);
      setUploadProgress(100);
      setFlowStage('upload-complete');
      await loadMotionSessionState({ silent: true });
      setMessage('시도 비디오 업로드와 자동 채점이 완료되었습니다. 결과 화면에서 점수와 요약을 확인해 주세요.');
    } catch (error) {
      setFlowStage('upload-waiting');
      setUploadProgress(0);
      void loadMotionSessionState({ silent: true });
      setUploadError(error instanceof Error ? error.message : '시도 비디오를 업로드하지 못했습니다.');
    } finally {
      setUploadLoading(false);
    }
  }

  function stopStream() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];

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
    setSaveError(null);
    setUploadError(null);
    setCountdownValue(COUNTDOWN_START);
    setSessionSeconds(0);
    setUploadProgress(0);
    setMessage(sessionState?.message ?? DEFAULT_MESSAGE);
  }

  const canContinueWithoutCamera =
    cameraState === 'missing' ||
    cameraState === 'unavailable' ||
    cameraState === 'unsupported' ||
    cameraState === 'denied' ||
    cameraState === 'error';

  const showPreparationStage =
    flowStage === 'camera-ready' ||
    flowStage === 'countdown-ready' ||
    flowStage === 'recording-active' ||
    flowStage === 'recording-paused' ||
    flowStage === 'upload-waiting';

  const showUploadStage =
    flowStage === 'upload-waiting' ||
    flowStage === 'uploading' ||
    flowStage === 'upload-complete' ||
    flowStage === 'sample-save-complete';

  const cameraSignal = cameraSignalMeta(cameraState);
  const uploadSignal = uploadSignalMeta(sessionState?.uploadEnabled ?? false);
  const recordingSignal = recordingSignalMeta(recordingSupported, flowStage);
  const serverSignal = serverSyncMeta(
    serverSyncState,
    sessionRefreshing,
    sessionError,
    sessionState?.runtimeState,
  );

  return (
    <section className="panel panel--section">
      <div className="section-heading">
        <span className="section-heading__code">03</span>
        <div>
          <h2>{challengeTitle ? `${challengeTitle} 세션 체크` : '카메라 준비 동선'}</h2>
          <p>{sessionLoading ? '모션 세션 준비 정보를 불러오는 중입니다...' : sessionError ?? message}</p>
        </div>
      </div>

      <div className="camera-panel__actions camera-panel__actions--utility">
        <button
          className="button-link button-link--secondary"
          type="button"
          onClick={() => void loadMotionSessionState({ silent: true })}
          disabled={sessionLoading || sessionRefreshing}
        >
          {sessionRefreshing ? '세션 상태 새로고침 중...' : '세션 상태 새로고침'}
        </button>
        {lastSessionSyncedAt ? (
          <p className="camera-panel__sync-meta">마지막 동기화 {lastSessionSyncedAt}</p>
        ) : null}
        {sessionState?.latestAttemptId ? (
          <Link className="button-link button-link--secondary" to={`/attempts/${sessionState.latestAttemptId}/result`}>
            최근 결과 보기
          </Link>
        ) : null}
      </div>

      <div className="status-marquee">
        <div className={`status-marquee__item status-marquee__item--${cameraSignal.tone}`}>
          <span className="status-marquee__icon">
            <StatusGlyph kind={cameraSignal.icon} tone={cameraSignal.tone} />
          </span>
          <div>
            <span className="status-marquee__label">CAMERA SIGNAL</span>
            <strong>{cameraSignal.title}</strong>
            <p>{cameraSignal.description}</p>
          </div>
        </div>
        <div className={`status-marquee__item status-marquee__item--${recordingSignal.tone}`}>
          <span className="status-marquee__icon">
            <StatusGlyph kind={recordingSignal.icon} tone={recordingSignal.tone} />
          </span>
          <div>
            <span className="status-marquee__label">RECORDING HUD</span>
            <strong>{recordingSignal.title}</strong>
            <p>{recordingSignal.description}</p>
          </div>
        </div>
        <div className={`status-marquee__item status-marquee__item--${uploadSignal.tone}`}>
          <span className="status-marquee__icon">
            <StatusGlyph kind={uploadSignal.icon} tone={uploadSignal.tone} />
          </span>
          <div>
            <span className="status-marquee__label">UPLOAD PATH</span>
            <strong>{uploadSignal.title}</strong>
            <p>{uploadSignal.description}</p>
          </div>
        </div>
        <div className={`status-marquee__item status-marquee__item--${serverSignal.tone}`}>
          <span className="status-marquee__icon">
            <StatusGlyph kind={serverSignal.icon} tone={serverSignal.tone} />
          </span>
          <div>
            <span className="status-marquee__label">BACKEND SYNC</span>
            <strong>{serverSignal.title}</strong>
            <p>{serverSignal.description}</p>
          </div>
        </div>
      </div>

      <div className="camera-console">
        <div className="camera-console__overview">
          <div className="signal-grid">
            <div className="signal-grid__item">
              <span>SESSION</span>
              <strong>{sessionState ? readinessStateLabel(sessionState.readinessState) : 'WAIT'}</strong>
              <p>
                {sessionState
                  ? readinessStateDescription(sessionState.readinessState)
                  : '세션 상태를 확인하고 있습니다.'}
              </p>
            </div>
            <div className="signal-grid__item">
              <span>RUNTIME</span>
              <strong>{sessionState ? runtimeStateShortLabel(sessionState.runtimeState) : 'WAIT'}</strong>
              <p>
                {sessionState
                  ? runtimeStateDescription(sessionState.runtimeState)
                  : '서버 런타임 단계를 계산하고 있습니다.'}
              </p>
              {sessionState && runtimeUpdatedDetail(sessionState) ? (
                <p>{runtimeUpdatedDetail(sessionState)}</p>
              ) : null}
              {sessionState && serverRuntimeTraceDetail(sessionState) ? (
                <p>{serverRuntimeTraceDetail(sessionState)}</p>
              ) : null}
              {sessionState && runtimeFailureDetail(sessionState) ? (
                <p>{runtimeFailureDetail(sessionState)}</p>
              ) : null}
            </div>
            <div className="signal-grid__item">
              <span>LATEST</span>
              <strong>{sessionState ? latestAttemptShortLabel(sessionState) : 'WAIT'}</strong>
              <p>{sessionState ? latestAttemptDescription(sessionState) : '최근 시도 정보를 확인하고 있습니다.'}</p>
            </div>
            <div className="signal-grid__item">
              <span>NEXT</span>
              <strong>{sessionState ? nextActionShortLabel(sessionState.nextAction) : 'WAIT'}</strong>
              <p>{sessionState ? nextActionLabel(sessionState.nextAction) : '다음 액션을 계산하고 있습니다.'}</p>
            </div>
            <div className="signal-grid__item">
              <span>CAMERA</span>
              <strong>{cameraStateShortLabel(cameraState)}</strong>
              <p>{cameraStateLabel(cameraState)}</p>
            </div>
            <div className="signal-grid__item">
              <span>FLOW</span>
              <strong>{flowStageShortLabel(flowStage)}</strong>
              <p>{flowStageLabel(flowStage)}</p>
            </div>
            <div className="signal-grid__item">
              <span>RECORDING</span>
              <strong>{sessionState ? recordingPhaseShortLabel(sessionState.recordingPhase) : 'WAIT'}</strong>
              <p>{sessionState ? recordingPhaseLabel(sessionState.recordingPhase) : '녹화 단계를 확인하고 있습니다.'}</p>
            </div>
            <div className="signal-grid__item">
              <span>UPLOAD</span>
              <strong>{sessionState ? (sessionState.uploadEnabled ? 'LIVE' : 'SAMPLE') : 'WAIT'}</strong>
              <p>
                {sessionState
                  ? sessionState.uploadEnabled
                    ? '업로드 자동 채점 경로가 열려 있습니다.'
                    : '지금은 샘플 저장 흐름 중심으로 안내됩니다.'
                  : '업로드 가능 여부를 계산하고 있습니다.'}
              </p>
            </div>
          </div>

          <div className="runtime-history panel-lift">
            <div className="runtime-history__header">
              <div>
                <span>RUNTIME HISTORY</span>
                <strong>최근 서버 상태 전이</strong>
              </div>
              <button
                className="button-link button-link--secondary"
                type="button"
                onClick={() => setRuntimeHistory([])}
              >
                추적 기록 비우기
              </button>
            </div>
            {runtimeHistory.length > 0 ? (
              <div className="runtime-history__summary">
                <div
                  className={`runtime-history__ops-banner runtime-history__ops-banner--${captureOpsTone(runtimeHistory, captureQualityHistory, sessionState)}`}
                >
                  <strong>{`${captureOpsTrendIcon(captureQualityHistory)} ${captureOpsLabel(runtimeHistory, captureQualityHistory, sessionState)}`}</strong>
                  <em>{captureQaStateLabel(runtimeHistory, captureQualityHistory, sessionState)}</em>
                  <em className="runtime-history__ops-severity">
                    {captureTraceSeverityLabel(runtimeHistory, sessionState)}
                  </em>
                  <em className="runtime-history__ops-urgency">
                    {captureUrgencyLabel(runtimeHistory, captureQualityHistory, sessionState)}
                  </em>
                  <span>{captureDecisionLabel(runtimeHistory, captureQualityHistory, sessionState)}</span>
                  <small>{captureOpsMetaLabel(captureQualityHistory)}</small>
                </div>
                <div className="runtime-history__summary-head">
                  <span>TRACE PATH</span>
                  <div className="runtime-history__capture-summary">
                    <strong
                      className={`runtime-history__capture-badge runtime-history__capture-badge--${runtimeCoverageStatus(runtimeHistory)}`}
                    >
                      {runtimeCoverageBadgeLabel(runtimeHistory)}
                    </strong>
                    <small>{runtimeCoverageScore(runtimeHistory)}% CAPTURE</small>
                  </div>
                </div>
                <div className="runtime-history__capture-stats">
                  <span>{`CURRENT ${runtimeCoverageScore(runtimeHistory)}%`}</span>
                  <span>{`BEST ${bestCaptureScore}%`}</span>
                  <span>{captureScoreDeltaLabel(runtimeCoverageScore(runtimeHistory), bestCaptureScore)}</span>
                </div>
                <div className="runtime-history__capture-stats runtime-history__capture-stats--trend">
                  <span>{captureScoreTrendLabel(captureScoreHistory)}</span>
                  <span>{captureScoreHistoryLabel(captureScoreHistory)}</span>
                </div>
                <div className="runtime-history__capture-stats runtime-history__capture-stats--trend">
                  <span>{captureReliabilityLabel(captureQualityHistory)}</span>
                  <span>{captureReproLabel(captureQualityHistory)}</span>
                  <span>{captureReproHistoryLabel(captureQualityHistory)}</span>
                </div>
                {sessionState ? (
                  <div className="runtime-history__capture-stats runtime-history__capture-stats--trend">
                    <span>{serverTraceMatchLabel(runtimeHistory, sessionState)}</span>
                    <span>{serverTraceAlignmentScoreLabel(runtimeHistory, sessionState)}</span>
                    <span>{serverTraceSourceLabel(sessionState)}</span>
                    <span>{serverTraceCoverageLabel(sessionState)}</span>
                    <span>{serverTracePathLabel(sessionState)}</span>
                  </div>
                ) : null}
                <p className="runtime-history__assessment runtime-history__assessment--decision">
                  {captureDecisionLabel(runtimeHistory, captureQualityHistory, sessionState)}
                </p>
                {sessionState ? (
                  <p className="runtime-history__assessment runtime-history__assessment--server">
                    {serverTraceAssessment(runtimeHistory, sessionState)}
                  </p>
                ) : null}
                <p className="runtime-history__assessment runtime-history__assessment--playbook">
                  {capturePlaybookLabel(runtimeHistory, captureQualityHistory, sessionState)}
                </p>
                <p>{runtimeHistoryPath(runtimeHistory)}</p>
                <p className="runtime-history__assessment">
                  {runtimeCoverageAssessment(runtimeHistory)}
                </p>
                <p className="runtime-history__assessment runtime-history__assessment--hint">
                  {runtimeCoverageRecommendation(runtimeHistory)}
                </p>
                <div className="runtime-history__capture-meta">
                  <span>
                    POLL {uploadLoading
                      ? `${HIGH_CAPTURE_POLL_MS}ms`
                      : isHighFrequencyRuntimeTrace(sessionState?.runtimeState)
                        ? `${RUNTIME_TRACE_POLL_MS}ms`
                        : `${REFERENCE_PENDING_POLL_MS}ms`}
                  </span>
                  <span>{`WINDOW STORE/ANALYZE ~${TRANSIENT_CAPTURE_WINDOW_SECONDS}s`}</span>
                  <span>{uploadLoading ? 'MODE HIGH CAPTURE' : 'MODE STANDARD'}</span>
                </div>
                <div className="runtime-history__capture-meta runtime-history__capture-meta--suggested">
                  <span>{`PRESET ${captureTunePresetLabel(runtimeHistory, captureScoreHistory)}`}</span>
                  <span>{`SUGGEST POLL ${captureTuneSuggestion(runtimeHistory, captureScoreHistory).pollMs}ms`}</span>
                  <span>{`SUGGEST WINDOW ${captureTuneSuggestion(runtimeHistory, captureScoreHistory).windowSeconds}s`}</span>
                </div>
                <p className="runtime-history__assessment runtime-history__assessment--tune">
                  {captureTuneSuggestion(runtimeHistory, captureScoreHistory).reason}
                </p>
                <p className="runtime-history__assessment runtime-history__assessment--goal">
                  {captureTuneNextGoal(runtimeHistory)}
                </p>
                {uploadLoading ? (
                  <p className="runtime-history__assessment">
                    현재는 고속 캡처 모드입니다. 업로드 중간 상태를 더 자주 동기화하고 있습니다.
                  </p>
                ) : null}
                <div className="runtime-history__coverage">
                  {runtimeCoverage(runtimeHistory).map((item) => (
                    <span
                      key={item.label}
                      className={`runtime-history__coverage-item runtime-history__coverage-item--${item.seen ? 'seen' : 'missing'}`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
                {sessionState && sessionState.serverRuntimeTrace.length > 0 ? (
                  <div className="runtime-history__coverage runtime-history__coverage--server">
                    {serverRuntimeCoverage(sessionState).map((item) => (
                      <span
                        key={`server-${item.label}`}
                        className={`runtime-history__coverage-item runtime-history__coverage-item--${item.seen ? 'seen' : 'missing'}`}
                      >
                        {`SV ${item.label}`}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {runtimeHistory.length === 0 ? (
              <p className="runtime-history__empty">세션을 한 번 이상 동기화하면 최근 runtime 전이가 여기에 쌓입니다.</p>
            ) : (
              <div className="runtime-history__list">
                {runtimeHistory.map((entry, index) => (
                  <div
                    className={`runtime-history__item runtime-history__item--${runtimeStateTone(entry.runtimeState)}`}
                    key={`${entry.runtimeState}-${entry.firstSeenAtMs}-${index}`}
                  >
                    <div>
                      <span>{index === 0 ? 'LATEST' : `TRACE ${String(index).padStart(2, '0')}`}</span>
                      <div className="runtime-history__headline">
                        <StatusGlyph
                          kind={runtimeStateShortLabel(entry.runtimeState)}
                          tone={runtimeStateTone(entry.runtimeState)}
                        />
                        <strong>{runtimeStateShortLabel(entry.runtimeState)}</strong>
                      </div>
                    </div>
                    <div>
                      <p>{runtimeStateLabel(entry.runtimeState)}</p>
                      <small>{runtimeStateHistoryHint(entry.runtimeState)}</small>
                      <small>{runtimeObservationSummary(entry)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flow-timeline" aria-label="준비 단계 타임라인">
            {timelineSteps.map((step) => {
              const state = timelineStepState(flowStage, step.stage);

              return (
                <div key={step.stage} className={`flow-timeline__item flow-timeline__item--${state}`}>
                  <span className="flow-timeline__code">{step.code}</span>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
              );
            })}
          </div>

          <div className="camera-hud">
            <div className="camera-hud__countdown">
              <span className="camera-hud__label">COUNTDOWN</span>
              <strong>{flowStage === 'countdown-ready' ? countdownValue : '--'}</strong>
              <p>{flowStage === 'countdown-ready' ? '녹화 직전 리듬 체크' : '카운트다운 대기 중'}</p>
            </div>

            <div className="camera-hud__timer">
              <span className="camera-hud__label">SESSION TIMER</span>
              <strong>{formatSeconds(sessionSeconds)}</strong>
              <p>카운트다운, 녹화, 업로드 대기 시간을 같은 세션으로 추적합니다.</p>
            </div>

            <div className="camera-hud__progress">
              <div className="camera-hud__progress-head">
                <span className="camera-hud__label">UPLOAD PROGRESS</span>
                <strong>{uploadProgress}%</strong>
              </div>
              <div className="upload-progress">
                <div className="upload-progress__bar" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p>{uploadProgressLabel(flowStage, uploadProgress, serverSyncState)}</p>
            </div>
          </div>

          <div className="camera-panel__actions">
            <button
              className="button-link"
              type="button"
              onClick={requestCameraAccess}
              disabled={cameraState === 'requesting' || sessionLoading || Boolean(sessionError)}
            >
              {cameraState === 'requesting' ? '권한 요청 중...' : '카메라 권한 확인'}
            </button>
            {cameraState === 'granted' ? (
              <button className="button-link button-link--secondary" type="button" onClick={resetCamera}>
                다시 준비하기
              </button>
            ) : null}
            {canContinueWithoutCamera ? (
              <button className="button-link button-link--secondary" type="button" onClick={continueWithoutCamera}>
                카메라 없이 계속 보기
              </button>
            ) : null}
          </div>
        </div>

        <div className="camera-console__preview">
          {cameraState === 'granted' ? (
            <div className="camera-preview">
              <video ref={videoRef} className="camera-preview__video" autoPlay muted playsInline />
            </div>
          ) : (
            <div className="camera-preview camera-preview--placeholder">
              <p>{cameraPlaceholderMessage(cameraState)}</p>
            </div>
          )}
        </div>
      </div>

      {showPreparationStage ? (
        <div className="session-placeholder">
          <span className="hero__eyebrow">COUNTDOWN / READY FLOW</span>
          <h3>실제 촬영 직전 단계 점검</h3>
          <p>
            지금 구간에서는 카메라 확인 이후 사용자가 어떤 순서로 움직이게 될지 먼저 고정합니다.
            카운트다운, 녹화, 업로드 대기, 결과 진입 흐름을 같은 설명 언어로 연결하는 것이 목적입니다.
          </p>
          <div className="detail-flow detail-flow--stack">
            <div className="detail-flow__item">1. 카메라 구도와 권한 상태 확인</div>
            <div className="detail-flow__item">2. 카운트다운 HUD와 녹화 상태 HUD 진입</div>
            <div className="detail-flow__item">3. 녹화 종료 후 업로드 대기 또는 샘플 저장 경로 선택</div>
          </div>
          <div className="camera-panel__actions">
            {flowStage === 'camera-ready' ? (
              <button className="button-link" type="button" onClick={moveToCountdownReady}>
                카운트다운 시작
              </button>
            ) : null}
            {(flowStage === 'camera-ready' || flowStage === 'countdown-ready') && sessionState?.uploadEnabled ? (
              <button className="button-link button-link--secondary" type="button" onClick={moveToUploadWaiting}>
                업로드 대기 단계 보기
              </button>
            ) : null}
            {flowStage === 'recording-active' ? (
              <>
                <button className="button-link" type="button" onClick={pauseRecordingSession}>
                  녹화 일시정지
                </button>
                <button className="button-link button-link--secondary" type="button" onClick={finishRecordingSession}>
                  녹화 종료 후 업로드 대기
                </button>
              </>
            ) : null}
            {flowStage === 'recording-paused' ? (
              <>
                <button className="button-link" type="button" onClick={resumeRecordingSession}>
                  녹화 다시 시작
                </button>
                <button className="button-link button-link--secondary" type="button" onClick={finishRecordingSession}>
                  녹화 종료 후 업로드 대기
                </button>
              </>
            ) : null}
            {flowStage === 'countdown-ready' ? (
              <button
                className="button-link button-link--secondary"
                type="button"
                onClick={() => setFlowStage('camera-ready')}
              >
                이전 단계 보기
              </button>
            ) : null}
            {flowStage === 'upload-waiting' && cameraState === 'granted' ? (
              <button className="button-link button-link--secondary" type="button" onClick={startRecordingSession}>
                {recordingSupported ? '실제 녹화 다시 시작' : '녹화 HUD 다시 시작'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showUploadStage ? (
        <div className="session-placeholder session-placeholder--active">
          <span className="hero__eyebrow">UPLOAD / RESULT FLOW</span>
          <h3>업로드 대기부터 결과 연결까지</h3>
          <p>
            실제 촬영 HUD와 아직 완전히 붙어 있지 않더라도 이 단계에서는 업로드 대기, 업로드 중, 자동 채점 완료,
            샘플 저장 결과를 실제 사용자 흐름처럼 먼저 검증할 수 있습니다.
          </p>

          <div className="dashboard-grid">
            <div className="signal-panel">
              <span className="signal-panel__label">LIVE PATH</span>
              <strong>실제 업로드 자동 채점</strong>
              <p>시도 비디오를 업로드하면 서버가 mock 분석과 자동 채점을 수행하고 결과 화면으로 바로 이어집니다.</p>
            </div>
            <div className="signal-panel">
              <span className="signal-panel__label">PROTO PATH</span>
              <strong>샘플 저장 흐름</strong>
              <p>실제 업로드를 하지 않아도 준비 상태 또는 샘플 완료 저장으로 결과 구조를 미리 확인할 수 있습니다.</p>
            </div>
          </div>

          <ul className="detail-list">
            <li>
              <strong>현재 단계</strong>
              {flowStageDetail(flowStage)}
            </li>
            <li>
              <strong>결과 출처 구분</strong>
              준비 상태 저장, 샘플 scoring preview, 실제 업로드 자동 채점 결과를 결과 화면에서 분리해 보여줍니다.
            </li>
          </ul>

          <div className="upload-box">
            <label className="upload-box__label" htmlFor="attempt-video-input">
              시도 비디오 선택
            </label>
            <input
              id="attempt-video-input"
              className="upload-box__input"
              type="file"
              accept="video/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedVideo(file);
                setUploadError(null);
                setUploadedAttempt(null);
                setSavedAttempt(null);
                if (file) {
                  setFlowStage('upload-waiting');
                  setMessage('비디오가 선택되었습니다. 업로드를 실행하면 자동 채점 결과로 이어집니다.');
                }
              }}
            />
            <p className="upload-box__hint">
              MP4 등 일반적인 비디오 파일을 선택해 주세요. 업로드 버튼은 실제 파일 기준으로 mock 분석과 자동 채점 결과를 생성합니다.
            </p>
            {selectedVideo ? (
              <p className="upload-box__file">
                선택한 파일: <strong>{selectedVideo.name}</strong> ({formatBytes(selectedVideo.size)})
              </p>
            ) : null}
            {selectedVideo && selectedVideoUrl ? (
              <div className="upload-review">
                <div className="upload-review__header">
                  <div>
                    <strong>{recordedVideo ? 'RECORDED TAKE READY' : 'SELECTED VIDEO READY'}</strong>
                    <p>
                      {recordedVideo
                        ? '방금 녹화한 영상을 업로드 전에 미리 확인하고 있습니다.'
                        : '선택한 파일을 업로드 전에 검수하고 있습니다.'}
                    </p>
                  </div>
                  <span className="pill">{recordedVideo ? '실제 녹화본' : '수동 선택 파일'}</span>
                </div>
                <div className="upload-review__preview">
                  <video className="upload-review__video" src={selectedVideoUrl} controls playsInline />
                </div>
                <div className="upload-review__actions">
                  {cameraState === 'granted' ? (
                    <button className="button-link button-link--secondary" type="button" onClick={moveToCountdownReady}>
                      다시 촬영하기
                    </button>
                  ) : null}
                  <button className="button-link button-link--secondary" type="button" onClick={clearSelectedVideo}>
                    선택 비우기
                  </button>
                </div>
              </div>
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
            <button
              className="button-link button-link--secondary"
              type="button"
              onClick={() => setFlowStage(cameraState === 'granted' ? 'recording-paused' : 'camera-check')}
            >
              이전 단계 보기
            </button>
          </div>
        </div>
      ) : null}

      {saveError ? (
        <div className="camera-console__feedback camera-console__feedback--error">
          <strong>SAVE ERROR</strong>
          <p>{saveError}</p>
        </div>
      ) : null}

      {uploadError ? (
        <div className="camera-console__feedback camera-console__feedback--error">
          <strong>UPLOAD ERROR</strong>
          <p>{uploadError}</p>
        </div>
      ) : null}

      {uploadedAttempt ? (
        <div className="camera-panel__saved">
          <span className="hero__eyebrow">AUTO SCORING COMPLETE</span>
          <div className="archive-card__header">
            <div>
              <h3>{uploadedAttempt.resultHeadline}</h3>
              <p>{uploadedAttempt.resultSummary}</p>
            </div>
            <div className="archive-card__score">
              <span>SCORE</span>
              <strong>{uploadedAttempt.score}</strong>
            </div>
          </div>
          <div className="archive-card__meta">
            <span className="pill">{uploadedAttempt.scoreAvailable ? '점수 사용 가능' : '점수 준비 중'}</span>
            <span className="pill">실제 업로드 자동 채점 결과</span>
            <span className="pill">{uploadedAttempt.analyzerName}</span>
            <span className="pill">{uploadedAttempt.videoOriginalFileName}</span>
          </div>
          <div className="inline-actions">
            <Link className="button-link" to={`/attempts/${uploadedAttempt.attemptId}/result`}>
              결과 화면 보기
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              전체 기록 보기
            </Link>
          </div>
        </div>
      ) : null}

      {savedAttempt ? (
        <div className="camera-panel__saved">
          <span className="hero__eyebrow">SAVE COMPLETE</span>
          <div className="archive-card__header">
            <div>
              <h3>기록 ID {savedAttempt.id}번이 저장되었습니다.</h3>
              <p>
                현재 저장한 상태는 {savedAttempt.status}이고, 점수는 {savedAttempt.score}점입니다.
              </p>
            </div>
            <div className="archive-card__score">
              <span>STATE</span>
              <strong>{savedAttempt.status === '준비됨' ? 'READY' : 'CLEAR'}</strong>
            </div>
          </div>
          <div className="inline-actions">
            <Link className="button-link" to={`/attempts/${savedAttempt.id}/result`}>
              결과 화면 보기
            </Link>
            <Link className="button-link button-link--secondary" to="/attempts">
              전체 기록 보기
            </Link>
          </div>
          <p className="upload-box__hint">
            {savedAttempt.resultSource === 'SAMPLE_SCORING_PREVIEW'
              ? '이 저장은 실제 업로드 분석이 아니라 sample scoring preview 결과입니다.'
              : '이 저장은 실제 채점이 아니라 준비 상태를 기록한 결과입니다.'}
          </p>
        </div>
      ) : null}
    </section>
  );
}

const timelineSteps: Array<{
  stage: FlowStage;
  code: string;
  title: string;
  description: string;
}> = [
  {
    stage: 'camera-check',
    code: '01',
    title: '카메라 체크',
    description: '권한, 장치 상태, 업로드 가능 여부를 먼저 확인합니다.',
  },
  {
    stage: 'countdown-ready',
    code: '02',
    title: '카운트다운 준비',
    description: '실제 촬영 전 리듬과 구도를 맞추는 준비 단계입니다.',
  },
  {
    stage: 'recording-active',
    code: '03',
    title: '녹화 진행',
    description: '실제 녹화 흐름과 HUD 상태를 함께 확인합니다.',
  },
  {
    stage: 'upload-waiting',
    code: '04',
    title: '업로드 대기',
    description: '시도 비디오를 선택하거나 샘플 저장 경로를 결정합니다.',
  },
  {
    stage: 'uploading',
    code: '05',
    title: '업로드 진행',
    description: '자동 채점을 위해 비디오와 메타 정보를 전송합니다.',
  },
  {
    stage: 'upload-complete',
    code: '06',
    title: '결과 연결',
    description: '자동 채점 결과 또는 샘플 저장 결과로 결과 화면에 진입합니다.',
  },
];

function timelineStepState(flowStage: FlowStage, step: FlowStage): 'done' | 'active' | 'pending' {
  const order: FlowStage[] = [
    'camera-check',
    'camera-ready',
    'countdown-ready',
    'recording-active',
    'recording-paused',
    'upload-waiting',
    'uploading',
    'upload-complete',
    'sample-save-complete',
  ];
  const normalizedFlow = flowStage === 'camera-ready' ? 'countdown-ready' : flowStage;
  const currentIndex = order.indexOf(normalizedFlow);
  const stepIndex = order.indexOf(step);

  if (currentIndex === stepIndex) {
    return 'active';
  }

  if (currentIndex > stepIndex) {
    return 'done';
  }

  return 'pending';
}

function flowStageDetail(stage: FlowStage): string {
  switch (stage) {
    case 'countdown-ready':
      return '카운트다운 HUD가 실행 중입니다. 실제 녹화 직전 진입감을 먼저 확인합니다.';
    case 'recording-active':
      return '녹화 진행 상태입니다. 실제 영상 촬영과 HUD 반응을 함께 점검합니다.';
    case 'recording-paused':
      return '녹화가 일시정지된 상태입니다. 다시 시작하거나 업로드 대기로 넘어갈 수 있습니다.';
    case 'uploading':
      return '선택한 비디오를 서버로 전송하고 자동 채점 결과를 기다리고 있습니다.';
    case 'upload-complete':
      return '실제 업로드 자동 채점이 끝났고 결과 화면으로 바로 이동할 수 있습니다.';
    case 'sample-save-complete':
      return '샘플 저장 흐름이 끝났고 결과 화면에서 preview 기반 결과 구조를 확인할 수 있습니다.';
    default:
      return '비디오 업로드 전 단계입니다. 실제 업로드 경로와 샘플 저장 경로를 여기서 나눕니다.';
  }
}

function buildPreviewScore(recordType: AttemptRecordType, cameraState: CameraState): number {
  if (recordType === 'prepared') {
    return 0;
  }

  return cameraState === 'granted' ? 82 : 68;
}

function buildAttemptNote(cameraState: CameraState, recordType: AttemptRecordType): string {
  if (recordType === 'completed') {
    if (cameraState === 'granted') {
      return '샘플 simple scoring 결과를 반영한 완료 기록';
    }

    return '카메라 없이 프로토 흐름에서 만든 샘플 완료 기록';
  }

  switch (cameraState) {
    case 'granted':
      return '카메라 권한 확인 후 촬영 준비 단계 진입';
    case 'missing':
      return '카메라 장치가 없는 상태에서 프로토 흐름 진행';
    case 'unavailable':
      return '카메라 장치 사용 불가 상태에서 프로토 흐름 진행';
    case 'unsupported':
      return '브라우저 미지원 환경에서 프로토 흐름 진행';
    case 'denied':
      return '카메라 권한 거부 상태에서 프로토 흐름 진행';
    default:
      return '카메라 없이 프로토 흐름 진행';
  }
}

function buildVideoAttemptNote(cameraState: CameraState): string {
  switch (cameraState) {
    case 'granted':
      return '카메라 준비 확인 후 시도 비디오 업로드';
    case 'missing':
      return '카메라가 없는 환경에서 시도 비디오 업로드';
    case 'unavailable':
      return '카메라 사용 불가 환경에서 시도 비디오 업로드';
    case 'unsupported':
      return '브라우저 미지원 환경에서 시도 비디오 업로드';
    case 'denied':
      return '카메라 권한 거부 후 시도 비디오 업로드';
    default:
      return '프로토 시작 화면에서 시도 비디오 업로드';
  }
}

function cameraPlaceholderMessage(state: CameraState): string {
  switch (state) {
    case 'missing':
      return '이 기기에서 사용할 수 있는 카메라를 찾지 못했습니다. 아래 업로드 경로는 그대로 진행할 수 있습니다.';
    case 'unavailable':
      return '카메라 장치를 사용할 수 없습니다. 다른 앱 사용 여부를 확인하거나 업로드 경로부터 먼저 진행해 주세요.';
    case 'unsupported':
      return '현재 브라우저에서는 카메라 기능을 지원하지 않습니다. 대신 업로드 흐름은 계속 진행할 수 있습니다.';
    case 'denied':
      return '카메라 권한이 거부된 상태입니다. 권한을 다시 허용하거나 카메라 없이 흐름을 이어갈 수 있습니다.';
    case 'error':
      return '카메라를 준비하는 중 문제가 발생했습니다. 다시 시도하거나 업로드 흐름만 먼저 확인해 주세요.';
    default:
      return '카메라 권한을 허용하면 이 영역에 미리보기가 표시됩니다.';
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

function cameraStateShortLabel(state: CameraState): string {
  switch (state) {
    case 'idle':
      return 'WAIT';
    case 'requesting':
      return 'ASK';
    case 'granted':
      return 'READY';
    case 'denied':
      return 'DENY';
    case 'missing':
      return 'MISS';
    case 'unavailable':
      return 'LOCK';
    case 'unsupported':
      return 'UNSUP';
    case 'error':
      return 'ERROR';
    default:
      return 'WAIT';
  }
}

function readinessStateLabel(state: MotionSessionState['readinessState']): string {
  switch (state) {
    case 'UPLOAD_READY':
      return 'READY';
    default:
      return 'LIMIT';
  }
}

function runtimeStateLabel(state: MotionSessionState['runtimeState']): string {
  switch (state) {
    case 'SCORING_COMPLETED':
      return '자동 채점 완료';
    case 'ANALYSIS_IN_PROGRESS':
      return '분석 진행 중';
    case 'UPLOAD_STORED':
      return '업로드 저장 완료';
    case 'FAILED_RETRYABLE':
      return '재시도 가능';
    case 'UPLOAD_IN_PROGRESS':
      return '업로드 진행 중';
    case 'UPLOAD_PENDING':
      return '업로드 대기';
    case 'IDLE':
    default:
      return '준비 대기';
  }
}

function runtimeStateShortLabel(state: MotionSessionState['runtimeState']): string {
  switch (state) {
    case 'SCORING_COMPLETED':
      return 'DONE';
    case 'ANALYSIS_IN_PROGRESS':
      return 'ANALYZE';
    case 'UPLOAD_STORED':
      return 'STORE';
    case 'FAILED_RETRYABLE':
      return 'RETRY';
    case 'UPLOAD_IN_PROGRESS':
      return 'SEND';
    case 'UPLOAD_PENDING':
      return 'QUEUE';
    case 'IDLE':
    default:
      return 'IDLE';
  }
}

function runtimeStateDescription(state: MotionSessionState['runtimeState']): string {
  switch (state) {
    case 'SCORING_COMPLETED':
      return '최신 업로드와 자동 채점이 서버 기준으로 완료된 상태입니다.';
    case 'ANALYSIS_IN_PROGRESS':
      return '업로드 저장은 끝났고, 현재 서버에서 분석과 채점 계산을 진행 중인 상태입니다.';
    case 'UPLOAD_STORED':
      return '비디오 파일 저장은 완료됐고, 다음 분석 단계로 넘어가기 직전 상태입니다.';
    case 'FAILED_RETRYABLE':
      return '최근 업로드 처리 중 문제가 발생해 같은 화면에서 다시 시도할 수 있는 상태입니다.';
    case 'UPLOAD_IN_PROGRESS':
      return '업로드 저장 또는 자동 채점이 서버 기준으로 아직 진행 중인 상태입니다.';
    case 'UPLOAD_PENDING':
      return '레퍼런스 준비가 끝나 업로드와 자동 채점 흐름으로 진입할 수 있습니다.';
    case 'IDLE':
    default:
      return '아직 서버 기준 업로드 런타임 단계가 열리지 않은 상태입니다.';
  }
}

function runtimeStateTone(
  state: MotionSessionState['runtimeState'],
): 'neutral' | 'good' | 'warn' | 'danger' {
  switch (state) {
    case 'SCORING_COMPLETED':
      return 'good';
    case 'FAILED_RETRYABLE':
      return 'danger';
    case 'UPLOAD_PENDING':
      return 'neutral';
    case 'IDLE':
      return 'neutral';
    default:
      return 'warn';
  }
}

function runtimeStateHistoryHint(state: MotionSessionState['runtimeState']): string {
  switch (state) {
    case 'UPLOAD_IN_PROGRESS':
      return 'UI uploading 단계에 대응';
    case 'UPLOAD_STORED':
      return '파일 저장 완료 직후 상태';
    case 'ANALYSIS_IN_PROGRESS':
      return '분석/채점 진행 중 상태';
    case 'SCORING_COMPLETED':
      return 'UI upload-complete 단계에 대응';
    case 'FAILED_RETRYABLE':
      return 'UI upload-waiting 재시도 단계에 대응';
    case 'UPLOAD_PENDING':
      return '업로드 대기 진입 가능 상태';
    case 'IDLE':
    default:
      return '세션 준비 전 기본 상태';
  }
}

function runtimeObservationSummary(entry: RuntimeObservation): string {
  const observedSeconds = Math.max(
    0,
    Math.round((entry.lastSeenAtMs - entry.firstSeenAtMs) / 1000),
  );

  if (entry.observationCount <= 1) {
    return `${entry.lastSeenAt} · 1회 관찰`;
  }

  return `${entry.firstSeenAt} -> ${entry.lastSeenAt} · ${entry.observationCount}회 관찰 · 약 ${observedSeconds}초`;
}

function runtimeHistoryPath(history: RuntimeObservation[]): string {
  return [...history]
    .reverse()
    .map((entry) => runtimeStateShortLabel(entry.runtimeState))
    .join(' -> ');
}

function runtimeCoverage(history: RuntimeObservation[]): Array<{ label: string; seen: boolean }> {
  const observed = new Set(history.map((entry) => entry.runtimeState));
  const checkpoints: Array<{ label: string; state: MotionSessionState['runtimeState'] }> = [
    { label: 'QUEUE', state: 'UPLOAD_PENDING' },
    { label: 'SEND', state: 'UPLOAD_IN_PROGRESS' },
    { label: 'STORE', state: 'UPLOAD_STORED' },
    { label: 'ANALYZE', state: 'ANALYSIS_IN_PROGRESS' },
    { label: 'DONE', state: 'SCORING_COMPLETED' },
  ];

  return checkpoints.map((checkpoint) => ({
    label: checkpoint.label,
    seen: observed.has(checkpoint.state),
  }));
}

function runtimeCoverageAssessment(history: RuntimeObservation[]): string {
  const coverage = runtimeCoverage(history);
  const missing = coverage.filter((item) => !item.seen).map((item) => item.label);

  if (missing.length === 0) {
    return '이번 세션에서는 핵심 업로드 파이프라인 단계가 모두 관찰되었습니다.';
  }

  if (missing.length === coverage.length) {
    return '아직 업로드 파이프라인 핵심 단계가 관찰되지 않았습니다. 실제 업로드를 시작하면 coverage가 채워집니다.';
  }

  return `부분 관찰 상태입니다. 아직 ${missing.join(', ')} 단계가 기록되지 않았습니다.`;
}

function runtimeCoverageRecommendation(history: RuntimeObservation[]): string {
  const coverage = runtimeCoverage(history);
  const missing = coverage.filter((item) => !item.seen).map((item) => item.label);

  if (missing.length === 0) {
    return '지금 캡처 품질이면 수동 검증 기준으로 충분합니다.';
  }

  if (missing.includes('SEND')) {
    return '전송 시작 구간이 자주 빠지면 업로드 시작 직후 세션 재조회 타이밍을 더 앞당기는 편이 좋습니다.';
  }

  if (missing.includes('STORE') || missing.includes('ANALYZE')) {
    return '중간 상태가 자주 빠지면 backend tracker의 짧은 안정화 윈도우를 조금 더 늘리는 편이 좋습니다.';
  }

  if (missing.includes('DONE')) {
    return '완료 단계가 빠지면 업로드 종료 직후 세션 재조회 타이밍과 결과 반영 경로를 먼저 확인해 보세요.';
  }

  return '부분 관찰 상태입니다. polling 주기와 상태 유지 시간을 같이 점검하는 편이 좋습니다.';
}

function captureTuneSuggestion(
  history: RuntimeObservation[],
  scoreHistory: number[],
): { pollMs: number; windowSeconds: number; reason: string } {
  const coverage = runtimeCoverage(history);
  const missing = coverage.filter((item) => !item.seen).map((item) => item.label);
  const trend = captureScoreTrendLabel(scoreHistory);

  if (missing.length === 0) {
    return {
      pollMs: HIGH_CAPTURE_POLL_MS,
      windowSeconds: TRANSIENT_CAPTURE_WINDOW_SECONDS,
      reason: '현재 trace 품질이 충분합니다. 지금 polling과 안정화 윈도우를 유지해도 됩니다.',
    };
  }

  if (missing.includes('SEND')) {
    return {
      pollMs: 450,
      windowSeconds: TRANSIENT_CAPTURE_WINDOW_SECONDS,
      reason:
        trend === 'TREND DOWN'
          ? '전송 시작 구간이 빠지고 최근 추세도 내려가고 있습니다. 업로드 시작 직후 polling을 450ms까지 더 당겨 보는 편이 좋습니다.'
          : '전송 시작 구간이 자주 빠집니다. 업로드 시작 직후 polling을 450ms 정도로 더 촘촘하게 가져가면 잡힐 가능성이 높습니다.',
    };
  }

  if (missing.includes('STORE') || missing.includes('ANALYZE')) {
    return {
      pollMs: RUNTIME_TRACE_POLL_MS,
      windowSeconds: 3,
      reason:
        trend === 'TREND DOWN'
          ? '중간 상태가 비고 최근 추세도 내려가고 있습니다. backend 안정화 윈도우를 3초 정도로 늘려 관찰성을 먼저 높이는 편이 좋습니다.'
          : '중간 상태가 짧게 지나가고 있습니다. backend 안정화 윈도우를 3초 정도로 늘리면 STORE/ANALYZE 관찰성이 좋아질 가능성이 큽니다.',
    };
  }

  if (missing.includes('DONE')) {
    return {
      pollMs: RUNTIME_TRACE_POLL_MS,
      windowSeconds: TRANSIENT_CAPTURE_WINDOW_SECONDS,
      reason: '완료 단계만 빠지고 있습니다. 완료 직후 재조회 타이밍과 결과 반영 경로를 먼저 점검하는 편이 좋습니다.',
    };
  }

  return {
    pollMs: RUNTIME_TRACE_POLL_MS,
    windowSeconds: TRANSIENT_CAPTURE_WINDOW_SECONDS,
    reason: '부분 관찰 상태입니다. 현재 polling과 안정화 윈도우를 함께 점검해 다음 trace를 비교해 보세요.',
  };
}

function captureTunePresetLabel(history: RuntimeObservation[], scoreHistory: number[]): string {
  const coverage = runtimeCoverage(history);
  const missing = coverage.filter((item) => !item.seen).map((item) => item.label);
  const trend = captureScoreTrendLabel(scoreHistory);

  if (missing.length === 0) {
    return 'HOLD';
  }

  if (missing.includes('SEND')) {
    return trend === 'TREND DOWN' ? 'AGGRESSIVE POLL' : 'FAST POLL';
  }

  if (missing.includes('STORE') || missing.includes('ANALYZE')) {
    return trend === 'TREND DOWN' ? 'AGGRESSIVE WINDOW' : 'BALANCED WINDOW';
  }

  if (missing.includes('DONE')) {
    return 'RESULT CHECK';
  }

  return 'BALANCED RETUNE';
}

function captureTuneNextGoal(history: RuntimeObservation[]): string {
  const coverage = runtimeCoverage(history);
  const missing = coverage.filter((item) => !item.seen).map((item) => item.label);

  if (missing.length === 0) {
    return '다음 목표는 FULL TRACE를 반복 재현하는 것입니다. 같은 조건으로 한 번 더 업로드해 재현성을 확인해 보세요.';
  }

  if (missing.includes('SEND')) {
    return '다음 테스트 목표는 SEND 단계 포착입니다. 업로드 시작 직후 전송 진입이 history에 남는지 먼저 확인해 보세요.';
  }

  if (missing.includes('STORE') || missing.includes('ANALYZE')) {
    return '다음 테스트 목표는 STORE/ANALYZE 중간 단계 포착입니다. 중간 상태가 한 번이라도 trace에 남는지 확인해 보세요.';
  }

  if (missing.includes('DONE')) {
    return '다음 테스트 목표는 DONE 단계 반영입니다. 완료 직후 세션 재조회와 결과 연결이 정상인지 확인해 보세요.';
  }

  return '다음 테스트 목표는 누락 단계가 다시 반복되는지 확인하는 것입니다.';
}

function isHighFrequencyRuntimeTrace(
  runtimeState: MotionSessionState['runtimeState'] | undefined,
): boolean {
  return (
    runtimeState === 'UPLOAD_IN_PROGRESS' ||
    runtimeState === 'UPLOAD_STORED' ||
    runtimeState === 'ANALYSIS_IN_PROGRESS'
  );
}

function runtimeCoverageStatus(history: RuntimeObservation[]): 'full' | 'partial' | 'empty' {
  const coverage = runtimeCoverage(history);
  const seenCount = coverage.filter((item) => item.seen).length;

  if (seenCount === 0) {
    return 'empty';
  }

  if (seenCount === coverage.length) {
    return 'full';
  }

  return 'partial';
}

function runtimeCoverageBadgeLabel(history: RuntimeObservation[]): string {
  switch (runtimeCoverageStatus(history)) {
    case 'full':
      return 'FULL TRACE';
    case 'partial':
      return 'PARTIAL TRACE';
    default:
      return 'NO TRACE';
  }
}

function runtimeCoverageScore(history: RuntimeObservation[]): number {
  const coverage = runtimeCoverage(history);
  const seenCount = coverage.filter((item) => item.seen).length;
  return Math.round((seenCount / coverage.length) * 100);
}

function captureScoreDeltaLabel(currentScore: number, bestScore: number): string {
  if (currentScore === 0 && bestScore === 0) {
    return 'BASELINE';
  }

  if (currentScore > bestScore) {
    return 'NEW BEST';
  }

  if (currentScore === bestScore) {
    return currentScore > 0 ? 'TIED BEST' : 'BASELINE';
  }

  return `-${bestScore - currentScore}% VS BEST`;
}

function parseCaptureScoreHistory(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => Number.parseInt(String(value), 10))
      .filter((value) => Number.isFinite(value))
      .slice(0, CAPTURE_SCORE_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function parseCaptureSessionQualityHistory(raw: string): CaptureSessionQuality[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const score = Number.parseInt(String(entry.score), 10);
        const status =
          entry.status === 'full' || entry.status === 'partial' || entry.status === 'empty'
            ? entry.status
            : null;
        const recordedAt = Number.parseInt(String(entry.recordedAt), 10);

        if (!Number.isFinite(score) || !status || !Number.isFinite(recordedAt)) {
          return null;
        }

        return { score, status, recordedAt };
      })
      .filter((entry): entry is CaptureSessionQuality => entry !== null)
      .slice(0, CAPTURE_SCORE_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function captureScoreTrendLabel(history: number[]): string {
  if (history.length === 0) {
    return 'TREND WAITING';
  }

  if (history.length === 1) {
    return 'TREND BASELINE';
  }

  const [latest, previous] = history;
  if (latest > previous) {
    return 'TREND IMPROVING';
  }

  if (latest < previous) {
    return 'TREND DOWN';
  }

  return 'TREND STABLE';
}

function captureScoreHistoryLabel(history: number[]): string {
  if (history.length === 0) {
    return 'RECENT NONE';
  }

  return `RECENT ${history.join(' / ')}`;
}

function captureReproLabel(history: CaptureSessionQuality[]): string {
  if (history.length === 0) {
    return 'REPRO WAITING';
  }

  const recent = history.slice(0, CAPTURE_REPRO_WINDOW);
  const fullCount = recent.filter((entry) => entry.status === 'full').length;
  return `REPRO ${fullCount}/${recent.length} FULL`;
}

function captureReproHistoryLabel(history: CaptureSessionQuality[]): string {
  if (history.length === 0) {
    return 'QUALITY NONE';
  }

  return `QUALITY ${history
    .slice(0, CAPTURE_REPRO_WINDOW)
    .map((entry) => `${entry.status.toUpperCase()} ${entry.score}%`)
    .join(' / ')}`;
}

function captureReliabilityLabel(history: CaptureSessionQuality[]): string {
  if (history.length === 0) {
    return 'STATUS WAITING';
  }

  const recent = history.slice(0, CAPTURE_REPRO_WINDOW);
  const fullCount = recent.filter((entry) => entry.status === 'full').length;
  const partialCount = recent.filter((entry) => entry.status === 'partial').length;

  if (fullCount === recent.length) {
    return 'STATUS STABLE';
  }

  if (fullCount >= 1 && partialCount + fullCount === recent.length) {
    return 'STATUS IMPROVING';
  }

  return 'STATUS UNSTABLE';
}

function captureDecisionLabel(
  history: RuntimeObservation[],
  qualityHistory: CaptureSessionQuality[],
  sessionState?: MotionSessionState | null,
): string {
  const serverStatus = sessionState ? serverTraceStatus(history, sessionState) : 'none';
  const alignmentScore = sessionState ? serverTraceAlignmentScore(history, sessionState) : 100;
  const coverage = runtimeCoverage(history);
  const missing = coverage.filter((item) => !item.seen).map((item) => item.label);
  const reliability = captureReliabilityLabel(qualityHistory);

  if (serverStatus === 'diverged' || alignmentScore < 60) {
    return 'DECISION: 서버 trace와 로컬 trace 정렬이 약합니다. 프론트 polling과 관측 타이밍을 먼저 맞추는 편이 좋습니다.';
  }

  if (reliability === 'STATUS STABLE') {
    return 'DECISION: 현재 설정을 유지하고 같은 조건으로 한 번 더 재현성을 확인해도 됩니다.';
  }

  if (missing.includes('SEND')) {
    return 'DECISION: retune를 먼저 권장합니다. 업로드 시작 직후 polling을 더 촘촘하게 가져가며 SEND 포착부터 확인해 보세요.';
  }

  if (missing.includes('STORE') || missing.includes('ANALYZE')) {
    return 'DECISION: backend 안정화 윈도우를 먼저 조정하는 편이 좋습니다. 중간 단계가 trace에 남는지 다시 확인해 보세요.';
  }

  if (missing.includes('DONE')) {
    return 'DECISION: retune보다 완료 반영 경로 점검이 먼저입니다. 결과 연결과 마지막 세션 재조회 타이밍을 확인해 보세요.';
  }

  if (reliability === 'STATUS IMPROVING') {
    return 'DECISION: 지금은 개선 중입니다. 추천 preset으로 한두 번 더 측정해 추세가 유지되는지 확인해 보세요.';
  }

  return 'DECISION: 아직 불안정합니다. 추천 preset을 먼저 적용한 뒤 다음 업로드에서 trace 품질을 다시 비교해 보세요.';
}

function captureOpsLabel(
  history: RuntimeObservation[],
  qualityHistory: CaptureSessionQuality[],
  sessionState?: MotionSessionState | null,
): string {
  const serverStatus = sessionState ? serverTraceStatus(history, sessionState) : 'none';
  const alignmentScore = sessionState ? serverTraceAlignmentScore(history, sessionState) : 100;
  const coverage = runtimeCoverage(history);
  const missing = coverage.filter((item) => !item.seen).map((item) => item.label);
  const recent = qualityHistory.slice(0, CAPTURE_REPRO_WINDOW);
  const fullCount = recent.filter((entry) => entry.status === 'full').length;

  if (serverStatus === 'diverged' || alignmentScore < 60) {
    return 'OPS MODE TRACE ALIGN';
  }

  if (recent.length >= 2 && fullCount >= 2) {
    return 'OPS MODE HOLD';
  }

  if (missing.includes('DONE')) {
    return 'OPS MODE RESULT CHECK';
  }

  if (missing.includes('SEND')) {
    return 'OPS MODE POLL RETUNE';
  }

  if (missing.includes('STORE') || missing.includes('ANALYZE')) {
    return 'OPS MODE WINDOW RETUNE';
  }

  return 'OPS MODE OBSERVE';
}

function captureOpsTone(
  history: RuntimeObservation[],
  qualityHistory: CaptureSessionQuality[],
  sessionState?: MotionSessionState | null,
): 'good' | 'warn' | 'danger' | 'neutral' {
  const label = captureOpsLabel(history, qualityHistory, sessionState);

  switch (label) {
    case 'OPS MODE HOLD':
      return 'good';
    case 'OPS MODE RESULT CHECK':
      return 'warn';
    case 'OPS MODE TRACE ALIGN':
      return 'warn';
    case 'OPS MODE POLL RETUNE':
    case 'OPS MODE WINDOW RETUNE':
      return 'danger';
    default:
      return 'neutral';
  }
}

function captureOpsMetaLabel(history: CaptureSessionQuality[]): string {
  if (history.length === 0) {
    return '최근 업로드 품질 데이터가 아직 없습니다.';
  }

  const recent = history.slice(0, CAPTURE_REPRO_WINDOW);
  const average = Math.round(
    recent.reduce((sum, entry) => sum + entry.score, 0) / recent.length,
  );

  return `최근 ${recent.length}회 평균 capture score ${average}%`;
}

function captureOpsTrendIcon(history: CaptureSessionQuality[]): string {
  if (history.length < 2) {
    return '→';
  }

  const recentWindow = history.slice(0, Math.min(CAPTURE_REPRO_WINDOW, history.length));
  const previousWindow = history.slice(
    Math.min(CAPTURE_REPRO_WINDOW, history.length),
    Math.min(CAPTURE_REPRO_WINDOW * 2, history.length),
  );

  const recentAverage = averageCaptureScore(recentWindow);
  const previousAverage =
    previousWindow.length > 0 ? averageCaptureScore(previousWindow) : history[1].score;

  if (recentAverage >= previousAverage + 8) {
    return '↑';
  }

  if (recentAverage <= previousAverage - 8) {
    return '↓';
  }

  return '→';
}

function averageCaptureScore(history: CaptureSessionQuality[]): number {
  if (history.length === 0) {
    return 0;
  }

  return history.reduce((sum, entry) => sum + entry.score, 0) / history.length;
}

function captureQaStateLabel(
  history: RuntimeObservation[],
  qualityHistory: CaptureSessionQuality[],
  sessionState?: MotionSessionState | null,
): string {
  const opsLabel = captureOpsLabel(history, qualityHistory, sessionState);

  switch (opsLabel) {
    case 'OPS MODE HOLD':
      return 'QA STATE: 기능 검증 계속';
    case 'OPS MODE RESULT CHECK':
      return 'QA STATE: 결과 경로 점검';
    case 'OPS MODE TRACE ALIGN':
      return 'QA STATE: trace 정렬 우선';
    case 'OPS MODE POLL RETUNE':
    case 'OPS MODE WINDOW RETUNE':
      return 'QA STATE: 튜닝 우선';
    default:
      return 'QA STATE: 추가 관찰';
  }
}

function captureTraceSeverityLabel(
  history: RuntimeObservation[],
  sessionState?: MotionSessionState | null,
): string {
  if (!sessionState) {
    return 'SEVERITY: WAITING';
  }

  const alignmentScore = serverTraceAlignmentScore(history, sessionState);
  const status = serverTraceStatus(history, sessionState);

  if (status === 'none') {
    return 'SEVERITY: WAITING';
  }

  if (status === 'match' && alignmentScore >= 100) {
    return 'SEVERITY: CLEAR';
  }

  if (status === 'diverged' || alignmentScore < 40) {
    return 'SEVERITY: CRITICAL';
  }

  if (alignmentScore < 80) {
    return 'SEVERITY: HIGH';
  }

  return 'SEVERITY: WATCH';
}

function captureUrgencyLabel(
  history: RuntimeObservation[],
  qualityHistory: CaptureSessionQuality[],
  sessionState?: MotionSessionState | null,
): string {
  const severity = captureTraceSeverityLabel(history, sessionState);
  const opsLabel = captureOpsLabel(history, qualityHistory, sessionState);

  if (opsLabel === 'OPS MODE HOLD') {
    return 'URGENCY: CONTINUE QA';
  }

  if (severity === 'SEVERITY: CRITICAL') {
    return 'URGENCY: RETUNE NOW';
  }

  if (severity === 'SEVERITY: HIGH') {
    return 'URGENCY: NEXT RUN';
  }

  if (opsLabel === 'OPS MODE RESULT CHECK') {
    return 'URGENCY: CHECK RESULT FLOW';
  }

  return 'URGENCY: OBSERVE';
}

function capturePlaybookLabel(
  history: RuntimeObservation[],
  qualityHistory: CaptureSessionQuality[],
  sessionState?: MotionSessionState | null,
): string {
  const opsLabel = captureOpsLabel(history, qualityHistory, sessionState);

  switch (opsLabel) {
    case 'OPS MODE HOLD':
      return 'PLAYBOOK: 같은 조건으로 1회 더 업로드해 FULL TRACE 재현 여부만 확인하세요.';
    case 'OPS MODE TRACE ALIGN':
      return 'PLAYBOOK: alignment score를 먼저 올리는 것이 목표입니다. 서버 trace에서 보이는 상태가 로컬에 왜 빠졌는지 polling 간격과 재조회 타이밍부터 먼저 맞춰 보세요.';
    case 'OPS MODE POLL RETUNE':
      return 'PLAYBOOK: polling retune 후 SEND 포착 여부를 먼저 확인하고, 그다음 평균 score 변화를 보세요.';
    case 'OPS MODE WINDOW RETUNE':
      return 'PLAYBOOK: 안정화 윈도우를 먼저 조정한 뒤 STORE/ANALYZE가 history에 남는지 확인하세요.';
    case 'OPS MODE RESULT CHECK':
      return 'PLAYBOOK: 결과 화면 연결과 완료 직후 세션 재조회 순서부터 점검하세요.';
    default:
      return 'PLAYBOOK: 현재 설정으로 1회 더 업로드해 누락 단계가 반복되는지 먼저 관찰하세요.';
  }
}

function runtimeFailureDetail(state: MotionSessionState): string | null {
  if (state.runtimeState !== 'FAILED_RETRYABLE') {
    return null;
  }

  const failureCode = state.lastFailureCode ? failureCodeLabel(state.lastFailureCode) : null;
  const failureTime = state.lastFailureAt
    ? new Date(state.lastFailureAt).toLocaleTimeString('ko-KR')
    : null;

  if (failureCode && state.lastFailureMessage && failureTime) {
    return `${failureCode} · 마지막 실패 ${failureTime}: ${state.lastFailureMessage}`;
  }

  if (failureCode && state.lastFailureMessage) {
    return `${failureCode} · 마지막 실패: ${state.lastFailureMessage}`;
  }

  if (failureCode && failureTime) {
    return `${failureCode} · 마지막 실패 시각: ${failureTime}`;
  }

  if (state.lastFailureMessage && failureTime) {
    return `마지막 실패 ${failureTime}: ${state.lastFailureMessage}`;
  }

  if (state.lastFailureMessage) {
    return `마지막 실패: ${state.lastFailureMessage}`;
  }

  return failureTime ? `마지막 실패 시각: ${failureTime}` : null;
}

function runtimeUpdatedDetail(state: MotionSessionState): string | null {
  if (!state.runtimeUpdatedAt) {
    return null;
  }

  return `런타임 갱신 시각: ${new Date(state.runtimeUpdatedAt).toLocaleTimeString('ko-KR')}`;
}

function serverRuntimeTraceDetail(state: MotionSessionState): string | null {
  if (!state.serverRuntimeTrace || state.serverRuntimeTrace.length === 0) {
    return null;
  }

  const latestTrace = state.serverRuntimeTrace[0];
  const recordedAt = latestTrace.recordedAt
    ? new Date(latestTrace.recordedAt).toLocaleTimeString('ko-KR')
    : null;
  const source = latestTrace.source ? ` · source ${latestTrace.source}` : '';

  if (recordedAt) {
    return `서버 trace ${state.serverRuntimeTrace.length}건 · 최신 ${runtimeStateShortLabel(latestTrace.runtimeState)} @ ${recordedAt}${source}`;
  }

  return `서버 trace ${state.serverRuntimeTrace.length}건 · 최신 ${runtimeStateShortLabel(latestTrace.runtimeState)}${source}`;
}

function serverTraceMatchLabel(
  localHistory: RuntimeObservation[],
  state: MotionSessionState,
): string {
  const status = serverTraceStatus(localHistory, state);

  if (status === 'match') {
    return 'SERVER TRACE MATCH';
  }

  if (status === 'diverged') {
    return 'SERVER TRACE DIVERGED';
  }

  if (status === 'partial') {
    const localSet = new Set(localHistory.map((entry) => entry.runtimeState));
    const serverStates = state.serverRuntimeTrace.map((entry) => entry.runtimeState);
    const matchedCount = serverStates.filter((runtimeState) => localSet.has(runtimeState)).length;
    return `SERVER TRACE PARTIAL ${matchedCount}/${serverStates.length}`;
  }

  return 'SERVER TRACE NONE';
}

function serverTraceStatus(
  localHistory: RuntimeObservation[],
  state: MotionSessionState,
): 'match' | 'partial' | 'diverged' | 'none' {
  if (!state.serverRuntimeTrace || state.serverRuntimeTrace.length === 0) {
    return 'none';
  }

  const localSet = new Set(localHistory.map((entry) => entry.runtimeState));
  const serverStates = state.serverRuntimeTrace.map((entry) => entry.runtimeState);
  const matchedCount = serverStates.filter((runtimeState) => localSet.has(runtimeState)).length;

  if (matchedCount === serverStates.length) {
    return 'match';
  }

  if (matchedCount === 0) {
    return 'diverged';
  }

  return 'partial';
}

function serverTracePathLabel(state: MotionSessionState): string {
  if (!state.serverRuntimeTrace || state.serverRuntimeTrace.length === 0) {
    return 'SERVER PATH NONE';
  }

  return `SERVER PATH ${[...state.serverRuntimeTrace]
    .reverse()
    .map((entry) => runtimeStateShortLabel(entry.runtimeState))
    .join(' -> ')}`;
}

function serverTraceSourceLabel(state: MotionSessionState): string {
  if (!state.serverRuntimeTrace || state.serverRuntimeTrace.length === 0) {
    return 'SERVER SOURCE NONE';
  }

  const latestSource = state.serverRuntimeTrace[0]?.source ?? 'UNKNOWN';
  return `SERVER SOURCE ${serverTraceSourceDisplayLabel(latestSource)}`;
}

function serverTraceSourceDisplayLabel(source: string): string {
  switch (source) {
    case 'TRACKER':
      return 'TRACKER';
    case 'ASYNC_JOB':
      return 'ASYNC JOB';
    case 'EVENT_BUS':
      return 'EVENT BUS';
    default:
      return source;
  }
}

function serverTraceCoverageLabel(state: MotionSessionState): string {
  if (!state.serverRuntimeTrace || state.serverRuntimeTrace.length === 0) {
    return 'SERVER COVERAGE NONE';
  }

  const coverage = serverRuntimeCoverage(state);
  const seenCount = coverage.filter((item) => item.seen).length;
  return `SERVER COVERAGE ${Math.round((seenCount / coverage.length) * 100)}%`;
}

function serverTraceAlignmentScoreLabel(
  localHistory: RuntimeObservation[],
  state: MotionSessionState,
): string {
  return `ALIGNMENT ${serverTraceAlignmentScore(localHistory, state)}%`;
}

function serverTraceAlignmentScore(
  localHistory: RuntimeObservation[],
  state: MotionSessionState,
): number {
  if (!state.serverRuntimeTrace || state.serverRuntimeTrace.length === 0) {
    return 0;
  }

  const localSet = new Set(localHistory.map((entry) => entry.runtimeState));
  const serverStates = state.serverRuntimeTrace.map((entry) => entry.runtimeState);
  const matchedCount = serverStates.filter((runtimeState) => localSet.has(runtimeState)).length;
  return Math.round((matchedCount / serverStates.length) * 100);
}

function serverRuntimeCoverage(
  state: MotionSessionState,
): Array<{ label: string; seen: boolean }> {
  const observed = new Set(state.serverRuntimeTrace.map((entry) => entry.runtimeState));
  const checkpoints: Array<{ label: string; state: MotionSessionState['runtimeState'] }> = [
    { label: 'QUEUE', state: 'UPLOAD_PENDING' },
    { label: 'SEND', state: 'UPLOAD_IN_PROGRESS' },
    { label: 'STORE', state: 'UPLOAD_STORED' },
    { label: 'ANALYZE', state: 'ANALYSIS_IN_PROGRESS' },
    { label: 'DONE', state: 'SCORING_COMPLETED' },
  ];

  return checkpoints.map((checkpoint) => ({
    label: checkpoint.label,
    seen: observed.has(checkpoint.state),
  }));
}

function serverTraceAssessment(
  localHistory: RuntimeObservation[],
  state: MotionSessionState,
): string {
  if (!state.serverRuntimeTrace || state.serverRuntimeTrace.length === 0) {
    return '서버 기준 trace는 아직 비어 있습니다. 현재는 프론트 로컬 관측을 중심으로 해석하고 있습니다.';
  }

  const localSet = new Set(localHistory.map((entry) => entry.runtimeState));
  const serverSet = new Set(state.serverRuntimeTrace.map((entry) => entry.runtimeState));
  const missingOnLocal = [...serverSet].filter((runtimeState) => !localSet.has(runtimeState));

  if (missingOnLocal.length === 0) {
    return '현재 trace는 로컬 관측과 서버 기준 전이가 대체로 일치합니다.';
  }

  return `서버에서는 ${missingOnLocal.map((runtimeState) => runtimeStateShortLabel(runtimeState)).join(', ')} 단계를 봤지만 로컬 trace에는 빠졌습니다. polling 또는 관측 타이밍 차이를 먼저 점검해 보세요.`;
}

function failureCodeLabel(code: NonNullable<MotionSessionState['lastFailureCode']>): string {
  switch (code) {
    case 'UPLOAD_STORAGE_FAILED':
      return 'STORAGE';
    case 'ANALYSIS_FAILED':
      return 'ANALYSIS';
    case 'SCORING_FAILED':
      return 'SCORING';
    default:
      return 'RETRY';
  }
}

function latestAttemptShortLabel(state: MotionSessionState): string {
  if (!state.latestAttemptId) {
    return 'NONE';
  }

  if (state.latestAttemptResultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return 'AUTO';
  }

  if (state.latestAttemptResultSource === 'SAMPLE_SCORING_PREVIEW') {
    return 'PREV';
  }

  return state.scoreAvailable ? 'DONE' : 'READY';
}

function latestAttemptDescription(state: MotionSessionState): string {
  if (!state.latestAttemptId) {
    return '최근 시도 결과가 아직 없어 세션 준비 정보만 먼저 보여주고 있습니다.';
  }

  if (state.latestAttemptResultSource === 'VIDEO_UPLOAD_AUTOSCORED') {
    return `최근 결과 #${state.latestAttemptId}는 실제 업로드 자동 채점 결과입니다.`;
  }

  if (state.latestAttemptResultSource === 'SAMPLE_SCORING_PREVIEW') {
    return `최근 결과 #${state.latestAttemptId}는 sample scoring preview 기준입니다.`;
  }

  return state.scoreAvailable
    ? `최근 결과 #${state.latestAttemptId}는 완료 상태 기록입니다.`
    : `최근 결과 #${state.latestAttemptId}는 준비 상태 저장 기록입니다.`;
}

function nextActionLabel(action: MotionSessionState['nextAction']): string {
  switch (action) {
    case 'REVIEW_REFERENCE_STATUS':
      return '레퍼런스 준비 상태 확인';
    case 'REQUEST_CAMERA_PERMISSION':
      return '카메라 권한 확인';
    default:
      return '상태 없음';
  }
}

function nextActionShortLabel(action: MotionSessionState['nextAction']): string {
  switch (action) {
    case 'REVIEW_REFERENCE_STATUS':
      return 'REF';
    case 'REQUEST_CAMERA_PERMISSION':
      return 'CAM';
    default:
      return 'WAIT';
  }
}

function readinessStateDescription(state: MotionSessionState['readinessState']): string {
  switch (state) {
    case 'UPLOAD_READY':
      return '레퍼런스 분석이 끝나 실제 업로드와 자동 채점 흐름으로 진입할 수 있습니다.';
    default:
      return '아직은 샘플 저장 중심으로 확인 가능한 단계입니다.';
  }
}

function recordingPhaseLabel(phase: MotionSessionState['recordingPhase']): string {
  switch (phase) {
    case 'UPLOAD_SCORING_READY':
      return '업로드 자동 채점 준비 완료';
    default:
      return '샘플 흐름 우선 확인 가능';
  }
}

function recordingPhaseShortLabel(phase: MotionSessionState['recordingPhase']): string {
  switch (phase) {
    case 'UPLOAD_SCORING_READY':
      return 'UPLOAD';
    default:
      return 'SAMPLE';
  }
}

function flowStageLabel(stage: FlowStage): string {
  switch (stage) {
    case 'camera-ready':
      return '카메라 준비 완료';
    case 'countdown-ready':
      return '카운트다운 진행 중';
    case 'recording-active':
      return '녹화 진행 중';
    case 'recording-paused':
      return '녹화 일시정지';
    case 'upload-waiting':
      return '업로드 대기 중';
    case 'uploading':
      return '업로드 진행 중';
    case 'upload-complete':
      return '자동 채점 완료';
    case 'sample-save-complete':
      return '샘플 저장 완료';
    default:
      return '카메라 체크 단계';
  }
}

function flowStageShortLabel(stage: FlowStage): string {
  switch (stage) {
    case 'camera-ready':
      return 'READY';
    case 'countdown-ready':
      return 'COUNT';
    case 'recording-active':
      return 'REC';
    case 'recording-paused':
      return 'PAUSE';
    case 'upload-waiting':
      return 'QUEUE';
    case 'uploading':
      return 'SEND';
    case 'upload-complete':
      return 'DONE';
    case 'sample-save-complete':
      return 'SAVE';
    default:
      return 'CHECK';
  }
}

function shouldApplyRuntimeFlowMapping(stage: FlowStage): boolean {
  switch (stage) {
    case 'countdown-ready':
    case 'recording-active':
    case 'recording-paused':
    case 'uploading':
    case 'upload-complete':
    case 'sample-save-complete':
      return false;
    default:
      return true;
  }
}

function runtimeStateToFlowStage(
  runtimeState: MotionSessionState['runtimeState'],
  cameraState: CameraState,
): FlowStage {
  switch (runtimeState) {
    case 'SCORING_COMPLETED':
      return 'upload-complete';
    case 'ANALYSIS_IN_PROGRESS':
      return 'uploading';
    case 'UPLOAD_STORED':
      return 'uploading';
    case 'FAILED_RETRYABLE':
      return 'upload-waiting';
    case 'UPLOAD_IN_PROGRESS':
      return 'uploading';
    case 'UPLOAD_PENDING':
      return 'upload-waiting';
    case 'IDLE':
    default:
      return cameraState === 'granted' ? 'camera-ready' : 'camera-check';
  }
}

function uploadProgressLabel(
  flowStage: FlowStage,
  progress: number,
  serverSyncState: ServerSyncState,
): string {
  switch (flowStage) {
    case 'uploading':
      return `분석 서버로 업로드 중입니다. 현재 ${progress}% 진행되었습니다.`;
    case 'upload-complete':
      if (serverSyncState === 'syncing') {
        return '업로드는 끝났고, 서버 세션 반영 상태를 다시 확인하고 있습니다.';
      }
      return '업로드와 자동 채점이 모두 끝났습니다.';
    case 'sample-save-complete':
      if (serverSyncState === 'syncing') {
        return '샘플 저장은 끝났고, 서버 세션 반영 상태를 다시 확인하고 있습니다.';
      }
      return '이번 흐름은 업로드 대신 샘플 저장 결과로 마무리되었습니다.';
    default:
      return '업로드를 시작하면 이 영역에 진행률이 표시됩니다.';
  }
}

function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function pickRecorderOptions(): MediaRecorderOptions | undefined {
  if (typeof window.MediaRecorder === 'undefined') {
    return undefined;
  }

  if (window.MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
    return { mimeType: 'video/webm;codecs=vp9' };
  }

  if (window.MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
    return { mimeType: 'video/webm;codecs=vp8' };
  }

  if (window.MediaRecorder.isTypeSupported('video/webm')) {
    return { mimeType: 'video/webm' };
  }

  return undefined;
}

function buildRecordedFile(chunks: Blob[]): File | null {
  if (chunks.length === 0) {
    return null;
  }

  const type = chunks[0].type || 'video/webm';
  const blob = new Blob(chunks, { type });
  const extension = type.includes('mp4') ? 'mp4' : 'webm';
  return new File([blob], `mocha-take-${Date.now()}.${extension}`, { type });
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

function cameraSignalMeta(state: CameraState): {
  tone: 'neutral' | 'good' | 'warn' | 'danger';
  icon: string;
  title: string;
  description: string;
} {
  switch (state) {
    case 'granted':
      return {
        tone: 'good',
        icon: 'CAM',
        title: '카메라 준비 완료',
        description: '실시간 미리보기와 브라우저 녹화를 바로 사용할 수 있습니다.',
      };
    case 'requesting':
      return {
        tone: 'neutral',
        icon: 'ASK',
        title: '권한 요청 중',
        description: '브라우저 권한 팝업 응답을 기다리고 있습니다.',
      };
    case 'denied':
      return {
        tone: 'danger',
        icon: 'DENY',
        title: '권한 거부',
        description: '설정에서 권한을 다시 허용하거나 업로드 경로로 진행해 주세요.',
      };
    case 'missing':
      return {
        tone: 'warn',
        icon: 'MISS',
        title: '카메라 장치 없음',
        description: '기기 카메라 없이 업로드와 샘플 흐름은 계속 확인할 수 있습니다.',
      };
    case 'unavailable':
      return {
        tone: 'warn',
        icon: 'LOCK',
        title: '장치 사용 불가',
        description: '다른 앱 점유 여부를 확인한 뒤 다시 시도해 주세요.',
      };
    case 'unsupported':
      return {
        tone: 'warn',
        icon: 'WEB',
        title: '브라우저 미지원',
        description: '녹화 대신 파일 업로드와 샘플 저장 흐름으로 이어집니다.',
      };
    case 'error':
      return {
        tone: 'danger',
        icon: 'ERR',
        title: '카메라 오류',
        description: '카메라 초기화에 실패했습니다. 업로드 경로로 우회할 수 있습니다.',
      };
    default:
      return {
        tone: 'neutral',
        icon: 'WAIT',
        title: '카메라 확인 대기',
        description: '권한 확인을 시작하면 라이브 미리보기 상태가 활성화됩니다.',
      };
  }
}

function recordingSignalMeta(
  supported: boolean,
  stage: FlowStage,
): {
  tone: 'neutral' | 'good' | 'warn' | 'danger';
  icon: string;
  title: string;
  description: string;
} {
  if (!supported) {
    return {
      tone: 'warn',
      icon: 'ALT',
      title: '녹화 대체 모드',
      description: '브라우저 녹화 대신 업로드 검수 패널 중심으로 흐름을 확인합니다.',
    };
  }

  switch (stage) {
    case 'countdown-ready':
      return {
        tone: 'good',
        icon: '3-2',
        title: '카운트다운 진행 중',
        description: '실제 녹화 진입 직전 리듬과 구도를 맞추고 있습니다.',
      };
    case 'recording-active':
      return {
        tone: 'good',
        icon: 'REC',
        title: '실제 녹화 진행 중',
        description: '세션 타이머와 브라우저 녹화가 동시에 움직이고 있습니다.',
      };
    case 'recording-paused':
      return {
        tone: 'warn',
        icon: 'PAUSE',
        title: '녹화 일시정지',
        description: '다시 시작하거나 업로드 대기로 넘어갈 수 있는 구간입니다.',
      };
    case 'upload-waiting':
      return {
        tone: 'neutral',
        icon: 'HOLD',
        title: '검수 대기',
        description: '녹화본 또는 선택한 파일을 업로드 전 미리 검수하고 있습니다.',
      };
    default:
      return {
        tone: 'neutral',
        icon: 'HUD',
        title: 'HUD 준비 상태',
        description: '카운트다운 시작 전 카메라와 녹화 가능 여부를 점검하고 있습니다.',
      };
  }
}

function uploadSignalMeta(enabled: boolean): {
  tone: 'neutral' | 'good' | 'warn' | 'danger';
  icon: string;
  title: string;
  description: string;
} {
  if (enabled) {
    return {
      tone: 'good',
      icon: 'LIVE',
      title: '실제 업로드 경로 열림',
      description: '비디오 업로드 후 mock 분석과 자동 채점 결과를 바로 받을 수 있습니다.',
    };
  }

  return {
    tone: 'warn',
    icon: 'SAMP',
    title: '샘플 저장 중심',
    description: '현재는 준비 상태 저장과 sample preview 결과를 우선 확인하는 경로입니다.',
  };
}

function serverSyncMeta(
  state: ServerSyncState,
  refreshing: boolean,
  sessionError: string | null,
  runtimeState?: MotionSessionState['runtimeState'],
): {
  tone: 'neutral' | 'good' | 'warn' | 'danger';
  icon: string;
  title: string;
  description: string;
} {
  if (state === 'error' || sessionError) {
    return {
      tone: 'danger',
      icon: 'ERR',
      title: '동기화 오류',
      description: '백엔드 세션 상태를 다시 확인하지 못했습니다. 수동 새로고침으로 재시도할 수 있습니다.',
    };
  }

  if (state === 'syncing' || refreshing) {
    return {
      tone: 'warn',
      icon: 'WAIT',
      title: '서버 반영 확인 중',
      description: '최근 액션 이후 백엔드 세션 상태를 다시 읽어 현재 가능 경로를 갱신하고 있습니다.',
    };
  }

  if (state === 'synced') {
    return {
      tone: 'good',
      icon: 'LIVE',
      title: '서버 상태 반영 완료',
      description:
        runtimeState === 'SCORING_COMPLETED'
          ? `${runtimeStateLabel(runtimeState)} 상태까지 서버와 동기화되었습니다.`
          : runtimeState === 'ANALYSIS_IN_PROGRESS'
            ? '업로드 저장 이후 분석과 채점 진행 상태까지 서버와 동기화되었습니다.'
            : runtimeState === 'UPLOAD_STORED'
              ? '비디오 저장 완료 상태까지 서버와 동기화되었습니다.'
          : runtimeState === 'FAILED_RETRYABLE'
            ? '업로드 실패 후 다시 시도 가능한 상태까지 서버와 동기화되었습니다.'
          : runtimeState === 'UPLOAD_IN_PROGRESS'
            ? '업로드 저장 또는 자동 채점 진행 상태까지 서버와 동기화되었습니다.'
          : runtimeState === 'UPLOAD_PENDING'
            ? '현재 시작 화면은 업로드 대기 가능 상태까지 서버와 동기화된 상태입니다.'
            : '현재 시작 화면은 최근 저장/업로드 액션 이후 서버 상태와 동기화된 상태입니다.',
    };
  }

  return {
    tone: 'neutral',
    icon: 'HUD',
    title: '동기화 대기',
    description: '세션 상태를 아직 한 번 더 확인하지 않은 초기 단계입니다.',
  };
}
