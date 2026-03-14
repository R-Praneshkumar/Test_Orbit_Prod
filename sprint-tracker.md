# TestOrbit — Complete Business Plan & Sprint Tracker

> **Updated:** 2026-03-13 (MAJOR STRATEGY REVISION — Postman AI-native response)
> **Overall Score:** 7.3/10 → Target 8.5/10 after revised sprints
> **Overall Progress:** Sprints 1-8 COMPLETE. All sprints done.
> **Total Effort:** ~310 hours (~15 weeks at 20h/week)
> **Launch Target:** Week 8 (Sprint 4) — DONE. Now: capture Postman refugees.

---

## 0. COMPETITIVE CRISIS & STRATEGIC PIVOT (March 2026)

### What Happened
On **March 1, 2026**, Postman launched v12 — a **full AI-native platform rewrite**. This is not a feature update. They rebuilt the entire product around AI.

### What Postman Now Has
- **Agent Mode:** 70+ tools, natural language control over entire API lifecycle
- **AI Test Generation:** 5 types (contract, load, unit, integration, e2e) + auto-repair
- **AI Agent Builder:** Visual canvas to build multi-step AI agents on APIs
- **Full MCP Support:** Client + Server + Generator + curated directory
- **AI Documentation:** Auto-docs + Fern acquisition (SDK gen in 9 languages)
- **AI Observability:** Postman Insights + Dynatrace partnership
- **Git-Native Architecture:** YAML collections, offline support
- **Collection 3.0:** Multi-protocol (HTTP, GraphQL, gRPC, MCP, MQTT, WebSocket)

### What This Means for TestOrbit
**The original moat — "AI-native API testing" — is gone.** Postman now has deeper AI integration than TestOrbit across every dimension. They have 40M+ developers, $5B+ valuation, and 98% of Fortune 500.

**You cannot out-AI Postman. Full stop.**

### BUT — Postman Created 5 Massive Vulnerabilities

| Vulnerability | Opportunity for TestOrbit |
|---|---|
| **Free plan gutted** — 1 user only, 50 AI credits/MONTH | Free for teams of up to 3. 50 AI calls/DAY not month. |
| **AI credits are metered** — $0.035-0.05/credit overage | Unlimited AI on paid plans (Gemini Flash costs ~$0.001/call) |
| **$19/user/mo for teams** — 5-person team = $1,140/yr | ₹500/mo + ₹250/seat = ₹21,000/yr ($252/yr). **4.5x cheaper.** |
| **Bloated & slow** — 70+ tools, Electron app, complex UI | Lightweight, web-first, loads in 2 seconds, zero config |
| **No AI security testing** — only static OWASP rules | AI-powered vulnerability discovery, fuzzing, auth bypass detection |

### New Positioning
**OLD:** "AI-Native API Testing Platform"
**NEW:** "The fast, affordable, AI-powered Postman alternative. Unlimited AI. Free for teams. No bloat."

### New Competitive Strategy

```
DON'T compete on:              DO compete on:
─────────────────              ──────────────
AI breadth (70+ tools)         AI DEPTH (2-3 things, 10x better)
Enterprise governance          Speed & simplicity
MCP server building            Price (4-5x cheaper)
SDK generation                 India-first (INR/UPI/Razorpay)
Multi-protocol (gRPC/MQTT)     Postman migration path
API catalog/observability      Free team collaboration
```

---

## 1. Updated Scorecard

| Dimension | Current Score | Target (Post-Pivot) | What Changed |
|-----------|--------------|---------------------|--------------|
| Feature Completeness | 8.5/10 | **9/10** | Add Postman import, AI security, enhanced AI |
| Reliability | **6/10** | **8/10** | Continue bug fixes |
| Security Posture | **7/10** | **8.5/10** | AI security testing is now a PRODUCT feature |
| Architecture Quality | 7.5/10 | 7.5/10 | No structural changes needed yet |
| Performance | **7/10** | **8/10** | Already fast — maintain advantage over Postman |
| DevOps | **7/10** | **8/10** | CI is good, add structured logging |
| Testing Coverage | **7/10** | **7.5/10** | 481 tests, maintain |
| UX & Accessibility | **6.5/10** | **8/10** | Simplicity IS the UX advantage |
| Collaboration | **4.5/10** | **7/10** | Teams + Postman import = migration path |
| Documentation | 8.5/10 | 8.5/10 | Already excellent |
| **Competitive Position** | **3/10** | **7/10** | NEW DIMENSION — price, speed, migration |
| **Overall** | **7.3/10** | **8.2/10** | Pivot from AI-breadth to price/speed/depth |

