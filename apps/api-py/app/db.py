"""Optional Postgres store when HRSIGN_DATABASE_URL is set (shared Prisma schema)."""

from __future__ import annotations

import json
import os
import uuid
from typing import Any

_CONN = None


def database_url() -> str | None:
    return os.environ.get("HRSIGN_DATABASE_URL") or os.environ.get("DATABASE_URL")


def enabled() -> bool:
    return bool(database_url())


def _connect():
    global _CONN
    if _CONN is not None:
        return _CONN
    url = database_url()
    if not url:
        return None
    import psycopg

    _CONN = psycopg.connect(url, autocommit=True)
    return _CONN


def list_envelopes(status: str | None = None, limit: int = 50) -> list[dict[str, Any]] | None:
    conn = _connect()
    if conn is None:
        return None
    sql = 'SELECT id, "accountId", status, subject, "emailBlurb", "sentAt", "completedAt", "voidedAt", "voidReason", "expiresAt", "createdAt", "updatedAt" FROM envelopes'
    params: list[Any] = []
    if status:
        sql += " WHERE status = %s"
        params.append(status)
    sql += ' ORDER BY "updatedAt" DESC LIMIT %s'
    params.append(min(200, limit))
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        cols = [d.name for d in cur.description]
    out = []
    for row in rows:
        item = dict(zip(cols, row))
        out.append(_row_to_dto(item, documents=[], recipients=[], tabs=[]))
    return out


def get_envelope(envelope_id: str) -> dict[str, Any] | None:
    conn = _connect()
    if conn is None:
        return None
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, "accountId", status, subject, "emailBlurb", "sentAt", "completedAt", "voidedAt", "voidReason", "expiresAt", "createdAt", "updatedAt" FROM envelopes WHERE id = %s',
            (envelope_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        cols = [d.name for d in cur.description]
        item = dict(zip(cols, row))
        cur.execute(
            'SELECT id, name, "documentOrder", "storageKey", sha256, "pageCount" FROM envelope_documents WHERE "envelopeId" = %s ORDER BY "documentOrder"',
            (envelope_id,),
        )
        docs = [dict(zip([d.name for d in cur.description], r)) for r in cur.fetchall()]
        cur.execute(
            'SELECT id, "recipientType", "routingOrder", name, email, status FROM envelope_recipients WHERE "envelopeId" = %s ORDER BY "routingOrder"',
            (envelope_id,),
        )
        recipients = [dict(zip([d.name for d in cur.description], r)) for r in cur.fetchall()]
    return _row_to_dto(item, documents=docs, recipients=recipients, tabs=[])


def create_envelope(payload: dict[str, Any], created_by: str = "system") -> dict[str, Any] | None:
    conn = _connect()
    if conn is None:
        return None
    eid = payload.get("id") or f"env_{uuid.uuid4().hex[:16]}"
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO envelopes (id, "accountId", status, subject, "emailBlurb", "expiresAt", "createdBy", "createdAt", "updatedAt")
               VALUES (%s, %s, 'created', %s, %s, %s, %s, NOW(), NOW())''',
            (
                eid,
                payload.get("accountId"),
                payload["subject"],
                payload.get("emailBlurb"),
                payload.get("expiresAt"),
                created_by,
            ),
        )
        for i, doc in enumerate(payload.get("documents") or [{"name": "Document 1"}]):
            cur.execute(
                '''INSERT INTO envelope_documents (id, "envelopeId", name, "documentOrder", "pageCount", "createdAt")
                   VALUES (%s, %s, %s, %s, %s, NOW())''',
                (
                    f"doc_{uuid.uuid4().hex[:12]}",
                    eid,
                    doc.get("name", "Document"),
                    doc.get("documentOrder", i + 1),
                    doc.get("pageCount", 1),
                ),
            )
        for i, rec in enumerate(payload.get("recipients") or []):
            cur.execute(
                '''INSERT INTO envelope_recipients (id, "envelopeId", "recipientType", "routingOrder", name, email, status, "createdAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, %s, %s, 'created', NOW(), NOW())''',
                (
                    f"rec_{uuid.uuid4().hex[:12]}",
                    eid,
                    rec.get("recipientType", "signer"),
                    rec.get("routingOrder", i + 1),
                    rec.get("name", ""),
                    rec.get("email", ""),
                ),
            )
    return get_envelope(eid)


def _iso(v: Any) -> Any:
    if v is None:
        return None
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v


def _row_to_dto(
    item: dict[str, Any],
    *,
    documents: list[dict[str, Any]],
    recipients: list[dict[str, Any]],
    tabs: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "id": item["id"],
        "accountId": item.get("accountId"),
        "status": item["status"] if isinstance(item["status"], str) else str(item["status"]),
        "subject": item["subject"],
        "emailBlurb": item.get("emailBlurb"),
        "sentAt": _iso(item.get("sentAt")),
        "completedAt": _iso(item.get("completedAt")),
        "voidedAt": _iso(item.get("voidedAt")),
        "voidReason": item.get("voidReason"),
        "expiresAt": _iso(item.get("expiresAt")),
        "documents": [
            {
                "id": d["id"],
                "name": d["name"],
                "documentOrder": d.get("documentOrder", 1),
                "storageKey": d.get("storageKey"),
                "sha256": d.get("sha256"),
                "pageCount": d.get("pageCount", 1),
            }
            for d in documents
        ],
        "recipients": [
            {
                "id": r["id"],
                "recipientType": r.get("recipientType", "signer"),
                "routingOrder": r.get("routingOrder", 1),
                "name": r.get("name"),
                "email": r.get("email"),
                "status": r.get("status", "created"),
            }
            for r in recipients
        ],
        "tabs": tabs,
        "createdAt": _iso(item.get("createdAt")),
        "updatedAt": _iso(item.get("updatedAt")),
        "storage": "postgres",
    }
