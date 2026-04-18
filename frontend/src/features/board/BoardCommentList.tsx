import type { BoardComment } from '../../shared/types/board';
import { BoardCommentComposer } from './BoardCommentComposer';

type BoardCommentListProps = {
  comments: BoardComment[];
  isAdmin: boolean;
  busy: boolean;
  editCommentId: number | null;
  editValue: string;
  actionError?: string | null;
  onEditStart: (comment: BoardComment) => void;
  onEditChange: (value: string) => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  onDelete: (commentId: number) => void;
};

export function BoardCommentList({
  comments,
  isAdmin,
  busy,
  editCommentId,
  editValue,
  actionError,
  onEditStart,
  onEditChange,
  onEditSubmit,
  onEditCancel,
  onDelete,
}: BoardCommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="glass-panel glass-panel--nested glass-panel--empty board-empty-inline">
        <strong>아직 등록된 댓글이 없습니다.</strong>
        <p>첫 댓글을 남기고 게시글에 대한 대화를 시작해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="board-comment-table">
      {comments.map((comment) => {
        const canManage = comment.mine || isAdmin;
        const isEditing = editCommentId === comment.id;

        return (
          <article className="board-comment-row" key={comment.id}>
            <div className="board-comment-row__meta">
              <span className="board-comment-row__author">{comment.memberDisplayName}</span>
              <span>{comment.mine ? '내 댓글' : '사용자 댓글'}</span>
              <span>{formatDateTime(comment.updatedAt)}</span>
            </div>

            {isEditing ? (
              <BoardCommentComposer
                value={editValue}
                busy={busy}
                submitLabel="댓글 수정"
                placeholder="댓글 내용을 수정해 주세요."
                error={actionError}
                onChange={onEditChange}
                onSubmit={onEditSubmit}
                onCancel={onEditCancel}
              />
            ) : (
              <>
                <p className="board-comment-row__content">{comment.content}</p>
                {canManage ? (
                  <div className="inline-actions board-actions-right">
                    <button className="button-link button-link--secondary" type="button" onClick={() => onEditStart(comment)}>
                      수정
                    </button>
                    <button className="button-link" type="button" onClick={() => onDelete(comment.id)} disabled={busy}>
                      삭제
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
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
