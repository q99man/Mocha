import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { BoardCommentComposer } from '../features/board/BoardCommentComposer';
import { BoardCommentList } from '../features/board/BoardCommentList';
import { ReviewStars } from '../features/reviews/ReviewStars';
import {
  createBoardComment,
  getBoardComments,
  getBoardPost,
  removeBoardComment,
  removeBoardPost,
  updateBoardComment,
} from '../shared/api/boardApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { CompactConfirmDialog } from '../shared/components/CompactConfirmDialog';
import type { BoardComment, BoardPost } from '../shared/types/board';

const INITIAL_COMMENT = '';
type BoardDetailConfirmState =
  | { type: 'none' }
  | { type: 'delete-post' }
  | { type: 'delete-comment'; commentId: number };

export function BoardDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();
  const [post, setPost] = useState<BoardPost | null>(null);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [commentValue, setCommentValue] = useState(INITIAL_COMMENT);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState<string | null>(null);
  const [editCommentId, setEditCommentId] = useState<number | null>(null);
  const [editCommentValue, setEditCommentValue] = useState('');
  const [confirmState, setConfirmState] = useState<BoardDetailConfirmState>({ type: 'none' });

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [postResponse, commentResponse] = await Promise.all([getBoardPost(id), getBoardComments(id)]);
        if (!active) {
          return;
        }

        setPost(postResponse);
        setComments(commentResponse);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '게시글을 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [id]);

  async function refreshComments() {
    const nextComments = await getBoardComments(id);
    setComments(nextComments);
    setPost((current) => (current ? { ...current, commentCount: nextComments.length } : current));
  }

  function handleDeletePost() {
    if (!post) {
      return;
    }

    setConfirmState({ type: 'delete-post' });
  }

  async function confirmDeletePost() {
    if (!post) {
      return;
    }

    setDeleteBusy(true);

    try {
      await removeBoardPost(post.id);
      navigate('/board');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '게시글을 삭제하지 못했습니다.');
      setConfirmState({ type: 'none' });
      setDeleteBusy(false);
    }
  }

  async function handleCreateComment() {
    setCommentBusy(true);
    setCommentError(null);
    setCommentSuccess(null);

    try {
      await createBoardComment(id, { content: commentValue.trim() });
      setCommentValue(INITIAL_COMMENT);
      setCommentSuccess('댓글을 등록했습니다.');
      await refreshComments();
    } catch (submitError) {
      setCommentError(submitError instanceof Error ? submitError.message : '댓글을 등록하지 못했습니다.');
    } finally {
      setCommentBusy(false);
    }
  }

  async function handleUpdateComment() {
    if (editCommentId == null) {
      return;
    }

    setCommentBusy(true);
    setCommentError(null);
    setCommentSuccess(null);

    try {
      await updateBoardComment(editCommentId, { content: editCommentValue.trim() });
      setEditCommentId(null);
      setEditCommentValue('');
      setCommentSuccess('댓글을 수정했습니다.');
      await refreshComments();
    } catch (updateError) {
      setCommentError(updateError instanceof Error ? updateError.message : '댓글을 수정하지 못했습니다.');
    } finally {
      setCommentBusy(false);
    }
  }

  function handleDeleteComment(commentId: number) {
    setConfirmState({ type: 'delete-comment', commentId });
  }

  async function confirmDeleteComment() {
    if (confirmState.type !== 'delete-comment') {
      return;
    }

    const { commentId } = confirmState;
    setCommentBusy(true);
    setCommentError(null);
    setCommentSuccess(null);

    try {
      await removeBoardComment(commentId);
      if (editCommentId === commentId) {
        setEditCommentId(null);
        setEditCommentValue('');
      }
      setCommentSuccess('댓글을 삭제했습니다.');
      await refreshComments();
    } catch (deleteError) {
      setCommentError(deleteError instanceof Error ? deleteError.message : '댓글을 삭제하지 못했습니다.');
    } finally {
      setConfirmState({ type: 'none' });
      setCommentBusy(false);
    }
  }

  function handleEditStart(comment: BoardComment) {
    setCommentError(null);
    setCommentSuccess(null);
    setEditCommentId(comment.id);
    setEditCommentValue(comment.content);
  }

  function handleEditCancel() {
    setEditCommentId(null);
    setEditCommentValue('');
    setCommentError(null);
  }

  if (loading) {
    return (
      <section className="glass-page board-page-compact">
        <div className="board-compact-shell board-compact-shell--detail">
          <div className="board-compact-empty">
            <strong>게시글을 불러오는 중입니다.</strong>
            <p>본문과 댓글을 정리하고 있습니다.</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !post) {
    return (
      <section className="glass-page board-page-compact">
        <div className="board-compact-shell board-compact-shell--detail">
          <div className="board-compact-empty">
            <strong>게시글을 불러오지 못했습니다.</strong>
            <p>{error ?? '선택한 게시글을 찾을 수 없습니다.'}</p>
            <div className="inline-actions">
              <Link className="button-link button-link--secondary button-link--compact" to="/board">
                목록으로
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const isReviewSync = post.sourceType === 'REVIEW_SYNC';
  const canManagePost = !isReviewSync && (post.mine || isAdmin);

  return (
    <div className="glass-page board-page-compact">
      <section className="board-compact-shell board-compact-shell--detail">
        <div className="board-detail-compact__toolbar">
          <div className="board-detail-compact__meta">
            <span className={`board-compact-badge${post.pinned ? ' is-pinned' : ''}`}>
              {toCategoryLabel(post.category)}
            </span>
            {isReviewSync ? <span className="board-detail-chip">자동 후기</span> : null}
            <span className="board-detail-chip">작성 {formatDateTime(post.createdAt)}</span>
            <span className="board-detail-chip">수정 {formatDateTime(post.updatedAt)}</span>
          </div>

          <div className="inline-actions">
            <Link className="button-link button-link--secondary button-link--compact" to="/board">
              목록
            </Link>
            {isAuthenticated ? (
              <Link className="button-link button-link--secondary button-link--compact" to="/board/new">
                글쓰기
              </Link>
            ) : (
              <Link className="button-link button-link--secondary button-link--compact" to="/auth">
                로그인
              </Link>
            )}
            {canManagePost ? (
              <>
                <Link
                  className="button-link button-link--secondary button-link--compact"
                  to={`/board/${post.id}/edit`}
                >
                  수정
                </Link>
                <button
                  className="button-link button-link--compact"
                  type="button"
                  onClick={handleDeletePost}
                  disabled={deleteBusy}
                >
                  {deleteBusy ? '삭제 중...' : '삭제'}
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="board-detail-compact__header">
          <h2>{post.title}</h2>
          <div className="board-detail-compact__submeta">
            <span>작성자 {post.authorDisplayName}</span>
            <span>조회 {post.viewCount}</span>
            <span>댓글 {post.commentCount}</span>
          </div>
        </div>

        {isReviewSync ? (
          <div className="board-review-summary board-review-summary--compact">
            {post.reviewRating ? <ReviewStars value={post.reviewRating} /> : null}
            {post.challengeId && post.challengeTitle ? (
              <Link className="board-review-summary__link" to={`/challenges?challengeId=${post.challengeId}&panel=reviews`}>
                {post.challengeTitle} 후기 보기
              </Link>
            ) : null}
          </div>
        ) : null}

        <article className="board-post-content board-post-content--compact">{post.content}</article>
      </section>

      <section className="board-compact-shell board-compact-shell--detail">
        <div className="board-detail-compact__toolbar board-detail-compact__toolbar--comments">
          <div className="board-detail-compact__section-title">
            <strong>댓글</strong>
            <span>{comments.length}개</span>
          </div>
        </div>

        {isAuthenticated ? (
          <BoardCommentComposer
            value={commentValue}
            busy={commentBusy}
            submitLabel="댓글 등록"
            placeholder="댓글 내용을 입력해 주세요."
            error={editCommentId == null ? commentError : null}
            success={commentSuccess}
            onChange={setCommentValue}
            onSubmit={handleCreateComment}
          />
        ) : (
          <div className="board-compact-empty">
            <strong>로그인 후 댓글을 작성할 수 있습니다.</strong>
            <p>게시판 참여 기능은 로그인 사용자에게 열려 있습니다.</p>
            <div className="inline-actions">
              <Link className="button-link button-link--compact" to="/auth">
                로그인
              </Link>
            </div>
          </div>
        )}

        <BoardCommentList
          comments={comments}
          isAdmin={isAdmin}
          busy={commentBusy}
          editCommentId={editCommentId}
          editValue={editCommentValue}
          actionError={editCommentId != null ? commentError : null}
          onEditStart={handleEditStart}
          onEditChange={setEditCommentValue}
          onEditSubmit={handleUpdateComment}
          onEditCancel={handleEditCancel}
          onDelete={handleDeleteComment}
        />
      </section>

      <CompactConfirmDialog
        open={confirmState.type !== 'none'}
        title={confirmState.type === 'delete-post' ? '게시글 삭제' : '댓글 삭제'}
        description={
          confirmState.type === 'delete-post'
            ? '게시글을 삭제하면 본문과 연결된 정보가 함께 정리됩니다.'
            : '댓글을 삭제하면 같은 내용으로 되돌릴 수 없습니다.'
        }
        confirmLabel="삭제"
        cancelLabel="취소"
        tone="danger"
        busy={confirmState.type === 'delete-post' ? deleteBusy : commentBusy}
        onConfirm={confirmState.type === 'delete-post' ? confirmDeletePost : confirmDeleteComment}
        onCancel={() => setConfirmState({ type: 'none' })}
      />
    </div>
  );
}

function toCategoryLabel(category: BoardPost['category']) {
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

function formatDateTime(value: string) {
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
