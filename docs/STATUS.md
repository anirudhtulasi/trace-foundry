# TraceFoundry Build Status

## Subsystem Assessment
- deploy/compose + collector — 🟡 partial  
  Evidence: Required layout plus Makefile + `.env.example` exist and `deploy/docker-compose.yml`, `deploy/otel-collector.yaml`, `deploy/trace-allowlist.yaml` define postgres/collector/ingest/ui stack (see `deploy/`). `make up` now invokes docker compose but fails locally because Docker daemon is unavailable in this environment (`permission denied while trying to connect to the Docker daemon socket`), so runtime verification is blocked.
- ingest/query API — 🟡 partial  
  Evidence: `apps/ingest-api/app/main.py` implements FastAPI service with `/healthz`, `/otlp`, `/api/traces`, `/api/traces/{id}`, `/api/traces/{id}/spans`, `/api/spans/{span_id}`, and `/api/payloads/{payload_ref}` plus RBAC via `app/auth.py`. Still missing export/import, dry-replay, and advanced filtering.
- DB schema + migrations — 🟡 partial  
  Evidence: SQLAlchemy models for `traces`, `spans`, `payload_blobs`, `span_payload_refs` live in `apps/ingest-api/app/models.py` and auto-create on startup, but Alembic migrations + Postgres-specific tuning are pending.
- payload store + redaction — 🟡 partial  
  Evidence: Filesystem payload store in `app/payloads.py` writes hashed blobs under `/data/payloads`; attribute allowlist + payload ref checks implemented in `app/main.py`. Formal redaction policies and MinIO/encryption support still outstanding.
- SDKs (Python + TypeScript) — ❌ missing  
  Evidence: `packages/tracefoundry-py/` and `packages/tracefoundry-ts/` exist only as empty scaffolds; no SDK code yet.
- UI (Next.js trace explorer) — 🟡 partial  
  Evidence: `apps/trace-ui/` contains a Next.js App Router project with Dockerfile, pnpm lockfile, and server components for trace list/detail using ingest API (`lib/api.ts`). UI styling was upgraded with Tailwind + shadcn-inspired components and a custom offline Tailwind PostCSS plugin (`tailwind.offline.postcss.js`); `pnpm build` now succeeds. Filters/sorting/export/import flows and live validation against the running stack are still pending.
- trace bundles (export/import) + dry replay — ❌ missing  
  Evidence: No export/import endpoints or bundle tooling implemented yet in ingest service or UI.
- demo agent + deterministic demo-load — 🟡 partial  
  Evidence: `scripts/demo_load.py` now generates ≥50 deterministic traces with seeded scenarios and posts JSON OTLP payloads to `/otlp`. Needs collector wiring + demo agent package integration.
- tests + CI — ❌ missing  
  Evidence: Make targets `lint`/`test` exist but intentionally stubbed (see `Makefile` lines 21-32). No pytest suites, JS tests, or CI workflows yet.

## Next Actions (priority order)
1. Enable a runnable local stack: resolve Docker daemon access or provide documented workaround (e.g., devcontainer) so `make up` brings up Postgres/collector/ingest/UI; confirm via logs.
2. Flesh out ingest API: add Alembic migrations, OTLP protobuf support, query filters/sorting, export/import bundle endpoints, dry-replay integrity checks, and scheduled retention jobs.
3. Wire demo load through collector + add `apps/demo-agent-py` behaviors so traces flow end-to-end; update `make demo-load` output verification.
4. Expand Next.js UI with filters/sorting, payload visibility per role, export/import flows, and status indicators using real data from ingest service.
5. Start SDK implementations in `packages/tracefoundry-py` and `packages/tracefoundry-ts`, ensuring payload separation + OTLP exporters, and add unit tests for hashing/redaction semantics.
6. Implement payload redaction policies + optional MinIO storage backend per PRD, then add integration/system tests plus CI workflows covering lint/test suites.
