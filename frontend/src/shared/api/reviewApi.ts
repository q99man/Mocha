import { deleteJson, fetchJson, patchJson, postJson } from './client';
import type { Review, ReviewInput } from '../types/review';

export async function getChallengeReviews(challengeId: string | number): Promise<Review[]> {
  return fetchJson<Review[]>(`/api/challenges/${challengeId}/reviews`);
}

export async function getRecentReviews(limit = 60): Promise<Review[]> {
  return fetchJson<Review[]>(`/api/reviews?limit=${limit}`);
}

export async function createChallengeReview(challengeId: string | number, input: ReviewInput): Promise<Review> {
  return postJson<Review, ReviewInput>(`/api/challenges/${challengeId}/reviews`, input);
}

export async function getMyReviews(): Promise<Review[]> {
  return fetchJson<Review[]>('/api/reviews/me');
}

export async function updateReview(reviewId: string | number, input: ReviewInput): Promise<Review> {
  return patchJson<Review, ReviewInput>(`/api/reviews/${reviewId}`, input);
}

export async function removeReview(reviewId: string | number): Promise<void> {
  return deleteJson(`/api/reviews/${reviewId}`);
}
