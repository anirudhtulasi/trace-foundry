# PRD — TraceFoundry: Agentic Traceability Stack (OpenTelemetry GenAI Tracing + Self-Hosted Collector + Trace Explorer UI)

## 1. Overview
TraceFoundry provides an end-to-end, self-hosted tracing system for GenAI/agentic applications:
- SDKs for Python and TypeScript to emit OpenTelemetry traces for agent runs (LLM calls, tool calls, retries, token usage, cost estimates).
- A self-hosted OpenTelemetry Collector to receive OTLP data.
- An ingest/query API to store, index, and serve trace data.
- A trace explorer UI to search and inspect traces and spans.
- Trace bundle export/import to support offline review and deterministic incident reproduction.
- A deterministic load generator to create a stable demo dataset.

This PRD defines the product requirements needed to build the system.

---

## 2. Goals
1. Capture full span trees for agent runs: request → agent steps → tool calls → LLM calls → response.
2. Provide searchable trace storage and a UI for debugging regressions (latency, errors, retries, prompt bloat, token/cost changes).
3. Store sensitive/bulky payloads (prompts, tool args/results) as separate payload blobs with references from spans.
4. Export/import trace bundles for incident review and offline inspection.
5. Run locally with a single command using docker-compose; include deterministic demo-load.

---

## 3. Non-Goals (v1)
- Full feature parity with enterprise tracing products (Tempo/Jaeger/SigNoz).
- Full production-grade auth (OIDC/SAML). Provide a minimal local auth + role model.
- Full “execute replay” against real external tools. v1 ships “dry replay” integrity checks and local replay against recorded outputs for demo agent.

---

## 4. Target Users & Core Workflows

### 4.1 Platform / Infra Engineer
- Filter traces by error/latency/cost, identify bottlenecks (slow tool calls, retry storms, large prompts), export trace bundle for incident review.

### 4.2 Applied AI Engineer
- Run eval or local test with tracing enabled, inspect failing traces, confirm improvements after changes.

---

## 5. Functional Requirements

### 5.1 Instrumentation SDKs
#### 5.1.1 Python SDK (tracefoundry-py)
Must:
- Provide a simple API to wrap an agent run:
  - Context manager or decorator: `trace_agent_run(...)`
- Instrument:
  - Root span: agent invocation.
  - LLM calls: request/response metadata, token usage (if available), cost estimate.
  - Tool calls: tool name, duration, retries, error codes.
  - Retries/timeouts: explicit events and attributes.
- Support exporting via OTLP (HTTP/protobuf preferred) to Collector.
- Enforce payload separation:
  - Prompts/tool args/tool results must not be stored directly in span attributes.
  - SDK must write payload blobs to payload store (filesystem in cheap mode) OR send payloads to ingest API (configurable).
  - Spans store only payload references/hashes + safe summaries.

#### 5.1.2 TypeScript SDK (tracefoundry-ts)
Must:
- Provide middleware for Node/Next services:
  - request span creation
  - propagation of trace context
- Provide helper wrappers for:
  - LLM clients (fetch-based)
  - tool gateways (HTTP, MCP gateway if used)
- Same payload separation guarantees as Python SDK.

#### 5.1.3 Span Semantics and Required Fields
Must:
- Use consistent span naming conventions:
  - Root: `invoke_agent` (plus agent name attribute)
  - LLM: `llm.chat` (or `llm.completion`)
  - Tool: `tool.execute`
- Required span attributes (minimum):
  - `service.name` (resource)
  - `deployment.environment` (resource)
  - `gen_ai.provider.name`
  - `gen_ai.request.model`
  - `gen_ai.operation.name` (for LLM/tool spans)
  - `gen_ai.usage.input_tokens` and `gen_ai.usage.output_tokens` where available
  - `tracefoundry.cost.usd_estimate` where possible
  - `tracefoundry.payload.*_ref` for any stored payloads
  - `tracefoundry.tool.name` for tool spans
- Required events:
  - `retry` event with attempt count and reason
  - `timeout` event with timeout value
  - `redaction_applied` event with policy id (if payload was redacted)

---

### 5.2 OpenTelemetry Collector
Must:
- Run in docker-compose with a provided `otel-collector.yaml`.
- Receive OTLP from SDKs.
- Apply processors:
  - batch
  - memory limiter
  - attribute normalization (optional)
  - allowlist/drop rules for attributes (security)
