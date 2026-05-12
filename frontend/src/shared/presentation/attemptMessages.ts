const ATTEMPT_MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Analysis is still running.': '분석이 아직 진행 중입니다.',
  'Waiting for analysis.': '분석 결과를 기다리는 중입니다.',
  'Waiting for the finished score.': '최종 점수를 기다리는 중입니다.',
  'Still waiting for analysis.': '분석 결과를 아직 기다리는 중입니다.',
  'Result ready.': '결과가 준비되었습니다.',
  'Attempt pending': '분석 대기 중',
  'Pending result': '결과 대기 중',
  'Kick result pending': '분석 대기 중',
  'Completed result': '결과 준비 완료',
  'Kick result ready': '결과 준비 완료',
  'Wave result ready': '결과 준비 완료',
  'Completed refreshed summary.': '새로고침된 결과 요약입니다.',
  'Refreshed same-result summary.': '최신 결과 요약입니다.',
  'Auto-scored result summary.': '자동 채점 결과 요약입니다.',
  'Raw headline': '결과',
  'Raw summary': '결과 요약입니다.',
};

const GARBLED_MARKERS = ['�', '??', '?꾨', '?덈', '?ㅼ', '?먯', '?낅', '濡', '遺', '梨', '鍮', '蹂'];

export function normalizeAttemptMessage(value: string | null | undefined, fallback = '') {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const translated = ATTEMPT_MESSAGE_TRANSLATIONS[trimmed];
  if (translated) {
    return translated;
  }

  if (GARBLED_MARKERS.some((marker) => trimmed.includes(marker))) {
    return fallback;
  }

  return value;
}
