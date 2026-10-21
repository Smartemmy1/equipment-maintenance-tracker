"""Shared fixtures: a fresh in-memory database and a fixed "today" for every test."""

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db, get_today
from app.main import app

TODAY = date(2026, 6, 15)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_today] = lambda: TODAY
    # Not used as a context manager, so the startup seeding does not run.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def make_equipment(client):
    """Create equipment through the API and return its JSON."""

    def _make(**overrides):
        payload = {
            "tag": "P-001",
            "name": "Test pump",
            "category": "pump",
            "location": "Test plant",
            "criticality": "high",
            "inspection_interval_days": 90,
            "installed_on": "2026-01-01",
        } | overrides
        res = client.post("/api/equipment", json=payload)
        assert res.status_code == 201, res.text
        return res.json()

    return _make
