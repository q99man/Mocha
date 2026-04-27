import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { formatDifficulty } from '../features/challenges/difficulty';
import { MyPageAccountTab } from '../features/mypage/MyPageAccountTab';
import { MyPageAttemptsTab } from '../features/mypage/MyPageAttemptsTab';
import { MyPageLikedChallengesTab } from '../features/mypage/MyPageLikedChallengesTab';
import { MyPagePostsTab } from '../features/mypage/MyPagePostsTab';
import { MyPageReviewsTab } from '../features/mypage/MyPageReviewsTab';
import { getAttempts } from '../shared/api/attemptApi';
import {
  createBoardPost,
  getBoardPost,
  getMyBoardPostsBySource,
  removeBoardPost,
  updateBoardPost,
} from '../shared/api/boardApi';
import { getChallenges, getMyLikedChallenges, unlikeChallenge } from '../shared/api/challengeApi';
import { getMyReviews, removeReview, updateReview } from '../shared/api/reviewApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { CompactConfirmDialog } from '../shared/components/CompactConfirmDialog';
import { CompactToast } from '../shared/components/CompactToast';
import type { AttemptSummary } from '../shared/types/attempt';
import type { BoardPost, BoardPostInput, BoardPostSummary } from '../shared/types/board';
import type { Challenge } from '../shared/types/challenge';
import type { Review, ReviewInput } from '../shared/types/review';

type MyPageTab = 'ATTEMPTS' | 'POSTS' | 'REVIEWS' | 'LIKES' | 'ACCOUNT';

const ATTEMPTS_PER_PAGE = 10;
const REVIEWS_PER_PAGE = 10;
const POSTS_PER_PAGE = 10;
const LIKES_PER_PAGE = 10;

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
  | { type: 'update-post'; postId: number }
  | { type: 'delete-post'; postId: number }
  | { type: 'update-review'; reviewId: number }
  | { type: 'delete-review'; reviewId: number };

