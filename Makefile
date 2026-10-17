.PHONY: help dev dev-backend dev-dashboard test test-backend test-load lint seed docker-up docker-down build-sdk

PYTHON ?= python
PIP ?= pip
NPM ?= npm

help:
	@echo "TraceLens Engineering & Operations Makefile"
	@echo "==========================================="
	@echo "  make dev             - Start backend and dashboard for local development"
	@echo "  make dev-backend     - Run FastAPI backend with auto-reload on port 8000"
	@echo "  make dev-dashboard   - Run Next.js dashboard on port 3000"
	@echo "  make test            - Execute all backend and SDK tests with coverage"
	@echo "  make test-load       - Run 10,000 span high-throughput ingestion benchmark"
	@echo "  make lint            - Run ruff linter and ESLint quality gates"
	@echo "  make seed            - Populate database with 200 realistic sample traces"
	@echo "  make docker-up       - Build and launch all 5 containers (DB, Redis, API, Worker, UI)"
	@echo "  make docker-down     - Stop and remove all Docker containers and volumes"
	@echo "  make build-sdk       - Build Python SDK wheel and sdist distributions"

dev-backend:
	uvicorn tracelens.backend.app.main:app --reload --host 0.0.0.0 --port 8000

dev-dashboard:
	cd tracelens/dashboard && $(NPM) run dev

dev:
	@echo "Launching TraceLens backend and dashboard..."
	@echo "Tip: Run 'make docker-up' to run the full stack with Postgres & Redis."

test-backend:
	$(PYTHON) -m pytest --cov=tracelens.backend.app --cov=tracelens.sdk.src.tracelens --cov-report=term-missing

test: test-backend
	cd tracelens/dashboard && $(NPM) run build

test-load:
	$(PYTHON) tests/load_test.py

lint:
	ruff check .
	cd tracelens/dashboard && $(NPM) run lint && npx tsc --noEmit

seed:
	$(PYTHON) -m tracelens.backend.seed

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down -v

build-sdk:
	cd tracelens/sdk && $(PYTHON) -m pip install --upgrade build && $(PYTHON) -m build
