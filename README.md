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

This uses an in-memory H2 database and seeds a small challenge catalog automatically.

2. Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:8080` by default.

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
