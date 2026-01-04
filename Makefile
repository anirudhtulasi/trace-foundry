COMPOSE_FILE=deploy/docker-compose.yml
ENV_FILE?=.env
PYTHON=python3
NODE_BIN?=pnpm
TRACE_ID?=

.PHONY: up down logs demo-load lint test export-trace

up:
	@echo "[tracefoundry] Starting docker stack"
	docker compose -f $(COMPOSE_FILE) --env-file $(ENV_FILE) up -d --build

down:
	@echo "[tracefoundry] Stopping docker stack"
	docker compose -f $(COMPOSE_FILE) --env-file $(ENV_FILE) down -v

logs:
	@echo "[tracefoundry] Tailing core service logs"
	docker compose -f $(COMPOSE_FILE) --env-file $(ENV_FILE) logs -f postgres otel-collector ingest-api trace-ui

lint:
	@echo "[tracefoundry] Lint placeholder (todo: wire ruff/mypy + eslint)"
	@echo "python lint placeholder: pass"
	@echo "node lint placeholder: run once UI exists"

test:
	@echo "[tracefoundry] Test placeholder (todo: unit/integration suites)"
	@$(PYTHON) -m pytest || echo "pytest not yet configured"
	@echo "node tests placeholder: run once packages exist"

demo-load:
	@echo "[tracefoundry] Running demo load"
	@$(PYTHON) scripts/demo_load.py

export-trace:
	@if [ -z "$(TRACE_ID)" ]; then \
		echo "TRACE_ID required, e.g. make export-trace TRACE_ID=abc"; \
		exit 1; \
	fi
	@echo "[tracefoundry] Export trace placeholder for $${TRACE_ID} (todo: call ingest API export)"
