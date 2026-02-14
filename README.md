<div align="center">
  <img src="docs/assets/testorbit-logo.svg" alt="TestOrbit Logo" width="120" height="120">

  # TestOrbit

  ### AI-Native API Testing Platform Powered by Google Gemini

  [![Google Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini%203-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

  [Quick Start](#-quick-start) · [Features](#-key-features) · [Deploy](#-deployment) · [Developer Guide](DEVELOPER.md)

</div>

---

## What is TestOrbit?

**TestOrbit** is an AI-native API testing platform that leverages **Google Gemini** to revolutionize how developers design, test, and mock APIs. Describe what you want in natural language — Gemini generates tests, mocks, code, and diagnoses failures automatically.

| Traditional Approach | TestOrbit Approach |
|---------------------|--------------------|
| Write tests manually | Describe in English, AI generates tests |
| Mock servers need setup | AI invents realistic responses instantly |
| Debug failures yourself | AI diagnoses root cause + suggests fixes |
| Single-tool usage | Agents (Claude, Cursor) can run tests via MCP |

---

## Key Features

### AI-Powered Intelligence (Gemini 3 Flash)

| Feature | Description |
|---------|-------------|
| **Natural Language Chat** | "Test the login endpoint with email and password" — Gemini builds the full request |
| **Auto Test Generation** | Upload OpenAPI spec — get 20+ test cases (happy path, edge cases, security) |
| **Failure Diagnosis** | One-click root cause analysis on failed tests with actionable fixes |
| **Code Generation** | Export requests as Python, JavaScript, Go, Java, cURL, and more |

### AI Mock Server

Send any request to `/mock-server/*` and Gemini invents a realistic JSON response on the fly:

```bash
curl -X POST http://localhost:8000/mock-server/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'
```

### Full Testing Suite

- **Collection Runner** — Sequential/parallel batch execution with AI optimization analysis
- **Pre/Post Scripts** — Postman-compatible `pm.*` API in a sandboxed JS environment
- **Assertions Builder** — Visual builder for status, time, JSONPath, header, regex checks
- **WebSocket Testing** — Connect, send messages, monitor real-time communication
- **Response Assertions** — Auto-evaluated with pass/fail indicators

### Import Everything

| Format | Supported |
|--------|-----------|
| Postman Collections | Yes |
| Insomnia | Yes |
| OpenAPI / Swagger | Yes |
| Thunder Client | Yes |
| cURL Commands | Yes |

### Auth & Cloud Sync

- **Google, GitHub, and Email** sign-in via Supabase Auth
- **Cloud sync** — Collections and environments synced across devices
- **Collection sharing** — Invite collaborators with viewer/editor roles
- **Environment manager** — Per-user key-value variables, synced to cloud

### Agent Integration (MCP)

TestOrbit exposes testing capabilities through the **Model Context Protocol**, allowing AI agents like Claude, Cursor, and Windsurf to run tests, generate tests, and diagnose failures programmatically.

---

## Demo

<div align="center">

**[Watch the Demo Video](https://vimeo.com/1163412339)**

</div>

### Screenshots

<table>
  <tr>
    <td align="center"><b>Dashboard</b></td>
    <td align="center"><b>AI Chat</b></td>
  </tr>
  <tr>
    <td><img src="docs/assets/screenshot-dashboard.png" width="400"></td>
    <td><img src="docs/assets/screenshot-chat.png" width="400"></td>
  </tr>
  <tr>
    <td align="center"><b>Mock Server</b></td>
    <td align="center"><b>Test Generation</b></td>
  </tr>
  <tr>
    <td><img src="docs/assets/screenshot-mock.png" width="400"></td>
    <td><img src="docs/assets/screenshot-tests.png" width="400"></td>
  </tr>
</table>

---

## Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Python** 3.11+ ([Download](https://python.org/))
- **Google Gemini API Key** ([Get one free](https://aistudio.google.com/apikey))

### 1. Clone & Setup Backend

```bash
git clone https://github.com/R-Praneshkumar/TestOrbit.git
cd TestOrbit/backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate      # Windows
source .venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add: GEMINI_API_KEY=your_key_here

# Start server
uvicorn app.main:app --reload --port 8000
```

### 2. Setup Frontend

```bash
cd ../frontend
npm install

# (Optional) Configure Supabase for auth/sync
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

npm run dev
```

### 3. Open TestOrbit

Open **http://localhost:5173** in your browser.

> TestOrbit works fully offline without Supabase — you just won't have auth, cloud sync, or sharing. All AI features work with just the Gemini API key.

---

## Deployment

**Recommended free stack: Cloudflare Pages (frontend) + Render (backend) = $0/month**

### Frontend (Cloudflare Pages)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create → Pages
2. Connect your GitHub repo
3. Set root directory: `frontend`, build command: `npm run build`, output: `dist`
4. Set env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`

### Backend (Render)

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Set root directory: `backend`, runtime: Docker, instance: Free
4. Set env vars: `GEMINI_API_KEY`, `ENV=production`, `REQUIRE_AUTH=True`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS`

### Docker (Self-hosted)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your keys

docker compose up --build -d
# Frontend: http://localhost  |  Backend: http://localhost:8000
```

See [DEVELOPER.md](DEVELOPER.md) for the full deployment guide, Supabase setup, Google OAuth setup, and troubleshooting.

---

## Architecture

```
+-------------------+     HTTPS      +-------------------+     API      +-------------------+
|    Browser        | ──────────────> |    Frontend        | ──────────> |    Backend         |
|    (React SPA)    | <────────────── |    (Cloudflare)    | <────────── |    (Render)        |
+-------------------+                 +-------------------+             +-------------------+
        |                                      |                               |
        |   Supabase Auth (JWT)                |   authFetch()                 |   Gemini API
        v                                      v                               v
+-------------------+                                                 +-------------------+
|   Supabase        |                                                 |   Google Gemini    |
|   (Auth + DB)     |                                                 |   3 Flash          |
+-------------------+                                                 +-------------------+
```

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React, Vite, Tailwind CSS | 19, 7, 4 |
| **State** | Zustand (persisted) | 5.x |
| **Backend** | FastAPI, Python | 0.128+, 3.11+ |
| **AI** | Google Gemini 3 Flash | via google-genai |
| **Auth & DB** | Supabase | 2.x |
| **Protocol** | Model Context Protocol (MCP) | Agent interop |

---

## API Reference

All endpoints require JWT auth when `REQUIRE_AUTH=True`. Rate limited per IP.

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| `POST` | `/api/v1/generate` | AI test case generation | 10/min |
| `POST` | `/api/v1/run` | Batch test execution | — |
| `POST` | `/api/v1/voice` | Natural language to API request | 10/min |
| `POST` | `/api/v1/codegen` | Code snippet generation | 10/min |
| `POST` | `/api/v1/diagnose` | AI failure diagnosis | 10/min |
| `POST` | `/api/v1/proxy` | CORS proxy for external APIs | 60/min |
| `ANY` | `/mock-server/*` | AI mock response generation | 30/min |
| `POST` | `/api/v1/oauth/token` | OAuth token exchange | 10/min |
| `POST` | `/api/v1/oauth/refresh` | OAuth token refresh | 10/min |
| `GET` | `/` | Health check (uptime, services) | — |

---

## Security

- **JWT Authentication** — Supabase JWT validation on all API routes
- **SSRF Protection** — Blocks private IPs, cloud metadata, localhost
- **Rate Limiting** — Per-IP via slowapi (configurable)
- **Input Validation** — Pydantic field limits (URLs: 2KB, specs: 100KB, bodies: 1MB)
- **Security Headers** — CSP, X-Frame-Options, HSTS, Permissions-Policy
- **Secret Masking** — API keys, JWTs, tokens masked in all log output
- **HTTPS Enforcement** — Auto-redirect in production

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | New Request |
| `Ctrl + Enter` | Send Request |
| `Ctrl + S` | Save |
| `Esc` | Close Modal / Runner |

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

```bash
git clone https://github.com/R-Praneshkumar/TestOrbit.git
git checkout -b feature/amazing-feature
# Make changes...
cd frontend && npm run lint   # 0 errors, 0 warnings
cd ../backend && python -c "from app.main import app; print('OK')"
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

  **[Developer Guide](DEVELOPER.md)** · **[Roadmap](todo.md)** · **[Contributing](CONTRIBUTING.md)**

  [Back to Top](#testorbit)

</div>
