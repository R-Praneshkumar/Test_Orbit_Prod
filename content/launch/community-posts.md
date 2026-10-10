> Historical draft: paid tiers and pricing in this document are retired. See [README](../../README.md) for the current open-source project.

# TestOrbit — Community Engagement Posts

> Ready-to-post content for each platform. Copy, review, customize, submit.

---

## 1. HackerNews — "Show HN"

**Title:**
```
Show HN: TestOrbit – AI-powered API testing, free for teams, unlimited AI on paid plans
```

**Text:**
```
Hi HN,

I built TestOrbit after Postman v12 gutted the free plan — 1 user, 50 AI credits/month, $19/user/month for teams.

TestOrbit is a web-based API testing platform with:

- 50 AI calls/day free (Postman gives 50/month)
- Free for teams of 3
- AI security scanning (OWASP Top 10 — SQL injection, XSS, SSRF detection)
- $3/month for unlimited AI on Pro
- Import Postman collections in 30 seconds

The economics work because we use Gemini 2.0 Flash (~$0.001/call). Postman charges $0.035-0.05/credit — that's 35-50x the actual cost.

What TestOrbit doesn't do: GraphQL, gRPC, enterprise SSO, Postman Monitors, 70-tool agent mode. If you need those, Postman is still the right choice.

Tech stack: React 19 + Vite + Tailwind (frontend), FastAPI + Gemini 2.0 Flash (backend), Supabase (auth). MIT licensed.

Live at: https://testorbit.dev
Source: https://github.com/R-Praneshkumar/TestOrbit

I'd appreciate any feedback — especially on what's missing that would make you switch from Postman.
```

---

## 2. Reddit — r/webdev

**Title:**
```
I built an open-source Postman alternative after they killed free teams — unlimited AI, $3/month Pro
```

**Body:**
```
When Postman v12 dropped last month, they cut the free plan to 1 user and 50 AI credits/month. Our small team couldn't afford $19/user/month, so I built TestOrbit.

**What it does:**
- AI test generation (boundary, negative, contract tests) — 50 calls/day free
- AI security scanning (OWASP Top 10 — Postman doesn't have this)
- AI code generation, diagnostics, and chat
- Collection runner, WebSocket tester, mock server
- Import from Postman/Insomnia in 30 seconds

**How it compares:**
| | TestOrbit | Postman |
|---|---|---|
| Free team size | 3 users | 1 user |
| AI calls (free) | 50/day | 50/month |
| AI (paid) | Unlimited | Metered credits |
| Solo price | $3/mo | $19/mo |
| 5-person team/year | $252 | $1,140 |
| AI security scanning | Yes | No |
| Install required | No (web) | Electron |

**What it doesn't do (yet):** GraphQL, gRPC, enterprise SSO, scheduled runs. If you need those, Postman is still better.

**Tech:** React 19 + FastAPI + Gemini 2.0 Flash. MIT licensed.

https://testorbit.dev | https://github.com/R-Praneshkumar/TestOrbit

Would love feedback from anyone who's been looking for Postman alternatives.
```

---

## 3. Reddit — r/programming

**Title:**
```
Show r/programming: TestOrbit — open-source AI API testing with unlimited AI and OWASP security scanning
```

**Body:**
```
I've been working on TestOrbit, an API testing platform focused on AI-powered test generation and security scanning.

The motivation: Postman's new pricing ($19/user/month, 50 AI credits/month on free) is rough for small teams. Bruno and Hoppscotch are great open-source alternatives but don't have AI features.

TestOrbit fills the gap: AI test generation, AI security scanning (OWASP Top 10), and AI diagnostics — with 50 free calls/day and unlimited on paid plans ($3/month).

**Why AI is unlimited:** Gemini 2.0 Flash costs ~$0.001/call. When Postman charges $0.035-0.05/credit, that's a 35-50x markup on the underlying AI cost. We just pass the actual cost through.

**Technical details:**
- Frontend: React 19 + Vite 7 + Tailwind v4 + Zustand 5 (persisted to localStorage)
- Backend: Python FastAPI + Google Gemini 2.0 Flash
- Auth: Supabase with JWT + row-level security
- Security: SSRF protection, rate limiting, secret masking, security headers
- Structured JSON logging with request ID middleware

MIT licensed. PRs welcome.

https://github.com/R-Praneshkumar/TestOrbit
```

---

## 4. Reddit — r/india or r/developersIndia

**Title:**
```
Built an AI-powered Postman alternative with INR pricing — Pro at ₹250/month, Team at ₹500/month
```

**Body:**
```
Hey everyone,

I built TestOrbit after Postman changed their pricing. For Indian developers, $19/user/month (~₹1,600) is a lot for API testing.

**TestOrbit pricing in INR:**
- **Free:** 3 users, 50 AI calls/day, all core features
- **Pro:** ₹250/month (~$3) — unlimited AI, 1 user
- **Team:** ₹500/month + ₹250/seat — unlimited everything, up to 25 users

**Comparison with Postman:**
- Free plan: 3 users vs Postman's 1 user
- AI calls: 50/day vs 50/month
- 5-person team: ₹21,000/year vs ₹95,000/year (Postman)
- Payment via Razorpay (INR, no forex markup)

**Features:**
- AI test generation, security scanning, code generation
- Import from Postman/Insomnia
- WebSocket tester, mock server, collection runner
- Works in any browser, no install

Built with React + FastAPI + Gemini 2.0 Flash. Payment through Razorpay so you pay in INR without international transaction fees.

https://testorbit.dev

Happy to answer questions!
```

