# Deployment Guide

> Status: skeleton — **local dev only**. No production deployment, CI/CD, auth or database yet.
> Production topics are listed under [Planned](#planned) and will be documented when built.
>
> **Last updated: 2026-09-17.** This file previously documented a frontend that fetched its plan from
> the API; that has not been true for some time (see [Wiring](#frontendbackend-wiring) below).

## Prerequisites

- Python 3.11+
- Node.js 20+ (npm)
- Docker + Docker Compose (optional)

## Frontend/Backend Wiring

**The app does not call the API.** This is the single most important thing to know before deploying:

| | Reality |
|---|---|
| Demo plan | Built in the browser — `frontend/src/data/build-demo-plan.ts` (`buildDemoVesselAndCargo`, `naiveFillPlan`) |
| Validation | Runs in the browser — `frontend/src/engine/validate-plan.ts` |
| `frontend/src/api/client.ts` | Zero importers |
| `fetch` / `axios` / `/api/` calls in `frontend/src` | None (the only `fetch` is inside `client.ts` itself) |
| Vite `/api` proxy | Configured (`API_URL`, default `http://localhost:8000`) but unused |
| React Query provider | Mounted in `main.tsx`, no queries registered |

So the frontend runs **standalone**: `npm run dev` alone gives a working app. The backend is a real,
independently runnable FastAPI service with 5 endpoints and no client — useful for API development,
`curl` and `/docs`, and for the future wiring work.

## Local Dev (without Docker)

**Frontend only** (the common case):

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

**Backend, if you are working on the API** (separate terminal):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check: `curl http://localhost:8000/api/health` → `{"status":"ok"}`.
OpenAPI docs: http://localhost:8000/docs.

Endpoints: `GET /api/health`, `GET /api/vessels/{id}`, `GET /api/plans/demo`,
`POST /api/validate`, `POST /api/stowage/solve`. State is in-memory (`_VESSELS` in `api/routes.py`) —
restarting resets it.

If you do run both, Vite proxies `/api` → `API_URL` (see `frontend/vite.config.ts`) — but nothing in
the app exercises it.

## Docker Compose

```bash
docker compose up --build     # api :8000, web :5173
docker compose logs -f api
docker compose down
```

| Service | Image base | Port | Hot reload | Notes |
|---|---|---|---|---|
| `api` | `python:3.11-slim` | 8000 | mounts `./backend/app` + `uvicorn --reload` | standalone; nothing calls it |
| `web` | `node:20-alpine` | 5173 | mounts `./frontend/src` (Vite HMR) | runs `npm run dev`, **not** a production build; `API_URL=http://api:8000` |

Rebuild after changing `requirements.txt` or `package.json`.
Postgres service is commented out in `docker-compose.yml` (phase 2).

## Configuration

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `API_URL` | Vite dev server proxy | `http://localhost:8000` | Backend target for `/api` (proxied, currently unused) |

Backend has no env config yet. CORS origin is hardcoded to `http://localhost:5173` in
`backend/app/main.py` — change it if serving the frontend from another origin.
State is in-memory (`_VESSELS` in `api/routes.py`); restarting the API resets it.

## Tests & Checks

```bash
cd frontend && npm test          # vitest run — 75 files / 586 tests, all passing
cd frontend && npm run typecheck # tsc --noEmit
cd frontend && npm run build     # typecheck + vite build -> frontend/dist
```

> **`npm test` exits non-zero (exit 1) even when the app is fine.** Vitest's default `include` also
> picks up ClaudeKit's `.claude/**/*.test.cjs` suites (`30 failed | 75 passed (105)` files) because
> `frontend/vite.config.ts` has no `test` block. All 30 failures are under `.claude/`; the app suite
> under `src/**` is 75 files / 586 tests green. Do not treat that exit code as a build failure.

There is **no backend test suite**. `pytest` and `httpx` are declared in `backend/requirements.txt`,
but `backend/tests/` does not exist — `cd backend && pytest` collects nothing.

There is **no CI** (`.github/` does not exist) and **no eslint/prettier config** anywhere in the repo,
so all three commands above are run manually. Tests are pure-unit only: vitest runs with
`environment: 'node'` and jsdom/testing-library are deliberately not installed, so nothing
DOM-related (every pointer, drag and keyboard interaction in the editor) is machine-verified — those
rest on the manual click-through script in `plans/reports/manual-click-through-260916-phase-c.md`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ModuleNotFoundError: fastapi` | Activate `.venv`, re-run `pip install -r requirements.txt` |
| Port 8000/5173 in use | `lsof -ti :8000 \| xargs kill` or `docker compose down` |
| Frontend shows no plan | Nothing to fix — this is **not** an API symptom. The plan is built in the browser; check the console for a client-side error. A 502 on `/api` is expected if the backend is down, because nothing calls it |
| CORS error when calling the API by hand | Add the origin in `backend/app/main.py` (it is hardcoded to `http://localhost:5173`) |
| `/api/stowage/solve` returns 501 | `cpsat` solver is a stub (phase 4); use `greedy-v0` |
| Backend changes have no visible effect in the app | Expected — the frontend does not call the backend (see [Wiring](#frontendbackend-wiring)) |

## Planned

From `docs/PLAN.md`; not implemented:

- **Phase 2:** PostgreSQL (vessels, voyages, plans, plan_versions) — enable `db` service in compose.
- **Phase 4:** async solver jobs (RQ/Celery) + WebSocket progress; `ortools`, `numpy` deps.
- **Later:** wiring the frontend to the API, production frontend build/serving (the `web` image runs
  `npm run dev`), env-based config (DB URL, CORS origins), CI, and a DOM test environment.

**Safety:** decision-support tool only. Plans must be verified on a class-approved loading
computer (IACS UR L5) before use.
