# Contributing to TestOrbit

Thank you for your interest in contributing to TestOrbit! 🎉

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/TestOrbit.git
   cd TestOrbit
   ```
3. **Set up** both frontend and backend (see [README.md](README.md) for details)

## Development Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Test your changes:
   ```bash
   # Frontend
   cd frontend && npm run dev

   # Backend
   cd backend && uvicorn app.main:app --reload --port 8000

   # Backend tests
   cd backend && pytest tests/ -v
   ```
4. Commit with a descriptive message:
   ```bash
   git commit -m "feat: add your feature description"
   ```
5. Push to your fork and open a Pull Request

## Code Style

- **Frontend**: React functional components, Zustand for state, Tailwind CSS for styling
- **Backend**: Python 3.11+, FastAPI, type hints, async/await

## Reporting Issues

- Use GitHub Issues to report bugs
- Include steps to reproduce, expected behavior, and actual behavior
- Include browser/OS info if relevant

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
