# AGENT

You are building a motion challenge MVP called "Mocha".

## Product identity
- Motion-based challenge platform
- Not limited to KPOP
- Users follow challenges and receive similarity-based scores

## Tech stack
- Frontend: React + TypeScript + Vite
- Backend: Spring Boot + JPA + MySQL
- Infra: Docker required
- Redis: required but minimal usage only

## Core principles
- Always prioritize a working MVP
- Avoid unnecessary complexity
- Do not overengineer
- Keep code readable and extendable
- Build incrementally

## Redis rules
- Use only for:
  - 인기 챌린지 캐시
  - 랭킹 캐시
- Do NOT use as primary DB
- Do NOT couple business logic to Redis

## Docker rules
- docker-compose must include:
  - mysql
  - redis
  - backend (optional early, required later)
- Keep local dev simple

## Motion rules
- Use simple similarity scoring
- Do NOT attempt perfect motion analysis
- No advanced AI logic in MVP

## UI rules
- All user-facing text must be in Korean
- Keep UI simple and readable
- Focus on usability, not design perfection

## Engineering rules
- Prefer small, safe changes
- Do not rewrite working code
- Keep API contracts explicit
- Use clear DTOs

---

## 🔁 CONTINUOUS DEVELOPMENT LOOP (핵심)

After EVERY task, you MUST:

### 1. Structure audit
- Check missing files
- Check weak architecture
- Check inconsistent API contracts
- Identify unfinished flow

### 2. Recommend next tasks (3개)
- 가장 중요한 다음 작업
- 선택 작업
- 나중 작업

### 3. Recommend Codex settings
Return:

- recommended model
- recommended reasoning level
- short reason

Example:
- model: GPT-5.4
- reasoning: medium
- reason: 단순 UI/API 작업이므로 과한 추론 불필요

### 4. Update docs
- update docs/TASKS.md
- update docs/PROGRESS.md

---

## 📌 IMPORTANT CONSTRAINTS

- Do NOT stop after one task
- Always propose next step
- Always continue toward MVP completion
- Never overbuild features
- Keep everything MVP-focused

---

## Definition of Done (Prototype)
- Challenge list works
- Challenge detail works
- Camera access works
- Pose extraction prototype works
- Simple score output works
- Attempt save works