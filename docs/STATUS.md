# TraceFoundry Build Status

## Subsystem Assessment
- deploy/compose + collector — 🟡 partial  
  Evidence: Required layout plus Makefile + `.env.example` exist and `deploy/docker-compose.yml`, `deploy/otel-collector.yaml`, `deploy/trace-allowlist.yaml` define postgres/collector/ingest/ui stack (see `deploy/`). `make up` continues to fail locally because Docker daemon access is denied (`dial unix ...docker.sock: connect: operation not permitted` – see verification log below), so runtime verification remains blocked.
- ingest/query API — 🟡 partial  
  Evidence: `apps/ingest-api/app/main.py` implements FastAPI service with `/healthz`, `/otlp`, `/api/traces`, `/api/traces/{id}`, `/api/traces/{id}/spans`, `/api/spans/{span_id}`, and `/api/payloads/{payload_ref}` plus RBAC via `app/auth.py`. Still missing export/import, dry-replay, and advanced filtering.
- DB schema + migrations — 🟡 partial  
  Evidence: SQLAlchemy models for `traces`, `spans`, `payload_blobs`, `span_payload_refs` live in `apps/ingest-api/app/models.py` and auto-create on startup, but Alembic migrations + Postgres-specific tuning are pending.
- payload store + redaction — 🟡 partial  
  Evidence: Filesystem payload store in `app/payloads.py` writes hashed blobs under `/data/payloads`; attribute allowlist + payload ref checks implemented in `app/main.py`. Formal redaction policies and MinIO/encryption support still outstanding.
- SDKs (Python + TypeScript) — ❌ missing  
  Evidence: `packages/tracefoundry-py/` and `packages/tracefoundry-ts/` exist only as empty scaffolds; no SDK code yet.
- UI (Next.js trace explorer) — 🟡 partial  
  Evidence: `apps/trace-ui/` contains a Next.js App Router project with Dockerfile, pnpm lockfile, and server components for trace list/detail using ingest API (`lib/api.ts`). UI styling and layout were overhauled with Tailwind + shadcn-inspired components plus custom hero/filters/timeline as of 2026-01-03, and Next.js has been upgraded to `16.1.1` with React 19. Feature gaps remain around advanced filters, export/import flows, and validation against a live backend (blocked until docker compose can run).
- trace bundles (export/import) + dry replay — ❌ missing  
  Evidence: No export/import endpoints or bundle tooling implemented yet in ingest service or UI.
- demo agent + deterministic demo-load — 🟡 partial  
  Evidence: `scripts/demo_load.py` now generates ≥50 deterministic traces with seeded scenarios and posts JSON OTLP payloads to `/otlp`. Needs collector wiring + demo agent package integration.
- tests + CI — ❌ missing  
  Evidence: Make targets `lint`/`test` exist but intentionally stubbed (see `Makefile` lines 21-32). No pytest suites, JS tests, or CI workflows yet.

## Verification Log — 2026‑01‑03
- `make up` → fails immediately when docker compose tries to enumerate containers:  
  ```
  permission denied while trying to connect to the Docker daemon socket at unix:///Users/anirudhtulasi/.docker/run/docker.sock
  ```
  Result: cannot start postgres/collector/ingest/ui stack in this environment.
- `make demo-load` → deterministic loader runs but every OTLP POST raises `<urlopen error [Errno 1] Operation not permitted>`, so `{ "traces_sent": 0, "target": 50 }`. This is expected while the ingest API is offline (stack not running).
- Because the compose stack never starts, health checks (`curl http://localhost:8000/healthz`, UI at `http://localhost:3000`), collector presence, and Postgres connectivity all remain unverified today.
- Container listing (`docker ps`) was not possible for the same reason (docker socket permission denied).

## Ingest Endpoint Coverage vs PRD
- `POST /otlp` — 🟡 implemented for JSON OTLP, idempotent upsert logic present, protobuf support still pending.
- `GET /api/traces` — 🟡 implemented (basic list, limited filters); not yet validated live due to stack outage.
- `GET /api/traces/{trace_id}` — 🟡 implemented (trace summary).
- `GET /api/traces/{trace_id}/spans` — 🟡 implemented returning span list/tree data.
- `GET /api/spans/{span_id}` — 🟡 implemented.
- `GET /api/payloads/{payload_ref}` — 🟡 implemented with role gate (viewer denied).
- `POST /api/traces/{trace_id}/export` — ❌ not implemented.
- `POST /api/bundles/import` — ❌ not implemented.
- `POST /api/traces/{trace_id}/dry-replay` — ❌ not implemented.

## Storage & Payload Requirements
- Tables (`traces`, `spans`, `payload_blobs`, `span_payload_refs`) exist in models.py; Alembic migrations + indexes outstanding (🟡).
- Payload separation enforcement exists in ingest service and filesystem blob store under `/.data/payloads`, but redaction policies/minio/encryption remain TODO (🟡).

## Auth / RBAC
- Basic auth implemented for ingest API; viewer vs engineer/admin gates payload endpoint. UI currently unauthenticated (needs follow-up) (🟡).

## UI Coverage
- Trace list: renders hero, metrics, basic filter cards, and table. Missing PRD-required filters/sorting/copy interactions (🟡).
- Trace detail: has summary hero, waterfall timeline, span hierarchy, metadata cards, but lacks span attribute inspector/payload viewers/export/import actions (🟡).

## Next Actions (priority order)
1. Regain Docker daemon access (or alternative runner) so `make up` can launch the stack and allow collector/Postgres/ingest/UI validation.
2. Once services run, re-run health checks + `make demo-load`, confirm traces exist via API/UI, and document evidence.
3. Flesh out ingest API gaps: Alembic migrations, OTLP protobuf support, advanced filters/sorting, export/import/dry-replay endpoints, retention job.
4. Wire demo load through collector with `apps/demo-agent-py`, ensuring payload refs and scenario coverage.
5. Continue UI feature work (filters, span inspector, payload role gating, export/import UI).
6. Implement SDK packages, payload redaction policies, and CI/test coverage per PRD milestones.
