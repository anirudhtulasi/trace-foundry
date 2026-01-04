#!/usr/bin/env python3
"""Deterministic demo load generator.

Generates trace payloads and posts them to the ingest API `/otlp` endpoint using
basic auth credentials. Designed as a placeholder vertical slice until the
collector wiring is fully fleshed out.
"""
from __future__ import annotations

import base64
import json
import os
import random
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List
from urllib import request

TRACE_COUNT = int(os.environ.get("TRACE_COUNT", "50"))
INGEST_URL = os.environ.get("INGEST_OTLP_URL", "http://localhost:8000/otlp")
BASIC_AUTH = os.environ.get("DEMO_LOAD_AUTH", "engineer:engineer")


def main() -> None:
    random.seed(20240523)
    base_time = datetime.now(tz=timezone.utc) - timedelta(minutes=5)
    successes = 0
    for index in range(TRACE_COUNT):
        trace_id = uuid.uuid4().hex
        service_name = f"demo-agent-{index % 3}"
        scenario = _choose_scenario(index)
        spans = _build_spans(trace_id, base_time, index, scenario)
        batch = {
            "resource_spans": [
                {
                    "resource": {
                        "attributes": [
                            {"key": "service.name", "value": {"string_value": service_name}},
                            {"key": "deployment.environment", "value": {"string_value": "demo"}},
                        ]
                    },
                    "scope_spans": [
                        {
                            "spans": spans,
                        }
                    ],
                }
            ]
        }
        if _post(batch):
            successes += 1
        time.sleep(0.01)
    print(json.dumps({"traces_sent": successes, "target": TRACE_COUNT}))


def _choose_scenario(index: int) -> str:
    scenarios = ["slow_tool", "retry_storm", "llm_error", "timeout", "normal"]
    return scenarios[index % len(scenarios)]


def _build_spans(trace_id: str, base_time: datetime, index: int, scenario: str) -> List[Dict[str, Any]]:
    start = base_time + timedelta(seconds=index * 2)
    root_span_id = uuid.uuid4().hex[:16]
    root_duration = 1.5 + (index % 5) * 0.5
    status = {"code": "STATUS_CODE_OK"}
    events: List[Dict[str, Any]] = []
    if scenario == "llm_error":
        status = {"code": "STATUS_CODE_ERROR", "message": "llm_error"}
    elif scenario == "timeout":
        events.append(
            {
                "name": "timeout",
                "time_unix_nano": _to_unix_nano(start + timedelta(milliseconds=800)),
                "attributes": [
                    {"key": "timeout_ms", "value": {"int_value": 1000}},
                ],
            }
        )
    elif scenario == "retry_storm":
        events.append(
            {
                "name": "retry",
                "time_unix_nano": _to_unix_nano(start + timedelta(milliseconds=400)),
                "attributes": [
                    {"key": "attempt", "value": {"int_value": 2}},
                    {"key": "reason", "value": {"string_value": "throttled"}},
                ],
            }
        )
    model = "gpt-4o-mini"
    prompt = f"Scenario {scenario} prompt {index}"
    completion = f"Response for {scenario}"
    tokens_in = 200 + index
    tokens_out = 180 + index // 2
    cost = round((tokens_in + tokens_out) / 1_000_000, 4)
    spans = [
        {
            "trace_id": trace_id,
            "span_id": root_span_id,
            "name": "invoke_agent",
            "kind": "SPAN_KIND_INTERNAL",
            "parent_span_id": "",
            "start_time_unix_nano": _to_unix_nano(start),
            "end_time_unix_nano": _to_unix_nano(start + timedelta(seconds=root_duration)),
            "attributes": [
                {"key": "gen_ai.request.model", "value": {"string_value": model}},
                {"key": "gen_ai.usage.input_tokens", "value": {"int_value": tokens_in}},
                {"key": "gen_ai.usage.output_tokens", "value": {"int_value": tokens_out}},
                {"key": "tracefoundry.cost.usd_estimate", "value": {"double_value": cost}},
            ],
            "events": events,
            "status": status,
            "tracefoundry_payloads": [
                {
                    "role": "prompt",
                    "content_type": "text/plain",
                    "data": prompt,
                },
                {
                    "role": "completion",
                    "content_type": "text/plain",
                    "data": completion,
                },
            ],
        }
    ]
    spans.extend(_tool_spans(trace_id, root_span_id, start, scenario))
    return spans


def _tool_spans(trace_id: str, parent_id: str, start: datetime, scenario: str) -> List[Dict[str, Any]]:
    spans: List[Dict[str, Any]] = []
    for idx in range(2):
        child_id = uuid.uuid4().hex[:16]
        delay = idx * 0.3
        duration = 0.4 + idx * 0.1
        if scenario == "slow_tool" and idx == 1:
            duration = 2.0
        status = {"code": "STATUS_CODE_OK"}
        if scenario == "retry_storm" and idx == 0:
            status = {"code": "STATUS_CODE_ERROR", "message": "tool timeout"}
        spans.append(
            {
                "trace_id": trace_id,
                "span_id": child_id,
                "parent_span_id": parent_id,
                "name": "tool.execute",
                "kind": "SPAN_KIND_INTERNAL",
                "start_time_unix_nano": _to_unix_nano(start + timedelta(seconds=delay)),
                "end_time_unix_nano": _to_unix_nano(start + timedelta(seconds=delay + duration)),
                "attributes": [
                    {
                        "key": "tracefoundry.tool.name",
                        "value": {"string_value": f"tool-{idx}"},
                    }
                ],
                "status": status,
                "tracefoundry_payloads": [
                    {
                        "role": "tool_args",
                        "content_type": "application/json",
                        "data": json.dumps({"input": idx}),
                    },
                    {
                        "role": "tool_result",
                        "content_type": "application/json",
                        "data": json.dumps({"output": idx * 2}),
                    },
                ],
            }
        )
    return spans


def _post(batch: Dict[str, Any]) -> bool:
    data = json.dumps(batch).encode("utf-8")
    username, password = BASIC_AUTH.split(":", 1)
    auth_header = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
    req = request.Request(
        INGEST_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Basic {auth_header}",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=10) as resp:
            resp.read()
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"demo_load error: {exc}", file=sys.stderr)
        return False


def _to_unix_nano(ts: datetime) -> int:
    return int(ts.timestamp() * 1_000_000_000)


if __name__ == "__main__":
    main()
