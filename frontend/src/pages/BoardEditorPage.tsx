import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { createBoardPost, getBoardPost, updateBoardPost } from '../shared/api/boardApi';
import { useAuth } from '../shared/auth/AuthProvider';
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
          setError('후기 게시글은 챌린지 상세 페이지에서 수정할 수 있습니다.');
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: BoardPostInput = {
        category: form.category,
        title: form.title.trim(),
        content: form.content.trim(),
        pinned: isAdmin ? Boolean(form.pinned) : false,
      };

      const response = isEditMode && id
        ? await updateBoardPost(id, payload)
        : await createBoardPost(payload);

      navigate(`/board/${response.id}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '게시글을 저장하지 못했습니다.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>게시글 편집 화면을 준비하는 중입니다.</strong>
          <p>기존 내용을 불러오고 있습니다.</p>
        </div>
      </section>
    );
  }

  if (reviewManagedPost) {
    return (
      <section className="glass-page">
        <div className="glass-panel glass-panel--empty">
          <strong>후기 게시글은 여기서 수정할 수 없습니다.</strong>
          <p>{error}</p>
          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={id ? `/board/${id}` : '/board'}>
              게시글로 돌아가기
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="glass-page">
      <section className="glass-intro">
        <div>
          <span className="glass-intro__eyebrow">{isEditMode ? 'Edit Post' : 'New Post'}</span>
          <h2>{isEditMode ? '게시글 수정' : '새 게시글 작성'}</h2>
          <p>제목, 카테고리, 본문만 입력하면 바로 게시할 수 있습니다. 챌린지 후기는 상세 페이지에서 자동으로 게시판에 연결됩니다.</p>
        </div>
      </section>

      <section className="glass-panel">
        <form className="glass-form" onSubmit={handleSubmit}>
          <div className="glass-form-grid">
            <label className="glass-select">
              <span>카테고리</span>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as Exclude<BoardCategory, 'REVIEW'> }))}
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="glass-field">
              <span>제목</span>
              <input
                type="text"
                maxLength={120}
                value={form.title}
                placeholder="게시글 제목을 입력해 주세요"
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
          </div>

          <label className="glass-field">
            <span>본문</span>
            <textarea
              rows={14}
              maxLength={5000}
              value={form.content}
              placeholder="다른 사용자가 쉽게 이해할 수 있도록 내용을 작성해 주세요."
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            />
          </label>

          {isAdmin ? (
            <label className="glass-checkbox">
              <input
                type="checkbox"
                checked={Boolean(form.pinned)}
                onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))}
              />
              <span>상단 고정으로 노출</span>
            </label>
          ) : null}

          {error ? <p className="review-composer__message review-composer__message--error">{error}</p> : null}

          <div className="inline-actions">
            <Link className="button-link button-link--secondary" to={isEditMode && id ? `/board/${id}` : '/board'}>
              취소
            </Link>
            <button className="button-link" type="submit" disabled={saving}>
              {saving ? '저장 중...' : isEditMode ? '수정 완료' : '게시글 등록'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
