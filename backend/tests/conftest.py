import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.database import Base, get_db
from app.main import app

test_db_url = os.environ.get("TEST_DATABASE_URL") or settings.TEST_DATABASE_URL
if not test_db_url or not test_db_url.strip():
    raise RuntimeError("Pytest requires TEST_DATABASE_URL to be set to an isolated test database.")

test_url = make_url(test_db_url.strip())
app_url = make_url(settings.DATABASE_URL.strip())

# Fail closed if configured against the application database
if (
    test_url.database == app_url.database
    and test_url.host == app_url.host
    and test_url.port == app_url.port
):
    raise RuntimeError(
        f"TEST_DATABASE_URL ({test_url.database}) cannot point to the same "
        f"database as DATABASE_URL ({app_url.database}). "
        "Pytest truncates tables and requires an isolated test database."
    )

# Ensure the test database exists
try:
    admin_url = test_url.set(database="postgres")
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
            {"dbname": test_url.database},
        ).scalar()
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{test_url.database}"'))
    admin_engine.dispose()
except Exception:
    # If cannot connect to 'postgres' admin db, assume database already exists
    pass

engine = create_engine(test_db_url, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
)


def override_get_db() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(autouse=True)
def clean_database():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE demo_sessions CASCADE;"))


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


def make_test_token(seed_id: str = "test") -> str:
    import base64
    import hashlib

    raw = hashlib.sha256(seed_id.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")
