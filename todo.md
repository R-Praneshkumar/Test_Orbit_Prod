# TestOrbit — SaaS Product Roadmap

> **Last updated:** 2026-02-24
> **Status:** Hackathon complete. Transitioning to production SaaS.
> **Goal:** Transform TestOrbit from a hackathon project into a live, paid SaaS product.

---

## Table of Contents

1. [Completed Features](#1-completed-features)
2. [Current Status](#2-current-status)
3. [Known Issues & Bugs](#3-known-issues--bugs)
4. [Security Vulnerabilities](#4-security-vulnerabilities)
5. [Competitive Gap Analysis](#5-competitive-gap-analysis)
6. [UI Logic Bugs (Feb 2026 Audit)](#6-ui-logic-bugs-feb-2026-audit)
7. [Top 10 Immediate Priorities](#7-top-10-immediate-priorities)
8. [Phase 1: Auth & UI Overhaul](#8-phase-1--auth--ui-overhaul)
9. [Phase 2: Production Ready](#9-phase-2--production-ready)
10. [Phase 3: SaaS Infrastructure](#10-phase-3--saas-infrastructure)
11. [Phase 4: Product Improvements](#11-phase-4--product-improvements)
12. [Phase 5: Collaboration & Enterprise](#12-phase-5--collaboration--enterprise)
13. [Future Roadmap](#13-future-roadmap)
14. [Codebase Stats](#14-codebase-stats)

---

## 1. Completed Features

Everything already built during hackathon development.

### Core Features (Phase 1-6)
- [x] **Zustand data model** — Collections with requests, chat messages, OpenAPI spec, base URL, run history, test suites
- [x] **Intelligence Panel** — 3-tab AI panel (Chat, Spec, Tests) with Gemini integration
- [x] **AI test generation** — `/api/v1/generate` endpoint generates test cases from OpenAPI specs and natural language
- [x] **Test runner** — `/api/v1/run` executes tests in parallel with aiohttp, reports pass/fail
- [x] **FastAPI backend** — Python backend with Pydantic models, async handlers, loguru logging
- [x] **Sidebar explorer** — Collection tree view with right-click context menus, drag support
- [x] **Request editor** — Full HTTP request builder with 6 subtabs (params, headers, body, auth, scripts, assertions)
- [x] **Response viewer** — Status code, headers, body display with timing info

### Sprint 1: JSON Syntax Highlighting
- [x] `react-syntax-highlighter` with `oneDark` theme for JSON response bodies
- [x] Syntax highlighting in request body editor
- [x] Copy-to-clipboard on response bodies

### Sprint 2: App Header + Dashboard
- [x] Top navigation bar with Home, Workspace, Mock Server, Docs tabs
- [x] Dashboard view with collections grid, quick actions, recent activity
- [x] TestOrbit branding with orbit SVG icon and "Powered by Gemini" badge
- [x] Dark mode toggle in header

### Sprint 3: AI Code Generation
- [x] `CodeGenModal.jsx` — Modal to generate API client code from requests
- [x] `/api/v1/codegen` backend endpoint using Gemini
- [x] Multi-language support: Python (requests/httpx), JavaScript (fetch/axios), Go, Java, cURL
- [x] Option to include test code alongside client code

### Sprint 4: Dark Mode
- [x] Full `dark:` variant support across all components
- [x] Persisted in Zustand store (survives page refresh)
- [x] `document.documentElement.classList` toggle in App.jsx
- [x] Dark mode for modals, dropdowns, tooltips, and all UI surfaces

### Sprint 5: AI Streaming Effect
- [x] `StreamingText` component — Typewriter animation for AI-generated content
- [x] Staggered character reveal animation
- [x] Applied to Intelligence Panel chat responses and test generation results

### Sprint 6: AI Failure Diagnosis
- [x] `/api/v1/diagnose` backend endpoint — Gemini analyzes why a test failed
- [x] Stethoscope button on failed test results in CollectionRunner
- [x] Sends full request/response context (method, URL, headers, body, expected vs actual status)
- [x] AI returns root cause analysis and suggested fixes

### Sprint 7: Pre/Post Request Scripts
- [x] `scriptEngine.js` — Sandboxed script execution with `new Function()` constructor
- [x] `pm.*` API: `pm.environment.get/set`, `pm.variables.get/set`, `pm.test()`, `pm.expect()`
- [x] Pre-request scripts run before sending, post-response scripts run after
- [x] Console output capture and display
- [x] Scripts tab in RequestEditor with CodeMirror-style editing

### Sprint 8: WebSocket Testing
- [x] `WebSocketTester.jsx` — Dedicated WebSocket client component
- [x] Connect/disconnect with custom headers
- [x] Send text/JSON messages with message history
- [x] Auto-scroll message log with timestamps
- [x] Connection state indicators (connecting, open, closed, error)
- [x] `websocket` item type in collections alongside `request` type

### Sprint 9: Multi-format Import
- [x] `ImportCollectionModal.jsx` — Auto-detect and import from multiple formats
- [x] Postman Collection v2.1 import (requests, folders, headers, body, auth)
- [x] Insomnia export JSON import
- [x] OpenAPI 3.x / Swagger 2.x spec import (generates requests from paths)
- [x] Thunder Client import
- [x] Format auto-detection from file content

### Sprint 10: Response Assertions
- [x] `assertionEngine.js` — Evaluate response assertions with multiple operators
- [x] Visual assertion builder in RequestEditor (assertions subtab)
- [x] Operators: equals, not_equals, contains, not_contains, greater_than, less_than, exists, not_exists, matches_regex, type_is
- [x] Target fields: status, body (JSONPath), header, response_time
- [x] Auto-evaluation on response with pass/fail indicators
- [x] Assertion results displayed inline with green/red badges

### Post-Sprint Features
- [x] **Supabase Auth** — Email/password login + GitHub OAuth via `AuthModal.jsx`
- [x] **Cloud sync** — Collections and environments synced to Supabase with real-time subscriptions
- [x] **Collection sharing** — `ShareModal.jsx` with viewer/editor roles via `collection_shares` table
- [x] **Environment manager** — `EnvironmentManager.jsx` with key-value pairs, per-user, synced to Supabase
- [x] **AI Mock Server** — `/mock-server/*` catch-all that generates realistic JSON responses with Gemini
- [x] **Docs panel** — `DocsPanel.jsx` with feature cards, keyboard shortcuts, quick tips
- [x] **Tour guide** — `TourGuide.jsx` using react-joyride for first-time user onboarding
- [x] **Interactive tutorials** — `InteractiveTutorial.jsx` with step-by-step automated walkthroughs
- [x] **cURL import** — `CurlImportModal.jsx` to paste and import cURL commands
- [x] **OAuth 2.0 proxy** — `/api/v1/oauth/token` and `/oauth/refresh` endpoints for secure token exchange
- [x] **Tab manager** — `TabManager.jsx` with multi-tab support, close/switch tabs
- [x] **Natural language commands** — `/api/v1/voice` endpoint processes English descriptions into API requests
- [x] **Custom method select** — `CustomMethodSelect.jsx` supports GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- [x] **JSON viewer** — `JsonViewer.jsx` with collapsible tree view
- [x] **Key-value editor** — `KeyValueEditor.jsx` reusable component for params, headers, form data
- [x] **Error boundary** — `ErrorBoundary.jsx` catches React render errors gracefully
- [x] **CLI tool** — `cli.py` with `mcp` (start MCP server) and `run` (batch test execution) commands
- [x] **MCP integration** — Model Context Protocol support for Claude, Cursor, Windsurf agents

---

## 2. Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password auth | Working | Via Supabase auth |
| GitHub OAuth | Working | Configured in Supabase |
| Google OAuth | Not Started | No provider configured |
| Cloud sync (collections) | Working | Real-time subscriptions active |
| Cloud sync (environments) | Working | Per-user, Supabase backed |
| Collection sharing | Working | Viewer/editor roles |
| AI test generation | Working | `/api/v1/generate` via Gemini |
| AI code generation | Working | `/api/v1/codegen` multi-language |
| AI failure diagnosis | Working | `/api/v1/diagnose` endpoint |
| AI mock server | Working | `/mock-server/*` catch-all |
| AI natural language | Working | `/api/v1/voice` endpoint |
| HTTP request execution | Working | Via `/api/v1/proxy` |
| WebSocket testing | Working | Connect/send/receive |
| Pre/post scripts | Working | Sandboxed `pm.*` API |
| Response assertions | Working | Visual builder + auto-eval |
| Multi-format import | Working | Postman, Insomnia, OpenAPI, Thunder Client |
| cURL import | Working | Paste and parse |
| Dark mode | Working | Full support, persisted |
| Tour guide | Working | First-time onboarding |
| Interactive tutorials | Needs Fix | ESLint errors (setState in effect) |
| Docs panel | Needs Fix | Components created during render |
| Dashboard | Needs Fix | `Date.now()` impure function in render |
| Profile page | Working | ProfilePage.jsx with edit name, avatar, connected providers, danger zone |
| Rate limiting | Working | slowapi: AI 10/min, proxy 60/min, mock 30/min per IP |
| Backend auth middleware | Working | JWT auth on all API + OAuth routes; mock server rate-limited |

---

## 3. Known Issues & Bugs

### Critical Runtime Bugs (FIXED)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| ~~"Converting circular structure to JSON" on sign-in and tutorial close~~ | `_realtimeChannel` (Supabase RealtimeChannel) stored in Zustand state was not excluded from `partialize` — circular refs: `channel.socket` → `RealtimeClient` → `channels` → back | Added `_realtimeChannel` and `user` to `partialize` exclusion list in `workspaceStore.js` |
| ~~Tutorial X button not closing~~ | The `stopTutorial()` call triggered `set()` which threw the circular JSON error above, preventing the state update from completing | Same fix — excluding circular objects from persist. Also added auto-close after last step finishes |
| ~~Google OAuth stuck on login page~~ | After Google OAuth redirect, `currentView: 'login'` was still persisted in localStorage. `initializeAuth` set `user` but never changed `currentView`, so user stayed on login page | Added `currentView` → `'dashboard'` redirect in both `getSession()` check and `onAuthStateChange` listener when user is authenticated and still on login page |

### ESLint Errors (36 errors, 10 warnings) — ALL FIXED

**Unused Variables/Imports (9 unique issues):**

| File | Line | Issue |
|------|------|-------|
| ~~`App.jsx`~~ | ~~16~~ | ~~`isSupabaseConfigured` imported but never used~~ (FIXED) |
| `InteractiveTutorial.jsx` | 19 | `addCollectionChatMessage` assigned but never used |
| `InteractiveTutorial.jsx` | 151 | `e` (catch param) defined but never used |
| `TourGuide.jsx` | 8 | `continuous` defined but never used |
| `TourGuide.jsx` | 284 | `action` assigned but never used |
| `CurlImportModal.jsx` | 67 | `addRequest` assigned but never used |
| `CurlImportModal.jsx` | 68 | `updateRequest` assigned but never used |
| `DocsPanel.jsx` | 1 | `useState` imported but never used |
| `MockServerPanel.jsx` | 3 | `useWorkspaceStore` imported but never used |
| `RequestEditor.jsx` | 655 | `e` (catch param) defined but never used |
| `RequestEditor.jsx` | 1186 | `v` defined but never used |
| `WebSocketTester.jsx` | 21 | `setAutoScroll` assigned but never used |
| `workspaceStore.js` | 178 | `owner_id` destructured but never used |
| `workspaceStore.js` | 461 | `state` param defined but never used |
| `workspaceStore.js` | 1016 | `responses` destructured but never used |
| `workspaceStore.js` | 1016 | `runner` destructured but never used |

**setState in Effect (5 issues):**

| File | Line | Issue |
|------|------|-------|
| `InteractiveTutorial.jsx` | 26 | `setActiveTutorial` called inside useEffect — cascading renders |
| `InteractiveTutorial.jsx` | 320 | `runStep()` called inside useEffect — calls setState internally |
| `InteractiveTutorial.jsx` | 336 | `setIsPlaying(false)` called inside useEffect |
| `RequestEditor.jsx` | 249 | `setLocalUrl()` called inside useEffect |
| `WebSocketTester.jsx` | 30 | `setLocalUrl()` called inside useEffect |

**Components Created During Render (3 components, many instances):**

| File | Lines | Issue |
|------|-------|-------|
| `DocsPanel.jsx` | 10-42 | `FeatureCard` defined inside component — resets state on every render |
| `DocsPanel.jsx` | 45-50 | `QuickTip` defined inside component |
| `DocsPanel.jsx` | 53-67 | `Shortcut` defined inside component |

**Fix:** Move `FeatureCard`, `QuickTip`, `Shortcut` outside the `DocsPanel` function (above it, or to separate files).

**React Compiler / Memoization Issues:**

| File | Line | Issue |
|------|------|-------|
| `InteractiveTutorial.jsx` | 298 | `useCallback` deps mismatch — inferred `tutorials` but specified `[activeTutorial, currentStep]` |
| `Dashboard.jsx` | 48 | `Date.now()` is impure — cannot be called during render |

**Missing useEffect Dependencies (6 warnings):**

| File | Line | Missing Dependency |
|------|------|-------------------|
| `InteractiveTutorial.jsx` | 315 | `tutorials` |
| `InteractiveTutorial.jsx` | 339 | `tutorials` |
| `CollectionRunner.jsx` | 202 | `finishRun` |
| `CollectionRunner.jsx` | 290 | `collections`, `finishRun` |
| `IntelligencePanel.jsx` | 78 | `activeCollection?.baseUrl`, `activeCollection?.openApiSpec` |
| `RequestEditor.jsx` | 250 | `request?.url` |
| `WebSocketTester.jsx` | 31 | `tab?.url` |
| `ShareModal.jsx` | 19 | `fetchShares` |

**Other:**

| File | Line | Issue |
|------|------|-------|
| `IntelligencePanel.jsx` | 57 | `messages` logical expression could change deps of useEffect on every render |
| `assertionEngine.js` | 36 | Unused eslint-disable directive (no `eqeqeq` problem was reported) |

---

## 4. Security Vulnerabilities

These MUST be fixed before deploying to production.

### CRITICAL

| # | Vulnerability | Severity | File | Description | Fix |
|---|--------------|----------|------|-------------|-----|
| ~~1~~ | ~~**No Auth on Backend Routes**~~ | ~~CRITICAL~~ | ~~`backend/app/api/routes.py`~~ | ~~All API endpoints were completely public~~ | **FIXED** — `verify_token` dependency added to all 6 routes. Uses `REQUIRE_AUTH` + `SUPABASE_JWT_SECRET` env vars. Frontend sends Bearer token via `authFetch()`. |

### HIGH

| # | Vulnerability | Severity | File | Description | Fix |
|---|--------------|----------|------|-------------|-----|
| ~~2~~ | ~~**SSRF via Proxy**~~ | ~~HIGH~~ | ~~`routes.py`~~ | ~~Proxy could hit internal networks~~ | **FIXED** — `validate_proxy_url()` blocks private IPs, localhost, metadata endpoints, non-http schemes |
| ~~3~~ | ~~**No Rate Limiting**~~ | ~~HIGH~~ | ~~`backend/app/main.py`~~ | ~~No rate limiting~~ | **FIXED** — slowapi: AI endpoints 10/min, proxy 60/min, configurable via env |

### MEDIUM

| # | Vulnerability | Severity | File | Description | Fix |
|---|--------------|----------|------|-------------|-----|
| ~~4~~ | ~~**No Input Sanitization**~~ | ~~MEDIUM~~ | ~~`routes.py`~~ | ~~No input length limits~~ | **FIXED** — `Field(max_length=...)` on all Pydantic models (URL: 2048, specs: 100KB, bodies: 1MB) |
| ~~5~~ | ~~**Hardcoded CORS Origins**~~ | ~~MEDIUM~~ | ~~`config.py`~~ | ~~CORS only allowed localhost~~ | **FIXED** — `ALLOWED_ORIGINS` env var overrides defaults when set |
| ~~6~~ | ~~**No HTTPS Enforcement**~~ | ~~MEDIUM~~ | ~~`main.py`~~ | ~~No HTTP→HTTPS redirect~~ | **FIXED** — `HTTPSRedirectMiddleware` active when `ENV=production`, respects `X-Forwarded-Proto` |

### LOW

| # | Vulnerability | Severity | File | Description | Fix |
|---|--------------|----------|------|-------------|-----|
| ~~4~~ | ~~**Mock routes unrate-limited**~~ | ~~CRITICAL~~ | ~~`mock_routes.py`~~ | ~~Mock server endpoints had no rate limiting — unlimited Gemini API calls = cost explosion~~ | **FIXED** — Added `@limiter.limit(MOCK_RATE_LIMIT)` to all 4 mock server handlers (list, clear, delete, catch-all) |
| ~~5~~ | ~~**OAuth routes no auth/rate-limit**~~ | ~~HIGH~~ | ~~`oauth_routes.py`~~ | ~~OAuth proxy endpoints had no JWT auth and no rate limiting~~ | **FIXED** — Added `Depends(verify_token)` + `@limiter.limit(AI_RATE_LIMIT)` to both `exchange_token` and `refresh_token` |
| ~~6~~ | ~~**Error messages leak internals**~~ | ~~HIGH~~ | ~~`routes.py`, `mock_routes.py`, `oauth_routes.py`~~ | ~~`str(e)` in HTTPException details exposed stack traces, paths, API keys~~ | **FIXED** — All error responses now return generic messages. Full errors logged server-side only. |
| ~~7~~ | ~~**`/voice` endpoint no error handling**~~ | ~~HIGH~~ | ~~`routes.py`~~ | ~~Unhandled AI exception = 500 with raw traceback~~ | **FIXED** — Wrapped in try/except, returns `"Voice processing failed"` |
| ~~8~~ | ~~**No CSP header**~~ | ~~MEDIUM~~ | ~~`security.py`, `nginx.conf`~~ | ~~Missing Content-Security-Policy header~~ | **FIXED** — Added CSP + Permissions-Policy to SecurityHeadersMiddleware and nginx.conf |
| ~~9~~ | ~~**No database indexes**~~ | ~~MEDIUM~~ | ~~`supabase_schema.sql`~~ | ~~O(n) scans on queries as data grows~~ | **FIXED** — Added 4 indexes: `idx_collections_owner_id`, `idx_collection_shares_user_email`, `idx_collection_shares_collection_id`, `idx_environments_owner_id` |
| 10 | **Exposed API Key in .env** | LOW | `backend/.env` | The `GEMINI_API_KEY` is stored in `.env`. Verify `.gitignore` includes `.env`. If this file was ever committed, the key is compromised. | Verify `.gitignore` covers `.env`. Rotate the API key if it was ever committed. Use a secrets manager in production (not env files). |

---

## 5. Competitive Gap Analysis

> **Date:** 2026-02-24
> **Compared Against:** Postman (full platform), Bruno (offline-first client), Beeceptor (mock server)
> **Overall Feature Completeness:** ~25-30% of combined feature set

### 5.1 Protocol & Request Support Gaps

| Feature | Postman | Bruno | Beeceptor | TestOrbit | Priority |
|---------|---------|-------|-----------|-----------|----------|
| GraphQL (dedicated UI + introspection) | Full | Full | Mock only | **MISSING** | Phase 4 |
| gRPC support (unary + streaming) | Full | Full | Mock only | **MISSING** | Phase 4 |
| SOAP/WSDL support | Full | Full | Mock only | **MISSING** | Phase 4 |
| Socket.IO support | Yes | No | No | **MISSING** | Low |
| File upload (multipart/form-data) | Yes | Yes | No | **MISSING** | Phase 2 |
| Binary request body | Yes | Yes | No | **MISSING** | Phase 2 |
| x-www-form-urlencoded body | Yes | Yes | No | **MISSING** | Phase 2 |
| XML body editor | Yes | Yes | No | **MISSING** | Phase 3 |
| Path variables (`:id` in URL) | Yes | Yes | No | **MISSING** | Phase 2 |

### 5.2 Authentication Types Gaps

| Auth Type | Postman | Bruno | TestOrbit | Priority |
|-----------|---------|-------|-----------|----------|
| Bearer Token | Yes | Yes | **Yes** | Done |
| Basic Auth | Yes | Yes | **Yes** | Done |
| API Key | Yes | Yes | **Yes** | Done |
| Auto-Auth (login flow) | No | No | **Yes** | Done |
| OAuth 2.0 (full: PKCE, all grants) | Full | Partial | **Token exchange only** | Phase 2 |
| OAuth 1.0 | Yes | No | **MISSING** | Low |
| Digest Auth | Yes | Yes | **MISSING** | Phase 3 |
| AWS Signature v4 | Yes | Yes | **MISSING** | Phase 3 |
| NTLM Auth | Yes | Yes | **MISSING** | Low |
| Hawk / Akamai EdgeGrid | Yes | No | **MISSING** | Low |
| JWT Bearer (generate tokens) | Yes | No | **MISSING** | Phase 3 |
| **Collection-level auth inheritance** | **Yes** | **Yes** | **MISSING** | **IMMEDIATE** |

### 5.3 Variables System Gaps

| Feature | Postman | Bruno | TestOrbit | Priority |
|---------|---------|-------|-----------|----------|
| Global + Environment variables | Yes | Yes | **Yes** | Done |
| Collection-scoped variables | Yes | Yes | **MISSING** | Phase 2 |
| Data-driven testing (CSV/JSON) | Yes | Yes | **MISSING** | Phase 2 |
| Dynamic variables (`{{$randomEmail}}`) | 50+ faker | Yes | **MISSING** | Phase 3 |
| Secret vault (local-only) | Yes | OS keychain | **MISSING** | Phase 3 |
| Variable quick-look preview | Yes | No | **MISSING** | Phase 2 |

### 5.4 Scripting & Testing Gaps

| Feature | Postman | Bruno | TestOrbit | Priority |
|---------|---------|-------|-----------|----------|
| Pre/post request scripts | Yes | Yes | **Yes (BROKEN)** | **IMMEDIATE** |
| `pm.sendRequest()` (nested requests) | Yes | No | **MISSING** | Phase 3 |
| `setNextRequest()` (execution flow) | Yes | Yes | **MISSING** | Phase 3 |
| Built-in libraries (Lodash, CryptoJS) | 10+ | 6+ | **MISSING** | Phase 3 |
| JSON Schema validation | Yes | Yes | **MISSING** | Phase 2 |
| Full Chai.js assertions | Full | Full | **Partial (BROKEN)** | **IMMEDIATE** |
| Data-driven testing (CSV iterations) | Yes | Yes | **MISSING** | Phase 2 |
| Run cancellation/abort | Yes | Yes | **MISSING** | **IMMEDIATE** |

### 5.5 Mock Server Gaps (vs Beeceptor)

| Feature | Beeceptor | TestOrbit | Priority |
|---------|-----------|-----------|----------|
| AI-generated mock responses | AI rules | **Yes** | Done |
| Rule-based routing (regex, path, body) | Yes | **MISSING** | Phase 2 |
| Response templates (Handlebars + Faker) | 300+ helpers | **MISSING** | Phase 3 |
| Stateful mocking (counters, datastore) | Yes | **MISSING** | Phase 3 |
| Response delay/timeout simulation | Yes | **MISSING** | Phase 2 |
| Rate limit simulation | Yes | **MISSING** | Phase 3 |
| CRUD simulation (auto-DB) | Yes | **MISSING** | Phase 3 |
| Local tunneling (expose localhost) | Yes | **MISSING** | Phase 4 |
| Webhook testing/inspection | Yes | **MISSING** | Phase 3 |
| Proxy mode (forward to real API) | Yes | **MISSING** | Phase 3 |
| Custom status codes per rule | Yes | **MISSING** | Phase 2 |

### 5.6 Collaboration & Workspace Gaps

| Feature | Postman | Bruno | TestOrbit | Priority |
|---------|---------|-------|-----------|----------|
| Team workspaces | Cloud | Git | **Partial (Supabase sync)** | Phase 3 |
| In-line commenting | Yes | No | **MISSING** | Phase 5 |
| Forking & merging collections | Yes | Git | **MISSING** | Phase 4 |
| Changelog / activity feed | Yes | Git log | **MISSING** | Phase 4 |
| Version control (Git) integration | Yes | Native | **MISSING** | Phase 4 |
| Conflict resolution | Yes | Git merge | **MISSING (last-write-wins)** | Phase 3 |

### 5.7 Other Major Gaps

| Feature | Available In | TestOrbit | Priority |
|---------|-------------|-----------|----------|
| API documentation generation | Postman, Bruno | **MISSING** | Phase 3 |
| Scheduled monitors/health checks | Postman | **MISSING** | Phase 4 |
| Performance/load testing | Postman | **MISSING** | Phase 4 |
| Contract testing (schema validation) | Postman | **MISSING** | Phase 3 |
| Cookie jar management | Postman, Bruno | **MISSING** | Phase 2 |
| Client certificates (mTLS) | Postman, Bruno, Beeceptor | **MISSING** | Phase 4 |
| Proxy settings (HTTP/SOCKS) | Postman, Bruno | **MISSING** | Phase 4 |
| CLI reporters (JUnit, HTML) | Postman (Newman), Bruno CLI | **JSON only** | Phase 2 |

---

## 6. UI Logic Bugs (Feb 2026 Audit)

> **Date:** 2026-02-24
> **Audit Method:** Full source code review of all frontend components, store, and utility files

### CRITICAL Bugs

| # | Component | File | Description | Status |
|---|-----------|------|-------------|--------|
| B1 | IntelligencePanel + RequestEditor | `IntelligencePanel.jsx:468`, `RequestEditor.jsx:642` | **"Apply & Run" never fires.** Chat "Apply & Run" button does `document.querySelector('[data-run-btn="true"]').click()` but Send button has no `data-run-btn` attribute. Dead feature. | `[x]` Fixed |
| B2 | scriptEngine | `scriptEngine.js:102-103` | **`pm.expect(v).to.be.true` always crashes.** `.true` and `.false` are IIFEs that both execute when `.be` is accessed. For any value, one always throws. All boolean assertions broken. | `[x]` Fixed — lazy getters via Object.defineProperty |
| B3 | Dashboard | `Dashboard.jsx:188,238` | **Pass/fail counts never display.** Accesses `run.passed`/`run.failed` but data stored at `run.summary.passed`/`run.summary.failed`. Stats always show undefined. | `[x]` Fixed |
| B4 | scriptEngine | `scriptEngine.js:47-48` | **`pm.environment.set()` is a no-op.** Changes written to local `envMap` copy but never propagated back to environment store. Scripts that set env vars silently fail. | `[x]` Fixed — getUpdatedEnvVars() + applyEnvVarChanges() |

### HIGH Bugs

| # | Component | File | Description | Status |
|---|-----------|------|-------------|--------|
| B5 | CollectionRunner | `CollectionRunner.jsx:255-341` | **Parallel mode drops all auth headers.** Sequential mode applies Bearer/Basic/API Key; parallel mode sends to `/run` without auth applied. | `[x]` Fixed |
| B6 | CollectionRunner | `CollectionRunner.jsx:78-252` | **No run cancellation.** No AbortController, no cancel flag. Network requests continue even after unmount. | `[x]` Fixed — AbortController added to both sequential/parallel modes, Cancel button in UI, cleanup on unmount |
| B7 | Sidebar | `Sidebar.jsx:87-88` | **No confirmation for collection deletion.** One click permanently deletes all requests, chat, run history, test suites. Irreversible. | `[x]` Fixed |
| B8 | workspaceStore | `workspaceStore.js` (multiple) | **No Supabase sync debouncing.** Every keystroke in URL/header/env triggers `saveCollectionToSupabase()`. 50-char URL = 50 concurrent upserts. | `[x]` Fixed |
| B9 | CollectionRunner + Store | `workspaceStore.js:421-436` | **Run history saved to wrong collection.** Uses `state.activeCollectionId`, not the runner's collection. Switching collections mid-run saves to wrong place. | `[x]` Fixed — now uses `state.runner?.collectionId` with fallback |
| B10 | workspaceStore | `workspaceStore.js:230,334` | **Realtime sync overwrites local edits.** Remote changes trigger full collection replacement, discarding unsaved edits. No conflict resolution. | `[x]` Fixed — dirty-flag tracking + smart merge skips dirty collections, 2s debounce on realtime handler |

### MEDIUM Bugs

| # | Component | File | Description | Status |
|---|-----------|------|-------------|--------|
| B11 | WebSocketTester | `WebSocketTester.jsx:50,98,141` | **Memory leak on long sessions.** Messages array grows unboundedly. High-frequency feeds cause tab crash. | `[ ]` Fix |
| B12 | IntelligencePanel | `IntelligencePanel.jsx:368` | **Chat messages grow unboundedly.** No cap (unlike runHistory capped at 20). Bloats localStorage and Supabase. | `[ ]` Fix |
| B13 | WebSocketTester | `WebSocketTester.jsx:89-105` | **Binary messages not handled.** Assumes string data. Binary (Blob/ArrayBuffer) displays as `[object Blob]`. | `[ ]` Fix |
| B14 | EnvironmentManager | `workspaceStore.js:866-872` | **Duplicate environment names allowed.** No uniqueness check. Two "Production" envs cause undefined behavior. | `[ ]` Fix |
| B15 | EnvironmentManager | `EnvironmentManager.jsx:17` | **Delete confirmation persists on tab switch.** Clicking delete then switching envs keeps confirmation, targets wrong env. | `[ ]` Fix |
| B16 | Sidebar | `Sidebar.jsx:128` | **Export ignores nested folder requests.** Only maps top-level `item.items`, nested folders excluded from export. | `[ ]` Fix |
| B17 | Sidebar | `Sidebar.jsx:356-371` | **Search excludes WebSocket items.** Only matches `type === 'request'`, WS entries unfindable via search. | `[ ]` Fix |
| B18 | Dashboard | `Dashboard.jsx:55-63` | **Stale time-ago display.** `useMemo(() => Date.now(), [])` computes once. After 30min on dashboard, times never update. | `[ ]` Fix |
| B19 | workspaceStore | `workspaceStore.js:94` | **Auth listener leaks in dev mode.** `onAuthStateChange` subscription never cleaned up. React 18 StrictMode registers two. | `[ ]` Fix |
| B20 | WebSocketTester | `WebSocketTester.jsx:21` | **Auto-scroll cannot be disabled.** State has no setter — always true. Users can't read old messages. | `[ ]` Fix |

### LOW Bugs

| # | Component | Description | Status |
|---|-----------|-------------|--------|
| B21 | workspaceStore | Variable resolution regex `\w+` doesn't support hyphens in `{{my-var}}` | `[ ]` |
| B22 | WebSocketTester | Message IDs `Date.now() + Math.random()` — not guaranteed unique, React key collisions | `[ ]` |
| B23 | IntelligencePanel | Spec/Free chat toggle is local state, resets on refresh | `[ ]` |
| B24 | MockServerPanel | Manual refresh + auto-interval can cause concurrent fetches and UI flicker | `[ ]` |
| B25 | ImportCollectionModal | `setTimeout(onClose, 1500)` can fire after unmount | `[ ]` |
| B26 | RequestEditor | `localUrl` state doesn't sync when URL changed externally while tab is open | `[ ]` |

---

## 7. Top 10 Immediate Priorities

> **Date:** 2026-02-24
> **Goal:** Fix all critical security vulnerabilities and breaking bugs before any new features
> **Why:** 4 critical security issues, 4 critical UI bugs, and several high-severity problems make the app unsafe and partially broken

| # | Type | Item | Impact | Status |
|---|------|------|--------|--------|
| 1 | Security | **Add SSRF validation to `test_runner.py`** — Zero URL validation lets attackers scan internal networks, access cloud metadata | CRITICAL | `[x]` |
| 2 | Security | **Replace `new Function()` with proper sandbox** in `scriptEngine.js` — Scripts access `window`, `document`, `localStorage`, `fetch` | CRITICAL | `[x]` |
| 3 | Bug | **Fix `pm.expect().to.be.true/false`** IIFEs in `scriptEngine.js` — All boolean assertions broken | CRITICAL | `[x]` |
| 4 | Security | **Add auth to mock server routes** — All mock endpoints unauthenticated. Anyone can list/delete/generate mocks | HIGH | `[x]` |
| 5 | Security | **Set `REQUIRE_AUTH=True` as default** — All deployments completely open by default | HIGH | `[x]` |
| 6 | Bug | **Fix Dashboard data shape** — `run.passed` should be `run.summary.passed`. Stats never display | CRITICAL | `[x]` |
| 7 | Bug | **Add `data-run-btn="true"` to Send button** — "Apply & Run" from chat is completely dead | CRITICAL | `[x]` |
| 8 | Bug+Feature | **Fix parallel runner auth + Add collection-level auth** — Parallel mode drops auth. Add collection-level auth inheritance for testing all endpoints with one auth config | HIGH | `[x]` |
| 9 | Bug | **Add Supabase sync debouncing** — Every keystroke fires network request | HIGH | `[x]` |
| 10 | Bug | **Add collection deletion confirmation** — One click permanently deletes all data, no undo | HIGH | `[x]` |

### New Security Vulnerabilities (Feb 2026 Audit)

| # | Vulnerability | Severity | File | Description |
|---|--------------|----------|------|-------------|
| S1 | ~~**SSRF in test runner**~~ | CRITICAL | `test_runner.py` | **FIXED** — Added `validate_proxy_url()` calls, HTTP method validation, MAX_CONCURRENT_TESTS=50 limit |
| S2 | ~~**Script sandbox escape**~~ | CRITICAL | `scriptEngine.js` | **FIXED** — Shadowed dangerous globals (window, document, fetch, localStorage, etc.) in Function constructor |
| S3 | ~~**Mock server no auth**~~ | HIGH | `mock_routes.py` | **FIXED** — Added `Depends(verify_token)` to list_mocks, clear_mocks, delete_mock endpoints |
| S4 | ~~**Auth disabled by default**~~ | HIGH | `config.py` | **FIXED** — Changed `REQUIRE_AUTH=True`, disabled OpenAPI/docs in production, reduced info leakage |
| S5 | ~~**DNS failure passthrough**~~ | HIGH | `security.py` | **FIXED** — DNS failures now reject with 400 error instead of silent passthrough |
| S6 | **DNS rebinding (TOCTOU)** | HIGH | `security.py:269-285` | DNS validated once, `aiohttp` resolves independently. Attacker can rebind DNS between check and request. |
| S7 | **Prompt injection** | HIGH | `ai_service.py` (all) | All user inputs directly interpolated into AI prompts. Can leak system prompts, generate malicious content. |
| S8 | **Open relay via proxy** | HIGH | `routes.py:175-236` | Proxy forwards all response headers (leaks `Server`, `Set-Cookie`, internal IPs). Accepts all request headers. |
| S9 | **LocalStorage secrets** | HIGH | `workspaceStore.js:13` | Entire store persisted including API keys, auth tokens, env secrets. Accessible to any XSS. |
| S10 | **Token forgery via JWKS** | HIGH | `security.py:175-180` | Without `SUPABASE_URL`, JWKS URL from unverified JWT `iss` claim. Attacker points to own JWKS server. |
| S11 | **No script timeout** | HIGH | `scriptEngine.js:162-189` | No timeout. `while(true){}` freezes browser permanently. No resource limits. |
| S12 | ~~**DoS amplification**~~ | HIGH | `test_runner.py` | **FIXED** — Added MAX_CONCURRENT_TESTS=50 limit, batch truncation |
| S13 | **Proxy no body size limit** | MEDIUM | `routes.py:64` | `body: Optional[Any]` with no size constraint. Multi-GB payloads exhaust memory. |
| S14 | ~~**Root endpoint info leak**~~ | MEDIUM | `main.py` | **FIXED** — Service details only shown in non-production environments |
| S15 | **OAuth no state param** | MEDIUM | `oauth_routes.py:50-55` | No CSRF protection via state parameter in authorization code flow. |
| S16 | ~~**OpenAPI spec public**~~ | MEDIUM | `main.py` | **FIXED** — Disabled OpenAPI spec, /docs, /redoc in production environment |

---

## 8. Phase 1 — Auth & UI Overhaul

> **Priority:** DO FIRST
> **Goal:** Replace the basic auth modal with a professional SaaS-grade auth experience
> **Why:** The current login is a small popup. No Google SSO. No profile page. The app goes straight to the dashboard with no indication of auth state. This is not acceptable for a SaaS product.

### 5.1 Auth Page Redesign

Replace `AuthModal.jsx` (217 lines, small popup) with a full-page `AuthPage.jsx`:

- [x] Create `frontend/src/components/common/AuthPage.jsx`
- [x] Split-screen layout: branding panel (left 55%), auth form (right 45%)
- [x] Left panel: TestOrbit logo, "AI-Native API Testing" tagline, 3 feature highlights with icons, purple-to-indigo gradient background
- [x] Right panel: auth form with social + email options
- [x] **Google SSO** button at top — "Continue with Google" with Google icon
  - Uses `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`
  - Requires one-time Supabase dashboard setup: enable Google provider, add Google Cloud OAuth Client ID
- [x] **GitHub SSO** button below Google — "Continue with GitHub" with GitHub icon (already working, just move the code)
- [x] Divider: "or continue with email"
- [x] Email/password form (migrated from AuthModal):
  - Login mode: email + password fields
  - Signup mode: full name + email + password fields
  - Toggle: "Don't have an account? Sign up" / "Already have an account? Log in"
- [x] Guest mode: "Skip for now — continue as guest" subtle link at bottom
- [x] Error/success message display (inline alert)
- [x] Full dark mode support
- [x] Responsive: left panel hidden on mobile (`hidden md:flex`), form goes full-width
- [x] On successful login: redirect to `currentView = 'dashboard'`

### 5.2 Profile Page

Create a dedicated profile management page (currently there is NO profile page — only a tiny modal showing email):

- [x] Create `frontend/src/components/common/ProfilePage.jsx`
- [x] Renders when `currentView === 'profile'` (new view in the existing view system)
- [x] **Profile header section:**
  - Large avatar circle (64px) — shows `profile.avatar_url` or first-letter-of-email colored fallback
  - User's full name (large text, editable)
  - User's email (smaller text, read-only, grayed out)
  - "Member since [date]" from `user.created_at`
- [x] **Account information card:**
  - Full name field — editable with inline Save button
  - Email field — read-only display
  - Avatar URL — text input to update (Supabase Storage upload is a future Phase 4 enhancement)
  - Connected providers — show badge for each: Google (colored), GitHub (colored), Email (gray) based on `user.app_metadata.providers` array
- [x] **Sync status card:**
  - Number of collections synced to cloud
  - "Active & Synced" green indicator (migrated from old AuthModal)
  - Last sync timestamp
- [x] **Danger zone card** (red border, bottom of page):
  - "Change Password" — expandable form calling `supabase.auth.updateUser({ password: newPassword })`
  - "Sign Out" button — calls centralized `logout()` action
  - "Sign Out of All Devices" — calls `supabase.auth.signOut({ scope: 'global' })`
- [x] Full dark mode support
- [x] Back button or breadcrumb to return to previous view

### 5.3 Header Auth UI

Replace the tiny "Log In" / "Profile" text button with a proper auth UI:

- [x] Create `frontend/src/components/common/UserMenu.jsx`
- [x] **When logged out:**
  - Styled "Sign In" button — `bg-corporate-600 hover:bg-corporate-700 text-white` with visible CTA styling
  - Clicking sets `currentView` to `'login'` (shows AuthPage)
- [x] **When logged in:**
  - Avatar circle (32px) showing user avatar or first-letter fallback
  - User name displayed next to avatar (hidden on small screens)
  - Click opens dropdown menu:
    - Top: user name + email (non-clickable, informational)
    - "Profile & Settings" — navigates to `currentView = 'profile'`
    - Divider line
    - "Sign Out" — calls `logout()` from store
  - Dropdown closes on outside click (useEffect with document click listener)
  - Dropdown closes on Escape key
- [x] Remove old auth button code from App.jsx (lines 162-170)

### 5.4 Guest Mode Banner

Show a subtle banner when the user hasn't signed in:

- [x] Create `frontend/src/components/common/GuestBanner.jsx`
- [x] Slim horizontal banner between header and main content
- [x] Text: "You're in guest mode. Sign in to sync your data across devices."
- [x] "Sign In" CTA button (links to login view)
- [x] X button to dismiss
- [x] Dismissal persisted in `localStorage` key `testorbit-guest-banner-dismissed`
- [x] Amber/yellow subtle styling: `bg-amber-50 border-amber-200` / `dark:bg-amber-900/20 dark:border-amber-800`
- [x] Only shows when `!user && !dismissed`

### 5.5 Store Updates

Modify `frontend/src/store/workspaceStore.js`:

- [x] Add `profile: null` to initial state — holds `{ full_name, avatar_url, email, updated_at }` from Supabase `profiles` table
- [x] Add `fetchProfile` action:
  ```
  Queries supabase.from('profiles').select('*').eq('id', user.id).single()
  Sets profile state with result
  ```
- [x] Add `updateProfile(updates)` action:
  ```
  Updates supabase.from('profiles').update({ ...updates, updated_at: now }).eq('id', user.id)
  Updates local profile state
  ```
- [x] Add `logout` action:
  ```
  Calls supabase.auth.signOut()
  The existing onAuthStateChange listener handles state cleanup
  ```
- [x] Modify `initializeAuth()`:
  - After detecting valid session (line ~80): call `get().fetchProfile()`
  - Inside `onAuthStateChange` when new user detected (line ~94): call `get().fetchProfile()`
- [x] Update `partialize` (line 1016):
  - Exclude `profile` from persistence: `const { responses, runner, profile, ...persisted } = state;`
  - Profile is fetched fresh from Supabase on each load, no need to persist

### 5.6 Cleanup

- [x] Delete `frontend/src/components/common/AuthModal.jsx` (all functionality migrated)
- [x] In `App.jsx`: remove `AuthModal` import (line 15)
- [x] In `App.jsx`: remove `isSupabaseConfigured` import (line 16) — already flagged as unused lint error
- [x] In `App.jsx`: remove `isAuthOpen` state and `setIsAuthOpen` (line 19)
- [x] In `App.jsx`: remove `<AuthModal>` JSX (lines 225-229)
- [x] In `App.jsx`: import `AuthPage`, `ProfilePage`, `UserMenu`, `GuestBanner`
- [x] In `App.jsx`: replace header auth button section (lines 162-170) with `<UserMenu />`
- [x] In `App.jsx`: add `<GuestBanner />` between header and main content (conditional on `!user`)
- [x] In `App.jsx`: add view branches in main content:
  ```
  currentView === 'login' ? <AuthPage />
  : currentView === 'profile' ? <ProfilePage />
  : currentView === 'dashboard' ? <Dashboard />
  : currentView === 'mock-server' ? <MockServerPanel />
  : currentView === 'docs' ? <DocsPanel />
  : (workspace view)
  ```

### 5.7 Google SSO Setup (Manual — Supabase Dashboard)

This is a one-time configuration, not code:

- [x] Go to Supabase Dashboard → Authentication → Providers → Google → Enable
- [x] Go to Google Cloud Console → APIs & Services → Credentials
- [x] Create OAuth 2.0 Client ID (Web application type)
- [x] Add Authorized redirect URI: `https://jdggstspmzmzdjhdmunn.supabase.co/auth/v1/callback`
- [x] Copy Client ID and Client Secret into Supabase Google provider settings
- [x] Test: click "Continue with Google" in new AuthPage → should redirect to Google consent → return to app logged in

### 5.8 Bug Fixes (Post-Implementation)

Critical bugs found during code review and fixed:

- [x] **CRITICAL: Profile save silently failing** — `updateProfile()` used `.update()` which returns no error on 0 rows affected. Changed to `.upsert()` with `onConflict: 'id'`
- [x] **CRITICAL: Race condition on first OAuth login** — `fetchProfile()` was fire-and-forget (no await) and profile trigger hadn't created row yet. Added `await` + retry logic (3 attempts, 500ms/1500ms backoff) + fallback to `user_metadata`
- [x] **HIGH: logout() could throw** — Added try-catch around `supabase.auth.signOut()`
- [x] **MEDIUM: GuestBanner localStorage crash** — `localStorage.getItem/setItem` can throw in private browsing or when storage is full. Wrapped in try-catch
- [x] **MEDIUM: hasEmail always truthy** — `providers.includes('email') || user.email` was always true since every Supabase user has an email. Fixed to `providers.includes('email')` only
- [x] **MEDIUM: handleLogoutAll no error handling** — Added try-catch around `supabase.auth.signOut({ scope: 'global' })`

---

## 9. Phase 2 — Production Ready

> **Priority:** Fix before going live
> **Goal:** Make the app safe and deployable
> **Why:** Right now, the backend has zero auth on routes, the proxy can hit any URL, there's no rate limiting, and CORS only allows localhost. Deploying this as-is would be dangerous.

### 6.1 Security Fixes

- [x] **JWT auth middleware** — Created `verify_token` dependency in `security.py`:
  - Validates Supabase JWT from `Authorization: Bearer <token>` header using PyJWT
  - `REQUIRE_AUTH=False` (dev): allows unauthenticated requests with stub user, still validates if token present
  - `REQUIRE_AUTH=True` (prod): rejects requests without valid token (401)
  - Validates HS256 algorithm, `authenticated` audience, expiry
  - Applied to all 6 routes in `routes.py` (generate, run, voice, codegen, diagnose, proxy)
  - Mock server routes: rate-limited (30/min per IP), no auth (demo purposes)
  - OAuth routes: JWT auth + rate limiting (10/min per IP)
  - Frontend: created `authFetch()` helper in `config.js` that auto-attaches Bearer token from Supabase session
  - Replaced all 11 `fetch(API_BASE/...)` calls across 5 files with `authFetch()`
  - Added `SUPABASE_JWT_SECRET` and `REQUIRE_AUTH` to config and `.env.example`
- [x] **SSRF protection** — Created `app/core/security.py` with `validate_proxy_url()`:
  - Blocks private IP ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`
  - Blocks cloud metadata: `169.254.0.0/16` (covers `169.254.169.254`)
  - Blocks `localhost` and `metadata.google.internal` hostnames
  - Blocks non-http(s) schemes
  - Resolves DNS and validates resolved IPs against blocked ranges
  - Applied to `/proxy` endpoint
- [x] **Rate limiting** — Added `slowapi` middleware:
  - AI endpoints (`/generate`, `/codegen`, `/diagnose`, `/voice`): 10/minute per IP (configurable via `AI_RATE_LIMIT`)
  - Proxy endpoint: 60/minute per IP (configurable via `PROXY_RATE_LIMIT`)
  - Mock server: 30/minute per IP (configurable via `MOCK_RATE_LIMIT`)
  - OAuth proxy: 10/minute per IP (uses `AI_RATE_LIMIT`)
  - Returns 429 with `Retry-After` header and structured error response
  - Rate limits configurable in `.env`
- [x] **Input validation** — Added `Field(max_length=...)` to all Pydantic models:
  - `url`: max 2048, `method`: max 10
  - `openapi_spec`: max 102400 (100KB)
  - `user_instructions`/`transcript`/`context`: max 5000
  - `body`/`request_body`/`response_body`: max 1048576 (1MB)
- [x] **Secret masking** — Created `SecretMaskingFilter` log filter in `security.py`. Detects and masks API keys, JWTs (`eyJ...`), Gemini keys (`AIza...`), tokens, passwords in all log output. Installed on root logger at app startup via `install_secret_masking()`. Also removed raw `response_text` from OAuth error logs.
- [x] **HTTPS enforcement** — Created `HTTPSRedirectMiddleware` in `security.py`. Redirects HTTP → HTTPS (307) in production. Respects `X-Forwarded-Proto` header from reverse proxies. Only active when `ENV=production`.
- [x] **CORS production config** — Added `ALLOWED_ORIGINS` env var. When set (comma-separated), overrides default dev origins. Use in `.env` for production.
- [x] **Security headers** — Created `SecurityHeadersMiddleware` in `app/core/security.py`:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` — restricts scripts, styles, connects, images, fonts, objects, base-uri
  - `Permissions-Policy` — disables camera, microphone, geolocation
  - `Strict-Transport-Security` (production only)
  - Same CSP/Permissions-Policy headers also added to `nginx.conf`
- [x] **CORS methods restricted** — Changed from `allow_methods=["*"]` to explicit `["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]`
- [x] **Error sanitization** — All backend error responses return generic messages (no `str(e)` leaking internals). Full errors logged server-side only. Fixed in `routes.py` (proxy, voice), `mock_routes.py`, `oauth_routes.py`.
- [x] **MockServerPanel error UI** — Added user-facing error banner (red alert) for fetch/clear/delete failures instead of silent `console.error`.

### 6.2 Environment Configuration

- [x] **Configurable backend URL** — Created `frontend/src/config.js` with `API_BASE`, `MOCK_BASE`, `BACKEND_URL` sourced from `VITE_API_BASE_URL`. Replaced all 14 hardcoded `localhost:8000` references across 8 files.
- [ ] **Environment-based settings** — Create config profiles:
  - `development`: localhost URLs, debug logging, permissive CORS
  - `staging`: staging URLs, info logging, staging CORS
  - `production`: production URLs, warning logging, strict CORS
- [x] **Frontend `.env.example`** — Created with Supabase + API base URL placeholders
- [x] **Backend `.env.example`** — Expanded with `ENV` and `ALLOWED_ORIGINS` variables

### 6.3 Docker & Deployment

- [x] **Frontend Dockerfile** — Multi-stage build: `node:20-alpine` (build) + `nginx:alpine` (serve). Custom `nginx.conf` with SPA routing, gzip, security headers, asset caching. Build args for `VITE_*` env vars.
- [x] **Backend Dockerfile** — `python:3.11-slim`, non-root `appuser`, 1 uvicorn worker (optimized for Render 512MB free tier). `.dockerignore` excludes `__pycache__`, `.env`, `mocks.json`.
- [x] **docker-compose.yml** — Two services: frontend (port 80) + backend (port 8000). Backend reads from `backend/.env`, env overrides for `ENV`, `REQUIRE_AUTH`, `ALLOWED_ORIGINS`.
- [x] **Cloudflare Pages setup** — Created `frontend/wrangler.json` with SPA routing (`not_found_handling: "single-page-application"`). Unlimited bandwidth + requests on free tier.
- [x] **Render backend setup** — Dockerfile ready for Render free tier (Docker runtime, 512MB RAM, 1 worker). Keep-alive via UptimeRobot prevents 15-min sleep.
- [x] **Deployment guide** — Comprehensive `DEVELOPER.md` created with:
  - Local development setup (step-by-step)
  - Docker deployment (quick start + individual builds)
  - **Cloudflare Pages + Render deployment** (step-by-step, $0/month)
  - Alternative platforms comparison (Koyeb, Oracle Cloud, HF Spaces)
  - Environment variables reference (all vars, defaults, descriptions)
  - Supabase setup guide (schema, auth, providers)
  - Google OAuth setup guide
  - Backend API reference (all 9 endpoints with request/response examples)
  - Frontend architecture (views, components, store, authFetch)
  - Security documentation (JWT, SSRF, rate limiting, headers, masking, CSP)
  - Troubleshooting (10 common issues with solutions)
  - Full project structure tree
- [x] **Production build optimization** — Vite build verified: JS 1,387KB (gzip 432KB). Tree-shaking active.
- [x] **Backend production config** — Dockerfile uses `--workers 4`. Docs include gunicorn command for production.

### 6.4 Error Handling & Logging

- [ ] **Structured logging** — Expand loguru usage in backend:
  - Request/response logging middleware (method, URL, status, duration)
  - Error logging with stack traces
  - JSON log format for production (parseable by log aggregators)
- [ ] **Frontend error boundaries** — Improve existing `ErrorBoundary.jsx`:
  - Add "Report this error" button
  - Show user-friendly error messages
  - Recovery options (retry, go home)
- [ ] **API error standardization** — All backend errors return consistent format:
  ```json
  { "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "...", "details": {} } }
  ```
- [ ] **Error tracking** — Integrate Sentry (or similar) for both frontend and backend
- [x] **Health check** — Enhanced root endpoint `/` with:
  - Uptime tracking (`uptime_seconds`)
  - Service status (`gemini: configured/missing_key`, `auth: enabled/disabled`)
  - Version number and environment

### 6.5 Database

- [ ] **Schema versioning** — Create a migrations system for Supabase schema changes:
  - Track schema version in a `schema_versions` table
  - Migration files in `supabase/migrations/` directory
  - Up/down migration support
- [ ] **Backup strategy** — Document Supabase backup options:
  - Supabase daily automatic backups (Pro plan)
  - Manual backup via pg_dump
  - Point-in-time recovery setup
- [x] **Index optimization** — Added 4 indexes to `supabase_schema.sql`:
  - `idx_collections_owner_id` on `collections(owner_id)`
  - `idx_collection_shares_user_email` on `collection_shares(user_email)`
  - `idx_collection_shares_collection_id` on `collection_shares(collection_id)`
  - `idx_environments_owner_id` on `environments(owner_id)`

### 6.6 Lint & Code Quality Fixes

- [x] Fix all 37 ESLint errors (was 36 + 1 from auth refactor) — **DONE, 0 remaining**
- [x] Fix all 10 ESLint warnings — **DONE, 0 remaining**
- [x] **DocsPanel.jsx** — Moved `FeatureCard`, `QuickTip`, `Shortcut` outside the component function; removed unused `useState` import
- [x] **InteractiveTutorial.jsx** — Removed duplicated `activeTutorial` local state (uses store directly via ref comparison); fixed `useCallback` deps; removed unused `addCollectionChatMessage`; fixed unused catch param
- [x] **Dashboard.jsx** — Replaced `Date.now()` in render with `useMemo(() => Date.now(), [])`
- [x] **TourGuide.jsx** — Removed unused `continuous` and `action` destructures
- [x] **CurlImportModal.jsx** — Removed unused `addRequest` and `updateRequest` selectors
- [x] **MockServerPanel.jsx** — Removed unused `useWorkspaceStore` import
- [x] **WebSocketTester.jsx** — Removed unused `setAutoScroll`; suppressed intentional setState-in-effect
- [x] **RequestEditor.jsx** — Fixed unused `e` and `v` variables; suppressed intentional setState-in-effect
- [x] **workspaceStore.js** — Prefixed `owner_id`, `responses`, `runner`, `profile` with `_`; removed unused `state` param
- [x] **IntelligencePanel.jsx** — Stabilized `messages`/`testSuites` empty arrays; suppressed intentional missing deps
- [x] **CollectionRunner.jsx** — Suppressed intentional missing deps in useCallback
- [x] **ShareModal.jsx** — Suppressed intentional missing dep
- [x] **assertionEngine.js** — Removed unused eslint-disable directive
- [x] **App.jsx** — Removed unused `user` selector
- [x] Target: **zero errors, zero warnings** ✅

---

## 10. Phase 3 — SaaS Infrastructure

> **Priority:** After production-ready
> **Goal:** Turn TestOrbit into a paid product
> **Why:** This is how you make money. Free tier to attract users, paid tiers for power features.

### 7.1 Stripe Billing Integration

- [ ] **Stripe account setup** — Create Stripe account, get API keys
- [ ] **Pricing tiers:**

| Feature | Free | Pro ($12/mo) | Team ($29/mo/seat) |
|---------|------|-------------|-------------------|
| AI calls | 50/day | Unlimited | Unlimited |
| Collections | 3 | Unlimited | Unlimited |
| Sharing | No | Yes | Yes |
| WebSocket testing | Yes | Yes | Yes |
| Team workspaces | No | No | Yes |
| Admin dashboard | No | No | Yes |
| Priority support | No | Yes | Yes |

- [ ] **Stripe Checkout** — Frontend integration for plan selection and payment
- [ ] **Stripe webhook handler** — Backend endpoint to process subscription events (created, updated, canceled, payment_failed)
- [ ] **Subscription management page** — UI to view current plan, upgrade, downgrade, cancel
- [ ] **Invoice history** — Display past invoices with download links
- [ ] **Supabase integration** — Store plan info in a `subscriptions` table linked to user ID
- [ ] **Graceful degradation** — When limits hit, show upgrade prompt (not hard block)

### 7.2 Usage Tracking & Quotas

- [ ] **Usage tracking table** — Supabase table: `usage_logs (id, user_id, endpoint, timestamp)`
- [ ] **Daily/monthly counters** — Track AI calls per user per day/month
- [ ] **Collection count check** — Enforce max collections per plan tier
- [ ] **Backend middleware** — Before AI endpoint execution, check if user has remaining quota
- [ ] **Usage dashboard widget** — In the app, show: "23/50 AI calls used today" progress bar
- [ ] **Upgrade prompts** — When at 80% of limit: warning banner. At 100%: upgrade modal
- [ ] **Reset schedule** — Daily quotas reset at midnight UTC

### 7.3 CI/CD Pipeline

- [ ] **GitHub Actions workflow** — `.github/workflows/deploy.yml`:
  ```
  on push to main:
    1. Lint (eslint)
    2. Type check (if TypeScript added later)
    3. Build frontend
    4. Build backend (verify imports)
    5. Run tests (pytest for backend)
    6. Deploy to production
  ```
- [ ] **Staging auto-deploy** — On PR creation, deploy to staging URL
- [ ] **Environment secrets** — Store all secrets in GitHub Secrets (Supabase keys, Stripe keys, Gemini key)
- [ ] **Build status badge** — Add to README.md
- [ ] **Deployment targets** — Configure for chosen cloud provider (Railway/Render/Fly.io)

### 7.4 User Management

- [ ] **Admin dashboard** — Protected page (admin-only) showing:
  - Total user count, new signups (daily/weekly/monthly chart)
  - Revenue (MRR, ARR from Stripe)
  - API usage (total calls, per-endpoint breakdown)
  - Active users (DAU, WAU, MAU)
- [ ] **User management panel** — List all users with:
  - Email, plan, signup date, last active
  - Suspend/unsuspend account action
  - Impersonate user (for debugging, with audit log)
- [ ] **Email notifications** — Transactional emails via Resend, SendGrid, or Supabase built-in:
  - Welcome email on signup
  - Billing receipts
  - Usage warning (approaching limit)
  - Account actions (password change, login from new device)

### 7.5 Legal & Compliance

- [ ] **Terms of Service page** — `/terms` view with standard SaaS ToS
- [ ] **Privacy Policy page** — `/privacy` view with data handling disclosure
- [ ] **Cookie consent banner** — Bottom banner with accept/reject for non-essential cookies
- [ ] **Data retention policy** — Document how long data is stored, how deletion works

### 7.6 Custom Error Pages

- [ ] **404 Not Found** — Branded page with TestOrbit styling and navigation
- [ ] **500 Server Error** — "Something went wrong" with retry button and error ID
- [ ] **Maintenance mode** — "We're upgrading TestOrbit" page with estimated return time
- [ ] **Rate limit exceeded** — "Slow down" page with time until reset and upgrade CTA

---

## 11. Phase 4 — Product Improvements

> **Priority:** After SaaS launch
> **Goal:** Features that make users stay and love the product
> **Why:** These are the features that differentiate TestOrbit from Postman and justify the subscription.

### 8.1 Request Management

- [ ] **Request history** — Searchable log of every request sent:
  - Filter by URL, method, status code, date range
  - View full request/response details for any past request
  - Store in Supabase for cloud persistence
- [ ] **Collection export to Postman** — Convert TestOrbit collection to Postman Collection v2.1 JSON format
- [ ] **Collection export to OpenAPI** — Generate OpenAPI 3.x spec from collection requests
- [ ] **Response diff viewer** — Compare two responses side by side:
  - Select any two responses from history
  - Highlight differences in status, headers, body (JSON diff)
- [ ] **File upload support** — `multipart/form-data` body type in RequestEditor:
  - File picker for attachments
  - Mix of file fields and text fields
- [ ] **Request chaining** — Use values from response A as input to request B:
  - Define extraction rules: "From response of 'Login', extract `data.token`"
  - Auto-populate variables: `{{Login.response.data.token}}`
  - Visual chain builder showing request dependencies
- [ ] **Request duplication** — One-click clone of any request (already partially exists via context menu)
- [ ] **Bulk actions** — Select multiple requests: delete, move to folder, export

### 8.2 Collection Features

- [ ] **Collection versioning** — Snapshot and rollback:
  - Auto-snapshot before major changes
  - Manual "Save version" with label
  - Diff between versions
  - Rollback to any previous version
- [ ] **Collection forking** — Fork a shared collection into your own workspace
- [ ] **Collection templates** — Pre-built collections for popular APIs:
  - Stripe API template
  - GitHub API template
  - Twitter/X API template
  - Custom template creation from any collection
- [ ] **Folder nesting** — Organize requests in sub-folders within collections:
  - Drag-and-drop reordering
  - Collapse/expand folders
  - Folder-level variables

### 8.3 Testing & Monitoring

- [ ] **API monitoring** — Scheduled health checks:
  - Configure interval (every 1min, 5min, 15min, 1hr)
  - Select which requests to monitor
  - Alert on failure (email, webhook)
  - Uptime percentage display
  - Response time history chart
- [ ] **Load testing** — Concurrent request execution:
  - Configure: concurrent users, ramp-up time, duration
  - Real-time metrics: requests/sec, avg response time, error rate
  - Results chart (throughput vs time, latency percentiles)
- [ ] **Performance benchmarking** — Track response times over time:
  - Per-endpoint response time trends
  - Baseline establishment
  - Alert on regression (>20% slower than baseline)
- [ ] **Test coverage report** — Compare collection against OpenAPI spec:
  - Show which endpoints are covered
  - Show which methods are missing (e.g., DELETE /users not tested)
  - Coverage percentage
- [ ] **CLI test runner** — Enhanced `cli.py run` for CI integration:
  - JUnit XML output for CI parsers
  - Exit code based on test results
  - Parallel execution option

### 8.4 Developer Experience

- [ ] **Command palette** — `Ctrl+K` opens searchable command list:
  - Search for requests by name or URL
  - Navigate to any view
  - Execute actions (new request, run tests, toggle dark mode)
  - Fuzzy matching
- [ ] **Enhanced keyboard shortcuts** — Customizable keybindings:
  - Current: Ctrl+N (new request), Ctrl+Enter (send), Ctrl+S (save), Esc (close)
  - Add: Ctrl+Shift+N (new collection), Ctrl+P (command palette), Ctrl+B (toggle sidebar)
  - Customization page in settings
- [ ] **Code snippets library** — Save and reuse code fragments:
  - Save frequently used request bodies, scripts, headers
  - Quick-insert from library
  - Share snippets across collections
- [ ] **Syntax highlighting for more body types** — Beyond JSON:
  - XML with tag coloring
  - YAML
  - Form-urlencoded
  - Plain text with line numbers
- [ ] **Variable autocomplete** — In URL and body editors:
  - `{{` triggers autocomplete dropdown
  - Shows available variables from current environment
  - Shows chained response variables
- [ ] **Tab drag-to-reorder** — Drag request tabs to rearrange order
- [ ] **Split view** — On wide screens, show request and response side by side instead of stacked

### 8.5 Environment System Enhancements

- [ ] **Environment inheritance** — Three-level variable resolution:
  - Global environment (applies to all workspaces)
  - Workspace/collection environment (applies to all requests in collection)
  - Request-level overrides
  - Resolution order: request > workspace > global
- [ ] **Environment quick-switch** — Dropdown in header to switch between environments instantly
- [ ] **Secret variables** — Variables marked as "secret":
  - Displayed as `••••••••` in UI
  - Never included in exports
  - Never synced to cloud in plaintext (encrypted at rest)
- [ ] **Dotenv file import** — Upload a `.env` file to auto-create an environment with all key-value pairs

---

## 12. Phase 5 — Collaboration & Enterprise

> **Priority:** Growth phase
> **Goal:** Features that make companies adopt TestOrbit
> **Why:** Teams, real-time editing, and roles are what turn individual users into enterprise contracts.

### 9.1 Real-time Collaboration

- [ ] **Real-time collaborative editing** — Multiple users editing the same collection simultaneously:
  - Powered by Supabase Realtime or Yjs CRDT
  - Changes propagate instantly to all connected users
  - No data loss on concurrent edits
- [ ] **Presence indicators** — See who's online and what they're viewing:
  - Avatar stack in collection header showing active users
  - "Alice is viewing GET /users" indicator
- [ ] **Live cursor positions** — See other users' cursors in editors (like Google Docs)
- [ ] **Conflict resolution** — When two users edit the same request simultaneously:
  - Automatic merge for non-overlapping changes
  - Conflict notification for overlapping changes with merge UI

### 9.2 Team Features

- [ ] **Team workspaces** — Shared workspace with shared billing:
  - Team owner creates workspace, invites members
  - Shared collections visible to all team members
  - Team-wide environment variables
- [ ] **Workspace roles & permissions:**
  - Owner: full control, billing, member management
  - Admin: manage members, manage all collections
  - Editor: edit collections they have access to
  - Viewer: read-only access to shared collections
- [ ] **Team member invite** — Invite by email with role assignment
- [ ] **Activity feed** — Chronological log of all team actions:
  - "Alice created collection 'Payment API'"
  - "Bob ran tests on 'Auth Endpoints' — 12 passed, 2 failed"
  - "Charlie shared 'Inventory API' with Dave"
- [ ] **Inline comments on requests** — Add discussion threads to any request:
  - "Why is this header needed?" / "For CSRF protection, see docs"
  - Resolve/unresolve threads
  - @mention team members

### 9.3 AI Enhancements

- [ ] **Multi-model support** — Let users choose their AI model:
  - Google Gemini (current, default)
  - OpenAI GPT-4 / GPT-4o
  - Anthropic Claude
  - User provides their own API key for non-Gemini models
  - Model selector in Intelligence Panel header
- [ ] **AI documentation writer** — Generate API documentation from collection:
  - Analyze all requests in a collection
  - Generate Markdown documentation with examples
  - Include request/response samples
  - Export as standalone docs page
- [ ] **AI test coverage analysis** — "You're missing edge cases":
  - Analyze existing tests against OpenAPI spec
  - Suggest missing test cases
  - Prioritize by risk (auth endpoints, payment endpoints first)
- [ ] **AI conversation memory** — Remember context across chat sessions:
  - "Remember, this API requires Bearer token from the auth endpoint"
  - Persistent context per collection
  - Summarize long conversations to stay within token limits
- [ ] **AI auto-fix** — Automatically fix failing tests:
  - Analyze test failure
  - Suggest and apply fixes
  - Re-run to verify fix works
- [ ] **AI request builder** — Build requests from natural language:
  - "Create a POST request to /users with name and email fields"
  - AI generates the full request with headers, body, and assertions

### 9.4 Notifications

- [ ] **In-app notification center** — Bell icon in header with dropdown:
  - Test failure alerts
  - Sharing invitations
  - Team activity mentions
  - System announcements
- [ ] **Email alerts** — Configurable email notifications:
  - Monitoring failures (immediate)
  - Daily digest of test results
  - Weekly team activity summary
- [ ] **Slack/Discord webhook integration** — Send alerts to team channels:
  - Configure webhook URL in settings
  - Customize which events trigger notifications
- [ ] **Weekly digest email** — Automated weekly summary:
  - Test results overview
  - API health metrics
  - Team activity highlights

---

## 13. Future Roadmap

> **Priority:** Long-term vision, post-SaaS establishment
> **Goal:** Make TestOrbit the definitive API testing platform
> **Why:** These are ambitious features that expand the market. Only pursue after the core product is profitable.

### 10.1 Protocol Support

- [ ] **GraphQL support:**
  - GraphQL query builder with syntax highlighting
  - Schema explorer (introspection query)
  - Variables panel
  - Auto-complete for queries based on schema
  - Subscription testing (WebSocket-based)
- [ ] **gRPC support:**
  - Proto file upload and parsing
  - Service browser (list all RPCs)
  - Unary, server-streaming, client-streaming, bidirectional streaming
  - Message builder from proto definitions
- [ ] **Server-Sent Events (SSE):**
  - Connect to SSE endpoint
  - Display events in real-time log
  - Filter events by type
- [ ] **MQTT support:**
  - Connect to MQTT broker
  - Subscribe to topics
  - Publish messages
  - QoS level selection
- [ ] **Message queue testing:**
  - RabbitMQ: publish/consume messages
  - Kafka: produce/consume topics
  - Visual message flow

### 10.2 Platform & Infrastructure

- [ ] **Custom domain support** — White-label for enterprise:
  - `api-tests.yourcompany.com` instead of `testorbit.app`
  - Custom branding (logo, colors)
- [ ] **Multi-region deployment:**
  - US (current)
  - EU (GDPR compliance, data residency)
  - Asia-Pacific (latency reduction)
- [ ] **On-premise / self-hosted option:**
  - Docker images for self-hosting
  - Helm chart for Kubernetes deployment
  - License key management
- [ ] **SOC 2 compliance:**
  - Security audit
  - Access controls documentation
  - Incident response procedures
  - Annual audit certification
- [ ] **GDPR compliance:**
  - Data export (download all your data)
  - Right to deletion (delete account and all data)
  - Data processing agreement
  - Cookie consent management
- [ ] **HIPAA compliance tier:**
  - For healthcare API testing
  - BAA (Business Associate Agreement)
  - Enhanced encryption and access controls

### 10.3 Extensibility

- [ ] **Plugin system:**
  - Community-built extensions
  - Plugin marketplace
  - Plugin API for custom request transformers, response viewers, auth providers
  - Example plugins: JWT decoder, GraphQL formatter, AWS Signature v4
- [ ] **Custom script languages:**
  - Python scripts (in addition to JavaScript)
  - Go scripts
  - WASM-based sandbox for safety
- [ ] **CI/CD plugins:**
  - GitLab CI integration
  - Jenkins plugin
  - Azure DevOps extension
  - Bitbucket Pipelines
- [ ] **Git-backed collections:**
  - Version control collections via git (not just internal snapshots)
  - Push/pull collections from GitHub repos
  - Branch-based collection variants
- [ ] **API marketplace:**
  - Browse public API collections
  - One-click import of community-maintained collections
  - Rating and review system

### 10.4 Advanced Features

- [ ] **Client certificate support (mTLS):**
  - Upload client certificates (.pem, .p12)
  - Per-request certificate selection
  - Certificate management UI
- [ ] **Proxy/tunnel support:**
  - HTTP proxy configuration
  - SOCKS5 proxy support
  - SSH tunnel setup for testing internal APIs
- [ ] **Natural language to OpenAPI spec:**
  - Describe an API in English
  - AI generates full OpenAPI 3.x spec
  - Edit and refine the generated spec
  - Export as YAML/JSON
- [ ] **Visual API flow builder:**
  - Drag-and-drop canvas for request chains
  - Conditional branching (if status 200 → do X, else → do Y)
  - Loop support (repeat request N times)
  - Visual execution with animated flow
- [ ] **Mobile companion app (iOS/Android):**
  - View test results on phone
  - Trigger test runs remotely
  - Push notifications for monitoring alerts
  - Quick request builder for on-the-go testing
- [ ] **Desktop app (Electron):**
  - Offline-first with cloud sync
  - Native OS integration (system tray, notifications)
  - Better performance for large collections
  - Local proxy for testing localhost APIs
- [ ] **Browser extension:**
  - Capture network requests from any website
  - One-click import captured requests into TestOrbit
  - Chrome and Firefox support

---

## 14. Codebase Stats

### Current Numbers (as of 2026-02-14)

| Metric | Value |
|--------|-------|
| **Frontend components** | 24 (17 workspace + 7 common) |
| **Utility files** | 3 (scriptEngine, assertionEngine, supabaseClient) |
| **Backend services** | 3 (ai_service, test_runner, mock_service) |
| **Backend route files** | 3 (routes, mock_routes, oauth_routes) |
| **API endpoints** | 9 (generate, run, voice, codegen, diagnose, proxy, mock/*, oauth/token, oauth/refresh) |
| **Zustand store version** | 8 (8 migrations: v1→v8) |
| **Frontend dependencies** | 8 runtime, 12 dev |
| **Backend dependencies** | 10 (requirements.txt) |
| **JS bundle size** | 1,387 KB (gzip: 432 KB) |
| **CSS bundle size** | 78 KB (gzip: 12 KB) |
| **ESLint errors** | 0 |
| **ESLint warnings** | 0 |
| **Supabase tables** | 4 (profiles, collections, collection_shares, environments) |
| **Python version** | 3.11+ |
| **Node.js version** | 18+ |

### Frontend Component Inventory

**Workspace components (17):**
`CodeGenModal` `CollectionRunner` `CurlImportModal` `CustomMethodSelect` `Dashboard` `DocsPanel` `EnvironmentManager` `ImportCollectionModal` `IntelligencePanel` `JsonViewer` `KeyValueEditor` `MockServerPanel` `RequestEditor` `ShareModal` `Sidebar` `TabManager` `WebSocketTester`

**Common components (7):**
`AuthPage` `ProfilePage` `UserMenu` `GuestBanner` `ErrorBoundary` `InteractiveTutorial` `TourGuide`

### Backend Endpoint Inventory

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/generate` | AI test case generation |
| POST | `/api/v1/run` | Batch test execution |
| POST | `/api/v1/voice` | Natural language → API request |
| POST | `/api/v1/codegen` | Code snippet generation |
| POST | `/api/v1/diagnose` | AI failure diagnosis |
| POST | `/api/v1/proxy` | CORS proxy for HTTP requests |
| ANY | `/mock-server/{path}` | AI mock response generation |
| POST | `/api/v1/oauth/token` | OAuth token exchange |
| POST | `/api/v1/oauth/refresh` | OAuth token refresh |
| GET | `/` | Health check |

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React | 19.2.0 |
| Build tool | Vite | 7.2.4 |
| CSS framework | Tailwind CSS | 4.1.18 |
| State management | Zustand | 5.0.11 |
| Auth & database | Supabase | 2.95.3 |
| Icons | Lucide React | 0.563.0 |
| Syntax highlighting | react-syntax-highlighter | 16.1.0 |
| Onboarding | react-joyride | 2.9.3 |
| Backend framework | FastAPI | 0.128.1+ |
| AI model | Google Gemini 3 Flash | via google-genai 1.62.0 |
| HTTP client (backend) | aiohttp | 3.13.3+ |
| Logging | loguru | 0.7.3+ |

---

> **Note:** This is a living document. Check off items as they're completed. Add new items as they're discovered. Update the status table after each phase.