export function MyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [likedChallenges, setLikedChallenges] = useState<Challenge[]>([]);
  const [posts, setPosts] = useState<BoardPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptPage, setAttemptPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [postPage, setPostPage] = useState(1);
  const [likedPage, setLikedPage] = useState(1);
  const [activeTab, setActiveTab] = useState<MyPageTab>('ATTEMPTS');
  const [postTotalCount, setPostTotalCount] = useState(0);
  const [challengeDifficultyById, setChallengeDifficultyById] = useState<Record<number, string>>({});

  const [expandedAttemptId, setExpandedAttemptId] = useState<number | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);
  const [expandedLikedChallengeId, setExpandedLikedChallengeId] = useState<number | null>(null);
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
  const [likeActionError, setLikeActionError] = useState<string | null>(null);
  const [likeActionSuccess, setLikeActionSuccess] = useState<string | null>(null);
  const [unlikeBusyIds, setUnlikeBusyIds] = useState<Set<number>>(() => new Set());
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
        const [attemptResponse, reviewResponse, likedChallengeResponse, challengeResponse] = await Promise.all([
          getAttempts(),
          getMyReviews(),
          getMyLikedChallenges(),
          getChallenges(),
        ]);

        if (!active) {
          return;
        }

        setAttempts(attemptResponse);
        setReviews(reviewResponse);
        setLikedChallenges(likedChallengeResponse);
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
  const likedTotalPages = Math.max(1, Math.ceil(likedChallenges.length / LIKES_PER_PAGE));

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

  useEffect(() => {
    if (likedPage > likedTotalPages) {
      setLikedPage(likedTotalPages);
    }
  }, [likedPage, likedTotalPages]);

  const pagedAttempts = useMemo(() => {
    const startIndex = (attemptPage - 1) * ATTEMPTS_PER_PAGE;
    return latestAttempts.slice(startIndex, startIndex + ATTEMPTS_PER_PAGE);
  }, [attemptPage, latestAttempts]);

  const pagedReviews = useMemo(() => {
    const startIndex = (reviewPage - 1) * REVIEWS_PER_PAGE;
    return reviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE);
  }, [reviewPage, reviews]);

  const pagedLikedChallenges = useMemo(() => {
    const startIndex = (likedPage - 1) * LIKES_PER_PAGE;
    return likedChallenges.slice(startIndex, startIndex + LIKES_PER_PAGE);
  }, [likedChallenges, likedPage]);

  const tabOptions = useMemo(
    () => [
      { key: 'ATTEMPTS' as const, label: '내 기록', count: latestAttempts.length },
      { key: 'POSTS' as const, label: '내 게시글', count: postTotalCount },
      { key: 'REVIEWS' as const, label: '내 후기', count: reviews.length },
      { key: 'LIKES' as const, label: '좋아요', count: likedChallenges.length },
      { key: 'ACCOUNT' as const, label: '내 계정' },
    ],
    [latestAttempts.length, postTotalCount, reviews.length, likedChallenges.length],
  );

  const tabSummary = useMemo(() => {
    if (activeTab === 'ATTEMPTS') {
      return `내 기록 ${latestAttempts.length}개`;
    }
    if (activeTab === 'POSTS') {
      return `내 게시글 ${postTotalCount}개`;
    }
    if (activeTab === 'ACCOUNT') {
      return '내 정보, 비밀번호, 회원탈퇴';
    }
    if (activeTab === 'LIKES') {
      return `좋아요한 챌린지 ${likedChallenges.length}개`;
    }
    return `내 후기 ${reviews.length}개`;
  }, [activeTab, latestAttempts.length, postTotalCount, reviews.length, likedChallenges.length]);

  const activeActionError = postActionError || reviewActionError || likeActionError;
  const activeActionSuccess = postActionSuccess || reviewActionSuccess || likeActionSuccess;

  function clearActionFeedback() {
    setPostActionError(null);
    setPostActionSuccess(null);
    setReviewActionError(null);
    setReviewActionSuccess(null);
    setLikeActionError(null);
    setLikeActionSuccess(null);
  }

  function resetInlineStates() {
    setExpandedAttemptId(null);
    setExpandedPostId(null);
    setExpandedReviewId(null);
    setExpandedLikedChallengeId(null);
    setCreatingPost(false);
    setEditingPostId(null);
    setEditingReviewId(null);
    setPostActionError(null);
    setPostActionSuccess(null);
    setReviewActionError(null);
    setReviewActionSuccess(null);
    setLikeActionError(null);
    setLikeActionSuccess(null);
    setConfirmState({ type: 'none' });
  }

  function handleAttemptRowToggle(attemptId: number) {
    setExpandedAttemptId((current) => (current === attemptId ? null : attemptId));
    setExpandedPostId(null);
    setExpandedReviewId(null);
    setExpandedLikedChallengeId(null);
    setCreatingPost(false);
    setEditingPostId(null);
    setEditingReviewId(null);
    setPostActionError(null);
    setPostActionSuccess(null);
    setReviewActionError(null);
    setReviewActionSuccess(null);
    setLikeActionError(null);
    setLikeActionSuccess(null);
  }

  async function handleUnlikeChallenge(challengeId: number) {
    if (unlikeBusyIds.has(challengeId)) {
      return;
    }

    setLikeActionError(null);
    setLikeActionSuccess(null);
    setUnlikeBusyIds((current) => {
      const next = new Set(current);
      next.add(challengeId);
      return next;
    });

    try {
      await unlikeChallenge(challengeId);
      setLikedChallenges((current) => current.filter((challenge) => challenge.id !== challengeId));
      setExpandedLikedChallengeId((current) => (current === challengeId ? null : current));
      setLikeActionSuccess('좋아요를 취소했습니다.');
    } catch (likeError) {
      setLikeActionError(likeError instanceof Error ? likeError.message : '좋아요를 취소하지 못했습니다.');
    } finally {
      setUnlikeBusyIds((current) => {
        const next = new Set(current);
        next.delete(challengeId);
        return next;
      });
    }
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
    setExpandedLikedChallengeId(null);
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
    setExpandedLikedChallengeId(null);
    setCreatingPost(false);
    setEditingPostId(null);
    setEditingReviewId(null);
  }

  function handleLikedChallengeRowToggle(challengeId: number) {
    setLikeActionError(null);
    setLikeActionSuccess(null);
    setConfirmState({ type: 'none' });

    setExpandedLikedChallengeId((current) => (current === challengeId ? null : challengeId));
    setExpandedAttemptId(null);
    setExpandedPostId(null);
    setExpandedReviewId(null);
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
    setExpandedLikedChallengeId(null);
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

  function requestUpdatePost(postId: number) {
    setConfirmState({ type: 'update-post', postId });
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

  async function confirmUpdatePost() {
    if (confirmState.type !== 'update-post') {
      return;
    }

    const { postId } = confirmState;
    await handleUpdatePost(postId);
    setConfirmState({ type: 'none' });
  }

  function handleStartReviewEdit(review: Review) {
    setEditingReviewId(review.id);
    setExpandedAttemptId(null);
    setExpandedReviewId(review.id);
    setExpandedPostId(null);
    setExpandedLikedChallengeId(null);
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

  function requestUpdateReview(reviewId: number) {
    setConfirmState({ type: 'update-review', reviewId });
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

  async function confirmUpdateReview() {
    if (confirmState.type !== 'update-review') {
      return;
    }

    const { reviewId } = confirmState;
    await handleUpdateReview(reviewId);
    setConfirmState({ type: 'none' });
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
      <section className="board-compact-shell board-compact-shell--detail mypage-compact-shell admin-hub-compact">
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
              {tab.count == null ? tab.label : `${tab.label} ${tab.count}`}
            </button>
          ))}
        </div>

        {activeTab === 'ATTEMPTS' ? (
          <MyPageAttemptsTab
            pagedAttempts={pagedAttempts}
            expandedAttemptId={expandedAttemptId}
            attemptPage={attemptPage}
            attemptTotalPages={attemptTotalPages}
            onToggleAttempt={handleAttemptRowToggle}
            onAttemptPageChange={setAttemptPage}
            formatResultSource={formatResultSource}
            formatDate={formatDate}
            toAttemptAreaLabel={toAttemptAreaLabel}
          />
        ) : null}

        {activeTab === 'POSTS' ? (
          <MyPagePostsTab
            creatingPost={creatingPost}
            postsLoading={postsLoading}
            posts={posts}
            postDetailsById={postDetailsById}
            postDetailLoadingId={postDetailLoadingId}
            postDetailError={postDetailError}
            expandedPostId={expandedPostId}
            editingPostId={editingPostId}
            postForm={postForm}
            postBusy={postBusy}
            postPage={postPage}
            postTotalPages={postTotalPages}
            categoryOptions={POST_CATEGORY_OPTIONS}
            setPostForm={setPostForm}
            onPostPageChange={setPostPage}
            onStartCreatePost={handleStartCreatePost}
            onCancelPostEditor={handleCancelPostEditor}
            onCreatePost={handleCreatePost}
            onTogglePost={handlePostRowToggle}
            onStartPostEdit={handleStartPostEdit}
            onRequestUpdatePost={requestUpdatePost}
            onDeletePost={handleDeletePost}
            toCategoryLabel={toCategoryLabel}
            formatDate={formatDate}
          />
        ) : null}

        {activeTab === 'REVIEWS' ? (
          <MyPageReviewsTab
            pagedReviews={pagedReviews}
            expandedReviewId={expandedReviewId}
            editingReviewId={editingReviewId}
            reviewForm={reviewForm}
            reviewBusy={reviewBusy}
            reviewPage={reviewPage}
            reviewTotalPages={reviewTotalPages}
            challengeDifficultyById={challengeDifficultyById}
            setReviewForm={setReviewForm}
            onReviewPageChange={setReviewPage}
            onToggleReview={handleReviewRowToggle}
            onNavigateToChallenge={(challengeId) => navigate(`/challenges?panel=reviews&challengeId=${challengeId}`)}
            onStartReviewEdit={handleStartReviewEdit}
            onCancelReviewEdit={handleCancelReviewEdit}
            onRequestUpdateReview={requestUpdateReview}
            onDeleteReview={handleDeleteReview}
            formatDate={formatDate}
          />
        ) : null}

        {activeTab === 'LIKES' ? (
          <MyPageLikedChallengesTab
            pagedChallenges={pagedLikedChallenges}
            expandedChallengeId={expandedLikedChallengeId}
            likedPage={likedPage}
            likedTotalPages={likedTotalPages}
            unlikeBusyIds={unlikeBusyIds}
            onLikedPageChange={setLikedPage}
            onToggleChallenge={handleLikedChallengeRowToggle}
            onUnlikeChallenge={handleUnlikeChallenge}
            formatDuration={formatDuration}
            formatDifficulty={formatDifficulty}
          />
        ) : null}

        {activeTab === 'ACCOUNT' ? <MyPageAccountTab /> : null}
      </section>

      <CompactConfirmDialog
        open={confirmState.type !== 'none'}
        title={
          confirmState.type === 'update-post'
            ? '게시글 수정'
            : confirmState.type === 'delete-post'
              ? '게시글 삭제'
              : confirmState.type === 'update-review'
                ? '후기 수정'
                : '후기 삭제'
        }
        description={
          confirmState.type === 'update-post'
            ? '입력한 내용으로 게시글을 수정합니다. 변경사항은 목록과 상세 화면에 바로 반영됩니다.'
            : confirmState.type === 'delete-post'
              ? '선택한 게시글을 삭제하면 마이페이지와 게시글 목록에서 바로 사라집니다.'
              : confirmState.type === 'update-review'
                ? '입력한 내용으로 후기를 수정합니다. 변경사항은 마이페이지와 챌린지 후기 목록에 바로 반영됩니다.'
                : '선택한 후기를 삭제하면 챌린지 후기 목록에서 바로 사라집니다.'
        }
        confirmLabel={confirmState.type === 'delete-post' || confirmState.type === 'delete-review' ? '삭제' : '수정'}
        cancelLabel="취소"
        tone={confirmState.type === 'delete-post' || confirmState.type === 'delete-review' ? 'danger' : 'default'}
        busy={confirmState.type === 'update-post' || confirmState.type === 'delete-post' ? postBusy : reviewBusy}
        onConfirm={
          confirmState.type === 'update-post'
            ? confirmUpdatePost
            : confirmState.type === 'delete-post'
              ? confirmDeletePost
              : confirmState.type === 'update-review'
                ? confirmUpdateReview
                : confirmDeleteReview
        }
        onCancel={() => setConfirmState({ type: 'none' })}
      />
      <CompactToast
        message={activeActionError || activeActionSuccess}
        type={activeActionError ? 'error' : 'success'}
        onClose={clearActionFeedback}
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
      return '자동 채점';
    case 'SAMPLE_SCORING_PREVIEW':
      return '미리보기';
    case 'PREPARED_FLOW':
      return '준비 흐름';
    default:
      return value;
  }
}

function toAttemptAreaLabel(
  value: AttemptSummary['strongestArea'] | AttemptSummary['weakestArea'],
  fallback: string,
) {
  if (!value) {
    return fallback;
  }

  switch (value) {
    case 'detection quality':
      return '검출 품질';
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

function formatDuration(durationSec: number) {
  if (durationSec < 60) {
    return `${durationSec}초`;
  }

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}

function buildExcerpt(content: string) {
  const trimmed = content.trim();
  if (trimmed.length <= 100) {
    return trimmed;
  }

  return `${trimmed.slice(0, 100)}...`;
}
