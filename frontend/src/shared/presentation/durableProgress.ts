import type { AttemptSummary, AttemptVideoProcessingJobProgress } from '../types/attempt';

type DurableProgressMessageOptions = {
  sourceLabel?: string;
};

export function buildDurableProgressHeadline(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return '처리 상태';
  }

  switch (progress.status) {
    case 'PENDING':
      return '분석 대기 중';
    case 'PROCESSING':
      return '분석 및 채점 진행 중';
    case 'COMPLETED':
      return '결과 준비 완료';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH' ? '확인 필요한 실패' : '재시도 가능';
    default:
      return '처리 상태';
  }
}

export function buildDurableProgressCalloutTitle(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return '처리 상태 확인 필요';
  }

  switch (progress.status) {
    case 'COMPLETED':
      return '결과 준비 완료';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH' ? '확인 필요한 실패' : '재시도 가능';
    case 'PROCESSING':
    case 'PENDING':
    default:
      return '처리 상태 확인 필요';
  }
}

export function buildDurableProgressSummary(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return '첫 진행 상태 정보를 기다리는 중입니다.';
  }

  switch (progress.status) {
    case 'PENDING':
      return '업로드가 접수되었습니다. 아직 분석 작업이 시작되지 않았습니다.';
    case 'PROCESSING':
      return '지금 분석이 진행 중입니다. 새 상태를 보려면 새로고침해 주세요.';
    case 'COMPLETED':
      return progress.resultAttemptId
        ? `결과 #${progress.resultAttemptId}를 바로 열 수 있습니다.`
        : '처리가 완료되었고 결과를 확인할 수 있습니다.';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH'
        ? '처리에 실패했습니다. 다음 시도 전에 확인이 필요합니다.'
        : '처리에 실패했지만 다시 시도하면 해결될 수 있습니다.';
    default:
      return '진행 상태를 새로 불러왔습니다.';
  }
}

export function buildDurableProgressStatusTag(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return '대기 중';
  }

  switch (progress.status) {
    case 'PENDING':
      return '대기';
    case 'PROCESSING':
      return '진행 중';
    case 'COMPLETED':
      return '완료';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH' ? '확인 필요' : '재시도 가능';
    default:
      return '대기 중';
  }
}

export function buildDurableProgressTone(
  progress: AttemptVideoProcessingJobProgress | null,
): 'pending' | 'processing' | 'completed' | 'failed-warn' | 'failed-high' {
  if (!progress) {
    return 'pending';
  }

  switch (progress.status) {
    case 'PROCESSING':
      return 'processing';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return progress.failureSeverity === 'HIGH' ? 'failed-high' : 'failed-warn';
    case 'PENDING':
    default:
      return 'pending';
  }
}

export function buildDurableProgressNextStep(progress: AttemptVideoProcessingJobProgress | null) {
  if (!progress) {
    return '첫 진행 상태가 잡히면 이 카드를 새로고침해 주세요.';
  }

  switch (progress.status) {
    case 'PENDING':
      return '지금 업로드를 유지한 채 잠시 후 이 카드를 새로고침해 주세요.';
    case 'PROCESSING':
      return '이 화면을 유지한 채 최신 채점 상태가 필요할 때 새로고침해 주세요.';
    case 'COMPLETED':
      return progress.resultAttemptId
        ? `결과 #${progress.resultAttemptId}를 열어 최종 점수를 확인해 주세요.`
        : '결과 ID가 표시되면 바로 열어 확인해 주세요.';
    case 'FAILED':
      return buildDurableProgressFailureAction(progress.failureAction);
    default:
      return '계속하려면 이 카드를 새로고침해 주세요.';
  }
}

export function buildDurableProgressFailureAction(action: AttemptVideoProcessingJobProgress['failureAction']) {
  switch (action) {
    case 'RETRY_UPLOAD':
      return '선택한 파일이 맞는지 확인한 뒤 다시 업로드해 주세요.';
    case 'CHECK_STORAGE':
      return '저장소 접근 상태와 업로드 파일 존재 여부를 확인해 주세요.';
    case 'RETRY_ANALYSIS':
      return '이 화면에서 분석을 다시 시도해 주세요.';
    case 'RETRY_SCORING':
      return '이 화면에서 채점을 다시 시도해 주세요.';
    default:
      return '실패 안내를 확인한 뒤 다시 시도해 주세요.';
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
  return '완료된 결과 열기';
}

export function buildDurableProgressCompletionLinkDescription() {
  return '완료된 결과 페이지로 바로 이동합니다.';
}

export function buildDurableProgressCompletionStrategyLabel(
  strategy: AttemptVideoProcessingJobProgress['completionStrategy'] | null | undefined,
) {
  switch (strategy) {
    case 'AUTO_RUNNER':
      return '자동 처리';
    case 'MANUAL_COMPLETION':
      return '수동 완료 필요';
    case 'INLINE_FLOW':
      return '즉시 처리';
    default:
      return '알 수 없음';
  }
}

export function buildDurableProgressElapsedTimeLabel(elapsedSeconds: number | null | undefined) {
  if (elapsedSeconds == null) {
    return '알 수 없음';
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
    return '알 수 없음';
  }
  if (!progress.autoRetryEnabled) {
    return '자동 재시도 꺼짐';
  }
  if (progress.autoRetryExhausted) {
    return '자동 재시도 소진';
  }
  return `자동 재시도 ${progress.remainingAutoRetryCount}회 남음`;
}

export function buildDurableProgressOriginalFileLabel(progress: AttemptVideoProcessingJobProgress | null) {
  return progress?.originalFileName ?? '알 수 없는 파일';
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
