# Deployment Guide

> Status: skeleton — **local dev only**. No production deployment, CI/CD, auth or database yet.
> Production topics are listed under [Planned](#planned) and will be documented when built.

## Prerequisites

- Python 3.11+
- Node.js 20+ (npm)
- Docker + Docker Compose (optional)

## Local Dev (without Docker)

**Backend** (terminal 1):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check: `curl http://localhost:8000/api/health` → `{"status":"ok"}`.
OpenAPI docs: http://localhost:8000/docs.

**Frontend** (terminal 2):

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Vite proxies `/api` → `API_URL` (default `http://localhost:8000`), see `frontend/vite.config.ts`.
Page loads the demo plan (`GET /api/plans/demo`) and validates it (`POST /api/validate`).

## Docker Compose

```bash
docker compose up --build     # api :8000, web :5173
docker compose logs -f api
docker compose down
```

| Service | Image base | Port | Hot reload | Notes |
|---|---|---|---|---|
| `api` | `python:3.11-slim` | 8000 | mounts `./backend/app` + `uvicorn --reload` | |
| `web` | `node:20-alpine` | 5173 | mounts `./frontend/src` (Vite HMR) | `API_URL=http://api:8000` |

Rebuild after changing `requirements.txt` or `package.json`.
Postgres service is commented out in `docker-compose.yml` (phase 2).

## Configuration

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `API_URL` | Vite dev server proxy | `http://localhost:8000` | Backend target for `/api` |

Backend has no env config yet. CORS origin is hardcoded to `http://localhost:5173` in
`backend/app/main.py` — change it if serving the frontend from another origin.
State is in-memory (`_VESSELS` in `api/routes.py`); restarting the API resets it.

## Tests & Checks

```bash
cd backend && pytest              # tests/test_api.py, tests/test_slot.py
cd frontend && npm run typecheck  # tsc --noEmit
cd frontend && npm run build      # typecheck + vite build -> frontend/dist
```

No frontend unit tests yet.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ModuleNotFoundError: fastapi` | Activate `.venv`, re-run `pip install -r requirements.txt` |
| Port 8000/5173 in use | `lsof -ti :8000 \| xargs kill` or `docker compose down` |
| Frontend shows no plan / 502 on `/api` | Backend not running, or `API_URL` wrong |
| CORS error when calling API directly | Use the Vite proxy (`/api`) or add origin in `main.py` |
| `/api/stowage/solve` returns 501 | `cpsat` solver is a stub (phase 4); use `greedy-v0` |

## Planned

From `docs/PLAN.md`; not implemented:

- **Phase 2:** PostgreSQL (vessels, voyages, plans, plan_versions) — enable `db` service in compose.
- **Phase 4:** async solver jobs (RQ/Celery) + WebSocket progress; `ortools`, `numpy` deps.
- **Later:** production frontend build/serving, env-based config (DB URL, CORS origins), CI.

**Safety:** decision-support tool only. Plans must be verified on a class-approved loading
computer (IACS UR L5) before use.
