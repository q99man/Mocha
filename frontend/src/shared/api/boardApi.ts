import { deleteJson, fetchJson, patchJson, postJson } from './client';
import type {
  BoardComment,
  BoardCommentInput,
  BoardOverview,
  BoardPost,
  BoardPostInput,
  BoardPostListResponse,
  BoardPostSourceType,
} from '../types/board';

type GetBoardPostsParams = {
  page?: number;
  size?: number;
  category?: string;
  sourceType?: 'ALL' | BoardPostSourceType;
  challengeId?: number | null;
  keyword?: string;
};

export async function getBoardPosts(params: GetBoardPostsParams = {}): Promise<BoardPostListResponse> {
  const searchParams = new URLSearchParams();

  if (params.page != null) searchParams.set('page', String(params.page));
  if (params.size != null) searchParams.set('size', String(params.size));
  if (params.category && params.category !== 'ALL') searchParams.set('category', params.category);
  if (params.sourceType && params.sourceType !== 'ALL') searchParams.set('sourceType', params.sourceType);
  if (params.challengeId != null) searchParams.set('challengeId', String(params.challengeId));
  if (params.keyword?.trim()) searchParams.set('keyword', params.keyword.trim());

  const query = searchParams.toString();
  return fetchJson<BoardPostListResponse>(`/api/board/posts${query ? `?${query}` : ''}`);
}

export async function getBoardOverview(): Promise<BoardOverview> {
  return fetchJson<BoardOverview>('/api/board/posts/overview');
}

export async function getMyBoardPosts(page = 1, size = 10): Promise<BoardPostListResponse> {
  return fetchJson<BoardPostListResponse>(`/api/board/posts/me?page=${page}&size=${size}`);
}

export async function getMyBoardPostsBySource(
  page = 1,
  size = 10,
  sourceType?: 'ALL' | BoardPostSourceType,
): Promise<BoardPostListResponse> {
  const searchParams = new URLSearchParams({
    page: String(page),
    size: String(size),
  });

  if (sourceType && sourceType !== 'ALL') {
    searchParams.set('sourceType', sourceType);
  }

  return fetchJson<BoardPostListResponse>(`/api/board/posts/me?${searchParams.toString()}`);
}

export async function getBoardPost(postId: string | number): Promise<BoardPost> {
  return fetchJson<BoardPost>(`/api/board/posts/${postId}`);
}

export async function createBoardPost(input: BoardPostInput): Promise<BoardPost> {
  return postJson<BoardPost, BoardPostInput>('/api/board/posts', input);
}

export async function updateBoardPost(postId: string | number, input: BoardPostInput): Promise<BoardPost> {
  return patchJson<BoardPost, BoardPostInput>(`/api/board/posts/${postId}`, input);
}

export async function removeBoardPost(postId: string | number): Promise<void> {
  return deleteJson(`/api/board/posts/${postId}`);
}

export async function getBoardComments(postId: string | number): Promise<BoardComment[]> {
  return fetchJson<BoardComment[]>(`/api/board/posts/${postId}/comments`);
}

export async function createBoardComment(postId: string | number, input: BoardCommentInput): Promise<BoardComment> {
  return postJson<BoardComment, BoardCommentInput>(`/api/board/posts/${postId}/comments`, input);
}

export async function updateBoardComment(commentId: string | number, input: BoardCommentInput): Promise<BoardComment> {
  return patchJson<BoardComment, BoardCommentInput>(`/api/board/comments/${commentId}`, input);
}

export async function removeBoardComment(commentId: string | number): Promise<void> {
  return deleteJson(`/api/board/comments/${commentId}`);
}
