import type { BoardComment } from '../../shared/types/board';
import { formatCompactDateTime as formatDateTime } from '../../shared/presentation/dateTime';
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
      <div className="board-compact-empty board-empty-inline">
        <strong>아직 등록된 댓글이 없습니다.</strong>
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
              <span>{comment.mine ? '내 댓글' : '참여 댓글'}</span>
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
                    <button
                      className="button-link button-link--secondary button-link--compact"
                      type="button"
                      onClick={() => onEditStart(comment)}
                    >
                      수정
                    </button>
                    <button
                      className="button-link button-link--compact"
                      type="button"
                      onClick={() => onDelete(comment.id)}
                      disabled={busy}
                    >
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

