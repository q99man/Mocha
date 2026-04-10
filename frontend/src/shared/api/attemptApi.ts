import { fetchJson, postFormData, postJson } from './client';
import type {
  AsyncPendingCompletionRequest,
  AttemptCreateRequest,
  AttemptSummary,
  AttemptVideoProcessingJobProgress,
  AttemptVideoResult,
  AttemptVideoUploadRequest,
} from '../types/attempt';

const NOT_FOUND_MESSAGE = 'The requested resource was not found.';
const BAD_REQUEST_MESSAGE = 'The request was rejected. Please review the input and try again.';
const SERVER_ERROR_MESSAGE = 'The server failed while processing the request. Please try again.';

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

export async function createAttempt(request: AttemptCreateRequest): Promise<AttemptSummary> {
  try {
    return await postJson<AttemptSummary, AttemptCreateRequest>('/api/attempts', request);
  } catch (error) {
    if (error instanceof Error && error.message === NOT_FOUND_MESSAGE) {
      throw new Error('The selected challenge could not be found.');
    }
    if (error instanceof Error && error.message === BAD_REQUEST_MESSAGE) {
      throw new Error('The attempt could not be saved. Please review the request and try again.');
    }
    if (error instanceof Error && error.message === SERVER_ERROR_MESSAGE) {
      throw new Error('The server failed while saving the attempt. Please try again.');
    }
    throw new Error('The attempt could not be saved.');
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
      throw new Error('The selected challenge could not be found.');
    }
    if (error instanceof Error && error.message === BAD_REQUEST_MESSAGE) {
      throw new Error('The upload request was rejected. Check the reference analysis status and file.');
    }
    if (error instanceof Error && error.message === SERVER_ERROR_MESSAGE) {
      throw new Error('The server failed while uploading the attempt video. Please try again.');
    }
    throw new Error('The attempt video could not be uploaded.');
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
      throw new Error('The pending upload could not be found.');
    }
    if (error instanceof Error && error.message === BAD_REQUEST_MESSAGE) {
      throw new Error('The tracking id or pending state is invalid.');
    }
    if (error instanceof Error && error.message === SERVER_ERROR_MESSAGE) {
      throw new Error('The server failed while completing the pending upload. Please try again.');
    }
    throw new Error('The pending upload could not be completed.');
  }
}
