# Motion Challenge Platform — Codex Harness Starter

## 1. Project One-liner
A motion-recognition challenge platform where users follow short challenges with a phone or webcam, receive similarity-based scores, and track their results.

## 2. Product Goal
Build an MVP web service that lets a user:
1. browse challenges
2. open a challenge detail page
3. start a camera session
4. capture pose data
5. compare motion against a reference template
6. view a score/result screen
7. save attempt history

## 3. Scope Strategy
### In scope (MVP)
- Email/social-free simple auth or mock auth
- Challenge list / detail
- Webcam-based challenge run
- Pose keypoint extraction
- Reference pose template comparison
- Simple scoring (overall similarity)
- Attempt history page
- Admin seed data or simple admin input page

### Out of scope (for now)
- Native mobile app
- Perfect real-time coaching
- 3D motion analysis
- Video editing / auto clip generation
- Real-time multiplayer battles
- Complex creator economy

## 4. Core User Flow
1. User signs in
2. User browses challenge list
3. User opens a challenge detail
4. User watches short guide
5. User grants camera permission
6. User performs challenge
7. System extracts pose keypoints
8. System compares user pose to template
9. System returns score and result
10. Result is stored in history

## 5. Recommended Stack
### Frontend
- React
- TypeScript
- Vite
- React Router
- TanStack Query (optional)
- Tailwind CSS
- MediaPipe Pose or similar browser pose estimation library

### Backend
- Spring Boot
- Spring Security (lightweight or mocked auth at first)
- Spring Data JPA
- MySQL

### Infra / Tooling
- GitHub
- Codex
- Docker optional later

## 6. Suggested Architecture
### Frontend domains
- auth
- challenges
- motion
- attempts
- common/ui

### Backend domains
- member
- challenge
- challenge_template
- attempt
- scoring

## 7. Proposed Data Model
### Member
- id
- email
- nickname
- password
- role
- createdAt

### Challenge
- id
- title
- description
- category
- difficulty
- thumbnailUrl
- guideVideoUrl
- durationSec
- status
- createdAt

### ChallengeTemplate
- id
- challengeId
- templateVersion
- keypointsJson
- frameCount
- createdAt

### Attempt
- id
- memberId
- challengeId
- score
- successYn
- startedAt
- endedAt
- createdAt

### AttemptFrameSummary
- id
- attemptId
- frameIndex
- similarityScore

## 8. API Draft
### Auth
- POST /api/auth/signup
- POST /api/auth/login
- GET /api/me

### Challenge
- GET /api/challenges
- GET /api/challenges/{id}

### Attempt
- POST /api/attempts
- GET /api/attempts/me
- GET /api/attempts/{id}

### Admin (optional)
- POST /api/admin/challenges
- POST /api/admin/challenges/{id}/template

## 9. Folder Structure Suggestion
```text
root/
  docs/
    PRD.md
    AGENT.md
    ARCHITECTURE.md
    TASKS.md
    PROGRESS.md
    PROMPTS.md
  frontend/
  backend/
```

## 10. Harness Files

### docs/PRD.md
Purpose:
- Product definition
- user problem
- target users
- features
- MVP scope
- success metrics

Template:
```md
# PRD
## Product summary
## Problem
## Target users
## User scenarios
## Core features
## MVP scope
## Non-goals
## Risks
## Success metrics
```

### docs/AGENT.md
Purpose:
- Rules Codex must follow at all times

Template:
```md
# AGENT
You are working on a motion challenge MVP.

## Objectives
- Prefer MVP-safe implementations
- Keep features small and testable
- Avoid introducing unnecessary libraries
- Do not rewrite working modules without reason

## Product rules
- The product is a web MVP, not a native app
- Scoring should be simple similarity-based scoring
- UX should favor clarity over novelty
- KPOP is only one example; product must remain genre-agnostic

## Engineering rules
- Frontend: React + TypeScript + Vite
- Backend: Spring Boot + JPA + MySQL
- Keep domain boundaries clean
- Add types for all API contracts
- Prefer small commits and incremental changes
- Update TASKS.md and PROGRESS.md after meaningful work

## Definition of done
- Builds successfully
- Main user flow works
- Types and contracts are aligned
- Basic error states handled
```