- Export to ingest API via OTLP/HTTP OR a collector exporter that posts to ingest endpoint.

---

### 5.3 Ingest + Query API (FastAPI)
Must:
- Accept OTLP span batches from Collector.
- Normalize OTLP into storage tables.
- Support idempotent ingest:
  - Upsert by `(trace_id, span_id)` so repeated batches do not duplicate.
- Maintain trace summaries:
  - duration, error flags, token totals, estimated cost, root span name, start time.
- Support payload storage:
  - Store payload blobs in object store (filesystem in cheap mode).
  - Store references in DB.
  - Enforce redaction/masking before persisting payloads.
- Provide query endpoints for UI:
  - trace list with filters
  - trace detail and span detail
- Provide export/import endpoints:
  - export as bundle zip
  - import bundle into local DB
- Provide “dry replay” endpoint:
  - verifies integrity of bundle/manifests/hashes
  - reconstructs dependency graph of payload refs
  - (optional) replays demo agent using recorded tool outputs only

---

### 5.4 Storage
#### 5.4.1 Databases
- Default (MVP): Postgres
- Cheap mode: SQLite
- Configuration must allow switching by env var.

#### 5.4.2 Data Model (Logical)
Tables (names may vary but must support the fields):

1) `traces`
- `trace_id` (PK)
- `service_name`
- `environment`
- `started_at` (timestamp)
- `duration_ms`
- `root_span_name`
- `status_code` (ok/error)
- `error_type` (nullable)
- `model` (nullable)
- `token_in` (nullable)
- `token_out` (nullable)
- `cost_usd_estimate` (nullable)
- `span_count`

2) `spans`
- `trace_id` (indexed)
- `span_id` (PK or unique with trace_id)
- `parent_span_id` (nullable)
- `name`
- `kind`
- `start_time`, `end_time`, `duration_ms`
- `status_code`, `error_type` (nullable)
- `attributes` (JSON)
- `events` (JSON)
- `resource` (JSON)

3) `payload_blobs`
- `payload_ref` (PK, content hash)
- `content_type`
- `compression` (none|gzip|zstd)
- `byte_length`
- `storage_path` (or object store key)
- `created_at`

4) `span_payload_refs`
- `trace_id`, `span_id`
- `payload_ref`
- `payload_role` (enum: prompt|completion|tool_args|tool_result|retrieved_docs|system_prompt|other)

Indexes:
- traces: `(service_name, started_at desc)`, `(environment)`, `(status_code)`, `(model)`, `(duration_ms)`
- spans: `(trace_id)`, `(name)`, optional JSON indexes for allowlisted attributes

---

### 5.5 Payload Store
Must:
- Cheap mode: local filesystem `./payloads/` with content-hash filenames.
- Optional: MinIO in docker-compose.
- Support encryption-at-rest as optional config (v1 can be “off by default”).
- Payloads must be redacted per configured policy before storage.

---

### 5.6 Trace Explorer UI (Next.js)
Must include:

#### 5.6.1 Trace List Page
- Filters:
  - time range
  - service, environment
  - status (error only)
  - model
  - tool name (contains)
  - latency range
  - token range
  - cost range
  - free-text query (matches trace_id, span name, allowlisted attributes)
- Sort:
  - newest
  - slowest
  - most expensive
- List columns:
  - started_at
  - service/env
  - duration
  - status
  - model
  - token totals
  - cost estimate
  - trace_id (copy)

#### 5.6.2 Trace Detail Page
- Span tree (collapsible)
- Timeline/waterfall visualization (simple)
- Summary header:
  - duration, status, token totals, cost, model, root span name
- Selecting a span shows:
  - attributes/events (with special formatting for gen_ai fields)
  - payload refs with “view payload” (role-based)
  - retry/timeout markers

#### 5.6.3 Export/Import
- Export trace bundle button:
  - options: include_payloads (toggle), redaction_mode (strict|standard|off)
- Import trace bundle:
  - upload zip
  - shows imported trace_id and link

#### 5.6.4 Role-based UI behavior
- viewer: can view span metadata but cannot download payloads
- engineer/admin: can include payloads in export and view payload contents

---

