export type BoardCategory = 'NOTICE' | 'FREE' | 'QNA' | 'REVIEW';
export type BoardPostSourceType = 'GENERAL' | 'REVIEW_SYNC';

export type BoardPostSummary = {
  id: number;
  category: BoardCategory;
  sourceType: BoardPostSourceType;
  title: string;
  excerpt: string;
  authorDisplayName: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  commentCount: number;
  mine: boolean;
  pinned: boolean;
  reviewId: number | null;
  challengeId: number | null;
  challengeTitle: string | null;
  reviewRating: number | null;
};

export type BoardPost = {
  id: number;
  category: BoardCategory;
  sourceType: BoardPostSourceType;
  title: string;
  content: string;
  authorId: number;
  authorDisplayName: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  commentCount: number;
  mine: boolean;
  pinned: boolean;
  reviewId: number | null;
  challengeId: number | null;
  challengeTitle: string | null;
  reviewRating: number | null;
};

export type BoardComment = {
  id: number;
  postId: number;
  memberId: number;
  memberDisplayName: string;
  content: string;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BoardPostInput = {
  category: Exclude<BoardCategory, 'REVIEW'>;
  title: string;
  content: string;
  pinned?: boolean;
};

export type BoardCommentInput = {
  content: string;
};

export type BoardPostListResponse = {
  items: BoardPostSummary[];
  totalCount: number;
  page: number;
  size: number;
};

export type BoardChallengeReviewSummary = {
  challengeId: number;
  challengeTitle: string;
  reviewCount: number;
  averageRating: number;
};

export type BoardOverview = {
  totalCount: number;
  generalCount: number;
  noticeCount: number;
  reviewCount: number;
  freeCount: number;
  qnaCount: number;
  topReviewChallenges: BoardChallengeReviewSummary[];
};
