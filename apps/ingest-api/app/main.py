"""FastAPI application entrypoint."""
from __future__ import annotations

import base64
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Dict, Iterable, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Response, status
from sqlalchemy.orm import Session

from . import schemas
from .auth import BasicUser, get_current_user, require_roles
from .config import get_settings
from .db import Base, engine, get_db
from .models import PayloadBlob, Span, SpanPayloadRef, Trace
from .payloads import load_payload, store_payload

settings = get_settings()
app = FastAPI(title="TraceFoundry Ingest API", version="0.1.0")


@app.on_event("startup")
def _startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/healthz", response_model=schemas.HealthResponse)
def healthz() -> schemas.HealthResponse:
    return schemas.HealthResponse(ok=True)


@app.post("/otlp")
def ingest_otlp(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    user: BasicUser = Depends(get_current_user),
) -> Dict[str, Any]:
    resource_spans = payload.get("resource_spans", [])
    ingested = 0
    for resource_span in resource_spans:
        resource = _attributes_to_dict(resource_span.get("resource", {}).get("attributes"))
        service_name = resource.get("service.name", "demo-agent")
        environment = resource.get("deployment.environment", settings.tracefoundry_env)
        scope_spans = resource_span.get("scope_spans", [])
        for scope in scope_spans:
            for span in scope.get("spans", []):
                trace_id = span.get("trace_id")
                span_id = span.get("span_id")
                if not trace_id or not span_id:
                    continue
                start_time = _parse_time(span.get("start_time_unix_nano"))
                end_time = _parse_time(span.get("end_time_unix_nano"))
                duration_ms = _duration_ms(start_time, end_time)
                attributes = _attributes_to_dict(span.get("attributes"))
                safe_attributes = _allowlist_attributes(attributes)
                events = _normalize_events(span.get("events"))
                resource_data = resource
                status_code = (span.get("status") or {}).get("code")
                error_type = (span.get("status") or {}).get("message")

                trace = db.query(Trace).filter(Trace.trace_id == trace_id).one_or_none()
                is_new_trace = trace is None
                if trace is None:
                    trace = Trace(trace_id=trace_id)
                    db.add(trace)
                    db.flush()
                trace.service_name = service_name
                trace.environment = environment

                span_obj = db.query(Span).filter(Span.span_id == span_id).one_or_none()
                is_new_span = span_obj is None
                if span_obj is None:
                    span_obj = Span(trace_id=trace_id, span_id=span_id)
                span_obj.parent_span_id = span.get("parent_span_id") or None
                span_obj.name = span.get("name", "span")
                span_obj.kind = span.get("kind")
                span_obj.start_time = _to_naive_utc(start_time)
                span_obj.end_time = _to_naive_utc(end_time)
                span_obj.duration_ms = duration_ms
                span_obj.status_code = status_code
                span_obj.error_type = error_type
                span_obj.attributes = safe_attributes
                span_obj.events = events
                span_obj.resource = resource_data
                db.add(span_obj)
                if is_new_span:
                    trace.span_count = (trace.span_count or 0) + 1
                if span_obj.parent_span_id in (None, ""):
                    trace.root_span_name = span_obj.name
                prior_start = trace.started_at
                trace.started_at = min_with_default(trace.started_at, start_time)
                reference_start = trace.started_at or prior_start or _to_naive_utc(start_time)
                if reference_start and end_time:
                    duration = (_to_naive_utc(end_time) - reference_start).total_seconds() * 1000
                    trace.duration_ms = max(trace.duration_ms or 0, duration)
                trace.status_code = _choose_status(trace.status_code, status_code)
                if safe_attributes.get("gen_ai.request.model"):
                    trace.model = safe_attributes["gen_ai.request.model"]
                trace.token_in = _sum_optional(trace.token_in, safe_attributes.get("gen_ai.usage.input_tokens"))
                trace.token_out = _sum_optional(trace.token_out, safe_attributes.get("gen_ai.usage.output_tokens"))
                trace.cost_usd_estimate = _sum_optional(trace.cost_usd_estimate, safe_attributes.get("tracefoundry.cost.usd_estimate"))

                for payload_entry in span.get("tracefoundry_payloads", []) or []:
                    _persist_payload(db, trace_id, span_obj.span_id, payload_entry)
                ingested += 1
    db.commit()
    return {"ingested_spans": ingested}


