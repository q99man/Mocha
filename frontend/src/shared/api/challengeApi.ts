import { deleteJson, fetchJson, patchJson, postFormData, putFormData } from './client';
import type {
  Challenge,
  ChallengeAnalysisResult,
  ChallengeCreateInput,
  ChallengeReferencePosePreview,
  ChallengeUpdateInput,
} from '../types/challenge';

export async function getChallenges(): Promise<Challenge[]> {
  return fetchJson<Challenge[]>('/api/challenges');
}

export async function getChallengeById(id: string | number): Promise<Challenge> {
  return fetchJson<Challenge>(`/api/challenges/${id}`);
}

export async function getAdminChallenges(): Promise<Challenge[]> {
  return fetchJson<Challenge[]>('/api/admin/challenges');
}

export async function getAdminChallengeById(id: string | number): Promise<Challenge> {
  return fetchJson<Challenge>(`/api/admin/challenges/${id}`);
}

export async function createChallenge(input: ChallengeCreateInput): Promise<Challenge> {
  const formData = new FormData();
  appendChallengeFormData(formData, input);
  formData.append('referenceVideo', input.referenceVideo);

  return postFormData<Challenge>('/api/admin/challenges', formData);
}

export async function updateChallenge(id: number, input: ChallengeUpdateInput): Promise<Challenge> {
  const formData = new FormData();
  appendChallengeFormData(formData, input);
  if (input.referenceVideo) {
    formData.append('referenceVideo', input.referenceVideo);
  }
  return putFormData<Challenge>(`/api/admin/challenges/${id}`, formData);
}

export async function analyzeChallengeReference(challengeId: number): Promise<ChallengeAnalysisResult> {
  return postFormData<ChallengeAnalysisResult>(`/api/admin/challenges/${challengeId}/analyze-reference`, new FormData());
}

export async function getChallengeReferencePreview(id: string | number): Promise<ChallengeReferencePosePreview> {
  return fetchJson<ChallengeReferencePosePreview>(`/api/challenges/${id}/reference-preview`);
}

export async function getAdminChallengeReferencePreview(id: string | number): Promise<ChallengeReferencePosePreview> {
  return fetchJson<ChallengeReferencePosePreview>(`/api/admin/challenges/${id}/reference-preview`);
}

export async function deleteChallenge(id: number): Promise<void> {
  return deleteJson(`/api/admin/challenges/${id}`);
}

export async function updateChallengeActive(id: number, isActive: boolean): Promise<Challenge> {
  return patchJson<Challenge, { isActive: boolean }>(`/api/admin/challenges/${id}/active`, { isActive });
}

function appendChallengeFormData(formData: FormData, input: Omit<ChallengeUpdateInput, 'referenceVideo'>) {
  formData.append('title', input.title);
  formData.append('description', input.description);
  formData.append('category', input.category);
  formData.append('difficulty', input.difficulty);
  formData.append('durationSec', String(input.durationSec));
  if (input.thumbnailUrl?.trim()) {
    formData.append('thumbnailUrl', input.thumbnailUrl.trim());
  }
  if (input.guideVideoUrl?.trim()) {
    formData.append('guideVideoUrl', input.guideVideoUrl.trim());
  }
}
