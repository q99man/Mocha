# Durable Progress Contract

## Current rule
- `trackingId` direct 조회가 기본입니다.
- `challengeId` 기반 조회는 fallback 전용입니다.

## UI rule
- 시작 화면, 결과 화면, 기록 목록의 pending 재조회 액션은 `pendingTrackingId`가 있으면 direct 조회만 사용합니다.
- `pendingTrackingId`가 없으면 재조회 대신 안내 문구를 보여줍니다.

## API rule
- `GET /api/attempts/video-processing-progress/{trackingId}`
  - 기본 경로
- `GET /api/attempts/video-processing-progress?challengeId=...`
  - fallback 전용 경로

## Backend rule
- `AttemptProcessingJob`가 durable source of truth입니다.
- `challengeId` 기반 조회 메서드/endpoint는 fallback 역할만 유지합니다.

## Why this matters
- async pending 흐름이 `trackingId` 기준으로 더 직접적이고 안정적으로 이어집니다.
- 다음 기능 작업에서 progress 조회 기준이 다시 흔들리지 않게 합니다.