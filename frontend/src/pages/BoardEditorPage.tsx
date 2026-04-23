import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { createBoardPost, getBoardPost, updateBoardPost } from '../shared/api/boardApi';
import { useAuth } from '../shared/auth/AuthProvider';
import { CompactConfirmDialog } from '../shared/components/CompactConfirmDialog';
import { CompactSegmentedControl } from '../shared/components/CompactSegmentedControl';
import { CompactToggle } from '../shared/components/CompactToggle';
import type { BoardCategory, BoardPostInput } from '../shared/types/board';

const INITIAL_FORM: BoardPostInput = {
  category: 'FREE',
  title: '',
  content: '',
  pinned: false,
};

export function BoardEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const isEditMode = Boolean(id);
  const [form, setForm] = useState<BoardPostInput>(INITIAL_FORM);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewManagedPost, setReviewManagedPost] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isEditMode || !id) {
      return;
    }

    const postId = id;
    let active = true;

    async function loadPost() {
      setLoading(true);
      setError(null);

      try {
        const response = await getBoardPost(postId);
        if (!active) {
          return;
        }

        if (response.sourceType === 'REVIEW_SYNC') {
          setReviewManagedPost(true);
          setError('후기 게시글은 챌린지 후기 화면에서 관리할 수 있습니다.');
          return;
        }

        setForm({
          category: response.category as Exclude<BoardCategory, 'REVIEW'>,
          title: response.title,
          content: response.content,
          pinned: response.pinned,
        });
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : '수정할 게시글을 불러오지 못했습니다.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPost();

    return () => {
      active = false;
    };
  }, [id, isEditMode]);

  const categoryOptions = useMemo<Array<{ value: Exclude<BoardCategory, 'REVIEW'>; label: string }>>(() => {
    const baseOptions: Array<{ value: Exclude<BoardCategory, 'REVIEW'>; label: string }> = [
      { value: 'FREE', label: '자유' },
      { value: 'QNA', label: '질문' },
    ];

    return isAdmin ? [{ value: 'NOTICE', label: '공지' }, ...baseOptions] : baseOptions;
  }, [isAdmin]);

  async function submitForm() {
    setSaving(true);
    setError(null);

    try {
      const payload: BoardPostInput = {
        category: form.category,
        title: form.title.trim(),
        content: form.content.trim(),
        pinned: isAdmin ? Boolean(form.pinned) : false,
      };

      const response =
        isEditMode && id
          ? await updateBoardPost(id, payload)
          : await createBoardPost(payload);

      navigate(`/board/${response.id}`, {
        state: {
          compactToast: {
            message: isEditMode ? '게시글이 수정되었습니다.' : '게시글이 등록되었습니다.',
            type: 'success',
          },
        },
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '게시글을 저장하지 못했습니다.');
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (isEditMode) {
      setSubmitConfirmOpen(true);
      return;
    }

    await submitForm();
  }

  if (loading) {
    return (
      <section className="glass-page board-page-compact">
        <div className="board-compact-shell board-compact-shell--detail">
          <div className="board-compact-empty">
            <strong>게시글 편집 화면을 준비하는 중입니다.</strong>
            <p>기존 내용을 불러오고 있습니다.</p>
          </div>
        </div>
      </section>
    );
  }

  if (reviewManagedPost) {
    return (
      <section className="glass-page board-page-compact">
        <div className="board-compact-shell board-compact-shell--detail">
          <div className="board-compact-empty">
            <strong>후기 게시글은 여기서 수정할 수 없습니다.</strong>
            <p>{error}</p>
            <div className="inline-actions">
              <Link className="button-link button-link--secondary button-link--compact" to={id ? `/board/${id}` : '/board'}>
                게시글로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="glass-page board-page-compact">
      <section className="board-compact-shell board-compact-shell--detail">
        <div className="board-detail-compact__toolbar">
          <div className="board-detail-compact__meta">
            <span className="board-detail-chip">{isEditMode ? '게시글 수정' : '새 게시글'}</span>
            <span className="board-detail-chip">간단하고 빠르게 작성</span>
          </div>

          <div className="inline-actions">
            <Link className="button-link button-link--secondary button-link--compact" to={isEditMode && id ? `/board/${id}` : '/board'}>
              취소
            </Link>
            <button className="button-link button-link--compact" type="submit" form="board-editor-form" disabled={saving}>
              {saving ? '저장 중...' : isEditMode ? '수정 완료' : '등록'}
            </button>
          </div>
        </div>

        <form className="glass-form board-editor-compact" id="board-editor-form" onSubmit={handleSubmit}>
          <div className="board-editor-compact__grid">
            <CompactSegmentedControl
              label="분류"
              value={form.category}
              options={categoryOptions}
              onChange={(nextCategory) =>
                setForm((current) => ({
                  ...current,
                  category: nextCategory as Exclude<BoardCategory, 'REVIEW'>,
                }))
              }
            />

            <label className="glass-field">
              <span>제목</span>
              <input
                type="text"
                maxLength={120}
                value={form.title}
                placeholder="게시글 제목을 입력해 주세요."
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
          </div>

          <label className="glass-field">
            <span>본문</span>
            <textarea
              rows={12}
              maxLength={5000}
              value={form.content}
              placeholder="다른 사용자가 읽기 편하게 내용을 정리해 주세요."
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            />
          </label>

          {isAdmin ? (
            <CompactToggle
              label="상단 고정으로 노출"
              checked={Boolean(form.pinned)}
              onChange={(checked) => setForm((current) => ({ ...current, pinned: checked }))}
            />
          ) : null}

          {error ? <p className="review-composer__message review-composer__message--error">{error}</p> : null}
        </form>
      </section>

      <CompactConfirmDialog
        open={submitConfirmOpen}
        title="게시글 수정"
        description="입력한 내용으로 게시글을 수정합니다. 변경사항은 상세 화면과 목록에 바로 반영됩니다."
        confirmLabel="수정"
        cancelLabel="취소"
        busy={saving}
        onConfirm={async () => {
          await submitForm();
          setSubmitConfirmOpen(false);
        }}
        onCancel={() => {
          if (!saving) {
            setSubmitConfirmOpen(false);
          }
        }}
      />
    </div>
  );
}
