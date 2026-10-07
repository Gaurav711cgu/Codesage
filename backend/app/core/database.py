from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine_kwargs = {
    "echo": settings.environment == "development",
}

if not settings.async_database_url.startswith("sqlite"):
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10

engine = create_async_engine(
    settings.async_database_url,
    **engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def get_db_readonly() -> AsyncSession:
    """FastAPI dependency that yields a database session for read-only queries.
    Rolls back automatically to prevent transaction log bloat."""
    async with AsyncSessionLocal() as session:
        # For Postgres, setting isolation_level to AUTOCOMMIT avoids transaction locks
        if not settings.async_database_url.startswith("sqlite"):
            await session.connection(execution_options={"isolation_level": "AUTOCOMMIT"})
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()
