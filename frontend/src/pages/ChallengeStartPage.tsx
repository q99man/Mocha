import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import '../features/challenges/challenge-play.css';
import { getChallengeById } from '../shared/api/challengeApi';
import { resolveApiUrl } from '../shared/api/client';
import type { Challenge } from '../shared/types/challenge';

type PlayState = 'idle' | 'countdown' | 'playing' | 'clear' | 'result';

const FULLSCREEN_STATES: PlayState[] = ['idle', 'countdown', 'playing', 'clear', 'result'];

export function ChallengeStartPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Play state ── */
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [countdownNumber, setCountdownNumber] = useState(3);
  const [progress, setProgress] = useState(0);

  /* ── Camera ── */
  const [cameraReady, setCameraReady] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  /* ── Reference video ── */
  const refVideoRef = useRef<HTMLVideoElement | null>(null);

  /* ── Timers ── */
  const progressIntervalRef = useRef<number | null>(null);

  /* ── Load challenge ── */
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
          setError(loadError instanceof Error ? loadError.message : '챌린지 시작 화면을 불러오지 못했습니다.');
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

  /* ── Attempt camera on mount + hide header ── */
  useEffect(() => {
    void requestCamera();

    /* Hide header/layout when entering play mode */
    document.body.classList.add('body--play-fullscreen');

    return () => {
      stopCamera();
      document.body.classList.remove('body--play-fullscreen');
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  async function requestCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      cameraStreamRef.current = stream;

      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
      }

      setCameraReady(true);
    } catch {
      /* Camera not available — proceed without it */
    }
  }

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
  }

  /* ── Start game sequence ── */
  const startGame = useCallback(() => {
    setPlayState('countdown');
    setCountdownNumber(3);

    let count = 3;
    const countdownInterval = window.setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNumber(count);
      } else {
        window.clearInterval(countdownInterval);
        setPlayState('playing');

        if (refVideoRef.current) {
          void refVideoRef.current.play();
        }

        const durationSec = challenge?.durationSec ?? 30;
        const startTime = Date.now();
        progressIntervalRef.current = window.setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          const pct = Math.min(100, (elapsed / durationSec) * 100);
          setProgress(pct);

          if (pct >= 100) {
            if (progressIntervalRef.current) {
              window.clearInterval(progressIntervalRef.current);
            }
            handlePlayComplete();
          }
        }, 100);
      }
    }, 1000);
  }, [challenge?.durationSec]);

  function handlePlayComplete() {
    /* Pause reference video */
    if (refVideoRef.current) {
      refVideoRef.current.pause();
    }

    /* Show STAGE CLEAR */
    setPlayState('clear');

    /* Transition to result screen after STAGE CLEAR animation */
    setTimeout(() => {
      setPlayState('result');
      stopCamera();
    }, 2500);
  }

  /* ── Exit ── */
  function handleExit() {
    stopCamera();
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
    }
    void navigate(`/challenges/${id}`);
  }

  /* ── Derived ── */
  const latestScoreLabel = useMemo(() => {
    if (!challenge?.latestRetrySummary) {
      return '기록 없음';
    }
    return `${challenge.latestRetrySummary.latestScore}점`;
  }, [challenge?.latestRetrySummary]);

  const rawVideoUrl = challenge?.guideVideoUrl ?? challenge?.fallbackThumbnailVideoUrl ?? null;
  const referenceVideoUrl = rawVideoUrl ? resolveApiUrl(rawVideoUrl) : null;

  /* ── Result data (from latestRetrySummary or simulated) ── */
  const retry = challenge?.latestRetrySummary;
  const resultScore = retry?.latestScore ?? 0;
  const resultRate = resultScore > 0 ? ((resultScore / 1000000) * 100).toFixed(2) : '0.00';
  const scoreDelta = retry?.scoreDeltaFromPrevious;
  const isNewRecord = scoreDelta != null && scoreDelta > 0;

  /* ── Loading / Error states ── */
  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>시작 화면을 준비하는 중입니다.</strong>
          <p>챌린지 상태와 업로드 가능 여부를 확인하고 있습니다.</p>
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

  const challengeReady = challenge.referenceVideoUploaded && challenge.referenceMotionProfileReady;

  if (!challengeReady) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>아직 바로 시작할 수 없는 챌린지입니다.</strong>
          <p>레퍼런스 영상과 모션 프로필이 준비되어야 실제 시도 업로드를 시작할 수 있습니다.</p>
          <div className="glass-inline-meta">
            <span>레퍼런스 영상 {challenge.referenceVideoUploaded ? '준비됨' : '없음'}</span>
            <span>모션 프로필 {challenge.referenceMotionProfileReady ? '준비됨' : '대기'}</span>
            <span>분석 상태 {challenge.referenceAnalysisStatus}</span>
          </div>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/challenges/${challenge.id}`}>
              상세 보기
            </Link>
          </div>
        </div>
      </section>
    );
  }

  /* ═════ RESULT SCREEN ═════ */
  if (playState === 'result') {
    return (
      <div className="play-result">
        {/* Left: Judgement Details */}
        <div className="play-result__left">
          <div className="play-result__mode-label">
            <span>MOTION CHALLENGE</span>
          </div>

          <h3 className="play-result__judgement-title">JUDGEMENT DETAILS</h3>

          <div className="play-result__judgement-table">
            <span className="play-result__judgement-label play-result__judgement-label--accent">포즈 형태</span>
            <span className="play-result__judgement-value">{retry?.strongestArea === 'pose shape' ? '★' : '-'}</span>

            <span className="play-result__judgement-label play-result__judgement-label--accent">타이밍</span>
            <span className="play-result__judgement-value">{retry?.strongestArea === 'pose timing' ? '★' : '-'}</span>

            <span className="play-result__judgement-label play-result__judgement-label--accent">인식 안정성</span>
            <span className="play-result__judgement-value">{retry?.strongestArea === 'detection quality' ? '★' : '-'}</span>
          </div>

          <div className="play-result__meta-section">
            <h4 className="play-result__meta-title">CHALLENGE</h4>
            <span className="play-result__meta-value">{challenge.title}</span>
          </div>

          <div className="play-result__meta-section">
            <h4 className="play-result__meta-title">DIFFICULTY</h4>
            <span className="play-result__meta-value">{challenge.difficulty}</span>
          </div>

          <div className="play-result__meta-section">
            <h4 className="play-result__meta-title">CATEGORY</h4>
            <span className="play-result__meta-value">{challenge.category}</span>
          </div>
        </div>

        {/* Right: Score display */}
        <div className="play-result__right">
          {/* Stats ring around circle */}
          <div className="play-result__stat-ring">
            <div className="play-result__stat-item">
              <span>BREAK</span>
              <strong>{retry?.weakestArea ? '1' : '0'}</strong>
            </div>
            <div className="play-result__stat-item">
              <span>BEST COMBO</span>
              <strong>{resultScore}</strong>
            </div>
          </div>

          {/* Score circle */}
          <div className="play-result__score-circle">
            <span className="play-result__rate">{resultRate}%</span>
            <span className="play-result__rate-delta">▲ {resultRate}%</span>
          </div>

          {/* Main score */}
          <div className="play-result__score-block">
            <span className="play-result__score-label">SCORE</span>
            <span className="play-result__score-number">{resultScore}</span>
            {scoreDelta != null && (
              <span className="play-result__score-delta">
                {scoreDelta >= 0 ? '▲' : '▼'} {Math.abs(scoreDelta)}
              </span>
            )}
          </div>

          {/* NEW RECORD */}
          {isNewRecord && (
            <span className="play-result__new-record">NEW RECORD</span>
          )}

          {/* Actions */}
          <div className="play-result__actions">
            <button
              type="button"
              className="play-result__action-btn"
              onClick={() => {
                setPlayState('idle');
                setProgress(0);
                void requestCamera();
              }}
            >
              다시 도전
            </button>
            <Link
              className="play-result__action-btn play-result__action-btn--secondary"
              to={`/challenges/${challenge.id}`}
            >
              상세 보기
            </Link>
            <Link
              className="play-result__action-btn play-result__action-btn--secondary"
              to="/challenges"
            >
              목록으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ═════ DJMAX PLAY SCREEN ═════ */
  return (
    <>
      <div className="play-stage">
        {/* ── Left Pane: Reference Video ── */}
        <div className="play-stage__left">
          <span className="play-stage__gear-label">JÖRMUNGANDR</span>

          <button
            type="button"
            className="play-stage__exit"
            onClick={handleExit}
          >
            ← 나가기
          </button>

          <div className="play-stage__video-wrap">
            {referenceVideoUrl ? (
              <video
                ref={refVideoRef}
                src={referenceVideoUrl}
                className="play-stage__video"
                playsInline
                preload="auto"
              />
            ) : (
              <div className="play-stage__video--placeholder">
                <span>{challenge.title}</span>
              </div>
            )}
          </div>

          <div className="play-stage__info">
            <span>{challenge.category}</span>
            <strong>{challenge.difficulty}</strong>
            <span>{formatDurationLabel(challenge.durationSec)}</span>
            <span>최근 {latestScoreLabel}</span>
          </div>

          {/* Progress gauge */}
          <div className="play-stage__gauge">
            <div
              className="play-stage__gauge-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* ── Right Pane: Camera ── */}
        <div className="play-stage__right">
          <div className="play-stage__rec">
            <span
              className={`play-stage__rec-dot${playState === 'playing' ? ' play-stage__rec-dot--active' : ''}`}
            />
            {playState === 'playing' ? '녹화 중' : '녹화 대기'}
          </div>

          {cameraReady ? (
            <video
              ref={cameraVideoRef}
              className="play-stage__camera"
              autoPlay
              muted
              playsInline
            />
          ) : (
            <div className="play-stage__camera-placeholder">
              <span>📷</span>
              <span>카메라 연결 대기</span>
            </div>
          )}

          {/* Stick figure guide overlay */}
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

        {/* ── Center overlay: Start / Countdown ── */}
        {playState === 'idle' && (
          <div className="play-stage__overlay">
            <button
              type="button"
              className="play-stage__start-btn"
              onClick={startGame}
            >
              GAME START
            </button>
          </div>
        )}

        {playState === 'countdown' && (
          <div className="play-stage__overlay" key={countdownNumber}>
            <span className="play-stage__countdown">{countdownNumber}</span>
          </div>
        )}
      </div>

      {/* ── Stage Clear overlay ── */}
      {playState === 'clear' && (
        <div className="play-stage__clear-overlay">
          <span className="play-stage__clear-text">STAGE CLEAR</span>
        </div>
      )}
    </>
  );
}

function formatDurationLabel(durationSec: number) {
  if (durationSec < 60) {
    return `${durationSec}초`;
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;

  if (seconds === 0) {
    return `${minutes}분`;
  }

  return `${minutes}분 ${seconds}초`;
}
