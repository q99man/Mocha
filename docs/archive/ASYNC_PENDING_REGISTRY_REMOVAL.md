# 비동기 Pending Registry 제거 메모

이 문서는 async pending 처리에서 메모리 registry를 제거하고 durable 흐름으로 옮기던 작업 보관본입니다.

## 핵심 내용

- `PendingAttemptVideoJobRegistry` 제거
- `AttemptProcessingJob` 중심의 durable draft 우선 저장
- registry 없이도 completion과 progress를 이어갈 수 있는 구조 정리

## 현재 기준

- 현재 구현은 실제 `AttemptProcessingJob` 흐름과 관련 서비스 코드를 함께 확인하면 됩니다.
