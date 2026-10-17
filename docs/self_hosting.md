# TraceLens Self-Hosting & Operations Guide

This guide covers everything needed to operate TraceLens in local environments, self-hosted Docker hosts, or cloud Kubernetes / VM clusters.

---

## 1. System Requirements

- **CPU**: 2+ vCPUs recommended
- **Memory**: 4 GB RAM minimum
- **Disk**: 20 GB SSD storage
- **Software**: Docker 24+ and Docker Compose v2 (for containerized deployments)

---

## 2. Quickstart with Docker Compose

TraceLens provides a turnkey `docker-compose.yml` that starts all services with persistent storage and health monitoring.

```bash
# 1. Clone repository
git clone https://github.com/your-org/tracelens.git
cd tracelens

# 2. Configure environment
cp .env.example .env

# 3. Launch all containers in detached mode
docker compose up --build -d

# 4. Check container health status
docker compose ps
```

### Services Launched:
| Container | Port | Description |
| :--- | :--- | :--- |
| `tracelens-postgres` | 5432 | PostgreSQL 16 database |
| `tracelens-redis` | 6379 | Redis 7 in-memory ingestion buffer |
| `tracelens-backend` | 8000 | FastAPI REST & ingestion API |
| `tracelens-worker` | N/A | Background queue persister + alert scheduler |
| `tracelens-dashboard` | 3000 | Next.js 14 Web Observability Dashboard |

---

## 3. Database Migrations (Alembic)

TraceLens uses Alembic for declarative schema migrations.

### Applying Migrations
When starting the backend container, migrations are automatically run via:
```bash
alembic upgrade head
```

To run migrations manually:
```bash
cd tracelens/backend
export DATABASE_URL="postgresql+asyncpg://tracelens:secret@localhost:5432/tracelens"
alembic upgrade head
```

### Rolling Back a Migration
To rollback the most recent migration revision:
```bash
alembic downgrade -1
```

To view current migration status:
```bash
alembic current
```

---

## 4. Production Cloud Deployments

### Managed Database (Neon PostgreSQL)
When using serverless PostgreSQL providers like Neon:
1. Ensure connection string uses `postgresql+asyncpg://`.
2. Append `?ssl=require` to enable TLS encryption.

### Managed Buffer (Upstash Redis)
For serverless Redis:
1. Use the TLS endpoint: `rediss://default:<password>@<host>:6379`.
2. TraceLens automatically handles Redis reconnections. If Redis goes offline, TraceLens fails over to an internal in-memory buffer without dropping HTTP requests.

---

## 5. Security & Network Hardening

1. **Change Default Secrets**:
   Never deploy with default keys. Generate a 256-bit secret key:
   ```bash
   openssl rand -hex 32
   ```
   Set this in `.env` as `SECRET_KEY`.

2. **CORS Restrictions**:
   Lock `CORS_ORIGINS` to trusted domains:
   ```env
   CORS_ORIGINS=https://dashboard.yourcompany.com
   ```

3. **Per-Key Rate Limiting**:
   By default, TraceLens enforces a 1,000 requests/minute rate limit per API key on the `/v1/ingest` endpoint to protect backend workers against unexpected traffic spikes.
