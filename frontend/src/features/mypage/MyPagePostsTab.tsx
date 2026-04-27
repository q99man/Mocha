import { Fragment, type Dispatch, type SetStateAction } from 'react';

import { IconAdd, IconDelete, IconEdit, IconSave } from '../../shared/components/AdminIcons';
import { Pagination } from '../../shared/components/Pagination';
import { CompactSegmentedControl } from '../../shared/components/CompactSegmentedControl';
import type { BoardPost, BoardPostInput, BoardPostSummary } from '../../shared/types/board';

type CategoryOption = { value: BoardPostInput['category']; label: string };

type MyPagePostsTabProps = {
  creatingPost: boolean;
  postsLoading: boolean;
  posts: BoardPostSummary[];
  postDetailsById: Record<number, BoardPost>;
  postDetailLoadingId: number | null;
  postDetailError: string | null;
  expandedPostId: number | null;
  editingPostId: number | null;
  postForm: BoardPostInput;
  postBusy: boolean;
  postPage: number;
  postTotalPages: number;
  categoryOptions: CategoryOption[];
  setPostForm: Dispatch<SetStateAction<BoardPostInput>>;
  onPostPageChange: (page: number) => void;
  onStartCreatePost: () => void;
  onCancelPostEditor: () => void;
  onCreatePost: () => void | Promise<void>;
  onTogglePost: (postId: number) => void | Promise<void>;
  onStartPostEdit: (post: BoardPost) => void;
  onRequestUpdatePost: (postId: number) => void;
  onDeletePost: (postId: number) => void;
  toCategoryLabel: (category: BoardPostSummary['category']) => string;
  formatDate: (value: string) => string;
};

export function MyPagePostsTab({
  creatingPost,
  postsLoading,
  posts,
  postDetailsById,
  postDetailLoadingId,
  postDetailError,
  expandedPostId,
  editingPostId,
  postForm,
  postBusy,
  postPage,
  postTotalPages,
  categoryOptions,
  setPostForm,
  onPostPageChange,
  onStartCreatePost,
  onCancelPostEditor,
  onCreatePost,
  onTogglePost,
  onStartPostEdit,
  onRequestUpdatePost,
  onDeletePost,
  toCategoryLabel,
  formatDate,
}: MyPagePostsTabProps) {
  return (
    <>
      <div className="mypage-inline-toolbar">
        <div className="admin-action-group admin-action-group--inline">
          <button className="button-link button-link--compact admin-action-button" type="button" onClick={onStartCreatePost}>
            <IconAdd />
            <span>글쓰기</span>
          </button>
        </div>
      </div>

      {creatingPost ? (
        <section className="mypage-inline-detail mypage-inline-detail--editor">
          <div className="mypage-inline-detail__header">
            <div>
              <strong>새 게시글 작성</strong>
            </div>
            <div className="admin-action-group admin-action-group--inline">
              <button
                className="button-link button-link--secondary button-link--compact admin-action-button"
                type="button"
                onClick={onCancelPostEditor}
                disabled={postBusy}
              >
                <span>닫기</span>
              </button>
              <button
                className="button-link button-link--compact admin-action-button"
                type="button"
                onClick={() => void onCreatePost()}
                disabled={postBusy || !postForm.title.trim() || !postForm.content.trim()}
              >
                <IconSave />
                <span>{postBusy ? '등록 중...' : '등록하기'}</span>
              </button>
            </div>
          </div>

          <div className="mypage-inline-form">
            <CompactSegmentedControl
              label="분류"
              value={postForm.category}
              options={categoryOptions}
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

        </section>
      ) : null}

      {postsLoading ? (
        <div className="glass-panel glass-panel--nested glass-panel--empty">
          <strong>게시글을 불러오는 중입니다.</strong>
        </div>
      ) : posts.length === 0 ? (
        <div className="glass-panel glass-panel--nested glass-panel--empty">
          <strong>아직 작성한 게시글이 없습니다.</strong>
        </div>
      ) : (
        <div className="admin-hub-compact-table mypage-compact-table">
          <div className="admin-hub-compact-table__head mypage-compact-table__head mypage-compact-table__head--posts" role="presentation">
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
                    className={`admin-hub-compact-row mypage-compact-row mypage-compact-row--posts${isExpanded ? ' is-expanded' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => void onTogglePost(post.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void onTogglePost(post.id);
                      }
                    }}
                  >
                    <div className="mypage-compact-row__status">
                      <span className={`board-compact-badge${post.pinned ? ' is-pinned' : ''}`}>{toCategoryLabel(post.category)}</span>
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
                            <div className="admin-action-group admin-action-group--inline">
                              {!isEditing ? (
                                <>
                                  <button
                                    className="button-link button-link--secondary button-link--compact admin-action-button"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onStartPostEdit(detail);
                                    }}
                                  >
                                    <IconEdit />
                                    <span>수정</span>
                                  </button>
                                  <button
                                    className="button-link button-link--secondary button-link--compact admin-action-button admin-hub-compact__action-btn--danger"
                                    type="button"
                                    disabled={postBusy}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onDeletePost(detail.id);
                                    }}
                                  >
                                    <IconDelete />
                                    <span>{postBusy ? '처리 중...' : '삭제'}</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="button-link button-link--secondary button-link--compact admin-action-button"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onCancelPostEditor();
                                    }}
                                    disabled={postBusy}
                                  >
                                    <span>취소</span>
                                  </button>
                                  <button
                                    className="button-link button-link--compact admin-action-button"
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onRequestUpdatePost(detail.id);
                                    }}
                                    disabled={postBusy || !postForm.title.trim() || !postForm.content.trim()}
                                  >
                                    <IconSave />
                                    <span>{postBusy ? '수정 중...' : '저장'}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {!isEditing ? (
                            <>
                              <div className="mypage-inline-meta">
                                <span>조회 {detail.viewCount}</span>
                                <span>댓글 {detail.commentCount}</span>
                                <span>수정 {formatDate(detail.updatedAt)}</span>
                              </div>
                              <article className="mypage-inline-content">{detail.content}</article>
                            </>
                          ) : (
                            <div className="mypage-inline-form">
                              <CompactSegmentedControl
                                label="분류"
                                value={postForm.category}
                                options={categoryOptions}
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
                          )}

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

      <Pagination currentPage={postPage} totalPages={postTotalPages} onPageChange={onPostPageChange} />
    </>
  );
}
