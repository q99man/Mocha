import type { AttemptSummary, AttemptVideoProcessingJobProgress } from '../types/attempt';

type DurableProgressMessageOptions = {
  sourceLabel?: string;
};

export function buildDurableProgressHeadline(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return 'Processing status';
  }

  switch (progress.status) {
    case 'PENDING':
      return 'Queued for analysis';
    case 'PROCESSING':
      return 'Analysis and scoring in progress';
    case 'COMPLETED':
      return 'Result ready';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH' ? 'Failure needs inspection' : 'Retry available';
    default:
      return 'Processing status';
  }
}

export function buildDurableProgressSummary(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return 'Waiting for the first durable progress snapshot.';
  }

  switch (progress.status) {
    case 'PENDING':
      return 'Upload accepted. The worker has not started analysis yet.';
    case 'PROCESSING':
      return 'Analysis is running now. Refresh if you want a newer snapshot.';
    case 'COMPLETED':
      return progress.resultAttemptId
        ? `Result #${progress.resultAttemptId} is ready to open.`
        : 'Processing finished and the result is ready.';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH'
        ? 'Processing failed and needs inspection before another attempt.'
        : 'Processing failed, but another retry may help.';
    default:
      return 'Durable progress was refreshed.';
  }
}

export function buildDurableProgressFailureAction(action: AttemptVideoProcessingJobProgress['failureAction']) {
  switch (action) {
    case 'RETRY_UPLOAD':
      return 'Retry the upload after confirming the selected file is correct.';
    case 'CHECK_STORAGE':
      return 'Check storage access and confirm the uploaded file is still available.';
    case 'RETRY_ANALYSIS':
      return 'Retry analysis from this screen.';
    case 'RETRY_SCORING':
      return 'Retry scoring from this screen.';
    default:
      return 'Review the failure notice, then try again.';
  }
}

export function buildDurableProgressRefreshMessage(
  progress: AttemptVideoProcessingJobProgress,
  options?: DurableProgressMessageOptions,
) {
  const summary = buildDurableProgressSummary(progress);
  if (!options?.sourceLabel) {
    return summary;
  }

  return `${options.sourceLabel}: ${summary}`;
}

export function buildDurableProgressCompletionLinkLabel() {
  return 'Open completed result';
}

export function buildDurableProgressCompletionLinkDescription() {
  return 'Jump directly to the completed result page.';
}

export function buildDurableProgressCompletionStrategyLabel(
  strategy: AttemptVideoProcessingJobProgress['completionStrategy'] | null | undefined,
) {
  switch (strategy) {
    case 'AUTO_RUNNER':
      return 'Automatic runner';
    case 'MANUAL_COMPLETION':
      return 'Manual completion required';
    case 'INLINE_FLOW':
      return 'Inline processing';
    default:
      return 'Unknown';
  }
}

export function buildDurableProgressElapsedTimeLabel(elapsedSeconds: number | null | undefined) {
  if (elapsedSeconds == null) {
    return 'Unknown';
  }
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`;
  }
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function buildDurableProgressRetryWindowLabel(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return 'Unknown';
  }
  if (!progress.autoRetryEnabled) {
    return 'Auto retry disabled';
  }
  if (progress.autoRetryExhausted) {
    return 'Auto retry exhausted';
  }
  return `${progress.remainingAutoRetryCount} auto retries left`;
}

export function buildDurableProgressOriginalFileLabel(progress: AttemptVideoProcessingJobProgress | null) {
  return progress?.originalFileName ?? 'Unknown file';
}

export function buildDurableProgressSnapshotFromAttempt(
  attempt: AttemptSummary | null,
): AttemptVideoProcessingJobProgress | null {
  if (!attempt || !attempt.processingMode || !attempt.durableProgressStatus) {
    return null;
  }

  return {
    trackingId: attempt.pendingTrackingId ?? `attempt-${attempt.id}`,
    challengeId: attempt.challengeId,
    status: attempt.durableProgressStatus,
    processingMode: attempt.processingMode,
    completionStrategy:
      attempt.completionStrategy ??
      (attempt.processingMode === 'ASYNC_JOB_PENDING' ? 'MANUAL_COMPLETION' : 'INLINE_FLOW'),
    runtimeState: null,
    processingNotice: attempt.processingNotice,
    failureCode: null,
    failureSeverity: null,
    failureAction: null,
    retryRecommended: false,
    processingAttempts: 0,
    retryCount: 0,
    autoRetryEnabled: attempt.autoRetryEnabled,
    remainingAutoRetryCount: attempt.remainingAutoRetryCount,
    autoRetryExhausted: attempt.autoRetryExhausted,
    resultAttemptId: attempt.processingComplete ? attempt.id : null,
    originalFileName: attempt.originalFileName,
    createdAt: attempt.attemptedAt,
    updatedAt: attempt.attemptedAt,
    elapsedSeconds: attempt.elapsedSeconds ?? 0,
  };
}
