import { fetchJson, postFormData } from './client';
import type {
  AttemptSummary,
  AttemptVideoProcessingJobProgress,
  AttemptVideoResult,
  AttemptVideoUploadRequest,
} from '../types/attempt';

const NOT_FOUND_MESSAGE = '요청한 정보를 찾을 수 없습니다.';
const BAD_REQUEST_MESSAGE = '요청이 거부되었습니다. 입력값을 확인한 뒤 다시 시도해 주세요.';
const SERVER_ERROR_MESSAGE = '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

export async function getAttempts(): Promise<AttemptSummary[]> {
  return fetchJson<AttemptSummary[]>('/api/attempts');
}

export async function getAttemptById(id: string | number): Promise<AttemptSummary> {
  return fetchJson<AttemptSummary>(`/api/attempts/${id}`);
}

export async function getAttemptVideoProcessingProgressByChallengeId(
  challengeId: number,
): Promise<AttemptVideoProcessingJobProgress> {
  const query = new URLSearchParams({ challengeId: String(challengeId) });

  return fetchJson<AttemptVideoProcessingJobProgress>(
    `/api/attempts/video-processing-progress?${query.toString()}`,
  );
}

export async function getAttemptVideoProcessingProgressByTrackingId(
  trackingId: string,
): Promise<AttemptVideoProcessingJobProgress> {
  return fetchJson<AttemptVideoProcessingJobProgress>(
    `/api/attempts/video-processing-progress/${encodeURIComponent(trackingId)}`,
  );
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
      throw new Error('선택한 챌린지를 찾을 수 없습니다.');
    }
    if (error instanceof Error && error.message === BAD_REQUEST_MESSAGE) {
      throw new Error('업로드 요청이 거부되었습니다. 레퍼런스 분석 상태와 파일을 확인해 주세요.');
    }
    if (error instanceof Error && error.message === SERVER_ERROR_MESSAGE) {
      throw new Error('시도 영상 업로드 중 서버 오류가 발생했습니다. 다시 시도해 주세요.');
    }
    throw new Error('시도 영상을 업로드하지 못했습니다.');
  }
}

