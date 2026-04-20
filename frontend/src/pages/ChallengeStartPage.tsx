import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import '../features/challenges/challenge-play.css';
import { formatDifficulty } from '../features/challenges/difficulty';
import {
  buildPlayJudgementCue,
  buildPlayJudgementTimeline,
  buildPreviewJudgementEvaluation,
} from '../features/challenges/playJudgement';
import { createAttempt, uploadAttemptVideo } from '../shared/api/attemptApi';
import { getChallengeById } from '../shared/api/challengeApi';
import { resolveApiUrl } from '../shared/api/client';
import { useAnimatedNumber } from '../shared/hooks/useAnimatedNumber';
import type { AttemptSummary } from '../shared/types/attempt';
import type { Challenge } from '../shared/types/challenge';

type FlowMode = 'camera' | 'test';
type PlayState = 'idle' | 'countdown' | 'playing' | 'clear' | 'analyzing' | 'result';
type JudgementCue = ReturnType<typeof buildPlayJudgementCue>;

const RECORDING_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=h264,opus',
  'video/webm',
  'video/mp4',
];

export function ChallengeStartPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowMode, setFlowMode] = useState<FlowMode>(searchParams.get('mode') === 'test' ? 'test' : 'camera');

  const [playState, setPlayState] = useState<PlayState>('idle');
  const [countdownNumber, setCountdownNumber] = useState(3);
  const [progress, setProgress] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [resultAttempt, setResultAttempt] = useState<AttemptSummary | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [judgementCue, setJudgementCue] = useState<JudgementCue | null>(null);

  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const refVideoRef = useRef<HTMLVideoElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);
  const judgementTimeoutRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string>('video/webm');

  useEffect(() => {
    let active = true;

    async function loadChallenge() {
      setLoading(true);
      setError(null);

      try {
        const response = await getChallengeById(id);
        if (active) {
          setChallenge(response);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '챌린지 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadChallenge();

    return () => {
      active = false;
    };
  }, [id]);

  const clearPlaybackTimers = useCallback(() => {
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    if (judgementTimeoutRef.current) {
      window.clearTimeout(judgementTimeoutRef.current);
      judgementTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const stopReferenceVideo = useCallback(() => {
    if (!refVideoRef.current) {
      return;
    }

    refVideoRef.current.pause();
    refVideoRef.current.currentTime = 0;
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }, []);

  const discardRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];

    if (!recorder) {
      return;
    }

    recorder.ondataavailable = null;
    recorder.onerror = null;
    recorder.onstop = null;

    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Ignore recorder shutdown errors during cleanup.
      }
    }
  }, []);

  const requestCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setFlowMode('test');
      setCameraReady(false);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stopCamera();
      cameraStreamRef.current = stream;

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }

      setCameraReady(true);
      setFlowMode('camera');
      return true;
    } catch {
      setFlowMode('test');
      setCameraReady(false);
      return false;
    }
  }, [stopCamera]);

  useEffect(() => {
    document.body.classList.add('body--play-fullscreen');

    return () => {
      clearPlaybackTimers();
      discardRecording();
      stopReferenceVideo();
      stopCamera();
      document.body.classList.remove('body--play-fullscreen');
    };
  }, [clearPlaybackTimers, discardRecording, stopCamera, stopReferenceVideo]);

  useEffect(() => {
    if (flowMode === 'camera' && playState === 'idle' && !cameraReady) {
      void requestCamera();
    }

    if (flowMode === 'test') {
      discardRecording();
      stopCamera();
    }
  }, [cameraReady, discardRecording, flowMode, playState, requestCamera, stopCamera]);

  const startCameraRecording = useCallback(() => {
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('이 브라우저에서는 카메라 녹화를 지원하지 않습니다.');
    }

    const stream = cameraStreamRef.current;
    if (!stream) {
      throw new Error('카메라 스트림이 준비되지 않았습니다.');
    }

    const mimeType = resolveRecordingMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    recordingChunksRef.current = [];
    recordingMimeTypeRef.current = recorder.mimeType || mimeType || 'video/webm';

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };

    recorder.start(250);
    mediaRecorderRef.current = recorder;
  }, []);

  const stopCameraRecording = useCallback((): Promise<File | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return Promise.resolve(null);
    }

    mediaRecorderRef.current = null;

    return new Promise((resolve, reject) => {
      const mimeType = recordingMimeTypeRef.current || recorder.mimeType || 'video/webm';
      const fileExtension = mimeType.includes('mp4') ? 'mp4' : 'webm';

      const cleanup = () => {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
      };

      recorder.onerror = () => {
        cleanup();
        recordingChunksRef.current = [];
        reject(new Error('카메라 녹화 파일을 정리하지 못했습니다.'));
      };

      recorder.onstop = () => {
        cleanup();
        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];

        if (chunks.length === 0) {
          resolve(null);
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        resolve(
          new File([blob], `attempt-${Date.now()}.${fileExtension}`, {
            type: mimeType,
          }),
        );
      };

      try {
        if (recorder.state === 'inactive') {
          const chunks = recordingChunksRef.current;
          recordingChunksRef.current = [];
          if (chunks.length === 0) {
            cleanup();
            resolve(null);
            return;
          }

          cleanup();
          const blob = new Blob(chunks, { type: mimeType });
          resolve(
            new File([blob], `attempt-${Date.now()}.${fileExtension}`, {
              type: mimeType,
            }),
          );
          return;
        }

        recorder.stop();
      } catch {
        cleanup();
        recordingChunksRef.current = [];
        reject(new Error('카메라 녹화를 종료하지 못했습니다.'));
      }
    });
  }, []);

  const persistPlayResult = useCallback(
    async (recordedFile: File | null) => {
      if (!challenge) {
        setResultError('결과를 저장할 챌린지 정보를 찾을 수 없습니다.');
        setPlayState('result');
        return;
      }

      setSavingResult(true);
      setResultError(null);

      try {
        if (flowMode === 'camera') {
          if (!recordedFile) {
            throw new Error('녹화된 플레이 영상이 없어 분석을 시작할 수 없습니다.');
          }

          const response = await uploadAttemptVideo({
            challengeId: challenge.id,
            notes: 'Challenge play camera capture uploaded from the play flow.',
            attemptVideo: recordedFile,
          });

          if (response.attemptId != null) {
            void navigate(`/attempts/${response.attemptId}/result`, { replace: true });
            return;
          }

          throw new Error('분석은 시작됐지만 결과 기록 ID를 받지 못했습니다.');
        }

        const attempt = await createAttempt({
          challengeId: challenge.id,
          score: 0,
          notes: 'Test mode preview result saved without camera upload.',
          recordType: 'completed',
        });

        setResultAttempt(attempt);
        void navigate(`/attempts/${attempt.id}/result`, { replace: true });
      } catch (saveError) {
        setResultError(saveError instanceof Error ? saveError.message : '결과를 저장하지 못했습니다.');
        setPlayState('result');
      } finally {
        setSavingResult(false);
      }
    },
    [challenge, flowMode, navigate],
  );

  const handlePlayComplete = useCallback(() => {
    stopReferenceVideo();
    if (judgementTimeoutRef.current) {
      window.clearTimeout(judgementTimeoutRef.current);
      judgementTimeoutRef.current = null;
    }
    setJudgementCue(null);
    setPlayState('clear');

    transitionTimeoutRef.current = window.setTimeout(() => {
      setPlayState('analyzing');

      void (async () => {
        try {
          const recordedFile = flowMode === 'camera' ? await stopCameraRecording() : null;
          stopCamera();
          await persistPlayResult(recordedFile);
        } catch (playError) {
          stopCamera();
          setResultError(playError instanceof Error ? playError.message : '플레이 녹화를 마무리하지 못했습니다.');
          setPlayState('result');
        }
      })();
    }, 1800);
  }, [flowMode, persistPlayResult, stopCamera, stopCameraRecording, stopReferenceVideo]);

  const startGame = useCallback(async () => {
    clearPlaybackTimers();
    setResultAttempt(null);
    setResultError(null);
    setJudgementCue(null);
    setProgress(0);
    setCountdownNumber(3);

    if (flowMode === 'camera' && !cameraReady) {
      const ready = await requestCamera();
      if (!ready) {
        setResultError('카메라를 사용할 수 없어 테스트 모드로 전환했습니다. 다시 시작해 주세요.');
        setPlayState('result');
        return;
      }
    }

    setPlayState('countdown');

    let count = 3;
    countdownIntervalRef.current = window.setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNumber(count);
        return;
      }

      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      try {
        if (flowMode === 'camera') {
          startCameraRecording();
        }
      } catch (recordingError) {
        setResultError(recordingError instanceof Error ? recordingError.message : '카메라 녹화를 시작하지 못했습니다.');
        setPlayState('result');
        return;
      }

      setPlayState('playing');
      if (refVideoRef.current) {
        void refVideoRef.current.play();
      }

      const durationSec = challenge?.durationSec ?? 30;
      const judgementTimeline = buildPlayJudgementTimeline(durationSec, flowMode);
      const startedAt = Date.now();
      let nextJudgementIndex = 0;
      let combo = 0;

      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        const percent = Math.min(100, (elapsed / durationSec) * 100);
        setProgress(percent);

        const elapsedMs = elapsed * 1000;
        while (nextJudgementIndex < judgementTimeline.length && elapsedMs >= judgementTimeline[nextJudgementIndex].triggerMs) {
          combo += 1;
          const planItem = judgementTimeline[nextJudgementIndex];
          const evaluation = buildPreviewJudgementEvaluation(planItem, flowMode);
          const cue = buildPlayJudgementCue(planItem, combo, evaluation);

          setJudgementCue(cue);
          if (judgementTimeoutRef.current) {
            window.clearTimeout(judgementTimeoutRef.current);
          }
          judgementTimeoutRef.current = window.setTimeout(() => {
            setJudgementCue((current) => (current?.id === cue.id ? null : current));
          }, cue.windowMs);

          nextJudgementIndex += 1;
        }

        if (percent >= 100) {
          if (progressIntervalRef.current) {
            window.clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
          handlePlayComplete();
        }
      }, 100);
    }, 1000);
  }, [
    cameraReady,
    challenge?.durationSec,
    clearPlaybackTimers,
    flowMode,
    handlePlayComplete,
    requestCamera,
    startCameraRecording,
  ]);

  const handleExit = useCallback(() => {
    clearPlaybackTimers();
    discardRecording();
    stopReferenceVideo();
    stopCamera();
    setJudgementCue(null);
    void navigate(`/challenges?challengeId=${id}`);
  }, [clearPlaybackTimers, discardRecording, id, navigate, stopCamera, stopReferenceVideo]);

  const handleRetry = useCallback(() => {
    clearPlaybackTimers();
    discardRecording();
    stopReferenceVideo();
    setPlayState('idle');
    setCountdownNumber(3);
    setProgress(0);
    setSavingResult(false);
    setResultAttempt(null);
    setResultError(null);
    setJudgementCue(null);

    if (flowMode === 'camera') {
      void requestCamera();
    } else {
      stopCamera();
    }
  }, [clearPlaybackTimers, discardRecording, flowMode, requestCamera, stopCamera, stopReferenceVideo]);

  const latestScoreLabel = useMemo(() => {
    if (!challenge?.latestRetrySummary?.latestScore && challenge?.latestRetrySummary?.latestScore !== 0) {
      return 'No record';
    }
    return `${challenge.latestRetrySummary.latestScore} pt`;
  }, [challenge?.latestRetrySummary]);

  const rawVideoUrl = challenge?.guideVideoUrl ?? challenge?.fallbackThumbnailVideoUrl ?? null;
  const referenceVideoUrl = rawVideoUrl ? resolveApiUrl(rawVideoUrl) : null;
  const challengeReady = challenge?.referenceVideoUploaded && challenge.referenceMotionProfileReady;
  const resultScore = resultAttempt?.score ?? 0;
  const animatedResultScore = useAnimatedNumber(resultScore, { duration: 1600 });
  const animatedResultRate = useAnimatedNumber(resultScore, { duration: 1850, decimals: 2 });
  const resultRate = `${animatedResultRate.toFixed(2)}%`;
  const resultHeadline = flowMode === 'test' ? '테스트 모드 결과가 준비되었습니다.' : '플레이 결과를 정리했습니다.';
  const resultSummary =
    resultError ??
    (flowMode === 'test'
      ? '카메라 없이 실행한 테스트 결과입니다. 실제 모션분석 점수는 아니며 플레이 흐름 점검용으로 저장됩니다.'
      : resultAttempt?.resultSummary ?? '카메라 업로드와 자동채점이 연결되지 않아 임시 결과 화면을 표시하고 있습니다.');
  const scoreDelta = resultAttempt?.scoreDeltaFromPrevious;
  const isNewRecord = scoreDelta != null && scoreDelta > 0;
  const analysisSteps = [
    '플레이 구간을 정리하고 있습니다.',
    flowMode === 'test'
      ? '카메라 없이 테스트 기록을 생성하고 있습니다.'
      : savingResult
        ? '녹화 영상을 업로드하고 자동채점을 요청하고 있습니다.'
        : '녹화 영상을 정리하고 업로드를 준비하고 있습니다.',
    flowMode === 'test' ? '프리뷰 결과 페이지로 이동합니다.' : '분석이 끝나면 결과 페이지로 바로 이동합니다.',
  ];

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>플레이 화면을 준비하고 있습니다.</strong>
          <p>챌린지 상태와 레퍼런스 영상을 확인하는 중입니다.</p>
        </div>
      </section>
    );
  }

  if (error || !challenge) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>챌린지 정보를 불러오지 못했습니다.</strong>
          <p>{error ?? '선택한 챌린지를 찾을 수 없습니다.'}</p>
          <div className="inline-actions">
            <Link className="button-link" to="/challenges">
              챌린지 목록으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!challengeReady) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>아직 플레이를 시작할 수 없는 챌린지입니다.</strong>
          <p>레퍼런스 영상 업로드와 모션분석이 모두 준비되어야 실제 플레이를 시작할 수 있습니다.</p>
          <div className="glass-inline-meta">
            <span>레퍼런스 영상 {challenge.referenceVideoUploaded ? '준비 완료' : '없음'}</span>
            <span>모션 프로필 {challenge.referenceMotionProfileReady ? '준비 완료' : '준비 중'}</span>
            <span>분석 상태 {challenge.referenceAnalysisStatus}</span>
          </div>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/challenges?challengeId=${challenge.id}`}>
              챌린지 목록으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (playState === 'result') {
    return (
      <div className="play-result">
        <div className="play-result__left">
          <div className="play-result__mode-label">
            <span>{flowMode === 'test' ? 'TEST MODE' : 'CAMERA MODE'}</span>
          </div>

          <h3 className="play-result__judgement-title">Result Analysis</h3>

          <div className="play-result__judgement-table">
            <span className="play-result__judgement-label play-result__judgement-label--accent">Flow</span>
            <span className="play-result__judgement-value">{flowMode === 'test' ? 'Timeline test' : 'Camera upload'}</span>

            <span className="play-result__judgement-label play-result__judgement-label--accent">Strongest</span>
            <span className="play-result__judgement-value">{formatAreaLabel(resultAttempt?.strongestArea)}</span>

            <span className="play-result__judgement-label play-result__judgement-label--accent">Weakest</span>
            <span className="play-result__judgement-value">{formatAreaLabel(resultAttempt?.weakestArea)}</span>
          </div>

          <div className="play-result__summary-card">
            <strong>{resultHeadline}</strong>
            <p>{resultSummary}</p>
            {resultAttempt ? <span>Record #{String(resultAttempt.id).padStart(3, '0')}</span> : null}
          </div>

          <div className="play-result__meta-section">
            <h4 className="play-result__meta-title">Challenge</h4>
            <span className="play-result__meta-value">{challenge.title}</span>
          </div>

          <div className="play-result__meta-section">
            <h4 className="play-result__meta-title">Difficulty</h4>
            <span className="play-result__meta-value">{formatDifficulty(challenge.difficulty)}</span>
          </div>

          <div className="play-result__meta-section">
            <h4 className="play-result__meta-title">Category</h4>
            <span className="play-result__meta-value">{challenge.category}</span>
          </div>
        </div>

        <div className="play-result__right">
          <div className="play-result__stat-ring">
            <div className="play-result__stat-item">
              <span>Flow</span>
              <strong>{flowMode === 'test' ? 'Test' : 'Camera'}</strong>
            </div>
            <div className="play-result__stat-item">
              <span>Status</span>
              <strong>{resultAttempt ? 'Saved' : 'Retry needed'}</strong>
            </div>
          </div>

          <div className="play-result__score-circle">
            <span className="play-result__rate">{resultRate}</span>
            <span className="play-result__rate-delta">
              {flowMode === 'test' ? 'Preview result' : 'Upload or scoring issue'}
            </span>
          </div>

          <div className="play-result__score-block">
            <span className="play-result__score-label">Score</span>
            <span className="play-result__score-number">{animatedResultScore}</span>
            {scoreDelta != null ? (
              <span className="play-result__score-delta">
                {scoreDelta >= 0 ? '+' : '-'} {Math.abs(scoreDelta)}
              </span>
            ) : null}
          </div>

          {isNewRecord ? <span className="play-result__new-record">New record</span> : null}

          <div className="play-result__actions">
            {resultAttempt ? (
              <Link className="play-result__action-btn" to={`/attempts/${resultAttempt.id}/result`}>
                View result
              </Link>
            ) : null}
            <button
              type="button"
              className="play-result__action-btn play-result__action-btn--secondary"
              onClick={handleRetry}
            >
              Retry
            </button>
            <Link className="play-result__action-btn play-result__action-btn--secondary" to={`/challenges?challengeId=${challenge.id}`}>
              Back to list
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="play-stage">
        <div className="play-stage__left">
          <span className="play-stage__gear-label">Motion Challenge</span>

          <button type="button" className="play-stage__exit" onClick={handleExit}>
            Exit
          </button>

          <div className="play-stage__video-wrap">
            {referenceVideoUrl ? (
              <video ref={refVideoRef} src={referenceVideoUrl} className="play-stage__video" playsInline preload="auto" />
            ) : (
              <div className="play-stage__video--placeholder">
                <span>{challenge.title}</span>
              </div>
            )}
          </div>

          <div className="play-stage__info">
            <span>{challenge.category}</span>
            <strong>{formatDifficulty(challenge.difficulty)}</strong>
            <span>{formatDurationLabel(challenge.durationSec)}</span>
            <span>Latest score {latestScoreLabel}</span>
          </div>

          <div className="play-stage__gauge">
            <div className="play-stage__gauge-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="play-stage__right">
          <div className={`play-stage__mode-chip${flowMode === 'test' ? ' play-stage__mode-chip--test' : ''}`}>
            {flowMode === 'test' ? 'TIMELINE TEST' : 'LIVE CAMERA'}
          </div>

          <div className="play-stage__rec">
            <span className={`play-stage__rec-dot${playState === 'playing' ? ' play-stage__rec-dot--active' : ''}`} />
            {playState === 'playing'
              ? flowMode === 'test'
                ? 'Testing'
                : 'Recording'
              : flowMode === 'test'
                ? 'Test standby'
                : 'Camera standby'}
          </div>

          {cameraReady && flowMode === 'camera' ? (
            <video ref={cameraVideoRef} className="play-stage__camera" autoPlay muted playsInline />
          ) : (
            <div className="play-stage__camera-placeholder">
              <span>{flowMode === 'test' ? 'Test mode' : 'Camera'}</span>
              <span>
                {flowMode === 'test'
                  ? '카메라 없이 판정 흐름만 점검하는 테스트 모드입니다.'
                  : '카메라 권한과 미리보기를 준비하고 있습니다.'}
              </span>
            </div>
          )}

          <div className="play-stage__guide-overlay">
            <svg viewBox="0 0 200 340" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
              <circle cx="100" cy="50" r="30" />
              <rect x="70" y="90" width="60" height="100" rx="4" />
              <line x1="70" y1="110" x2="20" y2="80" />
              <line x1="130" y1="110" x2="180" y2="80" />
              <line x1="80" y1="190" x2="50" y2="300" />
              <line x1="120" y1="190" x2="150" y2="300" />
            </svg>
          </div>
        </div>

        <div className="play-stage__beat-lane" aria-hidden="true">
          {Array.from({ length: 6 }, (_, laneIndex) => (
            <span
              key={laneIndex}
              className={`play-stage__beat-lane-slot${
                judgementCue?.lane === laneIndex ? ' is-active' : ''
              }${judgementCue?.lane === laneIndex ? ` is-${judgementCue.tone}` : ''}${
                judgementCue?.lane === laneIndex && judgementCue.accent ? ' is-accent' : ''
              }`}
            />
          ))}
        </div>

        {playState === 'playing' && judgementCue ? (
          <>
            <div className={`play-stage__judgement-flash play-stage__judgement-flash--${judgementCue.tone}`} />
            <div className={`play-stage__judgement play-stage__judgement--${judgementCue.tone}`} key={judgementCue.id}>
              <span className="play-stage__judgement-second">{String(judgementCue.second + 1).padStart(2, '0')} SEC</span>
              <strong>{judgementCue.label}</strong>
              <span className="play-stage__judgement-guide">{judgementCue.guide}</span>
              <span className="play-stage__judgement-meta">
                {judgementCue.source === 'timeline-preview' ? 'TIMELINE PREVIEW' : 'MOTION ANALYSIS'} ·{' '}
                {formatOffsetMs(judgementCue.offsetMs)}
              </span>
              <span className="play-stage__judgement-combo">{judgementCue.combo} COMBO</span>
            </div>
          </>
        ) : null}

        {playState === 'idle' ? (
          <div className="play-stage__overlay">
            <button type="button" className="play-stage__start-btn" onClick={() => void startGame()}>
              Start challenge
            </button>
          </div>
        ) : null}

        {playState === 'countdown' ? (
          <div className="play-stage__overlay" key={countdownNumber}>
            <span className="play-stage__countdown">{countdownNumber}</span>
          </div>
        ) : null}
      </div>

      {playState === 'clear' ? (
        <div className="play-stage__clear-overlay">
          <span className="play-stage__clear-text">Challenge Clear</span>
        </div>
      ) : null}

      {playState === 'analyzing' ? (
        <div className="play-stage__analyzing-overlay">
          <div className="play-stage__analyzing-panel">
            <span className="play-stage__analyzing-eyebrow">Analyzing</span>
            <h2>{flowMode === 'test' ? '테스트 결과를 정리하고 있습니다.' : '실제 플레이 영상을 업로드하고 분석하고 있습니다.'}</h2>
            <p>
              {flowMode === 'test'
                ? '카메라 없이 플레이 흐름만 확인한 테스트 결과입니다.'
                : '업로드가 끝나면 자동채점 결과 페이지로 바로 이동합니다.'}
            </p>

            <div className="play-stage__analysis-list">
              {analysisSteps.map((step) => (
                <div className="play-stage__analysis-item" key={step}>
                  <span className="play-stage__analysis-dot" />
                  <span>{step}</span>
                </div>
              ))}
            </div>

            {resultError ? <p className="play-stage__analysis-error">{resultError}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function resolveRecordingMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  return RECORDING_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? '';
}

function formatDurationLabel(durationSec: number) {
  if (durationSec < 60) {
    return `${durationSec}s`;
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function formatAreaLabel(value: AttemptSummary['strongestArea'] | undefined) {
  if (!value) {
    return 'None';
  }

  if (value === 'pose shape') {
    return 'Pose shape';
  }
  if (value === 'pose timing') {
    return 'Timing';
  }
  if (value === 'detection quality') {
    return 'Detection quality';
  }

  return value;
}

function formatOffsetMs(offsetMs: number) {
  if (offsetMs === 0) {
    return 'ON TIME';
  }

  return `${offsetMs > 0 ? '+' : ''}${offsetMs}ms`;
}
