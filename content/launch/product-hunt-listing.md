# TestOrbit — Product Hunt Launch Kit

> Ready-to-use copy for Product Hunt submission. Review, customize screenshots, and submit.

---

## Tagline (60 chars max)

```
AI-powered API testing — free for teams, unlimited AI
```

## One-liner

```
The fast, affordable Postman alternative with unlimited AI, free teams of 3, and AI security scanning.
```

---

## Description (Product Hunt "About")

### What is TestOrbit?

TestOrbit is an AI-powered API testing platform built for indie developers, startups, and small teams who want fast, affordable API testing without credit limits or bloat.

### Why we built it

When Postman v12 shipped in March 2026, they gutted the free plan — 1 user only, 50 AI credits/month, and $19/user/month for teams. We were a small team that relied on Postman's free tier. So we built the tool we wished existed.

### What makes TestOrbit different

**30x more free AI** — 50 AI calls per day (not per month). Generate tests, run security scans, get code snippets — no credit anxiety.

**Free for teams of 3** — Postman locked free teams to 1 user. TestOrbit keeps small teams free forever.

**4.5x cheaper** — Pro at $3/mo. A 5-person team pays $252/year vs Postman's $1,140/year.

**AI security scanning** — OWASP Top 10 vulnerability detection, SQL injection fuzzing, XSS testing, auth bypass analysis. Postman doesn't offer this.

**Web-first, zero bloat** — Opens in any browser in 2 seconds. No Electron app, no 500MB RAM footprint.

**Import in 30 seconds** — Drop your Postman Collection v2.1 JSON file. All requests, folders, scripts, environments, and auth configs transfer automatically.

### Key features

- AI test generation (boundary, negative, contract tests)
- AI security scanning (OWASP Top 10)
- AI code generation (JavaScript, Python, cURL)
- AI diagnostics and chat
- Collection runner with assertions
- WebSocket tester
- Mock server
- Environment variables
- Pre/post-request scripts
- Export to JUnit XML, HTML, Postman, OpenAPI
- Dark mode, command palette (Ctrl+K)
- Team collaboration with role-based access

### Who is it for?

- Indie developers who want AI testing without a credit card
- Small teams (2-10 people) who can't justify $1,140/year
- Startups in emerging markets where $19/user/month matters
- Developers switching from Postman's free plan

### Pricing

- **Free** — 3 users, 50 AI calls/day, all core features
- **Pro** — $3/month (₹250), unlimited AI, 1 user
- **Team** — $6/month + $3/seat (₹500 + ₹250/seat), unlimited everything

### Tech stack

React 19 + Vite + Tailwind (frontend), FastAPI + Google Gemini 2.0 Flash (backend), Supabase (auth + database)

---

## First Comment (by maker)

```
Hey Product Hunt! 👋

I'm the maker of TestOrbit. Here's the backstory:

When Postman shipped v12 last month, they cut the free plan to 1 user and 50 AI credits/month. Our small team couldn't afford $19/user/month, so we built what we wished existed.

TestOrbit gives you:
• 50 AI calls per DAY (not month) — 30x more generous
• Free for teams of 3
• AI security scanning (OWASP Top 10) — something Postman doesn't have
• $3/month for unlimited AI on Pro

We're NOT trying to compete with Postman on breadth — they have 70+ AI tools, GraphQL, gRPC, enterprise SSO. We can't match that (yet).

Instead, we focus on doing 3 things really well:
1. AI test generation that actually finds bugs
2. AI security scanning that catches vulnerabilities
3. Being affordable enough that pricing never enters the conversation

The whole thing loads in 2 seconds in a browser. No Electron, no install.

If you're a small team that left (or is thinking about leaving) Postman, I'd love your feedback. What's missing? What would make you switch?

Happy to answer any questions! 🚀
```

---

## Q&A Preparation

### "How is this different from Bruno/Hoppscotch/Insomnia?"

