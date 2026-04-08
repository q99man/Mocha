// Durable progress contract:
// 1) Active UI flows should prefer trackingId direct lookup.
// 2) challengeId-based lookup is fallback-only.
// 3) Screens should reuse these helpers so pending/processing/completed/failed messages stay aligned.

import type { AttemptSummary, AttemptVideoProcessingJobProgress } from '../types/attempt';

type DurableProgressMessageOptions = {
  sourceLabel?: string;
};

export function buildDurableProgressHeadline(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return '처리 작업 상태';
  }

  switch (progress.status) {
    case 'PENDING':
      return '처리 대기 중';
    case 'PROCESSING':
      return '분석/채점 진행 중';
    case 'COMPLETED':
      return '처리 완료';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH' ? '중요 실패 확인 필요' : '재확인 필요';
    default:
      return '처리 작업 상태';
  }
}

export function buildDurableProgressSummary(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return '대기 중인 처리 작업을 아직 확인하지 못했습니다. 잠시 후 상태를 다시 확인해 주세요.';
  }

  switch (progress.status) {
    case 'PENDING':
      return 'durable progress 기준으로 아직 처리 대기 중입니다. 잠시 후 상태를 다시 확인한 뒤 이어서 진행해 주세요.';
    case 'PROCESSING':
      return 'durable progress 기준으로 분석과 채점이 진행 중입니다. 잠시 후 상태를 다시 확인한 뒤 이어서 진행해 주세요.';
    case 'COMPLETED':
      return progress.resultAttemptId
        ? `durable progress 기준으로 처리 완료를 확인했습니다. 완료 결과 #${progress.resultAttemptId}로 바로 이동할 수 있습니다.`
        : 'durable progress 기준으로 처리 완료를 확인했습니다.';
    case 'FAILED':
      return progress.processingNotice ?? 'durable progress 기준으로 실패 상태를 확인했습니다. 안내 문구를 다시 확인해 주세요.';
    default:
      return 'durable progress 상태를 다시 확인했습니다. 현재 단계에 맞게 이어서 진행해 주세요.';
  }
}

export function buildDurableProgressFailureAction(action: AttemptVideoProcessingJobProgress['failureAction']) {
  switch (action) {
    case 'RETRY_UPLOAD':
      return '영상을 다시 업로드한 뒤 상태를 다시 확인하고 이어서 진행해 주세요.';
    case 'CHECK_STORAGE':
      return '업로드 파일 저장 상태를 다시 확인한 뒤 이어서 다시 시도해 주세요.';
    case 'RETRY_ANALYSIS':
      return '분석을 다시 시도한 뒤 상태를 다시 확인해 주세요.';
    case 'RETRY_SCORING':
      return '채점을 다시 시도한 뒤 상태를 다시 확인해 주세요.';
    default:
      return '안내 문구를 다시 확인한 뒤 이어서 진행해 주세요.';
  }
}

export function buildDurableProgressRefreshMessage(
  progress: AttemptVideoProcessingJobProgress,
  options?: DurableProgressMessageOptions,
) {
  const prefix = options?.sourceLabel ? `${options.sourceLabel} 기준으로 ` : '';
  const summary = buildDurableProgressSummary(progress);
  return prefix ? summary.replace('durable progress 기준으로 ', prefix) : summary;
}
export function buildDurableProgressCompletionLinkLabel() {
  return '완료 결과 바로 보기';
}

export function buildDurableProgressCompletionLinkDescription() {
  return '결과 화면에서 바로 이어서 확인할 수 있습니다.';
}
export function buildDurableProgressCompletionStrategyLabel(
  strategy: AttemptVideoProcessingJobProgress['completionStrategy'] | null | undefined,
) {
  switch (strategy) {
    case 'AUTO_RUNNER':
      return '백그라운드 자동 완료';
    case 'MANUAL_COMPLETION':
      return '로컬 완료 처리 필요';
    case 'INLINE_FLOW':
      return '즉시 처리 완료';
    default:
      return '확인 대기';
  }
}

export function buildDurableProgressElapsedTimeLabel(elapsedSeconds: number | null | undefined) {
  if (elapsedSeconds == null) {
    return '측정 전';
  }
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}초`;
  }
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}

export function buildDurableProgressRetryWindowLabel(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return '확인 전';
  }
  if (!progress.autoRetryEnabled) {
    return '자동 재시도 없음';
  }
  if (progress.autoRetryExhausted) {
    return '자동 재시도 소진';
  }
  return '남은 자동 재시도 ' + progress.remainingAutoRetryCount + '회';
}

export function buildDurableProgressOriginalFileLabel(progress: AttemptVideoProcessingJobProgress | null) {
  return progress?.originalFileName ?? '이름 확인 전';
}

export function buildDurableProgressSnapshotFromAttempt(attempt: AttemptSummary | null): AttemptVideoProcessingJobProgress | null {
  if (!attempt || !attempt.processingMode || !attempt.durableProgressStatus) {
    return null;
  }

  return {
    trackingId: attempt.pendingTrackingId ?? "attempt-",
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
