# PRD

## Product Summary
Motion Challenge Platform is a web MVP for short, repeatable motion challenges. Users browse a small set of challenges, open a challenge detail page, start a camera session later in the roadmap, receive a simple similarity-based score, and review past attempts.

## Problem
Challenge content is easy to watch but hard to measure. Users need a lightweight way to try a motion challenge themselves and get a clear, understandable performance result.

## Product Identity
- Genre-agnostic motion challenge platform
- KPOP is one possible challenge category, not the product identity
- Web MVP first, not native mobile

## Target Users
- Teens and young adults who enjoy short interactive challenges
- Casual users looking for a fun self-serve performance score
- Bootcamp/demo audiences who need a clear end-to-end motion product story

## User Scenarios
- A user browses available challenges and picks one that looks approachable.
- A user opens a challenge detail page to understand duration, difficulty, and guidance.
- A user starts a short camera session and performs the challenge.
- A user receives a simple result score and later revisits it from attempt history.

## Core Features
- Challenge browse page
- Challenge detail page
- Camera session entry point
- Similarity-based scoring result
- Attempt save and history view

## MVP Scope
- Small challenge catalog
- Simple score explanation, not advanced coaching
- Basic attempt history
- Mock-safe backend endpoints where full persistence is not ready yet
- Redis used only for narrow caching support

## Non-Goals
- Native mobile app
- Perfect pose accuracy
- Social feed or creator marketplace
- Real-time multiplayer
- Overbuilt auth in phase 1

## Risks
- Motion scoring quality may be overestimated if the MVP UI feels too polished too early.
- Browser camera differences may make user experience inconsistent.
- Redis can become accidental core infrastructure if caching boundaries are not kept explicit.

## Success Metrics
- Local dev environment boots reliably for a bootcamp team.
- A developer can understand where browse, motion, scoring, and attempts belong within 30 minutes.
- The repository supports the read-only challenge flow without architectural rewrites.
