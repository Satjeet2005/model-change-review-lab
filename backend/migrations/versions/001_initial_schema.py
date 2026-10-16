"""Initial database schema for Model Change Review Lab

Revision ID: 001_initial
Revises:
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. demo_sessions
    op.create_table(
        'demo_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('baseline_assumptions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('working_assumptions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('revision', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('revision >= 1', name='ck_demo_sessions_revision_min'),
        sa.UniqueConstraint('token_hash', name='uq_demo_sessions_token_hash'),
    )
    op.create_index('ix_demo_sessions_token_hash', 'demo_sessions', ['token_hash'])

    # 2. proposal_workspaces
    op.create_table(
        'proposal_workspaces',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('source_template_id', sa.Text(), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('base_revision', sa.Integer(), nullable=False),
        sa.Column('base_assumptions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('status', sa.Text(), nullable=False),
        sa.Column('selected_variant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('comparison_variant_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('accepted_variant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('base_revision >= 1', name='ck_proposal_workspaces_base_rev_min'),
        sa.CheckConstraint(
            "source_template_id IN ('hire-engineers-from-q3', 'increase-growth-from-q3', 'reduce-opex-from-m04')",
            name='ck_proposal_workspaces_source_template'
        ),
        sa.CheckConstraint(
            "status IN ('active', 'accepted', 'rejected', 'archived', 'dismissed')",
            name='ck_proposal_workspaces_status'
        ),
        sa.ForeignKeyConstraint(['session_id'], ['demo_sessions.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_proposal_workspaces_session_id', 'proposal_workspaces', ['session_id'])
    op.create_index(
        'uq_proposal_workspaces_active_session',
        'proposal_workspaces',
        ['session_id'],
        unique=True,
        postgresql_where=sa.text("status = 'active'")
    )

    # 3. proposal_variants
    op.create_table(
        'proposal_variants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('label', sa.Text(), nullable=False),
        sa.Column('source_template_id', sa.Text(), nullable=False),
        sa.Column('duplicated_from_variant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('operations', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('reset_snapshot_operations', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_original', sa.Boolean(), server_default='false', nullable=False),
        sa.CheckConstraint(
            "source_template_id IN ('hire-engineers-from-q3', 'increase-growth-from-q3', 'reduce-opex-from-m04')",
            name='ck_proposal_variants_source_template'
        ),
        sa.ForeignKeyConstraint(['workspace_id'], ['proposal_workspaces.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_proposal_variants_workspace_id', 'proposal_variants', ['workspace_id'])
    op.create_index(
        'uq_proposal_variants_original_workspace',
        'proposal_variants',
        ['workspace_id'],
        unique=True,
        postgresql_where=sa.text("is_original = true")
    )

    # 4. change_transactions
    op.create_table(
        'change_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('resulting_revision', sa.Integer(), nullable=False),
        sa.Column('kind', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('affected_cell_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('previous_assumptions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('new_assumptions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('provenance', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('undoes_transaction_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('undone_by_transaction_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('resulting_revision >= 2', name='ck_change_transactions_revision_min'),
        sa.CheckConstraint(
            "kind IN ('manual-edit', 'proposal-accepted', 'reset-to-baseline', 'undo')",
            name='ck_change_transactions_kind'
        ),
        sa.ForeignKeyConstraint(['session_id'], ['demo_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['undoes_transaction_id'], ['change_transactions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['undone_by_transaction_id'], ['change_transactions.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('session_id', 'resulting_revision', name='uq_change_transactions_session_rev'),
    )
    op.create_index('ix_change_transactions_session_id', 'change_transactions', ['session_id'])

    # 5. idempotency_requests
    op.create_table(
        'idempotency_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('idempotency_key', sa.String(length=128), nullable=False),
        sa.Column('method', sa.Text(), nullable=False),
        sa.Column('path', sa.Text(), nullable=False),
        sa.Column('request_hash', sa.String(length=64), nullable=False),
        sa.Column('response_status', sa.Integer(), nullable=False),
        sa.Column('response_body', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['demo_sessions.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('session_id', 'idempotency_key', name='uq_idempotency_requests_session_key'),
    )
    op.create_index('ix_idempotency_requests_session_id', 'idempotency_requests', ['session_id'])


def downgrade() -> None:
    op.drop_table('idempotency_requests')
    op.drop_table('change_transactions')
    op.drop_table('proposal_variants')
    op.drop_table('proposal_workspaces')
    op.drop_table('demo_sessions')