@app.get("/api/traces", response_model=List[schemas.TraceSummary])
def list_traces(
    limit: int = 50,
    offset: int = 0,
    service: Optional[str] = None,
    env: Optional[str] = None,
    status: Optional[str] = None,
    model: Optional[str] = None,
    user: BasicUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[schemas.TraceSummary]:
    limit = max(1, min(limit, 200))
    query = db.query(Trace)
    if service:
        query = query.filter(Trace.service_name == service)
    if env:
        query = query.filter(Trace.environment == env)
    if status:
        query = query.filter(Trace.status_code == status)
    if model:
        query = query.filter(Trace.model == model)
    traces = (
        query.order_by(Trace.started_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [schemas.TraceSummary(**_trace_to_dict(t)) for t in traces]


@app.get("/api/traces/{trace_id}", response_model=schemas.TraceSummary)
def get_trace(
    trace_id: str,
    user: BasicUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.TraceSummary:
    trace = db.query(Trace).filter(Trace.trace_id == trace_id).one_or_none()
    if not trace:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="trace_not_found")
    return schemas.TraceSummary(**_trace_to_dict(trace))


@app.get("/api/traces/{trace_id}/spans", response_model=List[schemas.SpanRead])
def list_trace_spans(
    trace_id: str,
    user: BasicUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[schemas.SpanRead]:
    spans = db.query(Span).filter(Span.trace_id == trace_id).all()
    return [_span_to_schema(span) for span in spans]


@app.get("/api/spans/{span_id}", response_model=schemas.SpanRead)
def get_span(
    span_id: str,
    user: BasicUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.SpanRead:
    span = db.query(Span).filter(Span.span_id == span_id).one_or_none()
    if not span:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="span_not_found")
    return _span_to_schema(span)


@app.get(
    "/api/payloads/{payload_ref}",
    response_class=Response,
)
def get_payload(
    payload_ref: str,
    user: BasicUser = Depends(require_roles("engineer", "admin")),
) -> Response:
    content = load_payload(payload_ref)
    return Response(content=content, media_type="application/octet-stream")


def _persist_payload(db: Session, trace_id: str, span_id: str, payload_entry: Dict[str, Any]) -> None:
    content_type = payload_entry.get("content_type", "application/octet-stream")
    data = payload_entry.get("data")
    if data is None:
        return
    if payload_entry.get("encoding") == "base64":
        content = base64.b64decode(data)
    else:
        content = data.encode("utf-8") if isinstance(data, str) else bytes(data)
    payload_ref, payload_path = store_payload(content, content_type=content_type)
    blob = db.query(PayloadBlob).filter(PayloadBlob.payload_ref == payload_ref).one_or_none()
    if blob is None:
        blob = PayloadBlob(
            payload_ref=payload_ref,
            content_type=content_type,
            compression="none",
            byte_length=len(content),
            storage_path=str(payload_path),
        )
        db.add(blob)
    link_exists = (
        db.query(SpanPayloadRef)
        .filter(
            SpanPayloadRef.span_id == span_id,
            SpanPayloadRef.payload_ref == payload_ref,
            SpanPayloadRef.payload_role == payload_entry.get("role", "other"),
        )
        .one_or_none()
    )
    if not link_exists:
        db.add(
            SpanPayloadRef(
                trace_id=trace_id,
                span_id=span_id,
                payload_ref=payload_ref,
                payload_role=payload_entry.get("role", "other"),
            )
        )


def _attributes_to_dict(attrs: Any) -> Dict[str, Any]:
    if isinstance(attrs, dict):
        return attrs
    result: Dict[str, Any] = {}
    if not isinstance(attrs, Iterable):
        return result
    for item in attrs or []:
        key = item.get("key") if isinstance(item, dict) else None
        if not key:
            continue
        value = item.get("value", {}) if isinstance(item, dict) else {}
        if isinstance(value, dict):
            for candidate_key in [
                "string_value",
                "int_value",
                "double_value",
                "bool_value",
                "array_value",
            ]:
                if candidate_key in value:
                    result[key] = value[candidate_key]
                    break
        else:
            result[key] = value
    return result


def _normalize_events(events: Any) -> Any:
    if events is None:
        return []
    normalized = []
    for event in events:
        name = event.get("name") if isinstance(event, dict) else None
        attrs = _attributes_to_dict(event.get("attributes")) if isinstance(event, dict) else {}
        normalized.append({"name": name, "attributes": attrs, "time_unix_nano": event.get("time_unix_nano")})
    return normalized


def _parse_time(unix_nano: Optional[Any]) -> Optional[datetime]:
    if not unix_nano:
        return None
    try:
        unix_nano = int(unix_nano)
    except (TypeError, ValueError):
        return None
    seconds = unix_nano / 1_000_000_000
    return datetime.fromtimestamp(seconds, tz=timezone.utc)


def _duration_ms(start: Optional[datetime], end: Optional[datetime]) -> Optional[float]:
    if start and end:
        return (_to_naive_utc(end) - _to_naive_utc(start)).total_seconds() * 1000
    return None


def min_with_default(current: Optional[datetime], candidate: Optional[datetime]) -> Optional[datetime]:
    if current is None:
        return candidate
    if candidate is None:
        return current
    current_naive = _to_naive_utc(current)
    candidate_naive = _to_naive_utc(candidate)
    if current_naive is None:
        return candidate_naive
    return candidate_naive if candidate_naive < current_naive else current_naive


def _to_naive_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _choose_status(existing: Optional[str], new: Optional[str]) -> Optional[str]:
    priority = {"STATUS_CODE_ERROR": 2, "STATUS_CODE_UNSET": 1, "STATUS_CODE_OK": 0}
    existing_priority = priority.get(existing or "STATUS_CODE_UNSET", 0)
    new_priority = priority.get(new or "STATUS_CODE_UNSET", 0)
    return new if new_priority >= existing_priority else existing


def _sum_optional(current: Optional[float], addend: Optional[Any]) -> Optional[float]:
    if addend is None:
        return current
    try:
        add_value = float(addend)
    except (TypeError, ValueError):
        return current
    if current is None:
        return add_value
    return current + add_value


def _trace_to_dict(trace: Trace) -> Dict[str, Any]:
    return {
        "trace_id": trace.trace_id,
        "service_name": trace.service_name,
        "environment": trace.environment,
        "started_at": trace.started_at,
        "duration_ms": trace.duration_ms,
        "root_span_name": trace.root_span_name,
        "status_code": trace.status_code,
        "error_type": trace.error_type,
        "model": trace.model,
        "token_in": trace.token_in,
        "token_out": trace.token_out,
        "cost_usd_estimate": trace.cost_usd_estimate,
        "span_count": trace.span_count or 0,
    }


def _span_to_schema(span: Span) -> schemas.SpanRead:
    payload_refs = [
        schemas.SpanPayloadRefSchema(payload_ref=ref.payload_ref, payload_role=ref.payload_role)
        for ref in span.payload_refs
    ]
    return schemas.SpanRead(
        span_id=span.span_id,
        trace_id=span.trace_id,
        parent_span_id=span.parent_span_id,
        name=span.name,
        kind=span.kind,
        start_time=span.start_time,
        end_time=span.end_time,
        duration_ms=span.duration_ms,
        status_code=span.status_code,
        error_type=span.error_type,
        attributes=span.attributes,
        events=span.events,
        resource=span.resource,
        payload_refs=payload_refs,
    )


def _allowlist_attributes(attrs: Dict[str, Any]) -> Dict[str, Any]:
    allowlist = _load_allowlist()
    clean_attrs: Dict[str, Any] = {}
    for key, value in attrs.items():
        if key in allowlist or key.startswith("tracefoundry.payload"):
            clean_attrs[key] = value
    return clean_attrs


@lru_cache
def _load_allowlist() -> set[str]:
    values: set[str] = set()
    try:
        with open(settings.attribute_allowlist_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("- "):
                    values.add(line[2:].strip())
    except FileNotFoundError:
        pass
    return values
