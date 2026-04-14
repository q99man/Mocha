# 영속 진행 상태 계약

이 문서는 processing progress를 메모리 상태가 아니라 DB 기반 durable 상태로 다루기 위해 정리했던 보관 문서입니다.

## 핵심 규칙

- `trackingId` 직접 조회가 기본 경로입니다.
- `challengeId` 기반 조회는 fallback 용도입니다.
- 진행 상태는 휘발성 registry보다 `AttemptProcessingJob` 같은 영속 레코드를 우선합니다.

## 현재 기준

- 현재 구현 상태는 실제 코드와 [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)를 함께 봐야 합니다.
