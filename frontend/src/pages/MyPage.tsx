import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { ReviewStars } from '../features/reviews/ReviewStars';
import { getAttempts } from '../shared/api/attemptApi';
import { getMyBoardPosts } from '../shared/api/boardApi';
import { getMyReviews } from '../shared/api/reviewApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { Pagination } from '../shared/components/Pagination';
import type { AttemptSummary } from '../shared/types/attempt';
import type { BoardPostSummary } from '../shared/types/board';
import type { Review } from '../shared/types/review';
import { ReviewList } from '../features/reviews/ReviewList';

const ATTEMPTS_PER_PAGE = 5;
const REVIEWS_PER_PAGE = 4;
const POSTS_PER_PAGE = 4;

export function MyPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [posts, setPosts] = useState<BoardPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptPage, setAttemptPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [postPage, setPostPage] = useState(1);
  const [postTotalCount, setPostTotalCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setLoading(true);
      setError(null);

      try {
        const [attemptResponse, reviewResponse] = await Promise.all([getAttempts(), getMyReviews()]);
        if (!active) {
          return;
        }

        setAttempts(attemptResponse);
        setReviews(reviewResponse);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '마이페이지 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPosts() {
      setPostsLoading(true);
      setError(null);

      try {
        const response = await getMyBoardPosts(postPage, POSTS_PER_PAGE);
        if (!active) {
          return;
        }

        setPosts(response.items);
        setPostTotalCount(response.totalCount);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '내 게시글 목록을 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setPostsLoading(false);
        }
      }
    }

    void loadPosts();

    return () => {
      active = false;
    };
  }, [postPage]);

  const summary = useMemo(() => {
    const bestAttempt = attempts.reduce<AttemptSummary | null>(
      (currentBest, attempt) => (!currentBest || attempt.score > currentBest.score ? attempt : currentBest),
      null,
    );

    return {
      totalAttempts: attempts.length,
      completedAttempts: attempts.filter((attempt) => attempt.status === 'Completed').length,
      reviewCount: reviews.length,
      postCount: postTotalCount,
      bestAttempt,
    };
  }, [attempts, postTotalCount, reviews]);

  const attemptTotalPages = Math.max(1, Math.ceil(attempts.length / ATTEMPTS_PER_PAGE));
  const reviewTotalPages = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE));
  const postTotalPages = Math.max(1, Math.ceil(postTotalCount / POSTS_PER_PAGE));

  useEffect(() => {
    if (attemptPage > attemptTotalPages) {
      setAttemptPage(attemptTotalPages);
    }
  }, [attemptPage, attemptTotalPages]);

  useEffect(() => {
    if (reviewPage > reviewTotalPages) {
      setReviewPage(reviewTotalPages);
    }
  }, [reviewPage, reviewTotalPages]);

  useEffect(() => {
    if (postPage > postTotalPages) {
      setPostPage(postTotalPages);
    }
  }, [postPage, postTotalPages]);

  const pagedAttempts = useMemo(() => {
    const startIndex = (attemptPage - 1) * ATTEMPTS_PER_PAGE;
    return attempts.slice(startIndex, startIndex + ATTEMPTS_PER_PAGE);
  }, [attemptPage, attempts]);

  const pagedReviews = useMemo(() => {
    const startIndex = (reviewPage - 1) * REVIEWS_PER_PAGE;
    return reviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);
  }, [reviewPage, reviews]);

  if (loading || postsLoading && postPage === 1) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>마이페이지를 준비하는 중입니다.</strong>
          <p>시도 기록, 후기, 게시글 활동을 함께 정리하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>마이페이지를 불러오지 못했습니다.</strong>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  return (
    <div className="glass-page">
      <section className="glass-intro">
        <div>
          <span className="glass-intro__eyebrow">My Page</span>
          <h2>{user?.displayName ?? '회원'}님의 활동 보드</h2>
          <p>시도 기록, 게시글, 후기만 남겨서 한 화면에서 필요한 활동 흐름을 빠르게 확인할 수 있게 정리했습니다.</p>
        </div>

        <div className="glass-intro__meta">
          <div>
            <span>시도</span>
            <strong>{String(summary.totalAttempts).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>게시글</span>
            <strong>{String(summary.postCount).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>후기</span>
            <strong>{String(summary.reviewCount).padStart(2, '0')}</strong>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div className="glass-inline-meta">
            {user?.email ? <span>{user.email}</span> : null}
            <span>최고 점수 {summary.bestAttempt ? `${summary.bestAttempt.score}점` : '없음'}</span>
            <span>{summary.bestAttempt?.challengeTitle ?? '아직 완료한 챌린지가 없습니다.'}</span>
          </div>

          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to="/board">
              게시판 보기
            </Link>
            <Link className="button-link" to="/board/new">
              게시글 작성
            </Link>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div>
            <h3 className="glass-section-title">최근 시도</h3>
            <p className="glass-toolbar__note">점수와 처리 상태 중심으로 빠르게 확인할 수 있게 유지했습니다.</p>
          </div>
        </div>

        {pagedAttempts.length === 0 ? (
          <div className="glass-panel glass-panel--nested glass-panel--empty">
            <strong>아직 시도 기록이 없습니다.</strong>
            <p>첫 챌린지를 시작하면 이 영역에서 최근 활동을 확인할 수 있습니다.</p>
          </div>
        ) : (
          <div className="glass-list">
            {pagedAttempts.map((attempt) => (
              <article className="glass-list-item" key={attempt.id}>
                <div className="glass-list-item__content">
                  <div className="glass-list-item__header">
                    <div>
                      <span className="glass-list-item__eyebrow">{formatDate(attempt.attemptedAt)}</span>
                      <strong>{attempt.challengeTitle}</strong>
                    </div>
                    <span className={`glass-badge${attempt.processingComplete ? ' is-accent' : ''}`}>
                      {attempt.processingComplete ? '결과 준비' : '처리 중'}
                    </span>
                  </div>

                  <div className="glass-inline-meta">
                    <span>{attempt.scoreAvailable ? `${attempt.score}점` : '점수 산출 중'}</span>
                    <span>{attempt.resultSource}</span>
                  </div>

                  <p className="glass-list-item__description">{attempt.resultHeadline || attempt.resultSummary}</p>
                </div>

                <div className="glass-list-item__actions">
                  <Link className="button-link" to={`/attempts/${attempt.id}/result`}>
                    결과 보기
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <Pagination currentPage={attemptPage} totalPages={attemptTotalPages} onPageChange={setAttemptPage} />
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div>
            <h3 className="glass-section-title">내 게시글</h3>
            <p className="glass-toolbar__note">작성한 게시글을 바로 열고 댓글 수와 조회 수를 함께 확인할 수 있습니다.</p>
          </div>
        </div>

        {postsLoading ? (
          <div className="glass-panel glass-panel--nested glass-panel--empty">
            <strong>내 게시글을 불러오는 중입니다.</strong>
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-panel glass-panel--nested glass-panel--empty">
            <strong>아직 작성한 게시글이 없습니다.</strong>
            <p>첫 게시글을 작성하면 여기에서 바로 관리할 수 있습니다.</p>
          </div>
        ) : (
          <div className="glass-list">
            {posts.map((post) => (
              <article className="glass-list-item" key={post.id}>
                <div className="glass-list-item__content">
                  <div className="glass-list-item__header">
                    <div>
                      <span className="glass-list-item__eyebrow">{toCategoryLabel(post.category)}</span>
                      <strong>{post.title}</strong>
                    </div>
                    <span className={`glass-badge${post.pinned ? ' is-accent' : ''}`}>
                      {post.sourceType === 'REVIEW_SYNC' ? '자동 후기' : post.pinned ? '고정' : '게시글'}
                    </span>
                  </div>

                  {post.sourceType === 'REVIEW_SYNC' ? (
                    <div className="board-review-inline">
                      {post.reviewRating ? <ReviewStars value={post.reviewRating} /> : null}
                      {post.challengeId && post.challengeTitle ? (
                        <Link className="board-review-inline__link" to={`/challenges/${post.challengeId}`}>
                          {post.challengeTitle}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="glass-list-item__description">{post.excerpt}</p>

                  <div className="glass-inline-meta">
                    <span>{formatDate(post.updatedAt)}</span>
                    <span>조회 {post.viewCount}</span>
                    <span>댓글 {post.commentCount}</span>
                  </div>
                </div>

                <div className="glass-list-item__actions">
                  <Link className="button-link button-link--secondary" to={`/board/${post.id}`}>
                    상세 보기
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <Pagination currentPage={postPage} totalPages={postTotalPages} onPageChange={setPostPage} />
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div>
            <h3 className="glass-section-title">내 후기</h3>
            <p className="glass-toolbar__note">후기는 챌린지 상세와 동일한 데이터로 연결되어 있습니다.</p>
          </div>
        </div>

        <ReviewList
          reviews={pagedReviews}
          emptyTitle="작성한 후기가 아직 없습니다."
          emptyDescription="챌린지에 참여한 뒤 상세 페이지에서 후기를 남겨 보세요."
          showChallengeLink
          showBoardLink
        />

        <Pagination currentPage={reviewPage} totalPages={reviewTotalPages} onPageChange={setReviewPage} />
      </section>
    </div>
  );
}

function toCategoryLabel(category: BoardPostSummary['category']) {
  switch (category) {
    case 'NOTICE':
      return '공지';
    case 'FREE':
      return '자유';
    case 'QNA':
      return '질문';
    case 'REVIEW':
      return '후기';
    default:
      return category;
  }
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