---

## 2. What's Truly Done (Verified Checklist)

### Phase 1 (Auth & UI Overhaul): COMPLETE
- [x] AuthPage (Google + GitHub + Email SSO)
- [x] ProfilePage with danger zone
- [x] UserMenu dropdown
- [x] GuestBanner
- [x] Store: profile, fetchProfile, updateProfile, logout
- [x] Google SSO configured in Supabase

### Phase 2 (Production Ready) — Partial:
- [x] JWT auth on all routes (HS256 + RS256/ES256 + JWKS caching)
- [x] SSRF protection (DNS validation, blocked IP ranges, metadata blocking)
- [x] Rate limiting (10/min AI, 60/min proxy, 30/min mock)
- [x] Input validation (Pydantic field limits)
- [x] Security headers (CSP, HSTS, X-Frame, Permissions-Policy)
- [x] Secret masking in logs
- [x] HTTPS enforcement in production
- [x] CORS production config
- [x] Error sanitization (no internals leaked)
- [x] Frontend config centralized (config.js)
- [x] Docker (frontend + backend + compose)
- [x] Deployment docs (Cloudflare + Render, Docker)
- [x] Health check endpoint
- [x] ESLint: 0 errors, 0 warnings
- [x] DB indexes (4 indexes)
- [x] Ownership hijack prevention (trigger)
- [x] Share role UPDATE policy

### Bug Fixes (10/10 critical/high):
- [x] B1-B10: All critical/high bugs fixed

### Sprint 1 (Security): COMPLETE
- [x] S1.1-S1.8: All security vulns fixed
- [ ] S1.9: Apply Supabase schema (BLOCKED — manual)

### Sprint 2 (Testing): COMPLETE
- [x] S2.1-S2.7: 481 tests, CI pipeline, 90%+ coverage on core engines

### Sprint 3 (Table Stakes): COMPLETE
- [x] S3.1-S3.5: Body types, export, code splitting, bug fixes, toasts

### Sprint 4 (SaaS Wiring): COMPLETE
- [x] S4.1-S4.7: Razorpay, usage tracking, rate limiting, legal, dashboard, Sentry

---

## 3. What's Still Open (Updated for New Strategy)

### Immediate Competitive Threats:
| Threat | Urgency | Response |
|--------|---------|----------|
| Postman refugees searching for alternatives RIGHT NOW | **CRITICAL** | Landing page + Postman import + SEO |
| Postman's 50 credits/month makes free plan useless | **HIGH** | Market our 50/DAY free tier aggressively |
| $19/user/mo pricing shock pushing teams to Bruno/Hoppscotch | **HIGH** | Capture with free team tier + INR pricing |
| Postman has AI security testing gap | **HIGH** | Build AI security as differentiator |
| Bruno (40K stars) + Hoppscotch (77K stars) growing but NO AI | **MEDIUM** | We have AI + they don't = our wedge |

### Infrastructure Gaps:
- ~~Zero frontend tests~~ 481 tests total
- ~~No CI/CD pipeline~~ GitHub Actions CI
- ~~No code splitting~~ 22 chunks, 100KB main
- No accessibility (ARIA, semantic HTML)
- ~~No error tracking~~ Sentry active
- No structured logging
- Monolithic store (1,919 lines)
- Supabase schema not applied to live DB yet

---

## 4. Completed Sprints (1-4) — Collapsed

<details>
<summary>Sprint 1: "Lock the Doors" — COMPLETE (8/8 + 1 blocked)</summary>

All security vulnerabilities fixed. S1.9 (Supabase schema) blocked on manual step.
</details>

<details>
<summary>Sprint 2: "Prove It Works" — COMPLETE (7/7)</summary>

481 tests: 415 frontend + 66 backend. CI pipeline green. Core engines at 90%+.
</details>

<details>
<summary>Sprint 3: "Table Stakes" — COMPLETE (5/5)</summary>

Body types, test export, code splitting, bug fixes, toast notifications.
</details>

<details>
<summary>Sprint 4: "SaaS Wiring" — COMPLETE (7/7)</summary>

