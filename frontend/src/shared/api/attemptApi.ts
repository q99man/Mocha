import { fetchJson, postFormData, postJson } from './client';
import type {
  AsyncPendingCompletionRequest,
  AttemptCreateRequest,
  AttemptVideoProcessingJobProgress,
  AttemptSummary,
  AttemptVideoResult,
  AttemptVideoUploadRequest,
} from '../types/attempt';

const NOT_FOUND_MESSAGE = '요청한 데이터를 찾을 수 없습니다.';
const BAD_REQUEST_MESSAGE = '요청 내용을 다시 확인해 주세요.';
const SERVER_ERROR_MESSAGE = '서버 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';

export async function getAttempts(): Promise<AttemptSummary[]> {
  return fetchJson<AttemptSummary[]>('/api/attempts');
}

export async function getAttemptById(id: string | number): Promise<AttemptSummary> {
  return fetchJson<AttemptSummary>(`/api/attempts/${id}`);
}

export async function getAttemptVideoProcessingProgress(
  challengeId: number,
  trackingId?: string | null,
): Promise<AttemptVideoProcessingJobProgress> {
  const query = new URLSearchParams({ challengeId: String(challengeId) });
  if (trackingId) {
    query.set('trackingId', trackingId);
  }

  return fetchJson<AttemptVideoProcessingJobProgress>(
    `/api/attempts/video-processing-progress?${query.toString()}`,
  );
}

export async function createAttempt(request: AttemptCreateRequest): Promise<AttemptSummary> {
  try {
    return await postJson<AttemptSummary, AttemptCreateRequest>('/api/attempts', request);
  } catch (error) {
    if (error instanceof Error && error.message === NOT_FOUND_MESSAGE) {
      throw new Error('저장할 챌린지를 찾을 수 없습니다.');
    }

    if (error instanceof Error && error.message === BAD_REQUEST_MESSAGE) {
      throw new Error('준비 기록 요청 형식을 다시 확인해 주세요.');
    }

    if (error instanceof Error && error.message === SERVER_ERROR_MESSAGE) {
      throw new Error('준비 기록 저장 중 서버 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }

    throw new Error('준비 기록을 저장하지 못했습니다.');
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
    if (error instanceof Error && error.message === NOT_FOUND_MESSAGE) {
      throw new Error('업로드할 챌린지를 찾을 수 없습니다.');
    }

    if (error instanceof Error && error.message === BAD_REQUEST_MESSAGE) {
      throw new Error('레퍼런스 분석 상태나 업로드 요청 형식을 다시 확인해 주세요.');
    }

    if (error instanceof Error && error.message === SERVER_ERROR_MESSAGE) {
      throw new Error('시도 비디오 업로드 처리 중 서버 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }

    throw new Error('시도 비디오를 업로드하지 못했습니다.');
  }
}

export async function completeAsyncPendingAttempt(
  request: AsyncPendingCompletionRequest,
): Promise<AttemptVideoResult> {
  try {
    return await postJson<AttemptVideoResult, AsyncPendingCompletionRequest>(
      '/api/scoring/async-pending-completion',
      request,
    );
  } catch (error) {
    if (error instanceof Error && error.message === NOT_FOUND_MESSAGE) {
      throw new Error('완료 처리할 대기 업로드를 찾을 수 없습니다.');
    }

    if (error instanceof Error && error.message === BAD_REQUEST_MESSAGE) {
      throw new Error('대기 업로드 상태나 추적 ID를 다시 확인해 주세요.');
    }

    if (error instanceof Error && error.message === SERVER_ERROR_MESSAGE) {
      throw new Error('대기 업로드 완료 처리 중 서버 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }

    throw new Error('대기 중인 업로드를 완료 처리하지 못했습니다.');
  }
}
