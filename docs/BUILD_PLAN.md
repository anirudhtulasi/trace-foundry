# TraceFoundry Build Plan Checklist

Checklist derived directly from `PRD.md`. Use as working Definition of Done per subsystem.

## deploy/compose + collector
- [ ] Maintain repo layout from PRD with `apps/`, `packages/`, `deploy/`, `scripts/`, `Makefile`.
- [ ] `deploy/docker-compose.yml` starts Postgres 16, otel-collector, ingest API, trace UI, optional MinIO.
- [ ] `deploy/otel-collector.yaml` configures OTLP receiver, batch & memory limit processors, attribute allowlist/drop, exporter to ingest API.
- [ ] Make targets: `up`, `down`, `demo-load`, `test`, `lint`, `export-trace` shell out to docker compose/cli scripts.
- [ ] `.env.example` documents all env vars consumed by compose + services.

## ingest/query API
- [ ] FastAPI service receives OTLP via `/otlp`, idempotently upserts `(trace_id, span_id)` and updates trace summaries.
- [ ] Implements payload ingestion hooks, redaction enforcement, and blob references.
- [ ] Query endpoints: `/api/traces`, `/api/traces/{trace_id}`, `/api/traces/{trace_id}/spans`, `/api/spans/{span_id}` with filters/sorting.
- [ ] Payload endpoint `/api/payloads/{payload_ref}` gated by role.
- [ ] Export/import endpoints plus `/api/traces/{trace_id}/dry-replay` with integrity validation.
- [ ] Basic auth middleware + role enforcement shared with UI/export/payload endpoints.

## DB schema + migrations
- [ ] SQLAlchemy models (or equivalent) + Alembic migrations for `traces`, `spans`, `payload_blobs`, `span_payload_refs` matching required columns/indexes.
- [ ] Configurable Postgres (default) and SQLite (cheap mode) DSNs via env.
- [ ] Retention job parameters stored and scheduled (metadata 7d, payloads 3d).
- [ ] Tests verifying schema migrations run and idempotent upserts behave as expected.

## payload store + redaction
- [ ] Filesystem payload store under `./payloads/` with content-hash filenames and metadata.
- [ ] Optional MinIO/S3 backend toggled by env.
- [ ] Redaction policies: strict/standard/off; `deploy/trace-allowlist.yaml` plus regex/pattern configs.
- [ ] Hashing + compression info captured in `payload_blobs` table; payload refs stored on spans as `tracefoundry.payload.*_ref` attributes.
- [ ] Viewer role blocked from downloading payload contents; strict export removes redacted data.

## SDKs (Python + TypeScript)
- [ ] `packages/tracefoundry-py/`: context manager/decorator `trace_agent_run`, helpers for LLM/tool spans, retries/timeouts events, payload capture that writes to payload store or ingest API.
- [ ] `packages/tracefoundry-ts/`: Next/Node middleware for propagation, wrappers for fetch-based LLM + tool gateways, payload separation enforcement.
- [ ] OTLP exporters (HTTP/proto) configurable via env; resources set `service.name`, `deployment.environment`.
- [ ] Consistent span naming/attributes/events per PRD; token/cost metrics aggregated.
- [ ] Tests verifying payload refs, hashing, redaction invocation, and span semantics.

## UI (Next.js trace explorer)
- [ ] Next.js App Router app under `apps/trace-ui/` using pnpm + lockfile.
- [ ] Trace list page: filters (time, service, env, status, model, tool substring, latency, tokens, cost, search), sorting (newest/slowest/expensive), list columns, copy trace ID.
- [ ] Trace detail page: span tree, waterfall/timeline, summary header (duration, status, tokens, cost, model, root span name), span inspector with payload refs + retry/timeout markers.
- [ ] Export/import UI flows with payload toggle & redaction mode selection; upload for bundles.
- [ ] Role-based behavior (viewer vs engineer/admin) controlling payload visibility and export options.

## trace bundles (export/import) + dry replay
- [ ] Bundle zip writer with `manifest.json`, `spans.otlp.*`, optional `payloads/`, README; includes hashes and metadata fields (git commit, env fingerprint if available).
- [ ] Importer validates hashes, loads spans/payloads, tags environment as `offline` or `source=bundle_import`.
- [ ] Dry replay endpoint reconstructs span tree, verifies payload refs, checks hash integrity, optionally replays demo agent with recorded tool outputs.
- [ ] CLI/Make target `make export-trace TRACE_ID=...` hitting export endpoint and saving bundle.

## demo agent + deterministic demo-load
- [ ] `apps/demo-agent-py/` implements seeded agent with scenarios (slow tool, retry storm, LLM error, timeout) emitting spans via Python SDK.
- [ ] `scripts/demo_load.py` (or uv/poetry task) sends ≥50 traces deterministically through collector when `make demo-load` runs.
- [ ] Demo agent includes dry-replay metadata/hints for recorded tool outputs.

## tests + CI
- [ ] Python + Node unit tests covering SDK behavior, payload hashing, redaction, RBAC enforcement.
- [ ] Integration tests for ingest/query, UI data rendering, export/import roundtrip, retention cleanup, payload secrecy checks.
- [ ] GitHub Actions workflow running lint (`ruff/mypy` + `eslint/tsc`), unit, integration (docker-compose) per PRD.
- [ ] Security tests verifying secrets absent from DB + strict export, viewer role denied payload endpoints.
