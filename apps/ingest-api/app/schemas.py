"""Pydantic response schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel


class TraceSummary(BaseModel):
    trace_id: str
    service_name: Optional[str] = None
    environment: Optional[str] = None
    started_at: Optional[datetime] = None
    duration_ms: Optional[float] = None
    root_span_name: Optional[str] = None
    status_code: Optional[str] = None
    error_type: Optional[str] = None
    model: Optional[str] = None
    token_in: Optional[int] = None
    token_out: Optional[int] = None
    cost_usd_estimate: Optional[float] = None
    span_count: int = 0


class SpanPayloadRefSchema(BaseModel):
    payload_ref: str
    payload_role: str


class SpanRead(BaseModel):
    span_id: str
    trace_id: str
    parent_span_id: Optional[str] = None
    name: str
    kind: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_ms: Optional[float] = None
    status_code: Optional[str] = None
    error_type: Optional[str] = None
    attributes: Any = None
    events: Any = None
    resource: Any = None
    payload_refs: List[SpanPayloadRefSchema] = []

    class Config:
        from_attributes = True


class PayloadBlobSchema(BaseModel):
    payload_ref: str
    content_type: Optional[str] = None
    byte_length: Optional[int] = None
    compression: Optional[str] = None


class HealthResponse(BaseModel):
    ok: bool
