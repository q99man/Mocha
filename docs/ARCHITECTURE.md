# ARCHITECTURE

## Repository Shape
```text
/docs
/frontend
/backend
```

## Frontend Modules
- `src/app`: app bootstrap, routing, shared styles
- `src/pages`: route-level pages
- `src/features/challenges`: challenge list/detail UI pieces
- `src/features/attempts`: attempt history UI pieces
- `src/features/motion`: reserved motion-session placeholders
- `src/shared`: shared types, API clients, and common layout

## Backend Modules
- `challenge`: read-only challenge entity, repository, service, controller, DTO, and seed initializer
- `attempt`: create/list attempt stubs for future persistence work
- `member`: reserved package for future identity work
- `scoring`: reserved package for future similarity logic
- `global/config`: Spring configuration such as Redis, CORS, and shared web config
- `global/common`: shared primitives such as health and base entity support

## Data Flow
1. Frontend challenge pages call the backend using explicit fetch-based API helpers.
2. Backend reads active challenge records from JPA.
3. A lightweight startup initializer seeds challenge data for local MVP use.
4. Redis remains limited to a non-critical popular-challenges cache placeholder.
5. Attempt data is still stubbed until persistence work reaches that slice.

## Storage Strategy
- Local runtime: MySQL only, aligned with seeded read flows and MediaPipe verification
- MySQL profile: intended longer-term source of truth and Docker-backed local infra path
- Redis: non-critical cache only

## API Contract Rules
- Use explicit DTOs rather than exposing entities.
- Keep challenge and attempt payloads small and stable.
- Prefer additive changes over breaking route changes.

## Current Constraints
- No advanced pose estimation yet
- No real scoring engine yet
- No full auth yet
- Challenge reads are persisted and seeded, while attempt persistence is still intentionally stubbed