Razorpay integration, usage tracking, per-user rate limiting, upgrade prompts, legal pages, dashboard overhaul, Sentry error tracking.
</details>

---

## 5. Sprint 5: "Capture the Exodus" (Week 9-10) ← URGENT — REPRIORITIZED

**WHY (OLD):** Teams need shared workspaces.
**WHY (NEW):** Postman just killed free team plans on March 1. Developers are FURIOUS and actively searching for alternatives. There is a **2-4 week window** to capture these users before they settle on Bruno/Hoppscotch. This sprint is about being the #1 result when someone searches "Postman alternative free teams AI."

**Goal:** Postman users can migrate to TestOrbit in under 5 minutes. Free team tier captures refugees.
**Duration:** ~55 hours of work
**Status:** ✅ COMPLETE

### Updated Pricing (Post-Postman Analysis):

| Feature | Free | Pro (₹250/mo) | Team (₹500/mo + ₹250/seat) |
|---------|------|---------------|---------------------------|
| Users | **Up to 3** | 1 user | Up to 25 |
| Collections | **Unlimited** | Unlimited | Unlimited |
| Requests | **Unlimited** | Unlimited | Unlimited |
| Environments | **Unlimited** | Unlimited | Unlimited |
| Test Runner | Sequential only | Sequential + Parallel | Sequential + Parallel |
| AI Chat / Diagnose / Suggest | **50 calls/day** | **Unlimited** | **Unlimited** |
| AI Test Generation | **10/day** | **Unlimited** | **Unlimited** |
| AI Code Generation | **10/day** | **Unlimited** | **Unlimited** |
| AI Security Scan | **3/day** | **Unlimited** | **Unlimited** |
| Export (JUnit XML, HTML) | Last run only | Full history | Full history |
| Mock Server | 5 mocks | Unlimited | Unlimited |
| WebSocket Tester | Yes | Yes | Yes |
| Body Types (form, file, etc.) | Yes | Yes | Yes |
| Postman Import | **Yes** | Yes | Yes |
| Collection Sharing | Link sharing | Link sharing | Role-based (owner/editor/viewer) |
| Team Workspaces | - | - | Yes |
| Team Analytics | - | - | Yes |
| Priority Support | - | Yes | Yes + SLA |
| Annual Plan | - | ₹2,500/yr (save 17%) | Custom |

**Key changes from old pricing:**
- Free tier: **3 users** (was 1) — directly counters Postman's single-user free plan
- AI calls: **50/day** (was 25/day) — Postman gives 50/MONTH, we give 50/DAY
- AI test gen: **10/day** (was 5/day) — more generous
- NEW: **AI Security Scan** — Postman doesn't have this at all
- NEW: **Postman Import** on free tier — zero-friction migration

**Postman comparison (for marketing):**

| What You Get | Postman Free | TestOrbit Free |
|---|---|---|
| Team members | **1 (solo only)** | **Up to 3** |
| AI usage | 50 credits/month | **50 calls/day (~1,500/month)** |
| Test generation | Credit-gated | **10/day free** |
| AI Security testing | None | **3 scans/day** |
| Collections | Unlimited | Unlimited |
| Price for 5-person team | **$1,140/year** | **₹21,000/year ($252)** |