---

## 5. Twitter/X — Launch Thread

```
Thread: 🧵

1/ I built an open-source Postman alternative after they killed free teams.

TestOrbit: AI-powered API testing.
• 50 AI calls/day (free)
• Free for teams of 3
• $3/month for unlimited AI
• AI security scanning

https://testorbit.dev

2/ Why?

Postman v12 (March 2026):
• Free plan: 1 user only
• AI: 50 credits/MONTH
• Teams: $19/user/month

For a 5-person startup:
• Postman: $1,140/year
• TestOrbit: $252/year

4.5x cheaper.

3/ How is unlimited AI possible?

Gemini 2.0 Flash costs ~$0.001 per call.

When Postman charges $0.035/credit, that's a 35x markup on the actual AI cost.

We pass the real cost through. $3/month covers heavy AI usage easily.

4/ What TestOrbit has that Postman doesn't:

AI security scanning — OWASP Top 10 detection:
• SQL injection
• XSS
• SSRF
• Auth bypass
• IDOR

Postman only has static rules. TestOrbit uses AI to find real vulnerabilities.

5/ What Postman has that we don't (being honest):

• GraphQL / gRPC / MQTT
• 70-tool AI agent mode
• Enterprise SSO
• Postman Monitors
• Massive ecosystem

If you need enterprise features, Postman is still better.

6/ Migration takes 5 minutes:

1. Export from Postman (Collection v2.1)
2. Import into TestOrbit
3. Done

Requests, folders, scripts, environments, auth — everything transfers.

7/ Tech stack:
• React 19 + Vite + Tailwind
• FastAPI + Gemini 2.0 Flash
• Supabase (auth + DB)
• Razorpay (INR billing)
• MIT licensed

GitHub: https://github.com/R-Praneshkumar/TestOrbit

8/ Who is TestOrbit for?

✓ Indie devs who want AI testing without a credit card
✓ Small teams (2-10) who can't justify $1,140/year
✓ Developers in emerging markets
✓ Anyone who just wants to test APIs without 70 tools

Try it: https://testorbit.dev
```

---

## 6. LinkedIn Post

```
I built an open-source Postman alternative. Here's why.

When Postman shipped v12 last month, they changed their pricing:
→ Free plan: 1 user only (was 3)
→ AI credits: 50/month (our platform gives 50/day)
→ Teams: $19/user/month

For indie developers and small teams, this is a dealbreaker.

So I built TestOrbit — an AI-powered API testing platform that's:

📊 4.5x cheaper (5-person team: $252/yr vs $1,140/yr)
🤖 30x more AI (50 calls/day free vs 50/month)
🔒 AI security scanning (OWASP Top 10 — something Postman doesn't offer)
⚡ Web-first (loads in 2 seconds, no Electron)
👥 Free for teams of 3

I'm not trying to replace Postman for enterprises — they have 40M+ developers and deep integrations we can't match yet.

But for indie devs, startups, and small teams? TestOrbit delivers 90% of the value at 20% of the cost.

The AI economics make it possible: Gemini 2.0 Flash costs ~$0.001/call. When tools charge $0.035/credit, that's a 35x markup. We just pass the actual cost through.

MIT licensed. Built with React 19 + FastAPI + Gemini.

🔗 https://testorbit.dev
💻 https://github.com/R-Praneshkumar/TestOrbit

If you're looking for a Postman alternative, I'd love your feedback.

#APITesting #DeveloperTools #OpenSource #AI #Startup
```

---

## 7. Dev.to — Cross-post

> Cross-post blog post #1 ("Postman killed free teams") to dev.to with the following additions:

**Series name:** `testorbit`
**Tags:** `api`, `testing`, `opensource`, `webdev`
**Canonical URL:** `https://testorbit.dev/blog/postman-killed-free-teams`

Add this footer to the dev.to version:

```
---

*If you found this useful, check out [TestOrbit on GitHub](https://github.com/R-Praneshkumar/TestOrbit). Star it if you think small teams deserve affordable AI testing. ⭐*
```

---

## Posting Schedule

| Day | Platform | Post |
|-----|----------|------|
| Tuesday (launch day) | Product Hunt | Submit listing |
| Tuesday | Twitter/X | Launch thread (8 tweets) |
| Tuesday | LinkedIn | Launch post |
| Tuesday | Dev.to | Cross-post blog #1 |
| Wednesday | r/webdev | Main Reddit post |
| Wednesday | r/programming | Technical post |
| Thursday | r/developersIndia | INR pricing post |
| Thursday | Hacker News | Show HN |
| Friday | Hashnode | Cross-post blog #2 |
| Following week | Medium | Cross-post blog #3 |

## Engagement Rules

1. **Reply to every comment** within 2 hours
2. **Be honest** about limitations — acknowledge where Postman is better
3. **Don't spam** — one post per subreddit, space them out
4. **Add value** — answer technical questions in detail
5. **Don't trash Postman** — respect the product, critique the pricing
6. **Thank people** — for feedback, stars, upvotes
