# TestOrbit Developer Guide

> Complete setup, architecture, and deployment reference for TestOrbit — the AI-native API testing platform powered by Google Gemini.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Local Development Setup](#4-local-development-setup)
5. [Environment Variables](#5-environment-variables)
6. [Supabase Setup](#6-supabase-setup)
7. [Google OAuth Setup](#7-google-oauth-setup)
8. [Backend API Reference](#8-backend-api-reference)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Security](#10-security)
11. [Docker Deployment](#11-docker-deployment)
12. [Production Deployment](#12-production-deployment)
13. [Project Structure](#13-project-structure)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Overview

TestOrbit is a full-stack API testing platform that combines:

- **AI-powered test generation** — Describe what to test in natural language, Gemini creates the test suite
- **Smart mock server** — Any request to `/mock-server/*` gets an AI-generated realistic response
- **WebSocket testing** — Connect, send messages, monitor real-time communication
- **Pre/post request scripts** — JavaScript sandbox with `pm.*` API (Postman-compatible)
- **Response assertions** — Visual builder for automated response validation
- **Multi-format import** — Import from Postman, Insomnia, OpenAPI, Thunder Client, cURL
- **Cloud sync** — Supabase-backed auth, collection sharing, cross-device sync
- **AI failure diagnosis** — When tests fail, AI explains why and suggests fixes
- **AI code generation** — Generate client code in Python, JavaScript, Go, Rust, etc.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React | 19.x |
| Build tool | Vite | 7.x |
| Styling | Tailwind CSS | 4.x |
| State | Zustand (persisted) | 5.x |
| Icons | Lucide React | 0.563+ |
| Backend | FastAPI (Python) | 0.128+ |
| AI | Google Gemini 3 Flash | via google-genai |
| Auth & DB | Supabase | 2.x JS client |
| Rate limiting | slowapi | 0.1.9+ |

---

## 2. Architecture

```
+-------------------+     HTTPS      +-------------------+     API      +-------------------+
|                   | ──────────────> |                   | ──────────> |                   |
|    Browser        |                 |    Frontend        |             |    Backend         |
|    (React SPA)    | <────────────── |    (Vite / nginx)  | <────────── |    (FastAPI)       |
|                   |                 |    Port 5173/80    |             |    Port 8000       |
+-------------------+                 +-------------------+             +-------------------+
        |                                      |                               |
        |   Supabase Auth (JWT)                |   authFetch()                 |   Gemini API
        |   Supabase Realtime                  |   Bearer token                |   AI calls
        v                                      v                               v
+-------------------+                                                 +-------------------+
|   Supabase        |                                                 |   Google Gemini    |
|   (Auth + DB)     |                                                 |   3 Flash          |
+-------------------+                                                 +-------------------+
```

### Data Flow

1. **Frontend** stores all workspace data in Zustand with `persist` middleware (localStorage)
2. **Auth** is handled by Supabase — JWT tokens are auto-attached to backend API calls via `authFetch()`
3. **Backend** validates JWTs, proxies requests (CORS-free), and calls Gemini for AI features
4. **Cloud sync** pushes collections/environments to Supabase Postgres with RLS (Row Level Security)
5. **Realtime** — Supabase channels notify the frontend when collections change on other devices

### State Management

- **Zustand store** (`workspaceStore.js`) — single store with `persist` middleware
- **localStorage key**: `gemini-workspace-storage`, **version**: 8
- **Persisted**: collections, tabs, environments, settings, tour state
- **NOT persisted** (excluded via `partialize`): `user`, `profile`, `responses`, `runner`, `_realtimeChannel`
- The `user` and `profile` are restored by `initializeAuth()` on every page load

---

## 3. Prerequisites

| Requirement | Minimum Version | Notes |
|------------|----------------|-------|
| Node.js | 18+ | 20 LTS recommended |
| npm | 9+ | Comes with Node.js |
| Python | 3.10+ | 3.11 recommended |
| pip | 22+ | Comes with Python |
| Google Gemini API key | — | Free tier available at [aistudio.google.com](https://aistudio.google.com/) |
| Supabase project | — | Free tier works, optional for local-only use |

---

## 4. Local Development Setup

### 4.1 Clone and Install

```bash
git clone <repo-url>
cd gemini-api-tester
```

### 4.2 Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
.venv\Scripts\activate      # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 4.3 Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env from template (optional — only needed for Supabase features)
cp .env.example .env.local
# Edit .env.local if you want Supabase auth/sync
```

### 4.4 Start Development Servers

**Terminal 1 — Backend:**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

### 4.5 Verify Everything Works

```bash
# Backend health check
curl http://localhost:8000/
# Should return: {"message": "TestOrbit Backend is Running", "version": "1.0.0", "uptime_seconds": ..., "services": {...}}

# Frontend
# Visit http://localhost:5173 — you should see the TestOrbit dashboard
```

### 4.6 Running Without Supabase

TestOrbit works fully offline without Supabase — you just won't have:
- User authentication (Google/GitHub/email sign-in)
- Cloud sync across devices
- Collection sharing

All other features (AI test generation, mock server, proxy, scripts, assertions, WebSocket) work locally with just the Gemini API key.

---

## 5. Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_SUPABASE_URL` | No | — | Supabase project URL (e.g., `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | No | — | Supabase anonymous/public key |
| `VITE_API_BASE_URL` | No | `http://localhost:8000` | Backend API base URL |

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | **Yes** | — | Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/) |
| `ENV` | No | `development` | Environment mode: `development`, `staging`, `production` |
| `ALLOWED_ORIGINS` | No | localhost:5173-5177,3000 | Comma-separated CORS origins. Overrides defaults when set. |
| `SUPABASE_JWT_SECRET` | Prod only | — | Supabase JWT secret for token validation. From Dashboard → Settings → API. |
| `REQUIRE_AUTH` | No | `False` | When `True`, all API routes require a valid JWT Bearer token. |
| `AI_RATE_LIMIT` | No | `10/minute` | Rate limit for AI endpoints (generate, codegen, diagnose, voice) |
| `PROXY_RATE_LIMIT` | No | `60/minute` | Rate limit for the proxy endpoint |
| `MOCK_RATE_LIMIT` | No | `30/minute` | Rate limit for mock server endpoints |

---

## 6. Supabase Setup

Supabase provides authentication (email, Google, GitHub) and Postgres database for cloud sync.

### 6.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Anon/Public Key**: from Settings → API → `anon` `public`
   - **JWT Secret**: from Settings → API → JWT Settings → JWT Secret

### 6.2 Run the Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Paste the contents of `supabase_schema.sql` (in the project root)
3. Click **Run**

This creates:

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data (name, avatar, email) |
| `collections` | Synced workspace collections (requests, tests, chat) |
| `collection_shares` | Sharing permissions (viewer/editor roles) |
| `environments` | User environment variables (synced per-user) |

Plus:
- **Row Level Security (RLS)** policies on all tables
- **Trigger**: `handle_new_user()` — auto-creates a profile row on signup
- **Sharing**: collections can be shared by email with viewer/editor roles

### 6.3 Enable Email Auth

1. Go to **Authentication → Providers → Email**
2. Ensure it's enabled (it is by default)
3. Optionally disable "Confirm email" for development

### 6.4 Configure Frontend

Add to `frontend/.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 6.5 Configure Backend (Production)

Add to `backend/.env`:
```
SUPABASE_JWT_SECRET=your-jwt-secret-here
REQUIRE_AUTH=True
```

---

## 7. Google OAuth Setup

Google Sign-In lets users authenticate with their Google account.

### 7.1 Supabase Side

1. Go to **Authentication → Providers → Google → Enable**
2. You'll need a Google Client ID and Client Secret (see below)

### 7.2 Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Go to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add **Authorized redirect URI**:
   ```
   https://YOUR_SUPABASE_PROJECT_ID.supabase.co/auth/v1/callback
   ```
7. Copy the **Client ID** and **Client Secret**

### 7.3 Connect to Supabase

1. Go back to **Supabase → Authentication → Providers → Google**
2. Paste the Client ID and Client Secret
3. Save

### 7.4 Test

1. Start the app and go to the login page
2. Click **"Continue with Google"**
3. You should be redirected to Google consent screen
4. After approval, you'll be redirected back to TestOrbit's dashboard

> GitHub SSO follows the same pattern — enable GitHub provider in Supabase, create an OAuth app on GitHub, and add the credentials.

---

## 8. Backend API Reference

Base URL: `http://localhost:8000/api/v1`

All endpoints (except mock server) require a Bearer token when `REQUIRE_AUTH=True`:
```
Authorization: Bearer <supabase_jwt_token>
```

### 8.1 AI Endpoints

#### `POST /api/v1/generate`
Generate test cases from an API description.

**Rate limit:** 10/minute

```json
{
  "url": "https://api.example.com/users",
  "context": "REST API for user management",
  "openapi_spec": "...",          // optional, max 100KB
  "user_instructions": "..."      // optional, max 5000 chars
}
```

**Response:** Array of test case objects with method, URL, expected status, headers, body.

#### `POST /api/v1/voice`
Process natural language commands into API requests.

**Rate limit:** 10/minute

```json
{
  "transcript": "Test GET https://jsonplaceholder.typicode.com/users/1",
  "openapi_spec": "...",                // optional
  "conversation_history": [...]          // optional
}
```

#### `POST /api/v1/codegen`
Generate client code for an API request.

**Rate limit:** 10/minute

```json
{
  "method": "GET",
  "url": "https://api.example.com/users",
  "headers": {"Authorization": "Bearer token"},
  "body": null,
  "language": "python",         // python, javascript, go, rust, java, csharp, php, ruby, swift, kotlin, curl
  "variant": "requests",       // language-specific variant (e.g., requests/httpx/aiohttp for Python)
  "include_tests": true
}
```

#### `POST /api/v1/diagnose`
Diagnose why an API test failed.

**Rate limit:** 10/minute

```json
{
  "method": "POST",
  "url": "https://api.example.com/users",
  "expected_status": 201,
  "actual_status": 400,
  "request_body": "{\"name\": \"John\"}",
  "response_body": "{\"error\": \"missing email\"}",
  "openapi_spec": "..."        // optional
}
```

### 8.2 Test Runner

#### `POST /api/v1/run`
Execute a batch of tests in parallel.

```json
{
  "base_url": "https://api.example.com",
  "tests": [
    {
      "test_name": "Get all users",
      "method": "GET",
      "endpoint": "/users",
      "expected_status": 200
    }
  ]
}
```

**Response:** Results array with status, duration, response body, and optional AI optimization suggestions for slow requests.

### 8.3 Proxy

#### `POST /api/v1/proxy`
Proxy HTTP requests to external APIs (solves CORS issues).

**Rate limit:** 60/minute

```json
{
  "url": "https://api.example.com/data",
  "method": "GET",
  "headers": {"Authorization": "Bearer xyz"},
  "body": null
}
```

**SSRF protection:** Blocks private IPs (`10.x`, `172.16.x`, `192.168.x`, `127.x`), cloud metadata (`169.254.x`), localhost, and non-http(s) schemes.

### 8.4 Mock Server

Base URL: `http://localhost:8000/mock-server`

> Mock server routes do NOT require JWT authentication but are rate-limited at 30/minute per IP.

#### `GET /mock-server/`
List all cached mocks.

#### `ANY /mock-server/{path}`
Send any HTTP request. If a cached mock exists, it's returned. Otherwise, Gemini generates a realistic response and caches it.

#### `DELETE /mock-server/`
Clear all mocks.

#### `DELETE /mock-server/{path}?method=GET`
Delete a specific mock.

### 8.5 OAuth Proxy

> OAuth routes require JWT authentication and are rate-limited at 10/minute per IP.

#### `POST /api/v1/oauth/token`
Exchange an authorization code for an access token (proxied to avoid CORS).

#### `POST /api/v1/oauth/refresh`
Refresh an expired access token.

---

## 9. Frontend Architecture

### 9.1 Views

The app uses a `currentView` state variable for navigation (not React Router):

| View | Component | Description |
|------|-----------|-------------|
| `login` | `AuthPage` | Full-page login (Google, GitHub, email) |
| `profile` | `ProfilePage` | User profile management |
| `dashboard` | `Dashboard` | Landing page with stats and quick actions |
| `workspace` | 3-panel layout | Sidebar + RequestEditor + IntelligencePanel |
| `mock-server` | `MockServerPanel` | AI mock server management |
| `docs` | `DocsPanel` | Documentation and interactive tutorials |

### 9.2 Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `Sidebar` | `workspace/Sidebar.jsx` | Collection tree, context menus, import/export |
| `RequestEditor` | `workspace/RequestEditor.jsx` | HTTP request builder (6 tabs: params, headers, body, auth, scripts, assertions) |
| `IntelligencePanel` | `workspace/IntelligencePanel.jsx` | AI chat, OpenAPI spec viewer, test generation |
| `CollectionRunner` | `workspace/CollectionRunner.jsx` | Batch test execution with AI diagnosis |
| `WebSocketTester` | `workspace/WebSocketTester.jsx` | WebSocket connect/send/monitor |
| `TabManager` | `workspace/TabManager.jsx` | Request tab bar |
| `CodeGenModal` | `workspace/CodeGenModal.jsx` | AI code generation in 11 languages |
| `TourGuide` | `common/TourGuide.jsx` | Joyride-based feature tour |
| `InteractiveTutorial` | `common/InteractiveTutorial.jsx` | Step-by-step live demos |

### 9.3 Zustand Store

The store (`workspaceStore.js`) manages all application state:

**Collections & Requests:**
- `collections[]` — Array of collections, each with `items[]`, `chatMessages[]`, `testSuites[]`, `openApiSpec`, `baseUrl`, `runHistory[]`
- `activeTabs[]`, `activeTabId`, `activeCollectionId` — Tab management
- Two item types: `request` (HTTP) and `websocket` (WS)

**Auth & Sync:**
- `user` — Supabase user object (NOT persisted)
- `profile` — User profile from `profiles` table (NOT persisted)
- `initializeAuth()` — Checks session, sets up `onAuthStateChange` listener
- `fetchRemoteCollections()` / `saveCollectionToSupabase()` — Two-way cloud sync
- `subscribeToCollectionChanges()` — Realtime subscription

**Features:**
- `environments[]`, `activeEnv` — Environment variable system
- `chainVars` — Request chaining variables
- `activeTour`, `activeTutorial` — Guided tours and tutorials
- `darkMode` — Theme toggle (persisted)
- `requestHistory[]` — Global audit trail (persisted, capped at 50)

### 9.4 Authenticated API Calls

All API calls to the backend use `authFetch()` from `config.js`:

```javascript
import { API_BASE, authFetch } from '../../config';

const res = await authFetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, context }),
});
```

`authFetch()` automatically:
1. Gets the current Supabase session
2. Extracts the `access_token`
3. Attaches it as `Authorization: Bearer <token>`
4. Falls back to no auth if Supabase isn't configured

Mock server calls use plain `fetch()` (no auth required).

---

## 10. Security

### 10.1 JWT Authentication

- Backend uses `verify_token` FastAPI dependency on all API routes
- Tokens are Supabase JWTs validated with `SUPABASE_JWT_SECRET`
- **Dev mode** (`REQUIRE_AUTH=False`): All requests pass through with a stub user
- **Prod mode** (`REQUIRE_AUTH=True`): Requests without valid JWT get 401

### 10.2 SSRF Protection

The `/proxy` endpoint validates all target URLs:
- Blocks private IP ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`
- Blocks cloud metadata: `169.254.0.0/16` (AWS/GCP metadata endpoint)
- Blocks hostnames: `localhost`, `metadata.google.internal`
- Only allows `http://` and `https://` schemes
- Resolves DNS and validates resolved IPs

### 10.3 Rate Limiting

Powered by slowapi (per-IP):
- AI endpoints: `10/minute` (configurable via `AI_RATE_LIMIT`)
- Proxy: `60/minute` (configurable via `PROXY_RATE_LIMIT`)
- Mock server: `30/minute` (configurable via `MOCK_RATE_LIMIT`)
- OAuth proxy: `10/minute` (uses `AI_RATE_LIMIT`)
- Returns `429 Too Many Requests` with `Retry-After` header

### 10.4 Input Validation

All request bodies have Pydantic `Field(max_length=...)`:
- URLs: 2,048 characters
- OpenAPI specs: 100KB
- Request/response bodies: 1MB
- Text fields (instructions, transcripts): 5,000 characters

### 10.5 Security Headers

Every response includes:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — restricts script, style, connect, img, font, object, base-uri sources
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security` (production only)

These same headers are also set in `nginx.conf` for the frontend.

### 10.6 Secret Masking

A `SecretMaskingFilter` is installed on the root logger at startup. It detects and masks:
- API keys, tokens, passwords in log messages
- JWTs (`eyJ...`)
- Gemini API keys (`AIza...`)

### 10.7 HTTPS Enforcement

In production (`ENV=production`), `HTTPSRedirectMiddleware` redirects all HTTP requests to HTTPS. Respects `X-Forwarded-Proto` from reverse proxies.

### 10.8 CORS

- **Development**: Allows `localhost:5173-5177` and `localhost:3000`
- **Production**: Set `ALLOWED_ORIGINS=https://yourdomain.com` in `.env`
- Methods restricted to: `GET, POST, PUT, DELETE, PATCH, OPTIONS`

---

## 11. Docker Deployment

### 11.1 Quick Start

```bash
# Create backend .env
cp backend/.env.example backend/.env
# Edit backend/.env with your GEMINI_API_KEY and other settings

# Build and run
docker compose up --build -d

# Frontend: http://localhost
# Backend:  http://localhost:8000
# API docs: http://localhost:8000/docs
```

### 11.2 Build Arguments

Frontend Vite env vars are baked in at build time via Docker build args:

```bash
docker compose build \
  --build-arg VITE_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-key \
  --build-arg VITE_API_BASE_URL=https://api.yourdomain.com
```

Or set them in a `.env` file at the project root:

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-key
VITE_API_BASE_URL=https://api.yourdomain.com
ENV=production
REQUIRE_AUTH=True
ALLOWED_ORIGINS=https://yourdomain.com
```

### 11.3 Docker Compose Services

| Service | Port | Base Image | Description |
|---------|------|-----------|-------------|
| `frontend` | 80 | `nginx:alpine` | Static React build served by nginx with SPA routing |
| `backend` | 8000 | `python:3.11-slim` | FastAPI with 4 uvicorn workers, runs as non-root user |

### 11.4 Individual Builds

```bash
# Frontend only
cd frontend
docker build -t testorbit-frontend \
  --build-arg VITE_API_BASE_URL=http://localhost:8000 .
docker run -p 80:80 testorbit-frontend

# Backend only
cd backend
docker build -t testorbit-backend .
docker run -p 8000:8000 --env-file .env testorbit-backend
```

---

## 12. Production Deployment

### 12.1 Pre-deployment Checklist

- [ ] Set `ENV=production` in backend `.env`
- [ ] Set `REQUIRE_AUTH=True` in backend `.env`
- [ ] Set `SUPABASE_JWT_SECRET` in backend `.env`
- [ ] Set `ALLOWED_ORIGINS` to your production domain
- [ ] Set `VITE_API_BASE_URL` to your backend's public URL
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Verify Gemini API key has production quota
- [ ] Run Supabase schema (`supabase_schema.sql`)
- [ ] Configure Google OAuth redirect URI for production domain
- [ ] Test the full auth flow end-to-end

### 12.2 Recommended Stack: Cloudflare Pages + Render (Free)

**Total cost: $0/month** — unlimited frontend bandwidth, 750 hrs/mo backend.

#### Frontend → Cloudflare Pages

1. Create a Cloudflare account at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Select your repo and configure:
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Set **environment variables** (these are build-time, baked into the bundle):
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
   - `VITE_API_BASE_URL` = your Render backend URL (e.g., `https://testorbit-api.onrender.com`)
5. Deploy — you'll get a URL like `testorbit.pages.dev`
6. SPA routing is handled by `frontend/wrangler.json` (already configured)

**Free tier:** Unlimited bandwidth, unlimited requests, 500 builds/month, 100 custom domains.

#### Backend → Render

1. Create a Render account at [render.com](https://render.com)
2. **New** → **Web Service** → Connect Git repo
3. Configure:
   - **Root directory:** `backend`
   - **Runtime:** Docker
   - **Instance type:** Free
4. Set **environment variables** in Render dashboard:
   - `GEMINI_API_KEY` = your Gemini API key
   - `ENV` = `production`
   - `REQUIRE_AUTH` = `True`
   - `SUPABASE_JWT_SECRET` = your Supabase JWT secret
   - `ALLOWED_ORIGINS` = `https://your-app.pages.dev` (your Cloudflare URL)
5. Deploy — you'll get a URL like `https://testorbit-api.onrender.com`

**Free tier:** 750 hrs/month, 512 MB RAM, 1 worker. Auto-sleeps after 15 min of no traffic.

#### Keep-Alive (Prevent Render Sleep)

Render free tier sleeps after 15 minutes of inactivity. Use a free ping service to keep it awake:

1. Sign up at [uptimerobot.com](https://uptimerobot.com) (free, no credit card)
2. Add HTTP(s) monitor → URL = your Render backend URL
3. Check interval: 5 minutes
4. This pings the health endpoint, keeping the service awake within the 750-hour budget

#### Post-Deploy Configuration

After both services are live:
1. Update `ALLOWED_ORIGINS` on Render to match your actual Cloudflare Pages URL
2. Update `VITE_API_BASE_URL` on Cloudflare Pages to match your actual Render URL (redeploy frontend)
3. In Supabase dashboard → **Authentication → URL Configuration**:
   - Add your Cloudflare Pages URL to **Redirect URLs**
   - If using Google OAuth: update the redirect URI in Google Cloud Console too

### 12.3 Alternative Platforms

| Platform | Frontend | Backend | Cost | Notes |
|----------|----------|---------|------|-------|
| **Cloudflare + Render** | Cloudflare Pages | Render (Docker) | **$0/mo** | Recommended. See above. |
| **Cloudflare + Koyeb** | Cloudflare Pages | Koyeb (Docker) | $0/mo | Faster cold starts (1-5s). Needs credit card. |
| **Cloudflare + Oracle** | Cloudflare Pages | Oracle Cloud ARM VPS | $0/mo | True always-on (24GB RAM). Manual server setup. |
| **Docker Compose** | nginx container | uvicorn container | VPS cost | Self-hosted. Full control. |

### 12.4 Production Backend Config

For paid hosting with more RAM, use gunicorn with multiple workers:

```bash
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## 13. Project Structure

```
gemini-api-tester/
├── frontend/                          # React SPA
│   ├── src/
│   │   ├── App.jsx                    # Root component, routing, header
│   │   ├── main.jsx                   # Entry point
│   │   ├── config.js                  # API_BASE, MOCK_BASE, authFetch()
│   │   ├── store/
│   │   │   └── workspaceStore.js      # Zustand store (all app state)
│   │   ├── utils/
│   │   │   ├── supabaseClient.js      # Supabase client init
│   │   │   ├── scriptEngine.js        # Pre/post script sandbox (pm.* API)
│   │   │   └── assertionEngine.js     # Response assertion evaluator
│   │   └── components/
│   │       ├── common/
│   │       │   ├── AuthPage.jsx       # Full-page login (Google/GitHub/email)
│   │       │   ├── ProfilePage.jsx    # User profile management
│   │       │   ├── UserMenu.jsx       # Header auth dropdown
│   │       │   ├── GuestBanner.jsx    # "Sign in to sync" banner
│   │       │   ├── TourGuide.jsx      # Joyride feature tour
│   │       │   ├── InteractiveTutorial.jsx  # Step-by-step demos
│   │       │   └── ErrorBoundary.jsx  # React error boundary
│   │       └── workspace/
│   │           ├── Sidebar.jsx        # Collection tree + context menus
│   │           ├── TabManager.jsx     # Request tab bar
│   │           ├── RequestEditor.jsx  # HTTP request builder (6 tabs)
│   │           ├── IntelligencePanel.jsx  # AI chat + spec + tests
│   │           ├── CollectionRunner.jsx   # Batch test runner + diagnosis
│   │           ├── WebSocketTester.jsx    # WebSocket client
│   │           ├── MockServerPanel.jsx    # Mock server management
│   │           ├── Dashboard.jsx      # Landing page
│   │           ├── DocsPanel.jsx      # Documentation + tutorials
│   │           ├── CodeGenModal.jsx   # AI code generation
│   │           ├── ShareModal.jsx     # Collection sharing
│   │           ├── CurlImportModal.jsx    # cURL import
│   │           ├── ImportCollectionModal.jsx  # Multi-format import
│   │           ├── EnvironmentManager.jsx # Environment variables
│   │           ├── JsonViewer.jsx     # Syntax-highlighted JSON/code
│   │           ├── KeyValueEditor.jsx # Key-value pair editor
│   │           └── CustomMethodSelect.jsx # HTTP method dropdown
│   ├── Dockerfile                     # Multi-stage: node build + nginx
│   ├── nginx.conf                     # SPA routing config
│   ├── .env.example                   # Environment template
│   ├── package.json
│   ├── vite.config.js
│   └── eslint.config.js
│
├── backend/                           # FastAPI server
│   ├── app/
│   │   ├── main.py                    # App entry, middleware, routes
│   │   ├── api/
│   │   │   ├── routes.py             # Main API endpoints (6 routes)
│   │   │   ├── mock_routes.py        # Mock server endpoints
│   │   │   └── oauth_routes.py       # OAuth 2.0 token proxy
│   │   ├── core/
│   │   │   ├── config.py             # Settings (env vars, defaults)
│   │   │   └── security.py           # JWT auth, SSRF, headers, log masking
│   │   └── services/
│   │       ├── ai_service.py         # Gemini API integration (5 methods)
│   │       ├── test_runner.py        # Parallel HTTP test execution
│   │       └── mock_service.py       # Mock storage & retrieval
│   ├── Dockerfile                     # Python + uvicorn
│   ├── requirements.txt
│   ├── .env.example
│   └── mcp_server.py                 # MCP server for Claude/AI IDE integration
│
├── docker-compose.yml                 # Both services
├── supabase_schema.sql                # Database schema + RLS policies
├── cli.py                            # CLI test runner
├── todo.md                           # SaaS roadmap & task tracking
├── DEVELOPER.md                      # This file
├── README.md                         # Project overview
├── CONTRIBUTING.md                   # Contribution guidelines
└── LICENSE                           # MIT License
```

---

## 14. Troubleshooting

### "Converting circular structure to JSON"

**Cause:** Supabase `RealtimeChannel` object was stored in Zustand state and the persist middleware tried to serialize it.

**Fix:** Already fixed — `_realtimeChannel` and `user` are excluded from `partialize` in `workspaceStore.js`.

### Google OAuth redirects but stays on login page

**Cause:** After OAuth redirect, `currentView` was still `'login'` in persisted state, and `initializeAuth()` didn't change it.

**Fix:** Already fixed — `initializeAuth()` now sets `currentView: 'dashboard'` when a user session is detected while on the login page.

### "Supabase is not configured" error

**Cause:** Missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` in frontend `.env.local`.

**Fix:** Create `frontend/.env.local` with your Supabase project credentials. Or ignore it — the app works without Supabase (no auth/sync).

### Backend returns 401 Unauthorized

**Cause:** `REQUIRE_AUTH=True` but no valid JWT token in the request.

**Fix:**
- For development: Set `REQUIRE_AUTH=False` in `backend/.env`
- For production: Ensure the frontend sends the token (it does automatically via `authFetch()` when logged in)
- Verify `SUPABASE_JWT_SECRET` matches your Supabase project's JWT secret

### CORS errors in browser console

**Cause:** Frontend origin not in the backend's allowed origins list.

**Fix:** Add your frontend URL to `ALLOWED_ORIGINS` in `backend/.env`:
```
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

### Rate limit exceeded (429)

**Cause:** Too many requests to an AI endpoint.

**Fix:** Wait for the rate limit window to reset (shown in `Retry-After` header). To increase limits, change `AI_RATE_LIMIT` or `PROXY_RATE_LIMIT` in `backend/.env`.

### Mock server returns empty list

**Cause:** No mocks have been generated yet.

**Fix:** Send any HTTP request to `http://localhost:8000/mock-server/your/api/path` — Gemini will generate a mock response and cache it.

### Build warnings about chunk size

**Cause:** The frontend JS bundle is ~1.4MB (432KB gzipped). This is within acceptable range for a feature-rich SPA.

**Fix:** Not critical. Future optimization: code-splitting via dynamic `import()` for large components (DocsPanel, CollectionRunner, etc.).

### Pre/post scripts not running

**Cause:** Scripts execute in a sandboxed `new Function()` context with `pm` and `console` objects.

**Fix:** Use the `pm.*` API:
```javascript
// Pre-request: set headers
pm.request.headers['Authorization'] = 'Bearer ' + pm.environment.get('token');

// Post-response: extract values
const token = pm.response.json().token;
pm.environment.set('token', token);

// Assertions
pm.test('Status is 200', () => pm.response.status === 200);
```

### WebSocket connection fails

**Cause:** The WebSocket URL might be incorrect or the server doesn't support WebSocket.

**Fix:** Ensure the URL starts with `ws://` or `wss://`. The WebSocket tester connects directly from the browser (not proxied through the backend).

---

## Build & Lint

```bash
# Frontend lint (should be 0 errors, 0 warnings)
cd frontend && npm run lint

# Frontend build
cd frontend && npm run build

# Backend import check
cd backend && python -c "from app.main import app; print('OK')"
```

---

*Last updated: 2026-02-14*
