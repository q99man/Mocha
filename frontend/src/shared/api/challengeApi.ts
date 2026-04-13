import { fetchJson, postFormData } from './client';
import type { Challenge, ChallengeAnalysisResult, ChallengeCreateInput, ChallengeReferencePosePreview } from '../types/challenge';

export async function getChallenges(): Promise<Challenge[]> {
  return fetchJson<Challenge[]>('/api/challenges');
}

export async function getChallengeById(id: string | number): Promise<Challenge> {
  return fetchJson<Challenge>(`/api/challenges/${id}`);
}

export async function createChallenge(input: ChallengeCreateInput): Promise<Challenge> {
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('description', input.description);
  formData.append('category', input.category);
  formData.append('difficulty', input.difficulty);
  formData.append('durationSec', String(input.durationSec));
  formData.append('referenceVideo', input.referenceVideo);
  if (input.thumbnailUrl?.trim()) {
    formData.append('thumbnailUrl', input.thumbnailUrl.trim());
  }
  if (input.guideVideoUrl?.trim()) {
    formData.append('guideVideoUrl', input.guideVideoUrl.trim());
  }

  return postFormData<Challenge>('/api/challenges', formData);
}

export async function analyzeChallengeReference(challengeId: number): Promise<ChallengeAnalysisResult> {
  return postFormData<ChallengeAnalysisResult>(`/api/challenges/${challengeId}/analyze-reference`, new FormData());
}

export async function getChallengeReferencePreview(id: string | number): Promise<ChallengeReferencePosePreview> {
  return fetchJson<ChallengeReferencePosePreview>(`/api/challenges/${id}/reference-preview`);
}