| # | Task | Implementation Detail | File(s) | Hours | Status | Date |
|---|------|----------------------|---------|-------|--------|------|
| S5.1 | Postman Collection import | Parse Postman Collection v2.1 JSON format. Map: requests (method, URL, headers, body, auth), folders (recursive), environments, pre-request scripts, tests. Add "Import from Postman" button in sidebar + Dashboard. Support drag-and-drop JSON file. Show import summary (X requests, Y folders imported). **THE #1 priority — every Postman refugee needs this on day 1.** | `ImportCollectionModal.jsx`, `Dashboard.jsx` | 12h | ✅ DONE | 2026-03-13 |
| S5.2 | "Postman Alternative" landing content | Update hero banner: "Switching from Postman? Import your collections in 30 seconds." Add comparison table (TestOrbit vs Postman pricing). Add migration guide section. SEO meta tags: "postman alternative", "free postman alternative", "postman alternative free teams". Add testimonial/quote section (placeholder). **Captures search traffic from angry Postman users.** | `Dashboard.jsx`, `index.html`, `PricingPage.jsx` | 8h | ✅ DONE | 2026-03-13 |
| S5.3 | Increase free tier AI limits | Update backend rate limiting: 50 AI calls/day (was 25), 10 test gen/day (was 5), 10 codegen/day (was 5). Update frontend usage display. Update PricingPage with new numbers. Update upgrade prompts (80% = 40/50). **Must be more generous than Postman's 50/month.** | `backend/app/services/usage_service.py`, `UpgradePrompt.jsx` | 3h | ✅ DONE | 2026-03-13 |
| S5.4 | Free team tier (up to 3 users) | Allow free-tier users to share collections with up to 2 other users. Simple invite-by-email. Shared collection visibility. No admin panel needed yet — just basic sharing. **Directly counters Postman's single-user free plan.** | `ShareModal.jsx`, `supabase_schema.sql` | 10h | ✅ DONE | 2026-03-13 |
| S5.5 | Team/org structure (paid) | Create `teams` table in Supabase: `(id, name, owner_id, plan, created_at)`. Create `team_members` table: `(team_id, user_id, role)`. Roles: owner, admin, editor, viewer. RLS policies. Frontend: team creation, invite by email, role management. **Billing entity for paid teams.** | `supabase_schema.sql`, `TeamPage.jsx`, `App.jsx`, `UserMenu.jsx` | 16h | ✅ DONE | 2026-03-13 |
| S5.6 | Team workspace | Collections owned by a team (not just individual). All team members see shared collections. Team-wide environment variables. Collection list shows personal + team collections. **Core collaboration.** | `workspaceStore.js`, new UI components | 12h | ✅ DONE | 2026-03-13 |

**Sprint total:** ~61 hours
**Exit criteria:** Can import Postman collections. Landing page targets Postman refugees. Free tier is 30x more generous than Postman on AI. Teams of 3 can collaborate for free. Paid teams have full org structure.

---

## 6. Sprint 6: "AI Depth, Not Breadth" (Week 11-12)

**WHY (OLD):** Growth features — command palette, autocomplete, export.
**WHY (NEW):** Postman has AI breadth (70+ tools). TestOrbit must have AI DEPTH. Pick 2-3 AI capabilities and make them 10x better than anything Postman offers. The two gaps Postman left wide open: **AI Security Testing** (they have zero) and **AI Performance Insights** (they have basic load testing but no intelligence). Plus, the original growth features that drive stickiness.

**Goal:** AI Security Testing that no competitor has. Killer UX features. Migration complete.
**Duration:** ~58 hours of work
**Status:** ✅ COMPLETE

| # | Task | Implementation Detail | File(s) | Hours | Status | Date |
|---|------|----------------------|---------|-------|--------|------|
| S6.1 | AI Security Scanner | NEW FEATURE — Postman doesn't have this. Use Gemini to analyze API requests/responses for: auth bypass patterns (missing auth on sensitive endpoints), injection vulnerabilities (SQL, NoSQL, XSS in responses), sensitive data exposure (SSN, credit cards, API keys in responses), CORS misconfiguration, rate limiting gaps, insecure headers. One-click "Security Scan" button per request. Report with severity levels (Critical/High/Medium/Low). **This is TestOrbit's #1 differentiator.** | New `backend/app/services/security_scanner.py`, new `SecurityScanPanel.jsx`, new route | 16h | ✅ DONE | 2026-03-13 |
| S6.2 | AI Performance Insights | NEW FEATURE — Analyze response times across collection runs. Gemini identifies: slow endpoints (>500ms), response size outliers, caching opportunities (missing Cache-Control), N+1 query patterns (sequential calls that could be batched), compression opportunities (large uncompressed responses). Show as "Performance Report" after collection run. **Postman has load testing but no AI analysis.** | New `backend/app/services/perf_analyzer.py`, `CollectionRunner.jsx` | 10h | ✅ DONE | 2026-03-13 |
| S6.3 | Command palette | `Ctrl+K` opens searchable modal. Search by: request name, URL, collection name, actions. Fuzzy matching. Keyboard navigation. **Power user magnet — makes TestOrbit feel fast.** | New `CommandPalette.jsx` | 8h | ✅ DONE | 2026-03-13 |
| S6.4 | Variable autocomplete | Typing `{{` in URL or body editor triggers dropdown showing environment variables, chain variables, dynamic variables. **Dev experience differentiator.** | `RequestEditor.jsx`, `EnvironmentManager` | 8h | ✅ DONE | 2026-03-13 |
| S6.5 | Collection export (Postman + OpenAPI) | Export to Postman Collection v2.1 JSON and OpenAPI 3.x spec. **Two-way migration — reduces lock-in fear. Users who import from Postman need to know they can export back.** | New `frontend/src/utils/exportCollection.js` | 8h | ✅ DONE | 2026-03-13 |
| S6.6 | Enhanced CLI | Add flags: `--base-url`, `--env`, `--format junit`, `--auth-token`. **CI/CD usability for teams.** | `backend/cli.py` | 8h | ✅ DONE | 2026-03-13 |

