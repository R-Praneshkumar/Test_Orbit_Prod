# TestOrbit

An open-source API testing workspace built with React, FastAPI, and Google Gemini.

[![CI](https://github.com/R-Praneshkumar/Test_Orbit_Prod/actions/workflows/ci.yml/badge.svg)](https://github.com/R-Praneshkumar/Test_Orbit_Prod/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

TestOrbit is available under the MIT license. The application has no paid tiers,
checkout, or subscription module. Self-hosting infrastructure and external AI
providers may charge for usage. Configured request rate limits still apply.

## Features

- Organize and send HTTP requests with collections, folders, and environments.
- Generate test cases, code snippets, and diagnostic suggestions with Gemini.
- Run API tests and compare responses with OpenAPI schemas.
- Inspect requests and responses with AI-assisted security and performance analysis.
- Test WebSocket connections and generate mock responses.
- Import Postman, Insomnia, OpenAPI, Thunder Client, and cURL requests.
- Use assertions and pre/post-request JavaScript scripts.
- Optionally enable Supabase sign-in, cloud sync, and collection/team sharing.

AI-generated tests and security suggestions require human review. They do not
certify that a target API is secure. Only test APIs you are authorized to access.

## Quick start

Prerequisites: Node.js 20.19+ (or 22.12+), Python 3.11+, and a Gemini API key for AI features.

```bash
git clone https://github.com/R-Praneshkumar/Test_Orbit_Prod.git
cd Test_Orbit_Prod/backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux instead: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` locally. Set `GEMINI_API_KEY`. For local-only use without
Supabase, set `ENV=development` and `REQUIRE_AUTH=False`. Keep the server bound
to localhost in this mode. Never commit this file or paste its values into issues.

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```bash
cd Test_Orbit_Prod/frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173. Supabase configuration is optional for local work.
AI features require an internet connection and the server-side Gemini key.

## Authentication and cloud sync

1. Create your own Supabase project and review `supabase_schema.sql` before applying it.
2. Configure the backend with `SUPABASE_URL` and, for legacy HS256 tokens,
   `SUPABASE_JWT_SECRET`.
3. Configure the frontend with `VITE_SUPABASE_URL` and the browser-safe
   `VITE_SUPABASE_ANON_KEY`, plus `VITE_API_BASE_URL` pointing to your backend.
4. Enable `REQUIRE_AUTH=True` for any shared deployment.

Every `VITE_*` value is included in the browser build. Never put a Gemini key,
Supabase service-role key, JWT signing secret, or other private credential there.
Database row-level security must be applied and verified in your own project.
Editing the SQL file does not change an existing hosted database.

## Deployment

The frontend is a static Vite build (`npm run build`, output `frontend/dist`).
The backend runs with Uvicorn or the supplied Dockerfile. `render.yaml` provides
backend configuration; `docker-compose.yml` supports a self-hosted setup.

For production set:

- `ENV=production` and `REQUIRE_AUTH=True`.
- `GEMINI_API_KEY` as a backend secret.
- `SUPABASE_URL` and the appropriate JWT verification configuration.
- `ALLOWED_ORIGINS` to the exact frontend origins you operate.
- Appropriate `AI_RATE_LIMIT`, `PROXY_RATE_LIMIT`, and `MOCK_RATE_LIMIT` values.

Use HTTPS and set provider-side spending limits. Mock endpoints require the
same authentication as other API routes. The backend blocks private network
targets outside local development and does not follow target redirects.

See [DEVELOPER.md](DEVELOPER.md) for architecture and development details.
Historical documents under `content/` and `BUSINESS_PLAN.md` are retired drafts;
their old commercial terms do not describe the current application.

## Security

See [SECURITY.md](SECURITY.md) for credential handling, deployment boundaries,
and vulnerability reporting. API request collections, environments, and history
can themselves contain credentials; review them before sharing or exporting.
Imported scripts are executable code: run only scripts you trust.

## Development checks

```bash
# From frontend/
npm run lint
npm test
npm run build

# From backend/, with development test configuration
python -m pytest tests/ -q
```

See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute.

## License

[MIT](LICENSE).
