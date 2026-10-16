"""Add state_version to demo_sessions

Revision ID: 002_state_version
Revises: 001_initial
Create Date: 2026-10-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '002_state_version'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'demo_sessions',
        sa.Column('state_version', sa.Integer(), server_default='1', nullable=False)
    )
    op.create_check_constraint(
        'ck_demo_sessions_state_version_min',
        'demo_sessions',
        'state_version >= 1'
    )


def downgrade() -> None:
    op.drop_constraint('ck_demo_sessions_state_version_min', 'demo_sessions', type_='check')
    op.drop_column('demo_sessions', 'state_version')