### docs/ARCHITECTURE.md
Purpose:
- Explain system boundaries, modules, data flow

Template:
```md
# Architecture
## Frontend modules
## Backend modules
## Motion analysis flow
## Data storage strategy
## API contract rules
## Risks and constraints
```

### docs/TASKS.md
Purpose:
- Actionable task backlog

Template:
```md
# TASKS
## Now
- [ ] Initialize frontend shell
- [ ] Initialize backend shell
- [ ] Define challenge schema
- [ ] Define attempt schema
- [ ] Build challenge list page
- [ ] Build challenge detail page
- [ ] Add camera permission flow
- [ ] Add pose extraction prototype
- [ ] Add simple score calculation
- [ ] Save attempt result

## Next
- [ ] Attempt history page
- [ ] Seed data
- [ ] Result summary UI

## Later
- [ ] Ranking
- [ ] Admin challenge upload
```

### docs/PROGRESS.md
Purpose:
- Running dev log for Codex context handoff

Template:
```md
# PROGRESS
## YYYY-MM-DD
### Done
- ...

### Decisions
- ...

### Blockers
- ...

### Next
- ...
```

### docs/PROMPTS.md
Purpose:
- Reusable prompts for Codex

Template:
```md
# Prompt templates
## Scaffold prompt
Read docs/PRD.md, docs/AGENT.md, docs/ARCHITECTURE.md, docs/TASKS.md.
Create only the minimum project skeleton needed for MVP phase 1.
Do not add optional infrastructure unless required.
After changes, update docs/PROGRESS.md and docs/TASKS.md.

## Feature prompt
Read docs/AGENT.md, docs/ARCHITECTURE.md, docs/TASKS.md, docs/PROGRESS.md.
Implement the next unchecked item in TASKS.md with the smallest safe change.
Explain file-by-file changes and update docs/PROGRESS.md.

## Refactor prompt
Read docs/AGENT.md and docs/ARCHITECTURE.md first.
Refactor only if it reduces complexity or improves maintainability without changing behavior.
Avoid broad rewrites.
```

## 11. Initial Milestones
### Milestone 1 — Skeleton
- frontend app bootstrapped
- backend app bootstrapped
- shared docs created
- routing and package structure created

### Milestone 2 — Read-only product flow
- challenge list page
- challenge detail page
- seeded mock/API data

### Milestone 3 — Motion prototype
- webcam permission
- pose extraction prototype
- sample similarity score

### Milestone 4 — Persistence
- attempt save API
- history page

## 12. Practical Codex Kickoff Prompt
```md
Read the docs folder first.
Build the initial repository skeleton for a web MVP called Motion Challenge Platform.
Tech stack:
- frontend: React + TypeScript + Vite
- backend: Spring Boot + Gradle + JPA + MySQL

Requirements:
- create docs files if missing
- create frontend and backend folders
- create minimal routing/pages for Home, ChallengeList, ChallengeDetail, AttemptHistory
- create backend domain packages for member, challenge, attempt, scoring
- do not implement advanced business logic yet
- keep code simple, typed, and easy to extend
- add README instructions for local startup
- update TASKS.md and PROGRESS.md when finished
```

## 13. Recommended Development Sequence
1. Repo/docs setup
2. Frontend shell
3. Backend shell
4. Challenge read flow
5. Motion prototype
6. Score prototype
7. Attempt persistence
8. Polish/demo prep

## 14. Guardrails
- Always prefer a working demo over a clever architecture
- Keep the motion-scoring algorithm explainable
- Avoid coupling frontend UI too tightly to raw pose-estimation output
- Store template data in a flexible JSON format in early versions
- Do not chase high-precision AI claims in MVP

