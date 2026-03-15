# TestOrbit — Claude Code Instructions

> This file is loaded automatically in every Claude Code session.
> It tells Claude where we are, what to do next, and how to validate.


## Project

- **Product:** TestOrbit — AI-Native API Testing Platform
- **Frontend:** `frontend/` (React 19 + Vite 7 + Tailwind v4 + Zustand 5)
- **Backend:** `backend/` (Python FastAPI + AI)
- **Master roadmap:** `todo.md` (living document — update as items complete)
- **Sprint tracker:** `sprint-tracker.md` (in project root — the FULL business plan + task tracker)

## Current Sprint

**The sprint tracker is the SINGLE SOURCE OF TRUTH for the entire business plan + execution tracking.**
**File:** `D:\Testing_Automation\gemini-api-tester\sprint-tracker.md` (project root)

It contains: scorecard, what's done, what's open, 6 detailed sprints with implementation notes, pricing tiers, revenue timeline, competitive strategy, what NOT to build, and the one-page summary.

**To find the active task:** Look for the row marked `🔵 ACTIVE` — that's where we left off. If no task is active, pick the next `⬜ TODO` task in order.

## Resume Protocol

When starting a new session, ALWAYS do this first:

1. Read `sprint-tracker.md` to find the current sprint and active task
2. If a task is marked `🔵 ACTIVE` — resume it. Read the relevant files before making changes.
3. If the previous task was left incomplete (still `🔵 ACTIVE` but context was lost), re-read the source files involved, verify current state, then continue.
4. After completing any task, update `sprint-tracker.md`: mark it `✅ DONE` with the date, then set the next task to `🔵 ACTIVE`.
5. Run the validation checklist (see below) after completing each task.

## Validation Checklist (Run After Every Task)

```bash
# 1. Frontend lint (must be 0 errors, 0 warnings)
cd frontend && npm run lint

# 2. Frontend build (must succeed, check bundle size)
cd frontend && npm run build

# 3. Backend import check (must not crash)
cd backend && .venv/Scripts/python.exe -c "from app.main import app; print('Backend OK')"

# 4. Backend tests (must all pass)
cd backend && .venv/Scripts/python.exe -m pytest tests/ -v
```

All 4 must pass. If any fails, fix before moving on.

## Custom Commands Available

- `/sprint-status` — Show current sprint progress, active task, and what's next
- `/resume-sprint` — Auto-find the next task, implement it, validate, update tracker
- `/validate` — Run the full validation checklist (lint + build + backend + tests)
- `/security-review` — Scan for OWASP Top 10 vulnerabilities

## Code Conventions

- **Never add `react-router`** — navigation uses Zustand `currentView` state
- **Always use `flattenItems()`** instead of `.filter()` — folders nest recursively
- **Always use `authFetch()`** from `config.js` — never raw `fetch()` to backend
- **Zustand migrations:** always bump version number, keep old migrations
- **ESLint target:** 0 errors, 0 warnings — always
- **New persisted fields:** update default object + `addRequest`/`addCollection` + migration
- **Sensitive data:** never log API keys, tokens, or secrets. Use `SecretMaskingFilter`.
- **Body types:** Request body has `{ type, content }` shape — type is 'json'|'form'|'raw'|'urlencoded'|'file'
- **Test files:** Frontend tests go in `frontend/src/__tests__/`. Backend tests in `backend/tests/`.
- **Toast notifications:** Use `import { toast } from '../../utils/toast'` — never `alert()`.
- **Payment gateway:** Razorpay (NOT Stripe). INR pricing: Free / Pro ₹399/mo / Team ₹799/mo + ₹399/seat.

## Architecture Quick Reference

- **Store:** `frontend/src/store/workspaceStore.js` (v12, ~1900 lines, persist to localStorage)
- **Config:** `frontend/src/config.js` — `API_BASE`, `MOCK_BASE`, `BACKEND_URL`, `authFetch()`
- **Security:** `backend/app/core/security.py` — JWT verification, SSRF validation, headers middleware
- **AI Service:** `backend/app/services/ai_service.py` — All Gemini integrations (8 capabilities)
- **Schema:** `supabase_schema.sql` — 4 tables with RLS + ownership trigger (NOT YET APPLIED TO LIVE DB)

## What NOT to Do

- Don't add features outside the current sprint task
- Don't refactor the Zustand store (it's a known tech debt, scheduled for later)
- Don't add TypeScript (it's a future migration, not now)
- Don't add GraphQL, gRPC, or SOAP support (Phase 4+)
- Don't install new dependencies without asking the user first
