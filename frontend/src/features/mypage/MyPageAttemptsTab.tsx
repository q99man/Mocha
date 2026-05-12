import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import { IconView } from '../../shared/components/AdminIcons';
import { Pagination } from '../../shared/components/Pagination';
import { normalizeAttemptMessage } from '../../shared/presentation/attemptMessages';
import type { AttemptSummary } from '../../shared/types/attempt';

type MyPageAttemptsTabProps = {
  pagedAttempts: AttemptSummary[];
  expandedAttemptId: number | null;
  attemptPage: number;
  attemptTotalPages: number;
  onToggleAttempt: (attemptId: number) => void;
  onAttemptPageChange: (page: number) => void;
  formatResultSource: (value: AttemptSummary['resultSource']) => string;
  formatDate: (value: string) => string;
  toAttemptAreaLabel: (
    value: AttemptSummary['strongestArea'] | AttemptSummary['weakestArea'],
    fallback: string,
  ) => string;
};

export function MyPageAttemptsTab({
  pagedAttempts,
  expandedAttemptId,
  attemptPage,
  attemptTotalPages,
  onToggleAttempt,
  onAttemptPageChange,
  formatResultSource,
  formatDate,
  toAttemptAreaLabel,
}: MyPageAttemptsTabProps) {
  return (
    <>
      {pagedAttempts.length === 0 ? (
        <div className="glass-panel glass-panel--nested glass-panel--empty">
          <strong>아직 저장된 기록이 없습니다.</strong>
        </div>
      ) : (
        <div className="admin-hub-compact-table mypage-compact-table">
          <div className="admin-hub-compact-table__head mypage-compact-table__head mypage-compact-table__head--attempts" role="presentation">
            <span>상태</span>
            <span>챌린지</span>
            <span>점수</span>
            <span>유형</span>
            <span>일시</span>
          </div>

          <div className="mypage-compact-table__body">
            {pagedAttempts.map((attempt) => {
              const isExpanded = expandedAttemptId === attempt.id;

              return (
                <Fragment key={attempt.id}>
                  <article
                    className={`admin-hub-compact-row mypage-compact-row mypage-compact-row--attempts${isExpanded ? ' is-expanded' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleAttempt(attempt.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onToggleAttempt(attempt.id);
                      }
                    }}
                  >
                    <div className="mypage-compact-row__status">
                      <span className={`board-classic-badge${attempt.processingComplete ? ' is-pinned' : ''}`}>
                        {attempt.processingComplete ? '완료' : '처리중'}
                      </span>
                    </div>
                    <div className="mypage-compact-row__title">
                      <button className="mypage-inline-trigger" type="button">
                        {attempt.challengeTitle}
                      </button>
                    </div>
                    <div className="mypage-compact-row__metric">{attempt.scoreAvailable ? `${attempt.score}점` : '-'}</div>
                    <div className="mypage-compact-row__meta">{formatResultSource(attempt.resultSource)}</div>
                    <div className="mypage-compact-row__date">{formatDate(attempt.attemptedAt)}</div>
                  </article>

                  {isExpanded ? (
                    <section className="mypage-inline-detail">
                      <div className="mypage-inline-detail__header">
                        <div>
                          <strong>{attempt.challengeTitle}</strong>
                          <p>
                            {attempt.processingComplete ? '완료된 기록' : '처리 중인 기록'} · 생성 {formatDate(attempt.attemptedAt)}
                          </p>
                        </div>
                        <div className="admin-action-group admin-action-group--inline">
                          <Link
                            className="button-link button-link--secondary button-link--compact admin-action-button"
                            to={`/challenges?challengeId=${attempt.challengeId}`}
                          >
                            <IconView />
                            <span>챌린지 보기</span>
                          </Link>
                        </div>
                      </div>

                      <div className="mypage-inline-meta">
                        <span>{attempt.scoreAvailable ? `점수 ${attempt.score}점` : '점수 산출 전'}</span>
                        <span>{formatResultSource(attempt.resultSource)}</span>
                        <span>{toAttemptAreaLabel(attempt.strongestArea, '강점 없음')}</span>
                        <span>{toAttemptAreaLabel(attempt.weakestArea, '보완 영역 없음')}</span>
                      </div>

                      <article className="mypage-inline-content">
                        {normalizeAttemptMessage(attempt.resultHeadline, '결과')}
                        {'\n'}
                        {'\n'}
                        {normalizeAttemptMessage(attempt.resultSummary, '결과 요약을 준비하지 못했습니다.')}
                        {attempt.coachingTeaser
                          ? `\n\n코칭: ${normalizeAttemptMessage(attempt.coachingTeaser, '다음 시도에서 다시 확인해 주세요.')}`
                          : ''}
                        {attempt.processingNotice
                          ? `\n\n안내: ${normalizeAttemptMessage(attempt.processingNotice, '분석 상태를 확인하는 중입니다.')}`
                          : ''}
                      </article>
                    </section>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      <Pagination currentPage={attemptPage} totalPages={attemptTotalPages} onPageChange={onAttemptPageChange} />
    </>
  );
}
