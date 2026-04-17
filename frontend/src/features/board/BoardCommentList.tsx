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
      <div className="glass-panel glass-panel--nested glass-panel--empty">
        <strong>아직 등록된 댓글이 없습니다.</strong>
        <p>첫 댓글을 남겨서 이 게시글의 대화를 시작해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="glass-list">
      {comments.map((comment) => {
        const canManage = comment.mine || isAdmin;
        const isEditing = editCommentId === comment.id;

        return (
          <article className="glass-list-item board-comment-item" key={comment.id}>
            <div className="glass-list-item__content">
              <div className="glass-list-item__header">
                <div>
                  <span className="glass-list-item__eyebrow">{comment.mine ? '내 댓글' : '사용자 댓글'}</span>
                  <strong>{comment.memberDisplayName}</strong>
                </div>
                <span className="glass-badge">{formatDateTime(comment.updatedAt)}</span>
              </div>

              {isEditing ? (
                <BoardCommentComposer
                  value={editValue}
                  busy={busy}
                  submitLabel="댓글 수정"
                  placeholder="댓글 내용을 수정해 주세요"
                  error={actionError}
                  onChange={onEditChange}
                  onSubmit={onEditSubmit}
                  onCancel={onEditCancel}
                />
              ) : (
                <>
                  <p className="glass-list-item__description">{comment.content}</p>
                  {canManage ? (
                    <div className="inline-actions">
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
            </div>
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