**Sprint total:** ~58 hours
**Exit criteria:** AI Security Scanner works and finds real vulnerabilities. AI Performance Insights identifies slow endpoints. Ctrl+K command palette. `{{` autocomplete. Export to Postman/OpenAPI format. CLI works in CI/CD.

---

## 7. Sprint 7: "Operational Excellence" (Week 13-14)

**WHY:** Now that the product is differentiated and capturing users, build the operational backbone. Structured logging for debugging production issues. Accessibility for wider market. Admin dashboard to see your own metrics. Request history for audit trails.

**Goal:** Production-grade operations, basic accessibility, business visibility
**Duration:** ~48 hours of work
**Status:** ✅ COMPLETE

| # | Task | Implementation Detail | File(s) | Hours | Status | Date |
|---|------|----------------------|---------|-------|--------|------|
| S7.1 | Structured logging | JSON-formatted logs. Request ID middleware (UUID per request). Log: method, URL, status, duration_ms, user_id. Parseable by CloudWatch, Datadog. | `backend/app/main.py`, middleware | 6h | ✅ DONE | 2026-03-13 |
| S7.2 | Basic accessibility | `aria-label` on all icon buttons. `role="navigation"` on Sidebar. `aria-live="polite"` on chat/test results. `:focus-visible` styles. | Multiple frontend components | 8h | ✅ DONE | 2026-03-13 |
| S7.3 | Admin dashboard | Protected admin page. Show: user count, signups, MRR (Razorpay API), usage by endpoint, DAU/WAU/MAU. **See your own business.** | New admin frontend + backend routes | 10h | ✅ DONE | 2026-03-13 |
| S7.4 | Request history | Supabase `request_history` table. Searchable log. Filter by URL, method, status, date. View full request/response. **Audit trails for teams.** | `supabase_schema.sql`, new UI | 10h | ✅ DONE | 2026-03-13 |
| S7.5 | Weekly digest email | Aggregate test results per team per week. Send via Resend/SendGrid. Tests run, pass rate, slowest endpoints, new failures. **Retention.** | Backend service + email provider | 6h | ✅ DONE | 2026-03-13 |
| S7.6 | Fix remaining medium bugs | B13 (binary WS messages), B15 (delete confirmation), B16 (nested folder export), B17 (search WS items), B18 (stale time-ago). | Multiple files | 8h | ✅ DONE | 2026-03-13 |

**Sprint total:** ~48 hours
**Exit criteria:** JSON logs with request IDs. ARIA labels on all buttons. Admin sees MRR + user count. Request history searchable. Weekly emails sending.

---

## 8. Sprint 8: "Content Marketing Blitz" (Week 15-16) — NEW

**WHY:** The best product in the world doesn't matter if nobody knows it exists. With Postman's pricing change, there's a 3-month window where developers are actively searching for alternatives. Every week without content = lost users to Bruno/Hoppscotch. This sprint is pure growth.

**Goal:** TestOrbit appears in top 10 for "Postman alternative" searches. 500+ free signups.
**Duration:** ~30 hours of work
**Status:** ✅ COMPLETE

