"""SQLAlchemy models."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from .db import Base


class Trace(Base):
    __tablename__ = "traces"

    trace_id = Column(String(64), primary_key=True)
    service_name = Column(String(128), index=True)
    environment = Column(String(64), index=True)
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    duration_ms = Column(Float)
    root_span_name = Column(String(256))
    status_code = Column(String(32), index=True)
    error_type = Column(String(128))
    model = Column(String(128), index=True)
    token_in = Column(Integer)
    token_out = Column(Integer)
    cost_usd_estimate = Column(Float)
    span_count = Column(Integer, default=0)

    spans = relationship("Span", back_populates="trace", cascade="all, delete-orphan")


class Span(Base):
    __tablename__ = "spans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trace_id = Column(String(64), ForeignKey("traces.trace_id"), index=True)
    span_id = Column(String(64), unique=True, index=True)
    parent_span_id = Column(String(64), index=True)
    name = Column(String(256))
    kind = Column(String(32))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration_ms = Column(Float)
    status_code = Column(String(32))
    error_type = Column(String(128))
    attributes = Column(JSON)
    events = Column(JSON)
    resource = Column(JSON)

    trace = relationship("Trace", back_populates="spans")
    payload_refs = relationship("SpanPayloadRef", back_populates="span", cascade="all, delete-orphan")


class PayloadBlob(Base):
    __tablename__ = "payload_blobs"

    payload_ref = Column(String(128), primary_key=True)
    content_type = Column(String(128))
    compression = Column(String(32), default="none")
    byte_length = Column(Integer)
    storage_path = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class SpanPayloadRef(Base):
    __tablename__ = "span_payload_refs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trace_id = Column(String(64), index=True)
    span_id = Column(String(64), ForeignKey("spans.span_id"), index=True)
    payload_ref = Column(String(128), ForeignKey("payload_blobs.payload_ref"))
    payload_role = Column(String(32))

    span = relationship("Span", back_populates="payload_refs")
