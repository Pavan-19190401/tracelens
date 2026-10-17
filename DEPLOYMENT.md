# TraceLens Production Deployment Guide & Runbook

This runbook documents every step required to deploy **TraceLens** to production across Neon (PostgreSQL 16), Upstash (Redis 7), Render (FastAPI Web Service + Worker), and Vercel (Next.js 14 Dashboard), as well as local multi-container Docker Compose.

---

## Architecture Summary

```
                              ┌───────────────────────────────────┐
                              │     Vercel (Next.js Dashboard)    │
                              │    https://tracelens.vercel.app   │
                              └─────────────────┬─────────────────┘
                                                │ HTTPS
                                                ▼
┌─────────────────────────┐   HTTPS   ┌───────────────────────────────────┐
│ Host App / Python SDK   ├──────────►│        Render Web Service         │
│  tracelens.init(...)    │  /ingest  │      (FastAPI on Port 8000)       │
└─────────────────────────┘           └─────────┬───────────────┬─────────┘
                                                │               │
                                   Enqueue Raw  │               │ Query State
                                       Envelopes│               │
                                                ▼               ▼
                              ┌─────────────────────┐   ┌─────────────────┐
                              │    Upstash Redis    │   │  Neon Postgres  │
                              │  (In-Memory Buffer) │   │ (ACID Relational│
                              └─────────┬───────────┘   │     Store)      │
                                        │               └────────▲────────┘
                                        │ Drain Batches          │
                                        ▼                        │ Persist
                              ┌──────────────────────────────────┴────────┐
                              │           Render Worker Service           │
                              │  (asyncio persister + 1-min alert loop)   │
                              └───────────────────────────────────────────┘
```

---

## 1. Local Deployment (Docker Compose)

### Prerequisites
- Docker Engine 24+ & Docker Compose v2 installed.

### Commands
```bash
# 1. Clone repository
git clone https://github.com/your-org/tracelens.git
cd tracelens

# 2. Copy environment template
cp .env.example .env

# 3. Launch all 5 containers (Postgres, Redis, API, Worker, Dashboard)
make docker-up
# or: docker compose up --build -d

# 4. View container logs
docker compose logs -f backend

# 5. Seed 200 realistic traces
docker compose exec backend python -m tracelens.backend.seed

# 6. Access Local Services
# Dashboard: http://localhost:3000
# API & Docs: http://localhost:8000/docs
# Health:    http://localhost:8000/health
```

---

## 2. Cloud Infrastructure Provisioning

Follow these steps when provisioning the production cloud services.

### Step 2.1: Database Provisioning (Neon Postgres)
1. Navigate to [Neon Console](https://console.neon.tech).
2. Click **Create Project**, name it `tracelens-prod`, choose region closest to Render (e.g. `us-east-1` / `us-east-2`).
3. Under **Dashboard > Connection Details**, select:
   - **Database**: `neondb` (or create `tracelens`)
   - **Connection string**: Choose **Direct connection** (or pooled if high scale)
4. Copy the connection string. Replace `postgres://` with `postgresql+asyncpg://`:
   ```env
   DATABASE_URL=postgresql+asyncpg://<username>:<password>@<ep-xyz>.us-east-2.aws.neon.tech/neondb?ssl=require
   ```

### Step 2.2: Buffer Queue Provisioning (Upstash Redis)
1. Navigate to [Upstash Console](https://console.upstash.com).
2. Click **Create Database**, name it `tracelens-queue`, select the same cloud region.
3. Select **TLS Enabled** (Default).
4. Under the database **Details**, copy the **redis-py** / Python connection string:
   ```env
   REDIS_URL=rediss://default:<upstash-password>@<upstash-endpoint>.upstash.io:6379
   ```

### Step 2.3: Backend & Worker Deployment (Render)

You can deploy via the `render.yaml` Blueprint or manually:

#### Option A: One-Click Render Blueprint
1. In Render dashboard, click **New > Blueprint**.
2. Connect your Git repository. Render automatically reads `render.yaml`.
3. Provide the environment variables prompted:
   - `DATABASE_URL`: Paste Neon connection string.
   - `REDIS_URL`: Paste Upstash Redis connection string.
   - `CORS_ORIGINS`: Set to your Vercel URL (e.g., `https://tracelens.vercel.app`).
4. Click **Apply**. Render will launch:
   - `tracelens-api` (Web Service with automated `alembic upgrade head` and health check `/health`)
   - `tracelens-worker` (Background Worker running `run_worker.py`)

#### Option B: Manual Web Service Setup
- **Name**: `tracelens-api`
- **Runtime**: Docker
- **Dockerfile Path**: `tracelens/backend/Dockerfile`
- **Docker Context**: `.`
- **Health Check Path**: `/health`
- **Environment Variables**:
  - `DATABASE_URL`: `postgresql+asyncpg://...`
  - `REDIS_URL`: `rediss://...`
  - `SECRET_KEY`: `<Generate 32-char hex secret>`
  - `CORS_ORIGINS`: `https://tracelens.vercel.app`
  - `ENVIRONMENT`: `production`

### Step 2.4: Dashboard Deployment (Vercel)
1. Navigate to [Vercel Dashboard](https://vercel.com/new).
2. Import the Git repository.
3. Configure the Project:
   - **Root Directory**: `tracelens/dashboard`
   - **Framework Preset**: Next.js
4. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://tracelens-api.onrender.com` (Your live Render web service URL).
5. Click **Deploy**. Vercel will build the production static pages and edge assets.

---

## 3. Post-Deployment Smoke Verification

Run the automated smoke test script locally against the live deployment:

```bash
LIVE_API_URL="https://tracelens-api.onrender.com" \
LIVE_API_KEY="tl_live_your_key_here" \
python - << 'EOF'
import os, sys, time, httpx

api_url = os.environ.get("LIVE_API_URL").rstrip("/")
api_key = os.environ.get("LIVE_API_KEY")

client = httpx.Client(timeout=15.0)

# 1. Health check
res = client.get(f"{api_url}/health")
assert res.status_code == 200, f"Health check failed: {res.text}"
print("✓ Health check endpoint OK: 200")

# 2. Ingest verification
ingest_res = client.post(
    f"{api_url}/v1/ingest",
    json={"traces": [{"id": f"smoke_{int(time.time())}", "name": "smoke_test", "status": "SUCCESS"}], "spans": []},
    headers={"X-API-Key": api_key}
)
assert ingest_res.status_code in (200, 202), f"Ingest check failed: {ingest_res.text}"
print("✓ Ingest endpoint OK: 202")

print("All Smoke Tests Passed!")
EOF
```

---

## 4. Rollback Plan & Disaster Recovery

### Scenario A: Reverting a Broken Application Deployment
If a bad build was deployed to Render or Vercel:

1. **Vercel (Dashboard)**:
   - Go to **Project > Deployments**.
   - Locate the previous successful deployment.
   - Click the three dots `...` > **Promote to Production**. Instant 1-second rollback.

2. **Render (API & Worker)**:
   - In Render Dashboard > `tracelens-api` > **Events**.
   - Select the previous stable commit > Click **Rollback to this deploy**.
   - Repeat for `tracelens-worker`.

### Scenario B: Rolling Back a Database Migration
If an Alembic migration fails or introduces an unwanted schema change:

1. Connect to the container / server shell:
   ```bash
   cd tracelens/backend
   ```
2. Revert the last applied revision:
   ```bash
   alembic downgrade -1
   ```
3. Or revert to a specific tagged revision:
   ```bash
   alembic downgrade <revision_id>
   ```
4. Verify table state:
   ```bash
   alembic current
   ```
