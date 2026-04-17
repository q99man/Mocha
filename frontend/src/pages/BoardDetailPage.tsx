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
import type { BoardComment, BoardPost } from '../shared/types/board';

const INITIAL_COMMENT = '';

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

  async function handleDeletePost() {
    if (!post) {
      return;
    }

    if (!window.confirm('이 게시글을 삭제하시겠습니까?')) {
      return;
    }

    setDeleteBusy(true);

    try {
      await removeBoardPost(post.id);
      navigate('/board');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '게시글을 삭제하지 못했습니다.');
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
      setCommentSuccess('댓글이 등록되었습니다.');
      await refreshComments();
    } catch (submitError) {
      setCommentError(submitError instanceof Error ? submitError.message : '댓글을 저장하지 못했습니다.');
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
      setCommentSuccess('댓글이 수정되었습니다.');
      await refreshComments();
    } catch (updateError) {
      setCommentError(updateError instanceof Error ? updateError.message : '댓글을 수정하지 못했습니다.');
    } finally {
      setCommentBusy(false);
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) {
      return;
    }

    setCommentBusy(true);
    setCommentError(null);
    setCommentSuccess(null);

    try {
      await removeBoardComment(commentId);
      if (editCommentId === commentId) {
        setEditCommentId(null);
        setEditCommentValue('');
      }
      setCommentSuccess('댓글이 삭제되었습니다.');
      await refreshComments();
    } catch (deleteError) {
      setCommentError(deleteError instanceof Error ? deleteError.message : '댓글을 삭제하지 못했습니다.');
    } finally {
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
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>게시글을 불러오는 중입니다.</strong>
          <p>본문과 댓글 흐름을 함께 정리하고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (error || !post) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>게시글을 불러오지 못했습니다.</strong>
          <p>{error ?? '선택한 게시글을 찾을 수 없습니다.'}</p>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to="/board">
              목록으로
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const isReviewSync = post.sourceType === 'REVIEW_SYNC';
  const canManagePost = !isReviewSync && (post.mine || isAdmin);

  return (
    <div className="glass-page">
      <section className="glass-intro">
        <div>
          <span className="glass-intro__eyebrow">
            {toCategoryLabel(post.category)}
            {isReviewSync ? ' · 자동 후기' : ''}
          </span>
          <h2>{post.title}</h2>
          <p>
            {isReviewSync
              ? '이 게시글은 챌린지 후기 원본과 자동으로 연결됩니다. 후기 수정과 삭제는 챌린지 상세 페이지에서 관리합니다.'
              : '게시글 본문과 댓글 흐름을 한 화면에서 자연스럽게 확인할 수 있도록 단순한 구조로 정리했습니다.'}
          </p>
        </div>
        <div className="glass-intro__meta">
          <div>
            <span>작성자</span>
            <strong>{post.authorDisplayName}</strong>
          </div>
          <div>
            <span>조회</span>
            <strong>{String(post.viewCount).padStart(2, '0')}</strong>
          </div>
          <div>
            <span>댓글</span>
            <strong>{String(post.commentCount).padStart(2, '0')}</strong>
          </div>
        </div>
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div className="glass-inline-meta">
            <span>{formatDateTime(post.createdAt)}</span>
            <span>수정 {formatDateTime(post.updatedAt)}</span>
            <span>{post.pinned ? '고정 게시글' : isReviewSync ? '후기 노출 게시글' : '일반 게시글'}</span>
          </div>

          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to="/board">
              목록으로
            </Link>
            {isAuthenticated ? (
              <Link className="button-link" to="/board/new">
                새 글 작성
              </Link>
            ) : (
              <Link className="button-link" to="/auth">
                로그인
              </Link>
            )}
          </div>
        </div>

        {isReviewSync ? (
          <div className="board-review-summary">
            {post.reviewRating ? <ReviewStars value={post.reviewRating} /> : null}
            {post.challengeId && post.challengeTitle ? (
              <Link className="board-review-summary__link" to={`/challenges/${post.challengeId}`}>
                {post.challengeTitle} 상세로 이동
              </Link>
            ) : null}
          </div>
        ) : null}

        <article className="board-post-content">{post.content}</article>

        {canManagePost ? (
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={`/board/${post.id}/edit`}>
              수정하기
            </Link>
            <button className="button-link" type="button" onClick={handleDeletePost} disabled={deleteBusy}>
              {deleteBusy ? '삭제 중...' : '삭제하기'}
            </button>
          </div>
        ) : null}
      </section>

      <section className="glass-panel">
        <div className="glass-toolbar">
          <div>
            <h3 className="glass-section-title">댓글</h3>
            <p className="glass-toolbar__note">후기 게시글에도 일반 게시글과 동일하게 댓글 대화를 이어갈 수 있습니다.</p>
          </div>
        </div>

        {isAuthenticated ? (
          <BoardCommentComposer
            value={commentValue}
            busy={commentBusy}
            submitLabel="댓글 등록"
            placeholder="게시글에 대한 의견을 남겨 보세요"
            error={editCommentId == null ? commentError : null}
            success={commentSuccess}
            onChange={setCommentValue}
            onSubmit={handleCreateComment}
          />
        ) : (
          <div className="glass-panel glass-panel--nested glass-panel--empty">
            <strong>로그인 후 댓글을 작성할 수 있습니다.</strong>
            <p>게시판 참여 기능은 회원 사용자에게 열려 있습니다.</p>
            <div className="inline-actions">
              <Link className="button-link" to="/auth">
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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
