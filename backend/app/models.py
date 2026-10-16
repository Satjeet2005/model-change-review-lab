import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DemoSession(Base):
    __tablename__ = "demo_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    baseline_assumptions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    working_assumptions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    state_version: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="1", default=1
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint("revision >= 1", name="ck_demo_sessions_revision_min"),
        CheckConstraint("state_version >= 1", name="ck_demo_sessions_state_version_min"),
    )

    workspaces: Mapped[list["ProposalWorkspace"]] = relationship(
        "ProposalWorkspace", back_populates="session", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["ChangeTransaction"]] = relationship(
        "ChangeTransaction",
        back_populates="session",
        cascade="all, delete-orphan",
        foreign_keys="ChangeTransaction.session_id",
    )
    idempotency_requests: Mapped[list["IdempotencyRequest"]] = relationship(
        "IdempotencyRequest", back_populates="session", cascade="all, delete-orphan"
    )


class ProposalWorkspace(Base):
    __tablename__ = "proposal_workspaces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("demo_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_template_id: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    base_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    base_assumptions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    selected_variant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    comparison_variant_ids: Mapped[list] = mapped_column(JSONB, nullable=False)
    accepted_variant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("base_revision >= 1", name="ck_proposal_workspaces_base_rev_min"),
        CheckConstraint(
            "source_template_id IN ('hire-engineers-from-q3', 'increase-growth-from-q3', "
            "'reduce-opex-from-m04')",
            name="ck_proposal_workspaces_source_template",
        ),
        CheckConstraint(
            "status IN ('active', 'accepted', 'rejected', 'archived', 'dismissed')",
            name="ck_proposal_workspaces_status",
        ),
        Index(
            "uq_proposal_workspaces_active_session",
            "session_id",
            unique=True,
            postgresql_where=(mapped_column("status") == "active"),
        ),
    )

    session: Mapped["DemoSession"] = relationship("DemoSession", back_populates="workspaces")
    variants: Mapped[list["ProposalVariant"]] = relationship(
        "ProposalVariant",
        back_populates="workspace",
        cascade="all, delete-orphan",
        order_by="ProposalVariant.created_at",
    )


class ProposalVariant(Base):
    __tablename__ = "proposal_variants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("proposal_workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    source_template_id: Mapped[str] = mapped_column(Text, nullable=False)
    duplicated_from_variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    operations: Mapped[list] = mapped_column(JSONB, nullable=False)
    reset_snapshot_operations: Mapped[list] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_original: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    __table_args__ = (
        CheckConstraint(
            "source_template_id IN ('hire-engineers-from-q3', 'increase-growth-from-q3', "
            "'reduce-opex-from-m04')",
            name="ck_proposal_variants_source_template",
        ),
        Index(
            "uq_proposal_variants_original_workspace",
            "workspace_id",
            unique=True,
            postgresql_where=(mapped_column("is_original") == True),  # noqa: E712
        ),
    )

    workspace: Mapped["ProposalWorkspace"] = relationship(
        "ProposalWorkspace", back_populates="variants"
    )


class ChangeTransaction(Base):
    __tablename__ = "change_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("demo_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resulting_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    affected_cell_ids: Mapped[list] = mapped_column(JSONB, nullable=False)
    previous_assumptions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    new_assumptions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    provenance: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    undoes_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("change_transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    undone_by_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("change_transactions.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        CheckConstraint("resulting_revision >= 2", name="ck_change_transactions_revision_min"),
        CheckConstraint(
            "kind IN ('manual-edit', 'proposal-accepted', 'reset-to-baseline', 'undo')",
            name="ck_change_transactions_kind",
        ),
        UniqueConstraint(
            "session_id", "resulting_revision", name="uq_change_transactions_session_rev"
        ),
    )

    session: Mapped["DemoSession"] = relationship(
        "DemoSession",
        back_populates="transactions",
        foreign_keys=[session_id],
    )


class IdempotencyRequest(Base):
    __tablename__ = "idempotency_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("demo_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    idempotency_key: Mapped[str] = mapped_column(String(128), nullable=False)
    method: Mapped[str] = mapped_column(Text, nullable=False)
    path: Mapped[str] = mapped_column(Text, nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_status: Mapped[int] = mapped_column(Integer, nullable=False)
    response_body: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "session_id", "idempotency_key", name="uq_idempotency_requests_session_key"
        ),
    )

    session: Mapped["DemoSession"] = relationship(
        "DemoSession", back_populates="idempotency_requests"
    )
