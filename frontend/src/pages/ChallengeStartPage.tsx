import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import '../features/challenges/challenge-play.css';
import { createAttempt } from '../shared/api/attemptApi';
import { getChallengeById } from '../shared/api/challengeApi';
import { resolveApiUrl } from '../shared/api/client';
import type { AttemptSummary } from '../shared/types/attempt';
import type { Challenge } from '../shared/types/challenge';

type FlowMode = 'camera' | 'test';
type PlayState = 'idle' | 'countdown' | 'playing' | 'clear' | 'analyzing' | 'result';

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

  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const refVideoRef = useRef<HTMLVideoElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const transitionTimeoutRef = useRef<number | null>(null);

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
      stopCamera();
      document.body.classList.remove('body--play-fullscreen');
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
      }
      if (transitionTimeoutRef.current) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [stopCamera]);

  useEffect(() => {
    if (flowMode === 'camera' && playState === 'idle' && !cameraReady) {
      void requestCamera();
    }

    if (flowMode === 'test') {
      stopCamera();
    }
  }, [cameraReady, flowMode, playState, requestCamera, stopCamera]);

  const saveResult = useCallback(async () => {
    if (!challenge) {
      setResultError('결과를 저장할 챌린지 정보를 확인할 수 없습니다.');
      setSavingResult(false);
      setPlayState('result');
      return;
    }

    setSavingResult(true);
    setResultError(null);

    try {
      const attempt = await createAttempt({
        challengeId: challenge.id,
        score: 0,
        notes:
          flowMode === 'test'
            ? '테스트 모드 결과입니다. 카메라 없이 진행되어 비교 데이터가 생성되지 않았고 점수는 0점으로 처리되었습니다.'
            : '플레이 결과 연결 단계에서 생성된 임시 기록입니다. 현재는 0점으로 저장됩니다.',
        recordType: 'completed',
      });

      setResultAttempt(attempt);
    } catch (saveError) {
      setResultError(saveError instanceof Error ? saveError.message : '결과를 저장하지 못했습니다.');
    } finally {
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      setSavingResult(false);
      setPlayState('result');
    }
  }, [challenge, flowMode]);

  const handlePlayComplete = useCallback(() => {
    if (refVideoRef.current) {
      refVideoRef.current.pause();
      refVideoRef.current.currentTime = 0;
    }

    setPlayState('clear');

    transitionTimeoutRef.current = window.setTimeout(() => {
      stopCamera();
      setPlayState('analyzing');
      void saveResult();
    }, 1800);
  }, [saveResult, stopCamera]);

  const startGame = useCallback(() => {
    setPlayState('countdown');
    setCountdownNumber(3);
    setProgress(0);
    setResultAttempt(null);
    setResultError(null);

    let count = 3;
    const countdownInterval = window.setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdownNumber(count);
        return;
      }

      window.clearInterval(countdownInterval);
      setPlayState('playing');

      if (refVideoRef.current) {
        void refVideoRef.current.play();
      }

      const durationSec = challenge?.durationSec ?? 30;
      const startTime = Date.now();
      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const percent = Math.min(100, (elapsed / durationSec) * 100);
        setProgress(percent);

        if (percent >= 100) {
          if (progressIntervalRef.current) {
            window.clearInterval(progressIntervalRef.current);
          }
          handlePlayComplete();
        }
      }, 100);
    }, 1000);
  }, [challenge?.durationSec, handlePlayComplete]);

  function handleExit() {
    stopCamera();
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
    }
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
    }
    void navigate(`/challenges?challengeId=${id}`);
  }

  function handleRetry() {
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
    }
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
    }

    setPlayState('idle');
    setCountdownNumber(3);
    setProgress(0);
    setSavingResult(false);
    setResultAttempt(null);
    setResultError(null);

    if (flowMode === 'camera') {
      void requestCamera();
    } else {
      stopCamera();
    }
  }

  const latestScoreLabel = useMemo(() => {
    if (!challenge?.latestRetrySummary) {
      return '기록 없음';
    }
    return `${challenge.latestRetrySummary.latestScore}점`;
  }, [challenge?.latestRetrySummary]);

  const rawVideoUrl = challenge?.guideVideoUrl ?? challenge?.fallbackThumbnailVideoUrl ?? null;
  const referenceVideoUrl = rawVideoUrl ? resolveApiUrl(rawVideoUrl) : null;
  const challengeReady = challenge?.referenceVideoUploaded && challenge.referenceMotionProfileReady;

  const resultScore = resultAttempt?.score ?? 0;
  const resultRate = `${resultScore.toFixed(2)}%`;
  const resultHeadline = flowMode === 'test' ? '테스트 모드 결과가 준비되었습니다.' : '플레이 결과가 준비되었습니다.';
  const resultSummary =
    resultError ??
    (flowMode === 'test'
      ? '카메라 없이 진행된 테스트 기록입니다. 비교 데이터는 생성되지 않았고 점수는 0점으로 처리되었습니다.'
      : resultAttempt?.resultSummary ?? '현재는 플레이 흐름 연결 단계라 임시 결과로 저장되었습니다.');
  const scoreDelta = resultAttempt?.scoreDeltaFromPrevious;
  const isNewRecord = scoreDelta != null && scoreDelta > 0;
  const analysisSteps = [
    '레퍼런스 진행 구간을 정리하고 있습니다.',
    flowMode === 'test' ? '카메라 입력 없이 테스트 결과를 생성하고 있습니다.' : '촬영 화면과 결과 흐름을 연결하고 있습니다.',
    savingResult ? '결과 기록을 저장하는 중입니다.' : '결과 화면을 준비하고 있습니다.',
  ];

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>플레이 화면을 준비하고 있습니다.</strong>
          <p>챌린지 상태와 재생 정보를 확인하고 있습니다.</p>
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
          <strong>아직 바로 도전할 수 없는 챌린지입니다.</strong>
          <p>레퍼런스 영상과 모션 프로필이 준비되어야 실제 도전이 가능합니다.</p>
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
            <span>{flowMode === 'test' ? '테스트 모드' : '카메라 모드'}</span>
          </div>

          <h3 className="play-result__judgement-title">결과 분석</h3>

          <div className="play-result__judgement-table">
            <span className="play-result__judgement-label play-result__judgement-label--accent">진행 방식</span>
            <span className="play-result__judgement-value">{flowMode === 'test' ? '테스트' : '실시간 촬영'}</span>

            <span className="play-result__judgement-label play-result__judgement-label--accent">강점</span>
            <span className="play-result__judgement-value">{formatAreaLabel(resultAttempt?.strongestArea)}</span>

            <span className="play-result__judgement-label play-result__judgement-label--accent">보완</span>
            <span className="play-result__judgement-value">{formatAreaLabel(resultAttempt?.weakestArea)}</span>
          </div>

          <div className="play-result__summary-card">
            <strong>{resultHeadline}</strong>
            <p>{resultSummary}</p>
            {resultAttempt ? <span>기록 번호 {String(resultAttempt.id).padStart(3, '0')}</span> : null}
          </div>

          <div className="play-result__meta-section">
            <h4 className="play-result__meta-title">챌린지</h4>
            <span className="play-result__meta-value">{challenge.title}</span>
          </div>

          <div className="play-result__meta-section">
            <h4 className="play-result__meta-title">난이도</h4>
            <span className="play-result__meta-value">{challenge.difficulty}</span>
          </div>

          <div className="play-result__meta-section">
            <h4 className="play-result__meta-title">카테고리</h4>
            <span className="play-result__meta-value">{challenge.category}</span>
          </div>
        </div>

        <div className="play-result__right">
          <div className="play-result__stat-ring">
            <div className="play-result__stat-item">
              <span>진행</span>
              <strong>{flowMode === 'test' ? '테스트' : '촬영'}</strong>
            </div>
            <div className="play-result__stat-item">
              <span>상태</span>
              <strong>{resultAttempt ? '완료' : '대기'}</strong>
            </div>
          </div>

          <div className="play-result__score-circle">
            <span className="play-result__rate">{resultRate}</span>
            <span className="play-result__rate-delta">
              {flowMode === 'test' ? '카메라 입력 없음' : '결과 흐름 연결 완료'}
            </span>
          </div>

          <div className="play-result__score-block">
            <span className="play-result__score-label">점수</span>
            <span className="play-result__score-number">{resultScore}</span>
            {scoreDelta != null ? (
              <span className="play-result__score-delta">
                {scoreDelta >= 0 ? '+' : '-'} {Math.abs(scoreDelta)}
              </span>
            ) : null}
          </div>

          {isNewRecord ? <span className="play-result__new-record">최고 기록</span> : null}

          <div className="play-result__actions">
            {resultAttempt ? (
              <Link className="play-result__action-btn" to={`/attempts/${resultAttempt.id}/result`}>
                상세 결과 보기
              </Link>
            ) : null}
            <button
              type="button"
              className="play-result__action-btn play-result__action-btn--secondary"
              onClick={handleRetry}
            >
              다시 도전
            </button>
            <Link className="play-result__action-btn play-result__action-btn--secondary" to={`/challenges?challengeId=${challenge.id}`}>
              목록으로
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
          <span className="play-stage__gear-label">모션 챌린지</span>

          <button type="button" className="play-stage__exit" onClick={handleExit}>
            나가기
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
            <strong>{challenge.difficulty}</strong>
            <span>{formatDurationLabel(challenge.durationSec)}</span>
            <span>최근 기록 {latestScoreLabel}</span>
          </div>

          <div className="play-stage__gauge">
            <div className="play-stage__gauge-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="play-stage__right">
          <div className={`play-stage__mode-chip${flowMode === 'test' ? ' play-stage__mode-chip--test' : ''}`}>
            {flowMode === 'test' ? '테스트 모드' : '실시간 촬영'}
          </div>

          <div className="play-stage__rec">
            <span className={`play-stage__rec-dot${playState === 'playing' ? ' play-stage__rec-dot--active' : ''}`} />
            {playState === 'playing'
              ? flowMode === 'test'
                ? '테스트 진행 중'
                : '촬영 중'
              : flowMode === 'test'
                ? '테스트 대기'
                : '촬영 대기'}
          </div>

          {cameraReady && flowMode === 'camera' ? (
            <video ref={cameraVideoRef} className="play-stage__camera" autoPlay muted playsInline />
          ) : (
            <div className="play-stage__camera-placeholder">
              <span>{flowMode === 'test' ? '테스트' : '카메라'}</span>
              <span>{flowMode === 'test' ? '카메라 없이 진행되는 테스트 모드입니다.' : '카메라 연결을 기다리고 있습니다.'}</span>
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

        {playState === 'idle' ? (
          <div className="play-stage__overlay">
            <button type="button" className="play-stage__start-btn" onClick={startGame}>
              도전 시작
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
          <span className="play-stage__clear-text">챌린지 완료</span>
        </div>
      ) : null}

      {playState === 'analyzing' ? (
        <div className="play-stage__analyzing-overlay">
          <div className="play-stage__analyzing-panel">
            <span className="play-stage__analyzing-eyebrow">결과 분석 중</span>
            <h2>{flowMode === 'test' ? '테스트 결과를 정리하고 있습니다.' : '플레이 결과를 정리하고 있습니다.'}</h2>
            <p>
              {flowMode === 'test'
                ? '카메라 입력 없이 테스트 기록을 만들고 있습니다.'
                : '촬영 결과와 분석 흐름을 연결하고 있습니다.'}
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

function formatAreaLabel(value: AttemptSummary['strongestArea'] | undefined) {
  if (!value) {
    return '없음';
  }

  if (value === 'pose shape') {
    return '자세 형태';
  }
  if (value === 'pose timing') {
    return '타이밍';
  }
  if (value === 'detection quality') {
    return '인식 안정성';
  }

  return value;
}