### 5.7 Trace Bundle Format (Export/Import)
Bundle is a zip:
- `manifest.json`
  - `trace_id`
  - `created_at`
  - `app` (service/env)
  - `schema_version`
  - `git_commit` (optional, if provided by SDK)
  - `env_fingerprint` (optional, if provided)
  - `redaction_policy_id`
  - `sha256_tree` (hash map of included files)
- `spans.otlp.json` OR `spans.otlp.pb`
- `payloads/` (optional) — content-hash filenames
- `README.txt` (optional) — human instructions
Optional (v2): `SIGNATURE` file.

Import must:
- Validate hashes from manifest
- Load spans and payload metadata
- Store payload files if included
- Mark traces as `environment=offline` or `source=bundle_import`

---

### 5.8 Deterministic Demo Load Generator
Must:
- Produce a stable dataset with seeded randomness:
  - fixed number of traces (e.g., 50)
  - includes exemplars: slow tool call, retry storm, LLM error, timeout
- Commands:
  - `make demo-load` generates traces via demo agent and sends OTLP to Collector
- Must be deterministic across machines when run in docker-compose.

---

## 6. Non-Functional Requirements

### 6.1 Performance Targets (Local)
- UI trace list query: <= 500ms for last 1,000 traces
- Trace detail render: <= 1s for traces up to 1,000 spans
- Ingest throughput: >= 2,000 spans/sec locally
- Added overhead in instrumented demo agent:
  - p95 additional latency <= 10ms at 50 RPS local (best effort)

### 6.2 Reliability
- Collector must buffer and retry exports with bounded queues.
- Ingest must be idempotent.
- Export must be deterministic given DB state.

### 6.3 Portability / Reproducibility
- `docker compose up` starts the full stack
- Provide `Makefile` commands:
  - `make up`, `make down`, `make demo-load`, `make test`, `make lint`, `make export-trace TRACE_ID=...`

---

## 7. Security & Privacy Requirements

### 7.1 Attribute Allowlisting
- Collector and/or ingest must drop unknown high-risk attributes by default.
- Explicit allowlist config file: `trace-allowlist.yaml`.

### 7.2 Payload Redaction
Must support redaction policies:
- strict: mask all secrets + emails + high-entropy strings + configured patterns
- standard: mask configured secrets and token-like strings
- off: no masking (allowed only for local dev)
Redaction must occur before payload storage and before bundle export (depending on export mode).

### 7.3 Access Control (MVP)
- Basic auth for UI and API (local only).
- Roles: viewer, engineer, admin
- Enforce:
  - payload content access restricted to engineer/admin
  - export with payloads restricted to engineer/admin
  - retention/policy changes restricted to admin

### 7.4 Retention
- Configurable retention for:
  - trace metadata
  - payload blobs
Defaults:
- metadata: 7 days
- payloads: 3 days
Implement as a scheduled cleanup job in ingest service (cron-like loop).

---

## 8. Tech Stack

### 8.1 Services
- Ingest/Query API: Python 3.11+, FastAPI, Uvicorn
- DB: Postgres 16+ (default), SQLite (cheap mode)
- UI: Next.js (App Router), TypeScript
- Collector: OpenTelemetry Collector (official container)
- Optional payload store: MinIO (S3-compatible)

### 8.2 Libraries
- OpenTelemetry SDK for Python and JS/TS
- OTLP exporter (HTTP/protobuf)
- DB ORM: SQLAlchemy (Python) OR equivalent (must support Postgres + SQLite)
- Migrations: Alembic (if SQLAlchemy) or equivalent

### 8.3 Packaging / Tooling
- Python: uv or poetry, pinned lockfile
- Node: pnpm, lockfile
- Docker Compose for local deployment
- GitHub Actions CI

---

## 9. API Specification (MVP)

### 9.1 Ingest
1) `POST /otlp`
- Content-Type: `application/x-protobuf` or JSON OTLP
- Auth: internal network only (compose)
- Behavior:
  - parse OTLP
  - upsert spans
  - update trace summary

### 9.2 Query
2) `GET /api/traces`
Query params:
- `service`, `env`, `status`, `model`, `tool`, `q`
- `min_latency_ms`, `max_latency_ms`
- `min_tokens`, `max_tokens`
- `min_cost`, `max_cost`
- `start_time`, `end_time`
- `limit`, `offset`
Response:
- list of trace summaries (fields in traces table)

