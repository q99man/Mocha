import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { formatDifficulty } from '../features/challenges/difficulty';
import { ReviewStars } from '../features/reviews/ReviewStars';
import { getAttempts } from '../shared/api/attemptApi';
import {
  createBoardPost,
  getBoardPost,
  getMyBoardPostsBySource,
  removeBoardPost,
  updateBoardPost,
} from '../shared/api/boardApi';
import { getChallenges } from '../shared/api/challengeApi';
import { getMyReviews, removeReview, updateReview } from '../shared/api/reviewApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { CompactSegmentedControl } from '../shared/components/CompactSegmentedControl';
import { Pagination } from '../shared/components/Pagination';
import { CompactConfirmDialog } from '../shared/components/CompactConfirmDialog';
import type { AttemptSummary } from '../shared/types/attempt';
import type { BoardPost, BoardPostInput, BoardPostSummary } from '../shared/types/board';
import type { Review, ReviewInput } from '../shared/types/review';

type MyPageTab = 'ATTEMPTS' | 'POSTS' | 'REVIEWS';

const ATTEMPTS_PER_PAGE = 10;
const REVIEWS_PER_PAGE = 10;
const POSTS_PER_PAGE = 10;

const INITIAL_POST_FORM: BoardPostInput = {
  category: 'FREE',
  title: '',
  content: '',
};

const INITIAL_REVIEW_FORM: ReviewInput = {
  rating: 5,
  content: '',
};
const POST_CATEGORY_OPTIONS: Array<{ value: BoardPostInput['category']; label: string }> = [
  { value: 'FREE', label: '자유' },
  { value: 'QNA', label: '질문' },
];

type MyPageConfirmState =
  | { type: 'none' }
  | { type: 'delete-post'; postId: number }
  | { type: 'delete-review'; reviewId: number };

