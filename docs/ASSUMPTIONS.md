# TraceFoundry Assumptions

- Basic auth user list is stored in env var `BASIC_AUTH_USERS` with format `username:password:role` per line (comma-separated) until full auth module defined.
- Initial OTLP ingest accepts JSON payloads sent directly to the ingest API while protobuf wiring for collector may be added later.
- The deterministic demo loader posts traces straight to `/otlp` for now; wiring through the collector will follow after the ingest service stabilizes.
- Local developer environment currently lacks permission to access the Docker daemon socket (`/Users/anirudhtulasi/.docker/run/docker.sock`), so `make up`/`docker compose` cannot be validated until privileges are granted or an alternate runner is used.
- Next.js/React dependencies have been upgraded to 16.1.1 / 19.0.0 respectively; additional lint/test scripts assume modern App Router behavior.
