"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "repos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("github_url", sa.Text, nullable=False, unique=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("stats", postgresql.JSONB, nullable=True),
        sa.Column("graph_data", sa.Text, nullable=True),
        sa.Column("error_code", sa.Text, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('queued','cloning','parsing','graphing','embedding',"
            "'storing','complete','failed')",
            name="repos_status_check",
        ),
    )

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("repo_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("repos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stage", sa.Text, nullable=False),
        sa.Column("current_step", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_steps", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(32), nullable=False, server_default="running"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "status IN ('running','complete','failed')",
            name="tasks_status_check",
        ),
    )

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("repo_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("repos.id", ondelete="SET NULL"), nullable=True),
        sa.Column("session_id", sa.Text, nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("retrieval_mode", sa.String(16), nullable=True),
        sa.Column("retrieval_meta", postgresql.JSONB, nullable=True),
        sa.Column("model_used", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role IN ('user','assistant')", name="messages_role_check"),
        sa.CheckConstraint(
            "retrieval_mode IN ('naive','graph')",
            name="messages_retrieval_mode_check",
        ),
    )

    # Indexes
    op.create_index("idx_repos_status", "repos", ["status"])
    op.create_index("idx_repos_created", "repos", [sa.text("created_at DESC")])
    op.create_index("idx_tasks_repo", "tasks", ["repo_id"])
    op.create_index("idx_messages_repo", "messages", ["repo_id"])
    op.create_index("idx_messages_session", "messages", ["session_id"])
    op.create_index("idx_messages_created", "messages", [sa.text("created_at DESC")])

    # Auto-update updated_at trigger
    op.execute("""
        CREATE OR REPLACE FUNCTION _updated_at()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
        $$
    """)
    op.execute("""
        CREATE TRIGGER repos_updated_at BEFORE UPDATE ON repos
        FOR EACH ROW EXECUTE FUNCTION _updated_at()
    """)
    op.execute("""
        CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION _updated_at()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS tasks_updated_at ON tasks")
    op.execute("DROP TRIGGER IF EXISTS repos_updated_at ON repos")
    op.execute("DROP FUNCTION IF EXISTS _updated_at()")
    op.drop_table("messages")
    op.drop_table("tasks")
    op.drop_table("repos")