| # | Task | Implementation Detail | File(s) | Hours | Status | Date |
|---|------|----------------------|---------|-------|--------|------|
| S8.1 | SEO landing pages | Create targeted pages: "/postman-alternative", "/postman-vs-testorbit", "/migrate-from-postman". Each with comparison tables, migration guide, CTA. | Frontend views | 8h | ✅ DONE | 2026-03-13 |
| S8.2 | Blog: "Why We Left Postman" | Write 3 blog posts: (1) "Postman killed free teams — here's what we built instead" (2) "AI API testing without credit limits" (3) "TestOrbit vs Postman: honest comparison for small teams". Publish on dev.to, Hashnode, Medium. | External content | 6h | ✅ DONE | 2026-03-14 |
| S8.3 | Product Hunt launch | Prepare PH listing: tagline, description, screenshots, demo video (60s). Schedule launch on a Tuesday. Prepare for Q&A. | External | 4h | ✅ DONE | 2026-03-14 |
| S8.4 | GitHub README overhaul | Position as "Open-source AI-powered API testing." Add comparison table. Add "Migrate from Postman" section. Add badges, screenshots, GIF demo. | `README.md` | 4h | ✅ DONE | 2026-03-14 |
| S8.5 | Community engagement | Post on: r/webdev, r/programming, r/India (Postman pricing thread). HackerNews "Show HN". Dev.to article. Twitter/X thread. LinkedIn post. **Go where angry Postman users are.** | External | 4h | ✅ DONE | 2026-03-14 |
| S8.6 | Demo video | 2-minute screen recording: import Postman collection → run AI tests → get security scan → export results. Show speed vs Postman. | External | 4h | ✅ DONE | 2026-03-14 |

**Sprint total:** ~30 hours
**Exit criteria:** 3 SEO landing pages live. 3 blog posts published. Product Hunt launched. GitHub README positioned competitively. Active in 5+ communities.

---

## 9. After Sprint 8: What You'll Have

| Dimension | Score After Revised Sprints |
|-----------|-----------------------------|
| Feature Completeness | **9/10** |
| Reliability | **8/10** |
| Security | **8.5/10** (AI security scanner = product feature) |
| Architecture | **7.5/10** |
| Performance | **8/10** |
| DevOps | **8/10** |
| Testing Coverage | **7.5/10** |
| UX & Accessibility | **8/10** |
| Collaboration | **7/10** |
| Documentation | **9/10** |
| **Competitive Position** | **7/10** (price + speed + AI depth + migration) |
| **Overall** | **8.2/10** |

**Readiness levels:**
- Solo developer: **YES** (already)
- Postman refugee (individual): **YES** (after Sprint 5)
- Small team (2-10 devs): **YES** (after Sprint 5-6)
- Mid-market (10-50 devs): **Possible** (after Sprint 7)
- Enterprise (50+ devs): **No** (need Phase 5: SSO, audit logs, SOC 2)

---

## 10. Revenue Timeline (Revised)

```
Week 1-4:   Sprints 1-2 (Security + Testing)    ─── Foundation (DONE)
Week 5-6:   Sprint 3 (Table Stakes)              ─── Beta launch (DONE)
Week 7-8:   Sprint 4 (SaaS Wiring)               ─── LAUNCH: Payments live (DONE)
Week 9-10:  Sprint 5 (Capture the Exodus)         ─── Postman import + free teams ← YOU ARE HERE
Week 11-12: Sprint 6 (AI Depth)                   ─── AI Security Scanner = differentiator
Week 13-14: Sprint 7 (Operations)                 ─── Admin, logging, history
Week 15-16: Sprint 8 (Content Marketing)          ─── SEO + PH + community blitz
```

**Revised milestone targets (aggressive):**
- Week 10: First Postman migrant (free tier)
- Week 12: First paying customer drawn by AI Security Scanner
- Month 4: 100 free users, 10 Pro, 2 Teams → ~₹5,000-8,000 MRR
- Month 6: 500 free users, 30 Pro, 8 Teams → ~₹15,000-35,000 MRR
- Month 9: 2,000 free, 80 Pro, 20 Teams → ~₹50,000-100,000 MRR

