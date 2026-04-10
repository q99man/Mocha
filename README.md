# Motion Challenge Platform

Motion Challenge Platform is a web MVP for short, genre-agnostic motion challenges. Users can browse challenges, open a detail page, start a camera flow later, receive a similarity-based score, and review attempt history.

This repository currently contains a docs-first foundation plus minimal runnable frontend and backend shells. Advanced motion logic, auth, and rich persistence are intentionally deferred.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Spring Boot + Gradle + Spring Data JPA + MySQL
- Infra: Docker Compose for MySQL and Redis
- Redis: cache stub only, not source of truth

## Repository Layout

```text
docs/
frontend/
backend/
```

## Local Development

### Quick local run

1. Start the backend with the default local profile:

```bash
cd backend
gradlew.bat bootRun
```

This uses an in-memory H2 database. If you want to verify motion-session or upload flows, create a challenge with a reference video first.

2. Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:8080` by default.

### MediaPipe bridge verification run

If you want the backend to use the real HTTP bridge shape instead of the in-process MediaPipe stub:

1. Start the FastAPI bridge:

```powershell
cd mediapipe-bridge
.\run-bridge.ps1
```

2. Start the backend with MediaPipe HTTP mode:

```powershell
cd backend
.\run-mediapipe-http.ps1
```

3. Then use the normal challenge reference analysis and attempt upload flow.

Quick stack verification:

```powershell
cd C:\SpringWork\Mocha
.\verify-mediapipe-stack.ps1
```

If the local H2 database is empty, you can provision a temporary verification challenge from a local video in one command:

```powershell
cd C:\SpringWork\Mocha
.\verify-mediapipe-stack.ps1 -ReferenceVideoPath 'C:\path\to\reference.mp4' -ForceProvisionChallenge
```

For a full reference-analysis plus attempt-upload smoke run, add `-ForceUploadAttempt`. If `-AttemptVideoPath` is omitted, the script reuses `-ReferenceVideoPath`.

```powershell
cd C:\SpringWork\Mocha
.\verify-mediapipe-stack.ps1 -ReferenceVideoPath 'C:\path\to\reference.mp4' -ForceProvisionChallenge -ForceUploadAttempt
```

Detailed verification steps are in [docs/MEDIAPIPE_BRIDGE_VERIFICATION.md](C:\SpringWork\Mocha\docs\MEDIAPIPE_BRIDGE_VERIFICATION.md).

### Docker-backed infra run

1. Copy `.env.example` values into your shell or a local `.env` file.
2. Start infrastructure:

```bash
docker compose up -d mysql redis
```

3. Start the backend against MySQL:

```bash
cd backend
set SPRING_PROFILES_ACTIVE=mysql
gradlew.bat bootRun
```

4. Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

### MySQL profile note

- `backend/src/main/resources/application-mysql.yml` uses MySQL as the source of truth and keeps `spring.jpa.hibernate.ddl-auto=update`, so tables are created automatically when the backend starts successfully with the `mysql` profile.
- `.env.example` defaults to `MYSQL_USERNAME=motion`, `MYSQL_PASSWORD=motion`, but your actual local MySQL account may be different.
- If local MySQL uses a different account, override one of these before startup:
  - environment variables such as `MYSQL_USERNAME`, `MYSQL_PASSWORD`, `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`
  - or `backend/src/main/resources/application-mysql.yml` for temporary local verification
- In this repository, MySQL profile verification was confirmed by starting the built backend JAR against a real local MySQL instance and checking that the schema and seed data were created.

### Timezone note

- MySQL JDBC timezone is configured with `${MYSQL_TIMEZONE:Asia/Seoul}`.
- Hibernate JDBC timezone is also aligned to `${MYSQL_TIMEZONE:Asia/Seoul}`.
- Add `MYSQL_TIMEZONE=Asia/Seoul` to your local environment if you want explicit control over stored timestamp behavior.

### Fallback verification path

- If `docker compose` is not available in the current shell, you can still verify the MySQL profile by:
  1. ensuring a local MySQL instance is reachable
  2. creating the target database if needed
  3. starting the built backend JAR with `--spring.profiles.active=mysql`
- This confirms schema creation and seed loading even when Docker CLI access is temporarily unavailable.

## Current MVP Foundation

- Frontend routes for `/`, `/challenges`, `/challenges/:id`, and `/attempts`
- Shared layout and feature-oriented folders
- Backend health endpoint
- Backend challenge read API backed by JPA and startup seed data
- Backend attempt create/list stubs
- Redis-backed popular challenges cache stub with safe fallback
- Docker Compose for MySQL and Redis

## What Is Intentionally Not Implemented Yet

- Pose estimation
- Camera session handling
- Real similarity scoring
- Full auth
- Persistent attempt storage
- Ranking logic

## Docker Notes

- `docker-compose.yml` currently manages MySQL and Redis because those unlock backend development immediately.
- A backend `Dockerfile` is included for later containerization and CI use.
- A frontend `Dockerfile` is intentionally skipped for now because Vite's local dev server is the most practical MVP workflow, and adding a container here would increase setup surface without helping iteration speed yet.