```
Great question! Here's the key difference:

- Bruno: Open-source, offline-first, no AI features. Great if you want a simple, local-only tool.
- Hoppscotch: Open-source, web-based, minimal AI. Similar philosophy but less AI depth.
- Insomnia: Kong-owned, AI features on paid plans only. Good but expensive.

TestOrbit is the AI-focused alternative. We give you 50 AI calls/day free, AI security scanning, and AI test generation — things the others don't offer (or charge for). If AI-assisted testing matters to you, that's where we differentiate.
```

### "Can I self-host it?"

```
Not yet, but it's on our roadmap. Right now TestOrbit is a hosted web app with a FastAPI backend. The architecture is ready for self-hosting — it's a standard React + FastAPI stack with optional Supabase for auth/storage.
```

### "What about data privacy?"

```
Your collections and test data are stored in your browser (localStorage) in local mode, or in Supabase (with row-level security) in cloud mode. AI calls go through our backend to Google Gemini — we don't store your API responses. You can run in local-only mode if you want zero cloud dependency.
```

### "Why Gemini and not GPT-4/Claude?"

```
Economics. Gemini 2.0 Flash costs ~$0.001 per call. GPT-4 costs 10-50x more. This is why we can offer unlimited AI on a $3/month plan — the underlying cost is pennies per user per month. We pass those savings to you instead of charging credits.
```

### "What's on the roadmap?"

```
Next up:
- GraphQL support
- Scheduled test runs (like Postman Monitors)
- CI/CD integration (GitHub Actions, GitLab CI)
- Self-hosting option
- API monitoring & alerts

We ship weekly. The sprint tracker is public in our repo.
```

---

## Screenshots Needed (checklist)

- [ ] Dashboard with hero banner (guest view — shows competitive positioning)
- [ ] Workspace with a request open + AI test generation results
- [ ] Security scan results panel
- [ ] Collection runner with test results
- [ ] Import from Postman flow
- [ ] Dark mode view of workspace
- [ ] Command palette (Ctrl+K)
- [ ] Mobile/tablet responsive view (if applicable)

## Launch Day Checklist

- [ ] Submit listing on Product Hunt (schedule for Tuesday 12:01 AM PST)
- [ ] Post first comment immediately after launch
- [ ] Share on Twitter/X with #ProductHunt tag
- [ ] Post in relevant Slack/Discord communities
- [ ] Reply to every comment within 1 hour
- [ ] Update LinkedIn with launch announcement
- [ ] Send email to any existing users/waitlist
- [ ] Monitor analytics throughout the day
- [ ] Thank voters and commenters at end of day

## Social Media Templates

### Twitter/X Launch Thread

```
🚀 We just launched TestOrbit on @ProductHunt!

TestOrbit = AI-powered API testing for small teams.

Why? Postman v12 gutted the free plan:
• 1 user only (was 3)
• 50 AI credits/MONTH
• $19/user/mo for teams

Our response:
• 3 free users
• 50 AI calls/DAY
• $3/mo for unlimited AI

🔗 [Product Hunt link]

🧵 Thread: why we built it ↓
```

### LinkedIn Post

```
Today we launched TestOrbit on Product Hunt.

When Postman changed their pricing in March, our small team couldn't afford $19/user/month. So we built what we wished existed.

TestOrbit is an AI-powered API testing platform that's:
→ Free for teams of 3 (Postman: 1 user)
→ 50 AI calls/day free (Postman: 50/month)
→ $3/month for unlimited AI (Postman: $19/month + credits)
→ Web-first, loads in 2 seconds (no Electron)

Plus AI security scanning — OWASP Top 10 vulnerability detection that Postman doesn't offer.

We're not trying to replace Postman for enterprises. We're building for indie devs, startups, and small teams who want fast, affordable API testing.

Check it out and let me know what you think: [link]

#APITesting #DeveloperTools #ProductHunt #Startup
```
