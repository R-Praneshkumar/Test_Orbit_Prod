<div align="center">
  <img src="docs/assets/testorbit-logo.svg" alt="TestOrbit Logo" width="120" height="120">
  
  # TestOrbit
  
  ### AI-Native API Testing Platform Powered by Google Gemini
  
  [![Google Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini%203-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
  [![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
  
  **🏆 Built for the Gemini API Developer Competition 2025**
  
  [▶️ Watch Demo](https://vimeo.com/1163412339) · [Quick Start](#quick-start) · [Features](#features) · [Architecture](#architecture)
  
</div>

---

## 🚀 What is TestOrbit?

**TestOrbit** is an AI-native API testing platform that leverages the power of **Google Gemini** to revolutionize how developers design, test, and mock APIs. Unlike traditional tools that require manual test writing, TestOrbit understands your API intent through natural language and generates comprehensive test suites automatically.

### The Problem We Solve

| Traditional Approach | TestOrbit Approach |
|---------------------|--------------------|
| ❌ Write tests manually | ✅ Describe in English, AI generates tests |
| ❌ Mock servers need setup | ✅ AI invents realistic responses instantly |
| ❌ Debug failures yourself | ✅ AI diagnoses root cause + suggests fixes |
| ❌ Single-tool usage | ✅ Agents (Claude, Cursor) can run tests via MCP |

---

## ✨ Key Features

### 🧠 AI-Powered Intelligence (Gemini 3 Flash)

| Feature | Description |
|---------|-------------|
| **Natural Language Chat** | "Test the login endpoint with email and password" → Gemini builds the full request |
| **Auto Test Generation** | Upload OpenAPI spec → Get 20+ test cases (happy path, edge cases, security) |
| **Failure Diagnosis** | One-click root cause analysis on failed tests with actionable fixes |
| **Code Generation** | Export requests as Python, JavaScript, Go, Java, or cURL |

### 🎭 AI Mock Server

> **No backend? No problem.**

Send any request to `/mock-server/*` and Gemini invents a realistic JSON response on the fly:

```bash
curl -X POST http://localhost:8000/mock-server/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'
```

Response (AI-generated):
```json
{
  "id": "usr_8f7g6h5j",
  "name": "Alice",
  "email": "alice@example.com",
  "created_at": "2025-02-10T12:00:00Z",
  "status": "active"
}
```

### 🤖 Agent Integration (MCP)

TestOrbit exposes its testing capabilities through the **Model Context Protocol**, allowing AI agents like Claude, Cursor, and Windsurf to:

- **Run test suites** programmatically
- **Generate tests** from code or specs
- **Diagnose failures** and suggest fixes

```bash
# Start MCP server for agent integration
python mcp_server.py
```

### 🧪 Professional Testing Suite

- **Collection Runner** — Sequential/parallel batch execution
- **Pre/Post Scripts** — Postman-compatible `pm.*` API
- **Assertions Builder** — Visual status, time, JSON path checks
- **Run History** — Track and compare past test runs
- **WebSocket Testing** — Full WS support with message templates

### 📥 Import Everything

| Format | Supported |
|--------|-----------|
| Postman Collections | ✅ |
| Insomnia | ✅ |
| OpenAPI/Swagger | ✅ |
| Thunder Client | ✅ |
| cURL Commands | ✅ |

---

## 🎬 Demo

<div align="center">

> 📹 **[Watch the Demo Video](https://vimeo.com/1163412339)**

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

## 🏁 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Python** 3.11+ ([Download](https://python.org/))
- **Google Gemini API Key** ([Get one free](https://aistudio.google.com/apikey))

### 1. Clone & Setup Backend

```bash
git clone https://github.com/your-username/testorbit.git
cd testorbit/backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Activate (macOS/Linux)
source .venv/bin/activate

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
npm run dev
```

### 3. Open TestOrbit

🌐 Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TestOrbit                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   React     │    │  FastAPI    │    │   Google Gemini     │  │
│  │  Frontend   │◄──►│  Backend    │◄──►│   (AI Engine)       │  │
│  │  (Vite)     │    │  (Python)   │    │                     │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│        │                  │                                     │
│        │                  ├──────────────────┐                  │
│        │                  │                  │                  │
│  ┌─────▼─────┐    ┌───────▼──────┐    ┌──────▼──────┐          │
│  │  Zustand  │    │  AI Services │    │  MCP Server │          │
│  │  (State)  │    │  - Generate  │    │  (Agents)   │          │
│  │           │    │  - Diagnose  │    │             │          │
│  └───────────┘    │  - Mock      │    └─────────────┘          │
│                   └──────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | React 19, Vite 7, Tailwind CSS v4 | Modern, fast, great DX |
| **State** | Zustand | Lightweight, no boilerplate |
| **Backend** | FastAPI, Python 3.11+ | Async, type-safe, fast |
| **AI** | Google Gemini 3 Flash | Best reasoning, fast inference |
| **Protocol** | Model Context Protocol (MCP) | Agent interoperability |

---

## 📁 Project Structure

```
testorbit/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── workspace/       # Core UI components
│   │   │   │   ├── Dashboard.jsx
│   │   │   │   ├── RequestEditor.jsx
│   │   │   │   ├── IntelligencePanel.jsx
│   │   │   │   ├── MockServerPanel.jsx
│   │   │   │   └── DocsPanel.jsx
│   │   │   └── common/          # Shared components
│   │   │       ├── TourGuide.jsx
│   │   │       └── InteractiveTutorial.jsx
│   │   ├── store/
│   │   │   └── workspaceStore.js  # Zustand state
│   │   ├── utils/
│   │   │   ├── scriptEngine.js    # pm.* API runtime
│   │   │   └── assertionEngine.js # Test assertions
│   │   └── App.jsx
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py        # REST endpoints
│   │   ├── services/
│   │   │   ├── ai_service.py    # Gemini integration
│   │   │   ├── mock_service.py  # AI mock server
│   │   │   └── runner.py        # Test execution
│   │   ├── core/
│   │   │   └── config.py        # Settings
│   │   └── main.py
│   ├── mcp_server.py            # MCP agent interface
│   └── requirements.txt
│
├── cli.py                       # CLI test runner
├── docs/                        # User documentation
└── README.md
```

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/generate` | Generate test suites from API description |
| `POST` | `/api/v1/run` | Execute batch tests |
| `POST` | `/api/v1/voice` | Natural language → API request |
| `POST` | `/api/v1/codegen` | Generate code snippets |
| `POST` | `/api/v1/diagnose` | AI failure diagnosis |
| `POST` | `/api/v1/proxy` | CORS proxy for external APIs |
| `ANY` | `/mock-server/*` | AI-powered mock endpoint |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | New Request |
| `Ctrl + Enter` | Send Request |
| `Ctrl + S` | Save |
| `Esc` | Close Modal / Runner |

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Fork and clone
git clone https://github.com/your-fork/testorbit.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and test
npm run dev
python -m pytest

# Submit PR
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **Google Gemini Team** — For the incredible AI capabilities
- **Competition Organizers** — For the opportunity to build this
- **Open Source Community** — React, FastAPI, Zustand, and all the tools that made this possible

---

<div align="center">
  
  **Built with ❤️ for the Gemini API Developer Competition 2025**
  
  [⬆ Back to Top](#testorbit)
  
</div>
