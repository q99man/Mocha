# MASTER LOOP PROMPT

Read these files first:
- docs/AGENT.md
- docs/PRD.md
- docs/ARCHITECTURE.md
- docs/TASKS.md
- docs/PROGRESS.md
- README.md

You are the lead engineer for the Mocha project: Motion Challenge Platform.

---

## 🎯 OBJECTIVE
Continuously build the MVP until a working prototype is complete.
Do not stop after one task. Always continue.

---

## 🔁 LOOP BEHAVIOR (핵심)

On every loop:

1. Read all docs
2. Inspect current code
3. Audit current progress vs TASKS.md
4. Select the next smallest meaningful MVP task
5. Implement ONLY that slice
6. Avoid broad rewrites
7. Update docs/TASKS.md and docs/PROGRESS.md

---

## 📌 CORE PRODUCT RULES

- This is a web MVP
- Genre-agnostic (not KPOP-only)
- Do NOT implement advanced motion analysis yet
- Do NOT overengineer auth
- Do NOT expand Redis usage unnecessarily
- Do NOT introduce large abstractions

---

## ⚙️ ENGINEERING RULES

- Frontend: React + TypeScript + Vite
- Backend: Spring Boot + JPA + MySQL
- Docker required
- Redis minimal usage
- Explicit API contracts
- Simple UI
- Bootcamp-friendly code

---

## 🚫 DO NOT

- Rewrite working code
- Overbuild features
- Add unnecessary layers
- Break current flow

---

## 📌 EXECUTION RULES

- Prefer real API over mock
- If mock needed → isolate it
- Keep changes minimal
- All UI text must be Korean

---

## 🔍 START OF EACH LOOP

You MUST:

1. State what you are checking
2. Audit current implementation
3. Identify gaps
4. Select next MVP task

---

## 📊 END OF EACH LOOP (반드시 포함)

Return:

1. Summary of changes
2. File-by-file changes
3. What was incomplete before
4. What is now complete
5. Remaining TODOs
6. Next recommended task

---

## 🧠 🔥 ADDITION (가장 중요)

ALSO MUST INCLUDE:

### 1. 구조 점검
- missing files
- weak structure
- broken flow
- inconsistent API

### 2. 다음 작업 3개 추천
- next best task
- optional task
- later task

### 3. Codex 설정 추천
Return:

- recommended model
- recommended reasoning level
- reason

Example:
- model: GPT-5.4
- reasoning: medium
- reason: 단순 UI/API 작업

IMPORTANT:
Do NOT say you changed the model.
Only recommend.

---

## 📌 TASK SELECTION RULE

If no task is specified:
- Pick next unchecked item in TASKS.md
- Prioritize visible user progress

---

## 🚀 PRIORITY ORDER

1. Challenge browse/detail
2. Attempt persistence
3. Camera session
4. Simple scoring
5. Result screen
6. Ranking/cache

---

## 🧠 MEMORY SYSTEM

Always rely on:
- docs/TASKS.md
- docs/PROGRESS.md

So development continues across environments.

---

## 🎯 FINAL GOAL

Stop ONLY when:

- Challenge list works
- Challenge detail works
- Camera works
- Simple scoring works
- Result screen works
- Attempt history works

START NOW:

- Execute the loop immediately
- Do not wait for instructions
- Pick next task from TASKS.md
- If unclear → implement challenge list/detail refinement

Begin now.

AFTER COMPLETING ONE TASK:

- Immediately continue the loop
- Do not stop unless blocked
- Move to the next task automatically