export function MyPage() {
  const navigate = useNavigate();
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
  const [activeTab, setActiveTab] = useState<MyPageTab>('ATTEMPTS');
  const [postTotalCount, setPostTotalCount] = useState(0);
  const [challengeDifficultyById, setChallengeDifficultyById] = useState<Record<number, string>>({});

  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);
  const [postDetailsById, setPostDetailsById] = useState<Record<number, BoardPost>>({});
  const [postDetailLoadingId, setPostDetailLoadingId] = useState<number | null>(null);
  const [postDetailError, setPostDetailError] = useState<string | null>(null);

  const [creatingPost, setCreatingPost] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [postForm, setPostForm] = useState<BoardPostInput>(INITIAL_POST_FORM);
  const [postBusy, setPostBusy] = useState(false);
  const [postActionError, setPostActionError] = useState<string | null>(null);
  const [postActionSuccess, setPostActionSuccess] = useState<string | null>(null);

  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewInput>(INITIAL_REVIEW_FORM);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const [reviewActionSuccess, setReviewActionSuccess] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<MyPageConfirmState>({ type: 'none' });

  async function fetchPostsPage(page: number) {
    setPostsLoading(true);
    setError(null);

    try {
      const response = await getMyBoardPostsBySource(page, POSTS_PER_PAGE, 'GENERAL');
      setPosts(response.items);
      setPostTotalCount(response.totalCount);
      return response;
    } catch (loadError) {
      setPosts([]);
      setPostTotalCount(0);
      const message = loadError instanceof Error ? loadError.message : '게시글 목록을 불러오지 못했습니다.';
      setError(message);
      throw loadError;
    } finally {
      setPostsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setLoading(true);
      setError(null);

      try {
        const [attemptResponse, reviewResponse, challengeResponse] = await Promise.all([
          getAttempts(),
          getMyReviews(),
          getChallenges(),
        ]);

        if (!active) {
          return;
        }

        setAttempts(attemptResponse);
        setReviews(reviewResponse);
        setChallengeDifficultyById(
          Object.fromEntries(
            challengeResponse.map((challenge) => [challenge.id, formatDifficulty(challenge.difficulty)]),
          ),
        );
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

    void fetchPostsPage(postPage).catch(() => {
      if (!active) {
        return;
      }
    });

    return () => {
      active = false;
    };
  }, [postPage]);

  const latestAttempts = useMemo(() => {
    const latestAttemptByChallengeId = new Map<number, AttemptSummary>();

    for (const attempt of attempts) {
      const current = latestAttemptByChallengeId.get(attempt.challengeId);

      if (!current) {
        latestAttemptByChallengeId.set(attempt.challengeId, attempt);
        continue;
      }

      const currentTime = new Date(current.attemptedAt).getTime();
      const nextTime = new Date(attempt.attemptedAt).getTime();

      if (nextTime > currentTime || (nextTime === currentTime && attempt.id > current.id)) {
        latestAttemptByChallengeId.set(attempt.challengeId, attempt);
      }
    }

    return Array.from(latestAttemptByChallengeId.values()).sort((left, right) => {
      const rightTime = new Date(right.attemptedAt).getTime();
      const leftTime = new Date(left.attemptedAt).getTime();

      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return right.id - left.id;
    });
  }, [attempts]);

  const attemptTotalPages = Math.max(1, Math.ceil(latestAttempts.length / ATTEMPTS_PER_PAGE));
  const reviewTotalPages = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE));
  const postTotalPages = Math.max(1, Math.ceil(postTotalCount / POSTS_PER_PAGE));

  useEffect(() => {
    if (attemptPage > attemptTotalPages) {
      setAttemptPage(attemptTotalPages);
    }
  }, [attemptPage, attemptTotalPages]);

  useEffect(() => {
    if (expandedAttemptId != null && !latestAttempts.some((attempt) => attempt.id === expandedAttemptId)) {
      setExpandedAttemptId(null);
    }
  }, [expandedAttemptId, latestAttempts]);

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
    return latestAttempts.slice(startIndex, startIndex + ATTEMPTS_PER_PAGE);
  }, [attemptPage, latestAttempts]);

  const pagedReviews = useMemo(() => {
    const startIndex = (reviewPage - 1) * REVIEWS_PER_PAGE;
    return reviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);
  }, [reviewPage, reviews]);

  const tabOptions = useMemo(
    () => [
      { key: 'ATTEMPTS' as const, label: '내 기록', count: latestAttempts.length },
      { key: 'POSTS' as const, label: '내 게시글', count: postTotalCount },
      { key: 'REVIEWS' as const, label: '내 후기', count: reviews.length },
    ],
    [latestAttempts.length, postTotalCount, reviews.length],
  );

  const tabSummary = useMemo(() => {
    if (activeTab === 'ATTEMPTS') {
      return '내 기록 ' + latestAttempts.length + '개';
    }
    if (activeTab === 'POSTS') {
      return '내 게시글 ' + postTotalCount + '개';
    }
    return '내 후기 ' + reviews.length + '개';
  }, [activeTab, latestAttempts.length, postTotalCount, reviews.length]);

  function resetInlineStates() {
    setExpandedAttemptId(null);
    setExpandedPostId(null);
    setExpandedReviewId(null);
    setCreatingPost(false);
    setEditingPostId(null);
    setEditingReviewId(null);
    setPostActionError(null);
    setPostActionSuccess(null);
    setReviewActionError(null);
    setReviewActionSuccess(null);
    setConfirmState({ type: 'none' });
  }

  function handleAttemptRowToggle(attemptId: number) {
    setExpandedAttemptId((current) => (current === attemptId ? null : attemptId));
    setExpandedPostId(null);
    setExpandedReviewId(null);
    setCreatingPost(false);
    setEditingPostId(null);
    setEditingReviewId(null);
    setPostActionError(null);
    setPostActionSuccess(null);
    setReviewActionError(null);
    setReviewActionSuccess(null);
  }

  async function handlePostRowToggle(postId: number) {
    setPostActionError(null);
    setPostActionSuccess(null);
    setConfirmState({ type: 'none' });

    if (expandedPostId === postId) {
      setExpandedPostId(null);
      setEditingPostId(null);
      return;
    }

    setExpandedAttemptId(null);
    setExpandedPostId(postId);
    setExpandedReviewId(null);
    setCreatingPost(false);
    setEditingReviewId(null);
    setEditingPostId(null);

    if (postDetailsById[postId]) {
      return;
    }

    setPostDetailLoadingId(postId);
    setPostDetailError(null);

    try {
      const detail = await getBoardPost(postId);
      setPostDetailsById((current) => ({ ...current, [postId]: detail }));
    } catch (loadError) {
      setPostDetailError(loadError instanceof Error ? loadError.message : '게시글 상세를 불러오지 못했습니다.');
    } finally {
      setPostDetailLoadingId(null);
    }
  }

  function handleReviewRowToggle(reviewId: number) {
    setReviewActionError(null);
    setReviewActionSuccess(null);
    setConfirmState({ type: 'none' });

    if (expandedReviewId === reviewId) {
      setExpandedReviewId(null);
      setEditingReviewId(null);
      return;
    }

    setExpandedAttemptId(null);
    setExpandedReviewId(reviewId);
    setExpandedPostId(null);
    setCreatingPost(false);
    setEditingPostId(null);
    setEditingReviewId(null);
  }

  function handleStartCreatePost() {
    resetInlineStates();
    setCreatingPost(true);
    setPostForm(INITIAL_POST_FORM);
  }

  function handleCancelPostEditor() {
    setCreatingPost(false);
    setEditingPostId(null);
    setPostActionError(null);
    setPostActionSuccess(null);
    setPostForm(INITIAL_POST_FORM);
    setConfirmState({ type: 'none' });
  }

  function handleStartPostEdit(post: BoardPost) {
    setCreatingPost(false);
    setExpandedAttemptId(null);
    setEditingPostId(post.id);
    setExpandedPostId(post.id);
    setExpandedReviewId(null);
    setPostActionError(null);
    setPostActionSuccess(null);
    setConfirmState({ type: 'none' });
    setPostForm({
      category: post.category === 'QNA' ? 'QNA' : 'FREE',
      title: post.title,
      content: post.content,
      pinned: false,
    });
  }

  async function handleCreatePost() {
    setPostBusy(true);
    setPostActionError(null);
    setPostActionSuccess(null);

    try {
      const created = await createBoardPost({
        category: postForm.category,
        title: postForm.title.trim(),
        content: postForm.content.trim(),
      });

      setCreatingPost(false);
      setPostForm(INITIAL_POST_FORM);
      setPostActionSuccess('게시글을 등록했습니다.');
      setExpandedPostId(created.id);
      setPostDetailsById((current) => ({ ...current, [created.id]: created }));

      if (postPage !== 1) {
        setPostPage(1);
      } else {
        await fetchPostsPage(1);
      }
    } catch (submitError) {
      setPostActionError(submitError instanceof Error ? submitError.message : '게시글을 등록하지 못했습니다.');
    } finally {
      setPostBusy(false);
    }
  }

  async function handleUpdatePost(postId: number) {
    setPostBusy(true);
    setPostActionError(null);
    setPostActionSuccess(null);

    try {
      const updated = await updateBoardPost(postId, {
        category: postForm.category,
        title: postForm.title.trim(),
        content: postForm.content.trim(),
      });

      setPostDetailsById((current) => ({ ...current, [postId]: updated }));
      setPosts((current) =>
        current.map((item) =>
          item.id === postId
            ? {
                ...item,
                category: updated.category,
                title: updated.title,
                excerpt: buildExcerpt(updated.content),
                updatedAt: updated.updatedAt,
              }
            : item,
        ),
      );
      setEditingPostId(null);
      setPostActionSuccess('게시글을 수정했습니다.');
    } catch (submitError) {
      setPostActionError(submitError instanceof Error ? submitError.message : '게시글을 수정하지 못했습니다.');
    } finally {
      setPostBusy(false);
    }
  }

  function handleDeletePost(postId: number) {
    setConfirmState({ type: 'delete-post', postId });
  }

  async function confirmDeletePost() {
    if (confirmState.type !== 'delete-post') {
      return;
    }

    const { postId } = confirmState;
    setPostBusy(true);
    setPostActionError(null);
    setPostActionSuccess(null);

    try {
      await removeBoardPost(postId);
      setExpandedPostId(null);
      setEditingPostId(null);
      setPostDetailsById((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });

      if (posts.length === 1 && postPage > 1) {
        setPostPage(postPage - 1);
      } else {
        await fetchPostsPage(postPage);
      }

      setPostActionSuccess('게시글을 삭제했습니다.');
    } catch (deleteError) {
      setPostActionError(deleteError instanceof Error ? deleteError.message : '게시글을 삭제하지 못했습니다.');
    } finally {
      setConfirmState({ type: 'none' });
      setPostBusy(false);
    }
  }

  function handleStartReviewEdit(review: Review) {
    setEditingReviewId(review.id);
    setExpandedAttemptId(null);
    setExpandedReviewId(review.id);
    setExpandedPostId(null);
    setReviewActionError(null);
    setReviewActionSuccess(null);
    setConfirmState({ type: 'none' });
    setReviewForm({
      rating: review.rating,
      content: review.content,
    });
  }

  function handleCancelReviewEdit() {
    setEditingReviewId(null);
    setReviewActionError(null);
    setReviewActionSuccess(null);
    setReviewForm(INITIAL_REVIEW_FORM);
    setConfirmState({ type: 'none' });
  }

  async function handleUpdateReview(reviewId: number) {
    setReviewBusy(true);
    setReviewActionError(null);
    setReviewActionSuccess(null);

    try {
      const updated = await updateReview(reviewId, {
        rating: reviewForm.rating,
        content: reviewForm.content.trim(),
      });

      setReviews((current) => current.map((item) => (item.id === reviewId ? updated : item)));
      setEditingReviewId(null);
      setReviewActionSuccess('후기를 수정했습니다.');
    } catch (submitError) {
      setReviewActionError(submitError instanceof Error ? submitError.message : '후기를 수정하지 못했습니다.');
    } finally {
      setReviewBusy(false);
    }
  }

  function handleDeleteReview(reviewId: number) {
    setConfirmState({ type: 'delete-review', reviewId });
  }

  async function confirmDeleteReview() {
    if (confirmState.type !== 'delete-review') {
      return;
    }

    const { reviewId } = confirmState;
    setReviewBusy(true);
    setReviewActionError(null);
    setReviewActionSuccess(null);

    try {
      await removeReview(reviewId);
      setReviews((current) => current.filter((item) => item.id !== reviewId));
      setExpandedReviewId(null);
      setEditingReviewId(null);
      setReviewActionSuccess('후기를 삭제했습니다.');
    } catch (deleteError) {
      setReviewActionError(deleteError instanceof Error ? deleteError.message : '후기를 삭제하지 못했습니다.');
    } finally {
      setConfirmState({ type: 'none' });
      setReviewBusy(false);
    }
  }

  if (loading || (postsLoading && postPage === 1)) {
    return (
      <div className="glass-page board-page-compact">
        <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell">
          <div className="glass-panel glass-panel--empty">
            <strong>마이페이지를 불러오는 중입니다.</strong>
            <p>내 기록, 게시글, 후기를 정리하고 있습니다.</p>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-page board-page-compact">
        <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell">
          <div className="glass-panel glass-panel--empty">
            <strong>마이페이지 정보를 불러오지 못했습니다.</strong>
            <p>{error}</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="glass-page board-page-compact">
      <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell">
        <div className="board-detail-compact__toolbar mypage-compact-header">
          <div>
            <h2 className="board-classic-title">{user?.displayName ?? '회원'}님의 마이페이지</h2>
            <p className="board-classic-summary">{tabSummary}</p>
          </div>
        </div>

        <div className="glass-chip-group mypage-compact-tabs">
          {tabOptions.map((tab) => (
            <button
              key={tab.key}
              className={`glass-chip${activeTab === tab.key ? ' is-active' : ''}`}
              type="button"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label} {tab.count}
            </button>
          ))}
        </div>

        {activeTab === 'ATTEMPTS' ? (
          <>
            {pagedAttempts.length === 0 ? (
              <div className="glass-panel glass-panel--nested glass-panel--empty">
                <strong>아직 저장된 기록이 없습니다.</strong>
                <p>챌린지를 완료하면 여기서 바로 확인할 수 있습니다.</p>
              </div>
            ) : (
              <div className="mypage-compact-table">
                <div className="mypage-compact-table__head mypage-compact-table__head--attempts" role="presentation">
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
                          className={`mypage-compact-row mypage-compact-row--attempts${isExpanded ? ' is-expanded' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleAttemptRowToggle(attempt.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleAttemptRowToggle(attempt.id);
                            }
                          }}
                        >
                          <div className="mypage-compact-row__status">
                            <span className={"board-classic-badge" + (attempt.processingComplete ? " is-pinned" : "")}>
                              {attempt.processingComplete ? '완료' : '처리중'}
                            </span>
                          </div>
                          <div className="mypage-compact-row__title">
                            <button className="mypage-inline-trigger" type="button">
                              {attempt.challengeTitle}
                            </button>
                          </div>
                          <div className="mypage-compact-row__metric">
                            {attempt.scoreAvailable ? attempt.score + '점' : '-'}
                          </div>
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
                              <div className="inline-actions board-actions-right">
                                <Link
                                  className="button-link button-link--secondary button-link--compact"
                                  to={`/challenges?challengeId=${attempt.challengeId}`}
                                >
                                  챌린지 보기
                                </Link>
                              </div>
                            </div>

                            <div className="mypage-inline-meta">
                              <span>{attempt.scoreAvailable ? '점수 ' + attempt.score + '점' : '점수 산출 전'}</span>
                              <span>{formatResultSource(attempt.resultSource)}</span>
                              <span>{toAttemptAreaLabel(attempt.strongestArea, '강점 없음')}</span>
                              <span>{toAttemptAreaLabel(attempt.weakestArea, '보완 영역 없음')}</span>
                            </div>

                            <article className="mypage-inline-content">
                              {attempt.resultHeadline}
                              {"\n"}
                              {"\n"}
                              {attempt.resultSummary}
                              {attempt.coachingTeaser ? "\n\n코칭: " + attempt.coachingTeaser : ""}
                              {attempt.processingNotice ? "\n\n안내: " + attempt.processingNotice : ""}
                            </article>
                          </section>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            <Pagination currentPage={attemptPage} totalPages={attemptTotalPages} onPageChange={setAttemptPage} />
          </>
        ) : null}

        {activeTab === 'POSTS' ? (
          <>
            <div className="mypage-inline-toolbar">
              <p className="mypage-inline-toolbar__note">게시글 항목을 누르면 아래에서 바로 상세보기와 수정이 열립니다.</p>
              <div className="inline-actions board-actions-right">
                <button className="button-link button-link--compact" type="button" onClick={handleStartCreatePost}>
                  글쓰기
                </button>
              </div>
            </div>

            {creatingPost ? (
              <section className="mypage-inline-detail mypage-inline-detail--editor">
                <div className="mypage-inline-detail__header">
                  <div>
                    <strong>새 게시글 작성</strong>
                    <p>게시판에 맞게 간단하게 작성하고 바로 등록할 수 있습니다.</p>
                  </div>
                  <div className="inline-actions board-actions-right">
                    <button
                      className="button-link button-link--secondary button-link--compact"
                      type="button"
                      onClick={handleCancelPostEditor}
                      disabled={postBusy}
                    >
                      닫기
                    </button>
                    <button
                      className="button-link button-link--compact"
                      type="button"
                      onClick={() => void handleCreatePost()}
                      disabled={postBusy || !postForm.title.trim() || !postForm.content.trim()}
                    >
                      {postBusy ? '등록 중...' : '등록하기'}
                    </button>
                  </div>
                </div>

                <div className="mypage-inline-form">
                  <CompactSegmentedControl
                    label="분류"
                    value={postForm.category}
                    options={POST_CATEGORY_OPTIONS}
                    disabled={postBusy}
                    onChange={(nextCategory) =>
                      setPostForm((current) => ({
                        ...current,
                        category: nextCategory as BoardPostInput['category'],
                      }))
                    }
                  />

                  <label className="mypage-inline-field">
                    <span>제목</span>
                    <input
                      type="text"
                      value={postForm.title}
                      disabled={postBusy}
                      maxLength={120}
                      onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))}
                    />
                  </label>

                  <label className="mypage-inline-field">
                    <span>내용</span>
                    <textarea
                      value={postForm.content}
                      rows={8}
                      disabled={postBusy}
                      maxLength={2400}
                      onChange={(event) => setPostForm((current) => ({ ...current, content: event.target.value }))}
                    />
                  </label>
                </div>

                {postActionSuccess ? <p className="mypage-inline-message is-success">{postActionSuccess}</p> : null}
                {postActionError ? <p className="mypage-inline-message is-error">{postActionError}</p> : null}
              </section>
            ) : null}

            {postsLoading ? (
              <div className="glass-panel glass-panel--nested glass-panel--empty">
                <strong>게시글을 불러오는 중입니다.</strong>
              </div>
            ) : posts.length === 0 ? (
              <div className="glass-panel glass-panel--nested glass-panel--empty">
                <strong>아직 작성한 게시글이 없습니다.</strong>
                <p>게시판에서 글을 작성하면 여기서 바로 확인할 수 있습니다.</p>
              </div>
            ) : (
              <div className="mypage-compact-table">
                <div className="mypage-compact-table__head mypage-compact-table__head--posts" role="presentation">
                  <span>분류</span>
                  <span>제목</span>
                  <span>조회수</span>
                  <span>댓글</span>
                  <span>작성일</span>
                </div>

                <div className="mypage-compact-table__body">
                  {posts.map((post) => {
                    const detail = postDetailsById[post.id];
                    const isExpanded = expandedPostId === post.id;
                    const isEditing = editingPostId === post.id;

                    return (
                      <Fragment key={post.id}>
                        <article
                          className={`mypage-compact-row mypage-compact-row--posts${isExpanded ? ' is-expanded' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => void handlePostRowToggle(post.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              void handlePostRowToggle(post.id);
                            }
                          }}
                        >
                          <div className="mypage-compact-row__status">
                            <span className={"board-compact-badge" + (post.pinned ? " is-pinned" : "")}>
                              {toCategoryLabel(post.category)}
                            </span>
                          </div>
                          <div className="mypage-compact-row__title">
                            <button className="mypage-inline-trigger" type="button">
                              {post.title}
                            </button>
                          </div>
                          <div className="mypage-compact-row__metric">{post.viewCount}</div>
                          <div className="mypage-compact-row__metric">{post.commentCount}</div>
                          <div className="mypage-compact-row__date">{formatDate(post.createdAt)}</div>
                        </article>
                        {isExpanded ? (
                          <section className="mypage-inline-detail">
                            {postDetailLoadingId === post.id ? (
                              <div className="mypage-inline-detail__empty">
                                <strong>게시글 상세를 불러오는 중입니다.</strong>
                              </div>
                            ) : postDetailError && !detail ? (
                              <div className="mypage-inline-detail__empty">
                                <strong>게시글 상세를 불러오지 못했습니다.</strong>
                                <p>{postDetailError}</p>
                              </div>
                            ) : detail ? (
                              <>
                                <div className="mypage-inline-detail__header">
                                  <div>
                                    <strong>{detail.title}</strong>
                                    <p>
                                      {toCategoryLabel(detail.category)} · {detail.authorDisplayName} · 작성 {formatDate(detail.createdAt)}
                                    </p>
                                  </div>
                                  <div className="inline-actions board-actions-right">
                                    {!isEditing ? (
                                      <>
                                        <button
                                          className="button-link button-link--secondary button-link--compact"
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleStartPostEdit(detail);
                                          }}
                                        >
                                          수정하기
                                        </button>
                                        <button
                                          className="button-link button-link--compact"
                                          type="button"
                                          disabled={postBusy}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleDeletePost(detail.id);
                                          }}
                                        >
                                          {postBusy ? '처리 중...' : '삭제하기'}
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          className="button-link button-link--secondary button-link--compact"
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            handleCancelPostEditor();
                                          }}
                                          disabled={postBusy}
                                        >
                                          취소
                                        </button>
                                        <button
                                          className="button-link button-link--compact"
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleUpdatePost(detail.id);
                                          }}
                                          disabled={postBusy || !postForm.title.trim() || !postForm.content.trim()}
                                        >
                                          {postBusy ? '수정 중...' : '수정하기'}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {!isEditing ? (
                                  <>
                                    <div className="mypage-inline-meta">
                                      <span>議고쉶 {detail.viewCount}</span>
                                      <span>?볤? {detail.commentCount}</span>
                                      <span>?섏젙 {formatDate(detail.updatedAt)}</span>
                                    </div>
                                    <article className="mypage-inline-content">{detail.content}</article>
                                  </>
                                ) : (
                                  <div className="mypage-inline-form">
                                    <CompactSegmentedControl
                                      label="遺꾨쪟"
                                      value={postForm.category}
                                      options={POST_CATEGORY_OPTIONS}
                                      disabled={postBusy}
                                      onChange={(nextCategory) =>
                                        setPostForm((current) => ({
                                          ...current,
                                          category: nextCategory as BoardPostInput['category'],
                                        }))
                                      }
                                    />

                                    <label className="mypage-inline-field">
                                      <span>?쒕ぉ</span>
                                      <input
                                        type="text"
                                        value={postForm.title}
                                        disabled={postBusy}
                                        maxLength={120}
                                        onChange={(event) =>
                                          setPostForm((current) => ({ ...current, title: event.target.value }))
                                        }
                                      />
                                    </label>

                                    <label className="mypage-inline-field">
                                      <span>?댁슜</span>
                                      <textarea
                                        value={postForm.content}
                                        rows={8}
                                        disabled={postBusy}
                                        maxLength={2400}
                                        onChange={(event) =>
                                          setPostForm((current) => ({ ...current, content: event.target.value }))
                                        }
                                      />
                                    </label>
                                  </div>
                                )}

                                {postActionSuccess ? <p className="mypage-inline-message is-success">{postActionSuccess}</p> : null}
                                {postActionError ? <p className="mypage-inline-message is-error">{postActionError}</p> : null}
                              </>
                            ) : null}
                          </section>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            <Pagination currentPage={postPage} totalPages={postTotalPages} onPageChange={setPostPage} />
          </>
        ) : null}

        {activeTab === 'REVIEWS' ? (
          <>
            <div className="mypage-inline-toolbar">
              <p className="mypage-inline-toolbar__note">후기 항목을 누르면 아래에서 상세보기, 수정, 삭제가 바로 열립니다.</p>
            </div>

            {pagedReviews.length === 0 ? (
              <div className="glass-panel glass-panel--nested glass-panel--empty">
                <strong>작성한 후기가 아직 없습니다.</strong>
                <p>챌린지에 참여하면 후기 버튼으로 바로 등록할 수 있습니다.</p>
              </div>
            ) : (
              <div className="mypage-compact-table">
                <div className="mypage-compact-table__head mypage-compact-table__head--reviews" role="presentation">
                  <span>난이도</span>
                  <span>제목</span>
                  <span>별점</span>
                  <span>작성일</span>
                </div>

                <div className="mypage-compact-table__body">
                  {pagedReviews.map((review) => {
                    const isExpanded = expandedReviewId === review.id;
                    const isEditing = editingReviewId === review.id;

                    return (
                      <Fragment key={review.id}>
                        <article
                          className={`mypage-compact-row mypage-compact-row--reviews${isExpanded ? ' is-expanded' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleReviewRowToggle(review.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleReviewRowToggle(review.id);
                            }
                          }}
                        >
                          <div className="mypage-compact-row__status">
                            <span className="board-compact-badge">{challengeDifficultyById[review.challengeId] ?? '-'}</span>
                          </div>
                          <div className="mypage-compact-row__title">
                            <button className="mypage-inline-trigger" type="button">
                              {review.challengeTitle}
                            </button>
                          </div>
                          <div className="mypage-compact-row__metric">★ {review.rating.toFixed(1)}</div>
                          <div className="mypage-compact-row__date">{formatDate(review.createdAt)}</div>
                        </article>

                        {isExpanded ? (
                          <section className="mypage-inline-detail">
                            <div className="mypage-inline-detail__header">
                              <div>
                                <strong>{review.challengeTitle}</strong>
                                <p>
                                  {challengeDifficultyById[review.challengeId] ?? '-'} · 작성 {formatDate(review.createdAt)}
                                </p>
                              </div>
                              <div className="inline-actions board-actions-right">
                                <button
                                  className="button-link button-link--secondary button-link--compact"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void navigate(`/challenges?panel=reviews&challengeId=${review.challengeId}`);
                                  }}
                                >
                                  챌린지 보기
                                </button>
                                {!isEditing ? (
                                  <>
                                    <button
                                      className="button-link button-link--secondary button-link--compact"
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleStartReviewEdit(review);
                                      }}
                                    >
                                      수정하기
                                    </button>
                                    <button
                                      className="button-link button-link--compact"
                                      type="button"
                                      disabled={reviewBusy}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleDeleteReview(review.id);
                                      }}
                                    >
                                      {reviewBusy ? '처리 중...' : '삭제하기'}
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="button-link button-link--secondary button-link--compact"
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleCancelReviewEdit();
                                      }}
                                      disabled={reviewBusy}
                                    >
                                      취소
                                    </button>
                                    <button
                                      className="button-link button-link--compact"
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void handleUpdateReview(review.id);
                                      }}
                                      disabled={reviewBusy || !reviewForm.content.trim()}
                                    >
                                      {reviewBusy ? '수정 중...' : '수정하기'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {!isEditing ? (
                              <>
                                <div className="mypage-inline-meta">
                                  <span>별점</span>
                                  <ReviewStars value={review.rating} disabled />
                                  <span>{review.rating.toFixed(1)}점</span>
                                </div>
                                <article className="mypage-inline-content">{review.content}</article>
                              </>
                            ) : (
                              <div className="mypage-inline-form">
                                <label className="mypage-inline-field">
                                  <span>蹂꾩젏</span>
                                  <div className="mypage-inline-stars">
                                    <ReviewStars
                                      value={reviewForm.rating}
                                      disabled={reviewBusy}
                                      onChange={(nextRating) =>
                                        setReviewForm((current) => ({ ...current, rating: nextRating }))
                                      }
                                    />
                                    <strong>{reviewForm.rating.toFixed(1)}</strong>
                                  </div>
                                </label>

                                <label className="mypage-inline-field">
                                  <span>후기 내용</span>
                                  <textarea
                                    value={reviewForm.content}
                                    rows={7}
                                    disabled={reviewBusy}
                                    maxLength={1200}
                                    onChange={(event) =>
                                      setReviewForm((current) => ({ ...current, content: event.target.value }))
                                    }
                                  />
                                </label>
                              </div>
                            )}

                            {reviewActionSuccess ? <p className="mypage-inline-message is-success">{reviewActionSuccess}</p> : null}
                            {reviewActionError ? <p className="mypage-inline-message is-error">{reviewActionError}</p> : null}
                          </section>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            <Pagination currentPage={reviewPage} totalPages={reviewTotalPages} onPageChange={setReviewPage} />
          </>
        ) : null}
      </section>

      <CompactConfirmDialog
        open={confirmState.type !== 'none'}
        title={confirmState.type === 'delete-post' ? '게시글 삭제' : '후기 삭제'}
        description={
          confirmState.type === 'delete-post'
            ? '선택한 게시글을 삭제하면 마이페이지와 게시글 목록에서 바로 사라집니다.'
            : '선택한 후기를 삭제하면 챌린지 후기 목록에서 바로 사라집니다.'
        }
        confirmLabel="삭제"
        cancelLabel="취소"
        tone="danger"
        busy={confirmState.type === 'delete-post' ? postBusy : reviewBusy}
        onConfirm={confirmState.type === 'delete-post' ? confirmDeletePost : confirmDeleteReview}
        onCancel={() => setConfirmState({ type: 'none' })}
      />
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

function formatResultSource(value: AttemptSummary['resultSource']) {
  switch (value) {
    case 'VIDEO_UPLOAD_AUTOSCORED':
      return '영상 채점';
    case 'SAMPLE_SCORING_PREVIEW':
      return '테스트 모드';
    case 'PREPARED_FLOW':
      return '준비 상태';
    default:
      return value;
  }
}

function toAttemptAreaLabel(value: AttemptSummary['strongestArea'] | AttemptSummary['weakestArea'], fallback: string) {
  if (!value) {
    return fallback;
  }

  switch (value) {
    case 'detection quality':
      return '감지 정밀도';
    default:
      return value;
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

function buildExcerpt(content: string) {
  const normalized = content.trim().replace(/\s+/g, ' ');
  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117)}...`;
}
