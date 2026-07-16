import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, ForeignKey, func, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
import enum
from sqlalchemy import Enum as SQLEnum

class RepoStatus(str, enum.Enum):
    queued = "queued"
    cloning = "cloning"
    parsing = "parsing"
    graphing = "graphing"
    embedding = "embedding"
    storing = "storing"
    complete = "complete"
    failed = "failed"

class TaskStatus(str, enum.Enum):
    running = "running"
    complete = "complete"
    failed = "failed"

JSONVariant = JSON().with_variant(JSONB, "postgresql")
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Repo(Base):
    __tablename__ = "repos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    github_url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[RepoStatus] = mapped_column(
        SQLEnum(RepoStatus, name="repostatus_enum"), nullable=False, default=RepoStatus.queued
    )
    stats: Mapped[dict | None] = mapped_column(JSONVariant, nullable=True)
    graph_data: Mapped[dict | None] = mapped_column(JSONVariant, nullable=True)
    error_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="repo", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="repo"
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    repo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repos.id", ondelete="CASCADE"), nullable=False
    )
    stage: Mapped[str] = mapped_column(Text, nullable=False)
    current_step: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_steps: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[TaskStatus] = mapped_column(
        SQLEnum(TaskStatus, name="taskstatus_enum"), nullable=False, default=TaskStatus.running
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    repo: Mapped["Repo"] = relationship("Repo", back_populates="tasks")


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    repo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("repos.id", ondelete="SET NULL"), nullable=True
    )
    session_id: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    retrieval_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    retrieval_meta: Mapped[dict | None] = mapped_column(JSONVariant, nullable=True)
    model_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    repo: Mapped["Repo | None"] = relationship("Repo", back_populates="messages")
