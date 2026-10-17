# Contributing to TraceLens

Thank you for your interest in contributing to TraceLens! This document guides you through setting up your local environment, running tests, and following our engineering standards.

---

## 1. Monorepo Structure

TraceLens is structured as a unified monorepo:

```
tracelens/
  sdk/               # Python SDK package ("tracelens" on PyPI)
    src/tracelens/   # Core client, context, decorators, models, pricing
    tests/           # SDK pytest unit tests
  backend/           # FastAPI backend application
    app/api/         # REST API routers (v1 auth, traces, metrics, evals, alerts)
    app/models/      # SQLAlchemy 2.0 ORM models
    app/services/    # Evals engine & scorers
    app/workers/     # Queue persister & alerter
    alembic/         # Database migrations
    tests/           # Backend pytest suite & integration tests
  dashboard/         # Next.js 14 App Router dashboard (TypeScript, Tailwind, Recharts)
  examples/          # Sample instrumented LLM applications (demo_app.py)
  docs/              # Developer & operational documentation
```

---

## 2. Local Development Setup

### Python Environment (SDK & Backend)
1. Python 3.11+ is required.
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\Activate.ps1
   ```
3. Install dependencies in editable mode:
   ```bash
   pip install -r tracelens/backend/requirements.txt
   pip install pytest pytest-asyncio pytest-cov ruff httpx build
   ```

### Dashboard Environment (Next.js)
1. Node.js 20+ and npm are required.
2. Install dashboard dependencies:
   ```bash
   cd tracelens/dashboard
   npm install
   ```

---

## 3. Running Quality Gates

Before submitting a Pull Request, ensure all quality gates pass cleanly:

### 1. Python Linting & Formatting
```bash
ruff check .
```

### 2. Full Test Suite & Coverage
```bash
export PYTHONPATH="."
pytest --cov=tracelens.backend.app --cov=tracelens.sdk.src.tracelens --cov-report=term-missing
```
*Note: Test coverage must remain at or above 80%.*

### 3. Frontend Lint & Type Checking
```bash
cd tracelens/dashboard
npm run lint
npx tsc --noEmit
npm run build
```

---

## 4. Conventional Commits

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat(...)`: A new feature (e.g. `feat(sdk): add mistral pricing support`)
- `fix(...)`: A bug fix (e.g. `fix(backend): correct parent span ordering`)
- `test(...)`: Adding or updating test cases
- `docs(...)`: Documentation updates
- `refactor(...)`: Code refactoring without behavioral changes

---

## 5. Pull Request Guidelines

1. Fork the repository and create a feature branch (`git checkout -b feat/my-new-feature`).
2. Write unit tests for all new endpoints, decorators, or UI components.
3. Verify all CI checks pass on GitHub Actions.
4. Submit your PR with a clear summary of changes and screenshots for any UI modifications.
