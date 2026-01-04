# TraceFoundry Assumptions

- Basic auth user list is stored in env var `BASIC_AUTH_USERS` with format `username:password:role` per line (comma-separated) until full auth module defined.
- Initial OTLP ingest accepts JSON payloads sent directly to the ingest API while protobuf wiring for collector may be added later.
- The deterministic demo loader posts traces straight to `/otlp` for now; wiring through the collector will follow after the ingest service stabilizes.
- Next.js remains pinned to `14.2.5` even though the CLI recommends a security upgrade; `pnpm up next@15.1.6` currently fails in this workspace because pnpm refuses to reuse the existing global store path without a full reinstall (blocked offline).
