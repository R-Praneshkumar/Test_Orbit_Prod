# Gemini API Tester — Frontend

React-based frontend for the Gemini API Tester platform.

## Tech Stack

- **React 19** with functional components and hooks
- **Vite 7** for development and bundling
- **Tailwind CSS v4** with dark mode support
- **Zustand** for state management with localStorage persistence

## Setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Key Components

| Component | Description |
|-----------|-------------|
| `RequestEditor` | HTTP request builder with 6 subtabs |
| `IntelligencePanel` | AI chat, OpenAPI spec, test generation |
| `CollectionRunner` | Batch test execution with results |
| `WebSocketTester` | WebSocket connection and messaging |
| `Sidebar` | Collection tree with context menus |
| `Dashboard` | Home view with collection cards |
| `CodeGenModal` | Multi-language code generation |
| `ImportCollectionModal` | Multi-format collection import |
| `EnvironmentManager` | Variable management |

## Utilities

| Utility | Description |
|---------|-------------|
| `scriptEngine.js` | Sandboxed pre/post script execution with `pm.*` API |
| `assertionEngine.js` | Response assertion evaluation engine |
