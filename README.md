# TraceFoundry

End-to-end GenAI/agent tracing stack scaffolded from `PRD.md`. This repo now includes docker-compose services, a FastAPI ingest/query API, a Next.js trace explorer UI, and a deterministic demo load generator.

## Prerequisites
- Docker + Docker Compose (v2)
- Python 3.11+
- Node.js 20+ with pnpm (Corepack-enabled)

## Quickstart
1. Copy environment template and adjust as needed:
   ```bash
   cp .env.example .env
   ```
2. Start the stack (Postgres, otel-collector, ingest API, trace UI):
   ```bash
   make up
   ```
3. In a separate terminal, seed deterministic traces:
   ```bash
   make demo-load
   ```
4. Open the UI at http://localhost:3000 (basic auth defaults are defined in `.env`). The ingest API listens on http://localhost:8000. When running inside docker-compose the UI talks to the backend via `http://ingest-api:8000`; if you run the Next.js app outside of containers, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
5. When finished:
   ```bash
   make down
   ```

## Developer Commands
- `make up` / `make down` – manage docker-compose stack defined in `deploy/docker-compose.yml`.
- `make logs` – tail logs for postgres, collector, ingest API, and UI containers.
- `make demo-load` – runs `scripts/demo_load.py`, which generates ≥50 seeded traces that post JSON OTLP payloads to `/otlp`.
- `make lint` / `make test` – stubbed placeholders until Python/Node lint + test harnesses are wired. (Documented in `docs/STATUS.md`).
- `make export-trace TRACE_ID=...` – placeholder for bundle export endpoint once implemented.

## Services
- **Ingest API (FastAPI)** – `apps/ingest-api`, exposes `/healthz`, `/otlp`, `/api/traces`, `/api/traces/{trace_id}`, `/api/traces/{trace_id}/spans`, `/api/spans/{span_id}`, and `/api/payloads/{payload_ref}` with basic auth roles (viewer/engineer/admin).
- **Trace UI (Next.js)** – `apps/trace-ui`, consumes ingest query endpoints for trace list + detail views.
- **OpenTelemetry Collector** – `deploy/otel-collector.yaml`, receives OTLP/HTTP on `4318` and forwards to ingest API.
- **Postgres** – persistent metadata store mounted via `postgres-data` volume; payload blobs stored on host `.data/payloads`.

## Demo Data
`scripts/demo_load.py` produces five deterministic scenarios (slow tool, retry storm, LLM error, timeout, normal) so trace examples cover key incident types. The script currently posts directly to `/otlp`; routing via collector will be added after collector → ingest OTLP handshake is validated.

## Project Status
See `docs/BUILD_PLAN.md` for current Definition of Done checklist and `docs/STATUS.md` for subsystem progress + next actions.
