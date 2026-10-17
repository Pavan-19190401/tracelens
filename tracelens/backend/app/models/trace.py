"""Trace and Span SQLAlchemy models."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from tracelens.backend.app.models.base import Base, TimestampMixin, utc_now


class Trace(Base, TimestampMixin):
    __tablename__ = "traces"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    session_id: Mapped[str | None] = mapped_column(
        String(100), index=True, nullable=True
    )
    user_id: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)

    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, index=True
    )
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="SUCCESS", index=True)
    status_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    input: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    output: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)

    metadata_: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata", JSON, nullable=True
    )
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    spans: Mapped[list["Span"]] = relationship(
        "Span",
        back_populates="trace",
        cascade="all, delete-orphan",
        order_by="Span.start_time",
    )

    __table_args__ = (
        Index("ix_traces_project_created", "project_id", "created_at"),
        Index("ix_traces_project_status", "project_id", "status"),
    )


class Span(Base, TimestampMixin):
    __tablename__ = "spans"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    trace_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("traces.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    parent_span_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("spans.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    span_kind: Mapped[str] = mapped_column(String(50), default="agent", index=True)

    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="SUCCESS")
    status_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    input: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    output: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    model: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    model_provider: Mapped[str | None] = mapped_column(String(50), nullable=True)

    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)

    metadata_: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata", JSON, nullable=True
    )
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    trace: Mapped["Trace"] = relationship("Trace", back_populates="spans")
    parent_span: Mapped[Optional["Span"]] = relationship(
        "Span", remote_side=[id], backref="child_spans"
    )

    __table_args__ = (
        Index("ix_spans_project_created", "project_id", "created_at"),
        Index("ix_spans_trace_parent", "trace_id", "parent_span_id"),
    )
