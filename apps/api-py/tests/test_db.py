from app import db


def test_db_disabled_by_default(monkeypatch):
    monkeypatch.delenv("HRSIGN_DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert db.enabled() is False
    assert db.list_envelopes() is None
