import { Link } from 'react-router-dom';

import { IconDelete, IconView } from '../../shared/components/AdminIcons';
import { Pagination } from '../../shared/components/Pagination';
import type { Challenge } from '../../shared/types/challenge';

type MyPageLikedChallengesTabProps = {
  pagedChallenges: Challenge[];
  likedPage: number;
  likedTotalPages: number;
  unlikeBusyIds: Set<number>;
  onLikedPageChange: (page: number) => void;
  onUnlikeChallenge: (challengeId: number) => void;
  formatDuration: (durationSec: number) => string;
  formatDifficulty: (value: string) => string | number;
};

export function MyPageLikedChallengesTab({
  pagedChallenges,
  likedPage,
  likedTotalPages,
  unlikeBusyIds,
  onLikedPageChange,
  onUnlikeChallenge,
  formatDuration,
  formatDifficulty,
}: MyPageLikedChallengesTabProps) {
  return (
    <>
      {pagedChallenges.length === 0 ? (
        <div className="glass-panel glass-panel--nested glass-panel--empty">
          <strong>좋아요한 챌린지가 아직 없습니다.</strong>
          <p>마음에 드는 챌린지의 하트를 눌러두면 여기에서 바로 다시 찾을 수 있습니다.</p>
        </div>
      ) : (
        <div className="admin-hub-compact-table mypage-compact-table">
          <div className="admin-hub-compact-table__head mypage-compact-table__head mypage-compact-table__head--likes" role="presentation">
            <span>난이도</span>
            <span>챌린지</span>
            <span>좋아요</span>
            <span>동작</span>
          </div>

          <div className="mypage-compact-table__body">
            {pagedChallenges.map((challenge) => (
              <article key={challenge.id} className="admin-hub-compact-row mypage-compact-row mypage-compact-row--likes">
                <div className="mypage-compact-row__status">
                  <span className="board-compact-badge">{formatDifficulty(challenge.difficulty)}</span>
                </div>
                <div className="mypage-compact-row__title">
                  <Link to={`/challenges?challengeId=${challenge.id}`}>{challenge.title}</Link>
                  <span className="mypage-liked-challenge__meta">
                    {challenge.category} · {formatDuration(challenge.durationSec)}
                  </span>
                </div>
                <div className="mypage-compact-row__metric">♥ {challenge.likeCount}</div>
                <div className="admin-action-group admin-action-group--inline mypage-liked-challenge__actions">
                  <Link
                    className="button-link button-link--secondary button-link--compact admin-action-button"
                    to={`/challenges?challengeId=${challenge.id}`}
                  >
                    <IconView />
                    <span>보기</span>
                  </Link>
                  <button
                    className="button-link button-link--secondary button-link--compact admin-action-button admin-hub-compact__action-btn--danger"
                    type="button"
                    disabled={unlikeBusyIds.has(challenge.id)}
                    onClick={() => onUnlikeChallenge(challenge.id)}
                  >
                    <IconDelete />
                    <span>{unlikeBusyIds.has(challenge.id) ? '처리 중...' : '취소'}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <Pagination currentPage={likedPage} totalPages={likedTotalPages} onPageChange={onLikedPageChange} />
    </>
  );
}