**Why targets are higher now:** Postman's pricing change created a wave of displaced users. If TestOrbit captures even 0.01% of the migration, that's 4,000 users (from Postman's 40M base).

---

## 11. Competitive Positioning Matrix

### TestOrbit vs The Field (March 2026)

| Feature | Postman | Bruno | Hoppscotch | Insomnia | **TestOrbit** |
|---------|---------|-------|------------|----------|---------------|
| **AI Features** | Deep (70+ tools) | None | None | Basic (mocks, MCP) | **Deep (8 endpoints + security + perf)** |
| **AI Pricing** | 50 credits/month free | N/A | N/A | Unknown | **50 calls/DAY free** |
| **Free Team** | 1 user only | Unlimited (Git) | Unlimited | 3 users | **3 users** |
| **Team Price** | $19/user/mo | $6/user/mo | $6/user/mo | $12/user/mo | **~$3/user/mo (₹250)** |
| **AI Security Scan** | No | No | No | No | **YES** |
| **AI Perf Analysis** | No | No | No | No | **YES** |
| **Web-First** | No (Electron) | No (Electron) | Yes | No (Electron) | **Yes** |
| **Speed** | Slow/bloated | Fast | Fast | Medium | **Fast** |
| **Postman Import** | N/A | Yes | Yes | Yes | **Yes (Sprint 5)** |
| **Open Source** | No | Yes | Yes | Yes | **Partial** |
| **India Pricing** | USD only | USD only | USD only | USD only | **INR + UPI + Razorpay** |

### TestOrbit's Wedge (Why Users Choose Us Over Each)

| Over Postman | Over Bruno/Hoppscotch | Over Insomnia |
|---|---|---|
| 4.5x cheaper for teams | AI features (they have zero) | Cheaper |
| 30x more AI on free tier | AI security scanning | Web-first |
| No Electron bloat | AI test generation | AI depth |
| INR pricing | AI performance analysis | Active development |
| Free teams (3 users) | AI chat/diagnose | India pricing |

---

## 12. What NOT to Build (Updated)

| Temptation | Why Not | When |
|------------|---------|------|
| Match Postman's 70+ Agent Mode tools | You'll never catch up. Go deep, not wide. | Never |
| MCP Server Generator | Postman owns this. Don't fight on their turf. | Phase 5+ |
| SDK Generation | Postman acquired Fern. Can't compete. | Never |
| GraphQL/gRPC/MQTT support | <5% of early users. Bruno/Hoppscotch have it. | Phase 5+ |
| Desktop app (Electron) | Web-first IS the advantage. Electron = bloat. | Never |
| API Catalog/Governance | Enterprise feature. Not your market yet. | Phase 6+ |
| LLM comparison/evaluation | Tangential. Not API testing. | Never |
| AI Agent Builder | Not your product. Stay focused on testing. | Never |
| Multi-model AI (OpenAI, Claude) | Gemini Flash works and is cheap. Don't fragment. | Phase 5+ |
| Git-native YAML collections | Nice but not urgent. JSON works fine for now. | Phase 5+ |

**New rule:** Before building ANY feature, ask: "Does this make TestOrbit cheaper, faster, or deeper on AI than Postman?" If no, don't build it.

---

## 13. Revised Pricing Strategy

### The Pricing Weapon

Postman's pricing change is TestOrbit's biggest opportunity. Here's the comparison to use in ALL marketing:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    WHY TEAMS SWITCH TO TESTORBIT                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  5-PERSON TEAM COST:                                                  │
│    Postman Team:  $19 × 5 × 12 = $1,140/year                        │
│    TestOrbit Team: ₹500 + (₹250 × 5) × 12 = ₹21,000/year ($252)   │
│    → YOU SAVE: $888/year (78% cheaper)                                │
│                                                                       │
│  AI USAGE (FREE TIER):                                                │
│    Postman:   50 credits/MONTH (runs out in 1 session)               │
│    TestOrbit: 50 calls/DAY (~1,500/month — 30x more)                 │
│                                                                       │
│  TEAM COLLABORATION (FREE):                                           │
│    Postman:   Solo only (1 user)                                      │
│    TestOrbit: Up to 3 users                                           │
│                                                                       │
│  AI SECURITY SCANNING:                                                │
│    Postman:   Not available at any price                              │
│    TestOrbit: 3 free scans/day, unlimited on Pro                      │
│                                                                       │
│  MIGRATION: Import your Postman collections in 30 seconds             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 14. The One-Page Summary (Revised)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    TESTORBIT BUSINESS PLAN (REVISED)                   │
│                    March 2026 — Post-Postman AI Pivot                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  CURRENT STATE: 7.3/10 — Sprints 1-4 done, SaaS live                │
│                                                                       │
│  OLD MOAT: "AI-native testing" — GONE (Postman matched it)           │
│  NEW MOAT: Price + Speed + AI Depth + India-first                    │
│                                                                       │
│  POSITIONING: "Fast, affordable, AI-powered Postman alternative"     │
│                                                                       │
│  8-SPRINT PLAN (16 weeks):                                            │
│    Sprint 1-4: DONE (Security, Testing, Features, Billing)           │
│    Sprint 5: Capture Postman refugees    (~61h) ← NOW                │
│    Sprint 6: AI Security + AI Depth      (~58h) ← DIFFERENTIATOR    │
│    Sprint 7: Operations + Accessibility  (~48h)                      │
│    Sprint 8: Content Marketing Blitz     (~30h) ← GROWTH            │
│                                                                       │
│  TOTAL EFFORT: ~310 hours (~16 weeks at 20h/week)                    │
│                                                                       │
│  PRICING:                                                             │
│    Free:  3 users, 50 AI/day, Postman import                        │
│    Pro:   ₹250/mo — unlimited AI                                     │
│    Team:  ₹500/mo + ₹250/seat — full collaboration                  │
│                                                                       │
│  COMPETITIVE EDGE:                                                    │
│    vs Postman: 4.5x cheaper, 30x more free AI, no bloat             │
│    vs Bruno:   AI features they'll never have                        │
│    vs Hoppscotch: AI + India pricing                                 │
│                                                                       │
│  TARGET: ₹50K-100K MRR by Month 9 (500+ Postman migrants)           │
│                                                                       │
│  IMMEDIATE NEXT: S5.1 — Postman Collection Import                    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Strategic principle (revised):** The game changed on March 1, 2026. Postman went AI-native and killed free teams simultaneously. Don't fight Postman on AI breadth — fight on price, speed, simplicity, and AI depth. The window is NOW. Every week without a Postman import feature and competitive landing page = lost users forever.

---

## 15. Known Remaining Bugs (Medium/Low — Fix in Sprint 7)

| ID | Bug | Priority | Status |
|----|-----|----------|--------|
| B11 | WebSocket memory leak (unbounded messages) | MEDIUM | ✅ |
| B12 | Chat messages grow unboundedly | MEDIUM | ✅ |
| B13 | Binary WebSocket messages show [object Blob] | MEDIUM | ✅ |
| B14 | Duplicate environment names allowed | MEDIUM | ✅ |
| B15 | Delete confirmation persists on tab switch | MEDIUM | ✅ |
| B16 | Export ignores nested folder requests | MEDIUM | ✅ |
| B17 | Search excludes WebSocket items | MEDIUM | ✅ |
| B18 | Stale time-ago display on dashboard | MEDIUM | ✅ |
| B19 | Auth listener leak in dev mode (StrictMode) | MEDIUM | ⬜ |
| B20 | Auto-scroll cannot be disabled (WS) | MEDIUM | ⬜ |
| B21 | Variable regex doesn't support hyphens | LOW | ⬜ |
| B22 | WS message IDs not guaranteed unique | LOW | ⬜ |
| B23 | Spec/Free chat toggle resets on refresh | LOW | ⬜ |
| B24 | MockServer concurrent fetch + interval flicker | LOW | ⬜ |
| B25 | ImportModal setTimeout after unmount | LOW | ⬜ |
| B26 | localUrl doesn't sync on external URL change | LOW | ⬜ |

---

## 16. How to Update This File

When completing a task:
1. Change `⬜ TODO` → `✅ DONE` and add the date
2. If a new task is discovered during work, add it to the appropriate sprint
3. Set the NEXT task to `🔵 ACTIVE` so the next session knows where to start
4. Keep the "Known Remaining Bugs" section updated
5. After completing a full sprint, update the scorecard (Section 1) with new scores

**Status legend:**
- `⬜ TODO` — Not started
- `🔵 ACTIVE` — Currently being worked on (only ONE task at a time)
- `✅ DONE` — Completed and validated
- `⏸️ BLOCKED` — Waiting on something external

**Validation checklist (run after EVERY task):**
```bash
cd frontend && npm run lint          # Must be 0 errors, 0 warnings
cd frontend && npm run build         # Must succeed
cd backend && .venv/Scripts/python.exe -c "from app.main import app; print('Backend OK')"
cd backend && .venv/Scripts/python.exe -m pytest tests/ -v   # Must all pass
```

**Decision filter (apply before EVERY new feature):**
> "Does this make TestOrbit cheaper, faster, or deeper on AI than Postman?"
> If no → don't build it. If yes → prioritize by user impact.