3) `GET /api/traces/{trace_id}`
Response:
- trace summary + derived fields (span_count, root span id)

4) `GET /api/traces/{trace_id}/spans`
Response:
- spans list with parent relations (for tree rendering)

5) `GET /api/spans/{span_id}`
Response:
- span detail (attributes/events/resource) + payload refs

### 9.3 Payload Access
6) `GET /api/payloads/{payload_ref}`
- Role required: engineer/admin
- Response: payload bytes (or JSON) with content-type

### 9.4 Export/Import
7) `POST /api/traces/{trace_id}/export`
Body:
- `include_payloads: bool`
- `redaction_mode: strict|standard|off`
Response:
- bundle zip stream

8) `POST /api/bundles/import`
- multipart upload zip
Response:
- `{ trace_id: string }`

### 9.5 Dry Replay / Integrity
9) `POST /api/traces/{trace_id}/dry-replay`
Response:
- integrity report:
  - hashes validated
  - missing payload refs
  - reconstructable span tree true/false

---

## 10. Configuration

### 10.1 Environment Variables (examples)
- `TRACEFOUNDRY_ENV=local`
- `DB_URL=postgresql+psycopg://...` or `sqlite:///...`
- `PAYLOAD_STORE=filesystem|minio`
- `PAYLOAD_DIR=./payloads`
- `MINIO_ENDPOINT=...`
- `AUTH_MODE=basic`
- `BASIC_AUTH_USERS=...` (or mounted secrets)
- `RETENTION_TRACES_DAYS=7`
- `RETENTION_PAYLOADS_DAYS=3`
- `ATTRIBUTE_ALLOWLIST_PATH=./deploy/trace-allowlist.yaml`

### 10.2 Collector Config
- `deploy/otel-collector.yaml` must define receivers, processors, exporters.

---

## 11. Deployment & Local Developer Experience

### 11.1 docker-compose services
- `otel-collector`
- `postgres` (or omit for sqlite mode)
- `ingest-api`
- `trace-ui`
- optional: `minio`

### 11.2 Makefile commands
- `make up` → `docker compose up -d --build`
- `make down` → `docker compose down -v`
- `make demo-load` → run deterministic generator
- `make export-trace TRACE_ID=...`
- `make test` (python + node)
- `make lint` (python + node)

---

## 12. Testing Requirements

### 12.1 Unit Tests
- SDK span creation correctness
- payload ref generation and hashing
- redaction functions and policies

### 12.2 Integration Tests
- ingest OTLP end-to-end (SDK → collector → ingest → DB)
- UI queries return correct data and span tree structure
- export/import bundle roundtrip
- retention cleanup job

### 12.3 Security Tests
- verify secrets never appear in DB span attributes/events (scan test)
- verify strict export contains no secrets
- verify viewer role cannot access payload endpoints

---

## 13. Acceptance Criteria (Definition of Done)
1. `docker compose up` brings up collector, ingest-api, UI, and storage.
2. `make demo-load` creates ≥ 50 traces visible in UI.
3. Trace list supports filtering by status, latency, model, tool name.
4. Trace detail shows span tree and span detail with gen_ai fields and payload refs.
5. Export bundle for a trace produces a zip with manifest + spans, optionally payloads.
6. Importing the bundle into a clean DB recreates the trace view in UI.
7. Viewer role cannot download payloads; engineer/admin can.
8. Redaction in strict mode prevents configured secrets from appearing in payload store and exports.

---

## 14. Milestones (Solo Build Plan)
- M1: Compose + ingest skeleton + Postgres schema + basic UI list (trace_id, duration, status)
- M2: Python SDK emits spans + demo-load generator
- M3: Trace detail page with span tree + span detail
- M4: Payload store + redaction + RBAC
- M5: Export/import bundles + dry replay integrity checks
- M6: CI with unit + integration + security scans

---

## 15. Repository Layout (Required)
tracefoundry/
  apps/
    ingest-api/
    trace-ui/
    demo-agent-py/
  packages/
    tracefoundry-py/
    tracefoundry-ts/
    tracefoundry-schema/
  deploy/
    docker-compose.yml
    otel-collector.yaml
    trace-allowlist.yaml
    postgres/
  scripts/
    demo_load.py
  Makefile
  README.md


