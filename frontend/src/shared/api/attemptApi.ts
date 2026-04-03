import { fetchJson, postFormData, postJson } from './client';
import type {
  AttemptCreateRequest,
  AttemptSummary,
  AttemptVideoResult,
  AttemptVideoUploadRequest,
} from '../types/attempt';

export async function getAttempts(): Promise<AttemptSummary[]> {
  return fetchJson<AttemptSummary[]>('/api/attempts');
}

export async function getAttemptById(id: string | number): Promise<AttemptSummary> {
  return fetchJson<AttemptSummary>(`/api/attempts/${id}`);
}

export async function createAttempt(request: AttemptCreateRequest): Promise<AttemptSummary> {
  try {
    return await postJson<AttemptSummary, AttemptCreateRequest>('/api/attempts', request);
  } catch (error) {
    if (error instanceof Error && error.message === '요청한 데이터를 찾을 수 없습니다.') {
      throw new Error('저장할 챌린지를 찾을 수 없습니다.');
    }

    if (error instanceof Error && error.message === '요청 내용을 다시 확인해 주세요.') {
      throw new Error('도전 기록 요청 형식을 다시 확인해 주세요.');
    }

    throw new Error('도전 기록을 저장하지 못했습니다.');
  }
}

export async function uploadAttemptVideo(request: AttemptVideoUploadRequest): Promise<AttemptVideoResult> {
  const formData = new FormData();
  formData.append('challengeId', String(request.challengeId));

  if (request.notes?.trim()) {
    formData.append('notes', request.notes.trim());
  }

  formData.append('attemptVideo', request.attemptVideo);

  try {
    return await postFormData<AttemptVideoResult>('/api/attempts/video', formData);
  } catch (error) {
    if (error instanceof Error && error.message === '요청한 데이터를 찾을 수 없습니다.') {
      throw new Error('업로드할 챌린지를 찾을 수 없습니다.');
    }

    if (error instanceof Error && error.message === '요청 내용을 다시 확인해 주세요.') {
      throw new Error('레퍼런스 분석이 아직 완료되지 않았거나 업로드 형식이 올바르지 않습니다.');
    }

    throw new Error('시도 비디오를 업로드하지 못했습니다.');
  }
}
