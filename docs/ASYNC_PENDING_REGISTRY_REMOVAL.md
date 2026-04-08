# ASYNC PENDING REGISTRY REMOVAL

## 현재 상태
- `PendingAttemptVideoJobRegistry`는 메인 코드에서 제거되었습니다.
- async pending 생성은 `AttemptProcessingJob` durable draft를 먼저 저장하는 방식으로 동작합니다.
- progress 조회는 `AttemptProcessingJob` 기준으로 최신 상태를 읽습니다.
- completion은 `AttemptProcessingJob`에 저장된 업로드 메타를 복원해서 이어갑니다.

## 전환 결과
- 메모리 registry는 더 이상 source of truth가 아닙니다.
- async pending의 생성, 조회, 완료 핵심 경로는 durable progress 기준으로 정리되었습니다.
- 현재 남아 있는 과도기 흔적은 제거 문서와 일부 오래된 TODO 정리 정도입니다.

## 실제로 제거된 것
- registry 클래스 제거
- registry 기반 생성 경로 제거
- registry 기반 completion 경로 제거
- registry 의존 통합 테스트 정리

## 다음 기준
- 앞으로 async pending 관련 확장은 `AttemptProcessingJob`을 기준으로 진행합니다.
- 새 progress 메타가 필요하면 registry가 아니라 durable entity와 endpoint 응답에 추가합니다.
