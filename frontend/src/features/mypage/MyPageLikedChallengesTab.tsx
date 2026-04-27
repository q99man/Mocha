import { Fragment } from 'react';
import { Link } from 'react-router-dom';

import { IconDelete, IconView } from '../../shared/components/AdminIcons';
import { Pagination } from '../../shared/components/Pagination';
import type { Challenge } from '../../shared/types/challenge';

type MyPageLikedChallengesTabProps = {
  pagedChallenges: Challenge[];
  expandedChallengeId: number | null;
  likedPage: number;
  likedTotalPages: number;
  unlikeBusyIds: Set<number>;
  onLikedPageChange: (page: number) => void;
  onToggleChallenge: (challengeId: number) => void;
  onUnlikeChallenge: (challengeId: number) => void;
  formatDuration: (durationSec: number) => string;
  formatDifficulty: (value: string) => string | number;
};

export function MyPageLikedChallengesTab({
  pagedChallenges,
  expandedChallengeId,
  likedPage,
  likedTotalPages,
  unlikeBusyIds,
  onLikedPageChange,
  onToggleChallenge,
  onUnlikeChallenge,
  formatDuration,
  formatDifficulty,
}: MyPageLikedChallengesTabProps) {
  return (
    <>
      {pagedChallenges.length === 0 ? (
        <div className="glass-panel glass-panel--nested glass-panel--empty">
          <strong>좋아요한 챌린지가 아직 없습니다.</strong>
        </div>
      ) : (
        <div className="admin-hub-compact-table mypage-compact-table">
          <div className="admin-hub-compact-table__head mypage-compact-table__head mypage-compact-table__head--likes" role="presentation">
            <span>난이도</span>
            <span>제목</span>
            <span>좋아요</span>
          </div>

          <div className="mypage-compact-table__body">
            {pagedChallenges.map((challenge) => {
              const isExpanded = expandedChallengeId === challenge.id;

              return (
                <Fragment key={challenge.id}>
                  <article
                    className={`admin-hub-compact-row mypage-compact-row mypage-compact-row--likes${isExpanded ? ' is-expanded' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleChallenge(challenge.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onToggleChallenge(challenge.id);
                      }
                    }}
                  >
                    <div className="mypage-compact-row__status">
                      <span className="board-compact-badge">{formatDifficulty(challenge.difficulty)}</span>
                    </div>
                    <div className="mypage-compact-row__title">
                      <span className="mypage-inline-trigger">{challenge.title}</span>
                    </div>
                    <div className="mypage-compact-row__metric mypage-compact-row__metric--like">♥ {challenge.likeCount}</div>
                  </article>

                  {isExpanded ? (
                    <section className="mypage-inline-detail">
                      <div className="mypage-inline-detail__header">
                        <div>
                          <strong>{challenge.title}</strong>
                          <div className="mypage-inline-meta">
                        <span>카테고리 {challenge.category}</span>
                        <span>챌린지 시간 {formatDuration(challenge.durationSec)}</span>
                        <span>좋아요 {challenge.likeCount}</span>
                      </div>
                        </div>
                        <div className="admin-action-group admin-action-group--inline mypage-liked-challenge__actions">
                          <Link
                            className="button-link button-link--secondary button-link--compact admin-action-button"
                            to={`/challenges?challengeId=${challenge.id}`}
                          >
                            <IconView />
                            <span>챌린지 보기</span>
                          </Link>
                          <button
                            className="button-link button-link--secondary button-link--compact admin-action-button admin-hub-compact__action-btn--danger"
                            type="button"
                            disabled={unlikeBusyIds.has(challenge.id)}
                            onClick={() => onUnlikeChallenge(challenge.id)}
                          >
                            <IconDelete />
                            <span>{unlikeBusyIds.has(challenge.id) ? '처리 중...' : '삭제'}</span>
                          </button>
                        </div>
                      </div>
                      
                      <article className="mypage-inline-content">{challenge.description}</article>
                    </section>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      <Pagination currentPage={likedPage} totalPages={likedTotalPages} onPageChange={onLikedPageChange} />
    </>
  );
}
