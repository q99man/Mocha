import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAttemptById } from '../shared/api/attemptApi';
import type { AttemptSummary } from '../shared/types/attempt';

export function AttemptResultPage() {
  const { id = '' } = useParams();
  const [attempt, setAttempt] = useState<AttemptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAttempt() {
      setLoading(true);
      setError(null);

      try {
        const response = await getAttemptById(id);
        if (active) {
          setAttempt(response);
        }
      } catch (loadError) {
        if (active) {
          setAttempt(null);
          setError(loadError instanceof Error ? loadError.message : '결과 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadAttempt();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <section className="panel">
        <p>결과 화면을 준비하는 중입니다...</p>
      </section>
    );
  }

  if (error || !attempt) {
    return (
      <section className="panel panel--error">
        <h2>결과 화면을 불러올 수 없습니다</h2>
        <p>{error ?? '선택한 기록을 찾을 수 없습니다.'}</p>
        <Link className="button-link" to="/attempts">
          기록 목록으로 이동
        </Link>
      </section>
    );
  }

  return (
    <div className="page">
      <section className="panel result-shell">
        <span className="hero__eyebrow">도전 결과</span>
        <h2>{attempt.challengeTitle}</h2>
        <p>{attempt.resultSummary}</p>
        <div className="stat-row">
          <div className="stat-card">
            <strong>기록 상태</strong>
            <p>{attempt.status}</p>
          </div>
          <div className="stat-card">
            <strong>현재 점수</strong>
            <p>{attempt.score}점</p>
          </div>
          <div className="stat-card">
            <strong>점수 사용 가능 여부</strong>
            <p>{attempt.scoreAvailable ? '점수 사용 가능' : '점수 준비 중'}</p>
          </div>
          <div className="stat-card">
            <strong>저장 시각</strong>
            <p>{new Date(attempt.attemptedAt).toLocaleString('ko-KR')}</p>
          </div>
        </div>
        <div className="result-shell__banner">
          <strong>{attempt.resultHeadline}</strong>
          <p>
            {attempt.scoreAvailable
              ? '이제 실제 피드백 필드만 추가되면 같은 결과 화면에서 더 풍부한 안내를 보여줄 수 있습니다.'
              : '지금은 준비 단계 기록이지만, 이후 실제 채점 결과도 같은 결과 화면 구조 안에서 이어서 보여줄 수 있습니다.'}
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>지금 할 수 있는 일</h2>
        <div className="result-actions-grid">
          <div className="result-action-card">
            <strong>같은 챌린지 다시 준비하기</strong>
            <p>카메라 준비 화면으로 돌아가 시도 비디오 업로드나 준비 상태 저장을 다시 확인할 수 있습니다.</p>
            <Link className="button-link" to={`/challenges/${attempt.challengeId}/start`}>
              다시 준비하기
            </Link>
          </div>
          <div className="result-action-card">
            <strong>기록 목록에서 비교하기</strong>
            <p>지금까지 저장한 준비 기록과 완료 기록을 한 번에 비교할 수 있습니다.</p>
            <Link className="button-link button-link--secondary" to="/attempts">
              기록 목록 보기
            </Link>
          </div>
          <div className="result-action-card">
            <strong>챌린지 상세로 돌아가기</strong>
            <p>가이드와 챌린지 설명을 다시 확인하고 시작 흐름으로 돌아갈 수 있습니다.</p>
            <Link className="button-link button-link--secondary" to={`/challenges/${attempt.challengeId}`}>
              챌린지 상세 보기
            </Link>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>다음 단계 안내</h2>
        <ul className="detail-list">
          <li>
            <strong>현재 상태 확인</strong>
            {attempt.status === '준비됨'
              ? '이 기록은 카메라 준비 또는 업로드 전 단계의 흐름을 저장한 상태입니다.'
              : '이 기록은 자동 채점이 반영된 완료 결과이거나, 현재 MVP의 샘플 완료 결과입니다.'}
          </li>
          <li>
            <strong>최소 결과 계약</strong>
            현재 결과 화면은 상태, 점수, 점수 사용 가능 여부, 헤드라인, 요약 문구를 공통 payload로 사용합니다.
          </li>
          <li>
            <strong>다음 확장 방향</strong>
            이후 단계에서는 같은 payload에 실제 유사도 점수, 자세 피드백, 비교 포인트만 추가하면 됩니다.
          </li>
        </ul>
      </section>
    </div>
  );
}
