"""HRSign Envelope API — Python FastAPI (parity with Next + Go, in-memory)."""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
import uuid
from typing import Any
from urllib import error as urlerror
from urllib import request as urlrequest

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field

BACKEND = "python"
VERSION = "0.4.0"

app = FastAPI(
    title="HRSign Envelope API (Python)",
    version=VERSION,
    description="Same OpenAPI contract as Next.js and Go. Apache-2.0.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_ENVELOPES: dict[str, dict[str, Any]] = {}
_POWERFORMS: list[dict[str, Any]] = []
_CLICKWRAPS: dict[str, dict[str, Any]] = {}
_ROOMS: dict[str, dict[str, Any]] = {}
_CLM: dict[str, dict[str, Any]] = {}
_NOTARY: dict[str, dict[str, Any]] = {}
_ACCOUNTS: dict[str, dict[str, Any]] = {
    "acct_default": {
        "accountId": "acct_default",
        "name": "Default",
        "slug": "default",
        "members": [],
        "brands": [],
        "createdAt": None,
        "updatedAt": None,
    }
}
_IDV: dict[str, dict[str, Any]] = {}
_EVENTS: dict[str, list[dict[str, Any]]] = {}
_CONNECT: dict[str, dict[str, Any]] = {}
_CONNECT_EVENTS = frozenset(
    {
        "envelope.sent",
        "envelope.completed",
        "envelope.voided",
        "envelope.declined",
        "recipient.completed",
        "task.created",
        "approval.result",
        "signing.completed",
        "signing.declined",
        "signing.expired",
    }
)


class RecipientIn(BaseModel):
    recipientType: str = "signer"
    routingOrder: int = 1
    name: str
    email: EmailStr
    userId: str | None = None
    phoneE164: str | None = None
    deliveryChannel: str = "email"
    idvMethod: str = "none"
    hostUserId: str | None = None
    witnessForId: str | None = None


class DocumentIn(BaseModel):
    name: str
    documentOrder: int = 1
    storageKey: str | None = None
    pageCount: int = 1
    blank: bool = True


class CreateEnvelope(BaseModel):
    subject: str = Field(min_length=1)
    emailBlurb: str | None = None
    expiresAt: str | None = None
    accountId: str | None = None
    documents: list[DocumentIn] | None = None
    recipients: list[RecipientIn] | None = None


def _now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _err(status: int, code: str) -> HTTPException:
    return HTTPException(status, detail={"error": {"code": code}})


def _get_env(envelope_id: str) -> dict[str, Any]:
    env = _ENVELOPES.get(envelope_id)
    if not env:
        raise _err(404, "ENVELOPE_NOT_FOUND")
    return env


def _event(envelope_id: str, action: str, **meta: Any) -> None:
    _EVENTS.setdefault(envelope_id, []).append(
        {"id": f"evt_{uuid.uuid4().hex[:10]}", "action": action, "meta": meta, "createdAt": _now()}
    )


def _is_tab_visible(tab: dict[str, Any], all_tabs: list[dict[str, Any]]) -> bool:
    rule = tab.get("conditional") or {}
    show_if = rule.get("showIf") if isinstance(rule, dict) else None
    if not isinstance(show_if, dict) or not show_if.get("tabId"):
        return True
    dep = next((t for t in all_tabs if t.get("id") == show_if["tabId"]), None)
    val = str((dep or {}).get("value") or "")
    if show_if.get("notEmpty"):
        return len(val.strip()) > 0
    if "equals" in show_if:
        return val == show_if["equals"]
    return True


def _filter_visible_tabs(tabs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [t for t in tabs if _is_tab_visible(t, tabs)]


def _assert_recipient_token(env: dict[str, Any], recipient_id: str, raw: str) -> dict[str, Any]:
    rec = next((r for r in env["recipients"] if r["id"] == recipient_id), None)
    if not rec:
        raise _err(401, "SIGN_LINK_INVALID")
    stored = rec.get("_accessToken") or ""
    if not stored or not raw or len(stored) != len(raw):
        raise _err(401, "SIGN_LINK_INVALID")
    if hmac.compare_digest(stored, raw):
        return rec
    raise _err(401, "SIGN_LINK_INVALID")


def _dispatch_connect(event: str, data: dict[str, Any] | None = None) -> None:
    payload = {
        "event": event,
        "timestamp": _now(),
        "data": data or {},
    }
    body = json.dumps(payload, separators=(",", ":"))
    for hook in _CONNECT.values():
        if not hook.get("enabled"):
            continue
        if event not in (hook.get("events") or []):
            continue
        secret = hook.get("secret") or ""
        sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        delivery = {
            "id": f"del_{uuid.uuid4().hex[:10]}",
            "event": event,
            "status": "PENDING",
            "createdAt": _now(),
        }
        hook.setdefault("deliveries", []).append(delivery)
        try:
            req = urlrequest.Request(
                hook["url"],
                data=body.encode(),
                headers={
                    "Content-Type": "application/json",
                    "X-HRSign-Event": event,
                    "X-HRSign-Signature": f"sha256={sig}",
                    "X-HRSign-Delivery": delivery["id"],
                },
                method="POST",
            )
            with urlrequest.urlopen(req, timeout=3) as resp:
                delivery["status"] = "DELIVERED" if 200 <= resp.status < 300 else "FAILED"
                delivery["responseStatus"] = resp.status
        except (urlerror.URLError, TimeoutError, OSError) as exc:
            delivery["status"] = "FAILED"
            delivery["responseError"] = str(exc)[:200]


@app.get("/v1/health")
def health():
    return {"status": "ok", "backend": BACKEND, "version": VERSION}


@app.get("/v1/tabs/types")
def tab_types():
    return {
        "types": [
            "signHere",
            "initialHere",
            "dateSigned",
            "text",
            "fullName",
            "emailAddress",
            "checkbox",
            "radioGroup",
            "formula",
            "attachment",
            "payment",
            "company",
            "title",
            "note",
        ]
    }


@app.get("/v1/identity/methods")
def idv_methods():
    return {
        "methods": ["email_otp", "sms_otp", "kba", "id_document", "face"],
        "plugins": [
            {"id": "email_otp", "status": "partial", "channel": "email"},
            {"id": "sms_otp", "status": "partial", "channel": "sms"},
            {"id": "kba", "status": "stub"},
            {"id": "id_document", "status": "stub"},
            {"id": "face", "status": "stub"},
        ],
    }


@app.get("/v1/trust/providers")
def trust_providers():
    return {
        "providers": [
            {"id": "IMAGE_SEAL", "kind": "visual", "status": "done"},
            {"id": "HANDWRITE", "kind": "visual", "status": "done"},
            {"id": "PADES", "kind": "cms_pkcs7", "status": "stub", "configured": False},
            {"id": "GM_SM2", "kind": "national_crypto", "status": "stub", "configured": False},
        ]
    }


@app.get("/v1/envelopes")
def list_envelopes(status: str | None = None, limit: int = 50):
    rows = list(_ENVELOPES.values())
    if status:
        rows = [e for e in rows if e["status"] == status]
    rows.sort(key=lambda e: e["updatedAt"], reverse=True)
    return {"envelopes": rows[: min(200, limit)]}


@app.post("/v1/envelopes", status_code=201)
def create_envelope(body: CreateEnvelope):
    eid = f"env_{uuid.uuid4().hex[:16]}"
    docs = body.documents or [DocumentIn(name="Document 1")]
    recipients = body.recipients or []
    env = {
        "id": eid,
        "accountId": body.accountId or "acct_default",
        "status": "created",
        "subject": body.subject.strip(),
        "emailBlurb": body.emailBlurb,
        "sentAt": None,
        "completedAt": None,
        "voidedAt": None,
        "voidReason": None,
        "expiresAt": body.expiresAt,
        "legacyTaskId": None,
        "documents": [
            {
                "id": f"doc_{uuid.uuid4().hex[:12]}",
                "name": d.name,
                "documentOrder": d.documentOrder,
                "storageKey": d.storageKey,
                "sha256": None,
                "pageCount": d.pageCount,
                "fileUrl": None,
            }
            for d in docs
        ],
        "recipients": [
            {
                "id": f"rec_{uuid.uuid4().hex[:12]}",
                "recipientType": r.recipientType,
                "routingOrder": r.routingOrder,
                "name": r.name,
                "email": str(r.email).lower(),
                "phoneE164": r.phoneE164,
                "deliveryChannel": r.deliveryChannel,
                "idvMethod": r.idvMethod,
                "idvStatus": "pending" if r.idvMethod and r.idvMethod != "none" else "skipped",
                "hostUserId": r.hostUserId,
                "witnessForId": r.witnessForId,
                "status": "completed"
                if r.recipientType in ("cc", "carbonCopy", "certifiedDelivery")
                else "created",
                "userId": r.userId,
                "signedAt": None,
                "declinedAt": None,
                "declineReason": None,
                "accessUrl": None,
            }
            for r in recipients
        ],
        "tabs": [],
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    _ENVELOPES[eid] = env
    _event(eid, "created")
    return env


@app.get("/v1/envelopes/{envelope_id}")
def get_envelope(envelope_id: str):
    return _get_env(envelope_id)


@app.delete("/v1/envelopes/{envelope_id}", status_code=204)
def purge_envelope(envelope_id: str):
    env = _get_env(envelope_id)
    if env["status"] != "created":
        raise _err(409, "ENVELOPE_INVALID_STATE")
    del _ENVELOPES[envelope_id]
    return Response(status_code=204)


@app.post("/v1/envelopes/{envelope_id}/send")
def send_envelope(envelope_id: str):
    env = _get_env(envelope_id)
    if env["status"] != "created":
        raise _err(409, "ENVELOPE_INVALID_STATE")
    if not env["recipients"]:
        raise _err(400, "ENVELOPE_NO_RECIPIENTS")
    if not env["documents"]:
        raise _err(400, "ENVELOPE_NO_DOCUMENTS")
    for r in env["recipients"]:
        if r["recipientType"] in ("cc", "carbonCopy", "certifiedDelivery"):
            r["status"] = "completed"
            continue
        token = secrets.token_urlsafe(18)
        r["status"] = "sent"
        r["_accessToken"] = token
        r["accessUrl"] = f"/sign/envelope/{envelope_id}?r={r['id']}&t={token}"
    if not env.get("tabs"):
        doc_id = env["documents"][0]["id"] if env["documents"] else None
        for i, r in enumerate(env["recipients"]):
            if r["recipientType"] in ("cc", "carbonCopy", "certifiedDelivery"):
                continue
            env["tabs"].append(
                {
                    "id": f"tab_{uuid.uuid4().hex[:10]}",
                    "tabType": "signHere",
                    "envelopeDocumentId": doc_id,
                    "recipientId": r["id"],
                    "coordinates": {"page": 1, "x": 72, "y": 120 + i * 60, "width": 160, "height": 48},
                    "required": True,
                    "value": None,
                    "conditional": None,
                }
            )
    env["status"] = "sent"
    env["sentAt"] = _now()
    env["updatedAt"] = _now()
    _event(envelope_id, "sent")
    _dispatch_connect("envelope.sent", {"envelopeId": envelope_id, "subject": env["subject"]})
    return env


@app.post("/v1/envelopes/{envelope_id}/void")
def void_envelope(envelope_id: str, body: dict[str, Any]):
    env = _get_env(envelope_id)
    if env["status"] not in ("created", "sent", "delivered"):
        raise _err(409, "ENVELOPE_INVALID_STATE")
    reason = (body or {}).get("reason") or ""
    if not reason.strip():
        raise _err(400, "VALIDATION_FAILED")
    env["status"] = "voided"
    env["voidedAt"] = _now()
    env["voidReason"] = reason.strip()
    env["updatedAt"] = _now()
    _event(envelope_id, "voided", reason=reason.strip())
    _dispatch_connect("envelope.voided", {"envelopeId": envelope_id, "reason": reason.strip()})
    return env


@app.get("/v1/envelopes/{envelope_id}/tabs")
def list_tabs(envelope_id: str):
    env = _get_env(envelope_id)
    return {"tabs": env.get("tabs", [])}


@app.put("/v1/envelopes/{envelope_id}/tabs")
def replace_tabs(envelope_id: str, body: dict[str, Any]):
    env = _get_env(envelope_id)
    if env["status"] != "created":
        raise _err(409, "ENVELOPE_INVALID_STATE")
    tabs = []
    for t in body.get("tabs") or []:
        tabs.append(
            {
                "id": f"tab_{uuid.uuid4().hex[:10]}",
                "tabType": t.get("tabType", "signHere"),
                "envelopeDocumentId": t.get("envelopeDocumentId")
                or (env["documents"][0]["id"] if env["documents"] else None),
                "recipientId": t.get("recipientId"),
                "coordinates": t.get("coordinates")
                or {"page": 1, "x": 72, "y": 72, "width": 160, "height": 40},
                "required": t.get("required", True),
                "value": t.get("value"),
                "conditional": t.get("conditional"),
            }
        )
    env["tabs"] = tabs
    env["updatedAt"] = _now()
    return {"tabs": tabs}


@app.post("/v1/envelopes/{envelope_id}/recipients/{recipient_id}/sign")
def sign_recipient(
    envelope_id: str, recipient_id: str, body: dict[str, Any] | None = None
):
    env = _get_env(envelope_id)
    if env["status"] not in ("sent", "delivered", "signed"):
        raise _err(409, "ENVELOPE_INVALID_STATE")
    rec = next((r for r in env["recipients"] if r["id"] == recipient_id), None)
    if not rec:
        raise _err(404, "RECIPIENT_NOT_FOUND")
    if rec["recipientType"] in ("cc", "carbonCopy", "certifiedDelivery"):
        raise _err(400, "RECIPIENT_CC_NO_SIGN")
    if rec["status"] in ("signed", "completed"):
        raise _err(409, "RECIPIENT_ALREADY_SIGNED")
    if rec.get("idvMethod", "none") != "none" and rec.get("idvStatus") != "verified":
        raise _err(403, "IDV_REQUIRED")
    if body and body.get("tabValues"):
        for tab in env.get("tabs", []):
            if tab["id"] in body["tabValues"] and tab.get("recipientId") == recipient_id:
                if not _is_tab_visible(tab, env.get("tabs", [])):
                    continue
                tab["value"] = body["tabValues"][tab["id"]]
    rec["status"] = "signed"
    rec["signedAt"] = _now()
    signers = [
        r
        for r in env["recipients"]
        if r["recipientType"] in ("signer", "inPersonSigner", "notary", "witness", "editor")
    ]
    _dispatch_connect(
        "recipient.completed",
        {"envelopeId": envelope_id, "recipientId": recipient_id},
    )
    if all(r["status"] in ("signed", "completed", "declined") for r in signers):
        env["status"] = "completed"
        env["completedAt"] = _now()
        _event(envelope_id, "completed")
        _dispatch_connect("envelope.completed", {"envelopeId": envelope_id})
    elif env["status"] == "sent":
        env["status"] = "delivered"
    else:
        env["status"] = "signed"
    env["updatedAt"] = _now()
    _event(envelope_id, "recipient_signed", recipientId=recipient_id)
    return env


@app.get("/v1/envelopes/{envelope_id}/certificate")
def certificate(envelope_id: str):
    env = _get_env(envelope_id)
    if env["status"] != "completed":
        raise _err(409, "ENVELOPE_NOT_COMPLETED")
    return {
        "envelopeId": env["id"],
        "status": env["status"],
        "subject": env["subject"],
        "completedAt": env["completedAt"],
        "recipients": [
            {
                "name": r["name"],
                "email": r["email"],
                "recipientType": r["recipientType"],
                "status": r["status"],
                "signedAt": r["signedAt"],
            }
            for r in env["recipients"]
        ],
        "documents": [{"name": d["name"], "sha256": d["sha256"]} for d in env["documents"]],
    }


@app.get("/v1/envelopes/{envelope_id}/evidence")
def evidence(envelope_id: str, download: str | None = Query(None)):
    env = _get_env(envelope_id)
    if env["status"] != "completed":
        raise _err(409, "ENVELOPE_NOT_COMPLETED")
    pack: dict[str, Any] = {
        "format": "hrsign.evidence.v1",
        "generatedAt": _now(),
        "envelope": {
            "id": env["id"],
            "accountId": env.get("accountId"),
            "subject": env["subject"],
            "status": env["status"],
            "sentAt": env.get("sentAt"),
            "completedAt": env.get("completedAt"),
        },
        "certificateOfCompletion": {
            "envelopeId": env["id"],
            "status": env["status"],
            "subject": env["subject"],
            "completedAt": env["completedAt"],
            "recipients": env["recipients"],
            "documents": env["documents"],
        },
        "documents": env["documents"],
        "recipients": env["recipients"],
        "tabs": env.get("tabs", []),
        "timeline": _EVENTS.get(envelope_id, []),
        "trust": {"signatureProviders": ["IMAGE_SEAL", "HANDWRITE", "PADES", "GM_SM2"]},
    }
    canonical = json.dumps(pack, sort_keys=True, separators=(",", ":"))
    pack["integrity"] = {
        "sha256": hashlib.sha256(canonical.encode()).hexdigest(),
        "algorithm": "sha256",
    }
    if download == "1":
        return Response(
            content=json.dumps(pack, indent=2),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="evidence-{envelope_id}.json"'
            },
        )
    return pack


@app.get("/v1/envelopes/{envelope_id}/comments")
def list_comments(envelope_id: str):
    env = _get_env(envelope_id)
    return {"comments": env.setdefault("_comments", [])}


@app.post("/v1/envelopes/{envelope_id}/comments", status_code=201)
def add_comment(envelope_id: str, body: dict[str, Any]):
    env = _get_env(envelope_id)
    text = (body or {}).get("body") or ""
    if not text.strip():
        raise _err(400, "VALIDATION_FAILED")
    row = {
        "id": f"cmt_{uuid.uuid4().hex[:10]}",
        "body": text.strip(),
        "authorName": "api",
        "documentId": body.get("documentId"),
        "page": body.get("page"),
        "createdAt": _now(),
    }
    env.setdefault("_comments", []).append(row)
    return row


@app.post("/v1/envelopes/{envelope_id}/views/recipient", status_code=201)
def embedded_view(envelope_id: str, body: dict[str, Any]):
    env = _get_env(envelope_id)
    rid = body.get("recipientId")
    ret = body.get("returnUrl")
    if not rid or not ret:
        raise _err(400, "VALIDATION_FAILED")
    rec = next((r for r in env["recipients"] if r["id"] == rid), None)
    if not rec:
        raise _err(404, "RECIPIENT_NOT_FOUND")
    token = secrets.token_urlsafe(18)
    rec["_accessToken"] = token
    return {
        "url": f"{ret.rstrip('/')}/sign/envelope/{envelope_id}?r={rid}&t={token}&embed={token}",
        "expiresAt": _now(),
    }


@app.get("/v1/sign/envelope/{envelope_id}")
def hosted_sign_get(
    envelope_id: str,
    r: str = Query(...),
    t: str | None = Query(None),
    embed: str | None = Query(None),
):
    env = _get_env(envelope_id)
    raw = t or embed
    if not raw:
        raise _err(401, "SIGN_LINK_INVALID")
    rec = _assert_recipient_token(env, r, raw)
    if rec["status"] == "sent":
        rec["status"] = "delivered"
        if env["status"] == "sent":
            env["status"] = "delivered"
            env["updatedAt"] = _now()
        _event(envelope_id, "recipient_viewed", recipientId=r)
    my_tabs = [
        tab
        for tab in env.get("tabs", [])
        if tab.get("recipientId") in (r, None)
    ]
    visible = _filter_visible_tabs(my_tabs)
    return {
        "envelope": {
            "id": env["id"],
            "subject": env["subject"],
            "status": env["status"],
            "emailBlurb": env.get("emailBlurb"),
            "documents": env["documents"],
        },
        "recipient": {
            "id": rec["id"],
            "name": rec["name"],
            "email": rec["email"],
            "status": rec["status"],
            "recipientType": rec["recipientType"],
            "phoneE164": rec.get("phoneE164"),
            "idvMethod": rec.get("idvMethod", "none"),
            "idvStatus": rec.get("idvStatus", "none"),
            "deliveryChannel": rec.get("deliveryChannel", "email"),
        },
        "tabs": visible,
        "idvRequired": bool(
            rec.get("idvMethod", "none") != "none" and rec.get("idvStatus") != "verified"
        ),
    }


@app.post("/v1/sign/envelope/{envelope_id}")
def hosted_sign_post(envelope_id: str, body: dict[str, Any]):
    env = _get_env(envelope_id)
    rid = body.get("recipientId")
    token = body.get("token")
    if not rid or not token:
        raise _err(401, "SIGN_LINK_INVALID")
    _assert_recipient_token(env, rid, token)
    if body.get("decline"):
        rec = next(r for r in env["recipients"] if r["id"] == rid)
        rec["status"] = "declined"
        rec["declinedAt"] = _now()
        rec["declineReason"] = (body.get("declineReason") or "").strip() or None
        env["status"] = "declined"
        env["updatedAt"] = _now()
        _event(envelope_id, "recipient_declined", recipientId=rid)
        _dispatch_connect(
            "envelope.declined",
            {"envelopeId": envelope_id, "recipientId": rid},
        )
        return env
    return sign_recipient(envelope_id, rid, body)


# —— Connect ——
@app.get("/v1/connect/configurations")
def list_connect():
    rows = []
    for c in _CONNECT.values():
        rows.append(
            {
                "configurationId": c["configurationId"],
                "name": c["name"],
                "url": c["url"],
                "events": c["events"],
                "enabled": c["enabled"],
                "secretPrefix": c["secretPrefix"],
                "createdAt": c["createdAt"],
            }
        )
    return {"configurations": rows}


@app.post("/v1/connect/configurations", status_code=201)
def create_connect(body: dict[str, Any]):
    name = (body.get("name") or "").strip()
    url = (body.get("url") or "").strip()
    events = body.get("events") or []
    if not name or not url or not events:
        raise _err(400, "VALIDATION_FAILED")
    for e in events:
        if e not in _CONNECT_EVENTS:
            raise _err(400, "WEBHOOK_EVENT_INVALID")
    secret = f"whsec_{secrets.token_urlsafe(24)}"
    cid = f"conn_{uuid.uuid4().hex[:10]}"
    row = {
        "configurationId": cid,
        "name": name,
        "url": url,
        "events": list(events),
        "enabled": body.get("enabled", True) is not False,
        "secret": secret,
        "secretPrefix": secret[:12],
        "createdAt": _now(),
        "deliveries": [],
    }
    _CONNECT[cid] = row
    return {
        "configurationId": cid,
        "name": name,
        "url": url,
        "events": row["events"],
        "enabled": row["enabled"],
        "secretPrefix": row["secretPrefix"],
        "secret": secret,
        "createdAt": row["createdAt"],
    }


@app.get("/v1/connect/configurations/{configuration_id}")
def get_connect(configuration_id: str):
    c = _CONNECT.get(configuration_id)
    if not c:
        raise _err(404, "CONNECT_NOT_FOUND")
    return {
        "configurationId": c["configurationId"],
        "name": c["name"],
        "url": c["url"],
        "events": c["events"],
        "enabled": c["enabled"],
        "secretPrefix": c["secretPrefix"],
        "createdAt": c["createdAt"],
    }


@app.delete("/v1/connect/configurations/{configuration_id}", status_code=204)
def delete_connect(configuration_id: str):
    if configuration_id not in _CONNECT:
        raise _err(404, "CONNECT_NOT_FOUND")
    del _CONNECT[configuration_id]
    return Response(status_code=204)


# —— PowerForms ——
@app.get("/v1/powerforms")
def list_powerforms():
    return {"powerForms": _POWERFORMS}


@app.post("/v1/powerforms", status_code=201)
def create_powerform(body: dict[str, Any]):
    if not body.get("name") or not body.get("templateId"):
        raise _err(400, "VALIDATION_FAILED")
    slug = f"pf-{uuid.uuid4().hex[:8]}"
    row = {
        "id": f"pf_{uuid.uuid4().hex[:10]}",
        "name": body["name"],
        "templateId": body["templateId"],
        "url": f"/powerforms/{slug}",
        "urlSlug": slug,
    }
    _POWERFORMS.append(row)
    return row


@app.post("/v1/powerforms/{slug}/start", status_code=201)
def start_powerform(slug: str, body: dict[str, Any]):
    pf = next((p for p in _POWERFORMS if p.get("urlSlug") == slug), None)
    if not pf:
        raise _err(404, "POWERFORM_NOT_FOUND")
    if not body.get("name") or not body.get("email"):
        raise _err(400, "VALIDATION_FAILED")
    env = create_envelope(
        CreateEnvelope(
            subject=f"{pf['name']} — {body['name']}",
            emailBlurb=f"Started via PowerForm {pf['name']}",
            documents=[DocumentIn(name="Document.pdf")],
            recipients=[
                RecipientIn(name=body["name"], email=body["email"], recipientType="signer")
            ],
        )
    )
    sent = send_envelope(env["id"])
    access = sent["recipients"][0].get("accessUrl")
    return {"envelopeId": sent["id"], "accessUrl": access, "powerFormId": pf["id"]}


@app.post("/v1/bulk_send_batches", status_code=201)
def bulk_send(body: dict[str, Any]):
    if not body.get("templateId") or not isinstance(body.get("rows"), list):
        raise _err(400, "VALIDATION_FAILED")
    return {
        "batchId": f"bulk_{uuid.uuid4().hex[:10]}",
        "accepted": len(body["rows"]),
        "status": "queued",
    }


# —— Accounts ——
@app.get("/v1/accounts")
def list_accounts():
    return {"accounts": list(_ACCOUNTS.values())}


@app.post("/v1/accounts", status_code=201)
def create_account(body: dict[str, Any]):
    name = (body.get("name") or "").strip()
    if not name:
        raise _err(400, "VALIDATION_FAILED")
    slug = (body.get("slug") or name.lower().replace(" ", "-"))[:48]
    aid = f"acct_{uuid.uuid4().hex[:10]}"
    row = {
        "accountId": aid,
        "name": name,
        "slug": slug,
        "members": [],
        "brands": [],
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    _ACCOUNTS[aid] = row
    return row


@app.get("/v1/accounts/{account_id}")
def get_account(account_id: str):
    row = _ACCOUNTS.get(account_id)
    if not row:
        raise _err(404, "ACCOUNT_NOT_FOUND")
    return row


@app.get("/v1/accounts/{account_id}/members")
def list_members(account_id: str):
    row = _ACCOUNTS.get(account_id)
    if not row:
        raise _err(404, "ACCOUNT_NOT_FOUND")
    return {"members": row.get("members", [])}


@app.post("/v1/accounts/{account_id}/members", status_code=201)
def add_member(account_id: str, body: dict[str, Any]):
    row = _ACCOUNTS.get(account_id)
    if not row:
        raise _err(404, "ACCOUNT_NOT_FOUND")
    email = (body.get("email") or "").strip().lower()
    if not email:
        raise _err(400, "VALIDATION_FAILED")
    member = {
        "memberId": f"mem_{uuid.uuid4().hex[:8]}",
        "email": email,
        "role": body.get("role") or "sender",
        "name": body.get("name"),
    }
    row.setdefault("members", []).append(member)
    return member


@app.get("/v1/accounts/{account_id}/brands")
def list_brands(account_id: str):
    row = _ACCOUNTS.get(account_id)
    if not row:
        raise _err(404, "ACCOUNT_NOT_FOUND")
    return {"brands": row.get("brands", [])}


@app.post("/v1/accounts/{account_id}/brands", status_code=201)
def create_brand(account_id: str, body: dict[str, Any]):
    row = _ACCOUNTS.get(account_id)
    if not row:
        raise _err(404, "ACCOUNT_NOT_FOUND")
    if not body.get("brandName"):
        raise _err(400, "VALIDATION_FAILED")
    brand = {
        "brandId": f"br_{uuid.uuid4().hex[:8]}",
        "brandName": body["brandName"],
        "primaryColor": body.get("primaryColor") or "#1a1a1a",
    }
    row.setdefault("brands", []).append(brand)
    return brand


# —— Clickwrap / Rooms / CLM / Notary ——
@app.get("/v1/clickwraps")
def list_clickwraps():
    return {
        "clickwraps": [
            {
                "clickwrapId": c["id"],
                "name": c["name"],
                "displayName": c.get("displayName") or c["name"],
                "status": c["status"],
                "version": c.get("version", 1),
                "acceptanceCount": len(c.get("acceptances", [])),
            }
            for c in _CLICKWRAPS.values()
        ]
    }


@app.post("/v1/clickwraps", status_code=201)
def create_clickwrap(body: dict[str, Any]):
    if not body.get("name"):
        raise _err(400, "VALIDATION_FAILED")
    cid = f"cw_{uuid.uuid4().hex[:10]}"
    row = {
        "id": cid,
        "name": body["name"],
        "displayName": body.get("displayName") or body["name"],
        "status": body.get("status") or "active",
        "bodyHtml": body.get("bodyHtml") or "<p>I agree.</p>",
        "version": 1,
        "requireScroll": bool(body.get("requireScroll")),
        "acceptances": [],
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    _CLICKWRAPS[cid] = row
    return {
        "clickwrapId": cid,
        "name": row["name"],
        "displayName": row["displayName"],
        "status": row["status"],
        "version": 1,
        "bodyHtml": row["bodyHtml"],
    }


@app.post("/v1/clickwraps/{clickwrap_id}/accept", status_code=201)
def accept_clickwrap(clickwrap_id: str, body: dict[str, Any]):
    cw = _CLICKWRAPS.get(clickwrap_id)
    if not cw or cw["status"] != "active":
        raise _err(404, "CLICKWRAP_NOT_FOUND")
    email = (body.get("acceptorEmail") or "").strip().lower()
    if not email:
        raise _err(400, "VALIDATION_FAILED")
    doc_hash = hashlib.sha256(f"{cw['id']}:{cw['version']}:{cw['bodyHtml']}".encode()).hexdigest()
    acceptance = {
        "acceptanceId": f"acc_{uuid.uuid4().hex[:10]}",
        "clickwrapId": cw["id"],
        "version": cw["version"],
        "documentHash": doc_hash,
        "acceptedAt": _now(),
    }
    cw.setdefault("acceptances", []).append(acceptance)
    return acceptance


@app.get("/v1/rooms")
def list_rooms():
    return {"rooms": list(_ROOMS.values())}


@app.post("/v1/rooms", status_code=201)
def create_room(body: dict[str, Any]):
    if not body.get("name"):
        raise _err(400, "VALIDATION_FAILED")
    rid = f"room_{uuid.uuid4().hex[:10]}"
    members = [
        {
            "memberId": f"rm_{uuid.uuid4().hex[:6]}",
            "name": m.get("name") or m.get("email"),
            "email": m.get("email"),
            "role": m.get("role") or "viewer",
        }
        for m in (body.get("members") or [])
    ]
    row = {
        "roomId": rid,
        "name": body["name"],
        "status": "active",
        "description": body.get("description"),
        "members": members,
        "documents": [],
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    _ROOMS[rid] = row
    return row


@app.get("/v1/clm/agreements")
def list_clm():
    return {"agreements": list(_CLM.values())}


@app.post("/v1/clm/agreements", status_code=201)
def create_clm(body: dict[str, Any]):
    if not body.get("name"):
        raise _err(400, "VALIDATION_FAILED")
    aid = f"clm_{uuid.uuid4().hex[:10]}"
    row = {
        "agreementId": aid,
        "name": body["name"],
        "status": body.get("status") or "draft",
        "counterparty": body.get("counterparty"),
        "envelopeId": body.get("envelopeId"),
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    _CLM[aid] = row
    return row


@app.patch("/v1/clm/agreements/{agreement_id}")
def patch_clm(agreement_id: str, body: dict[str, Any]):
    row = _CLM.get(agreement_id)
    if not row:
        raise _err(404, "CLM_AGREEMENT_NOT_FOUND")
    if body.get("status"):
        row["status"] = body["status"]
    if "notes" in body:
        row["notes"] = body["notes"]
    row["updatedAt"] = _now()
    return row


@app.get("/v1/notary/transactions")
def list_notary():
    return {"transactions": list(_NOTARY.values())}


@app.post("/v1/notary/transactions", status_code=201)
def create_notary(body: dict[str, Any]):
    tid = f"not_{uuid.uuid4().hex[:10]}"
    row = {
        "transactionId": tid,
        "status": "scheduled" if body.get("scheduledAt") else "created",
        "envelopeId": body.get("envelopeId"),
        "notaryName": body.get("notaryName"),
        "jurisdiction": body.get("jurisdiction"),
        "scheduledAt": body.get("scheduledAt"),
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    _NOTARY[tid] = row
    return row


@app.patch("/v1/notary/transactions/{transaction_id}")
def patch_notary(transaction_id: str, body: dict[str, Any]):
    row = _NOTARY.get(transaction_id)
    if not row:
        raise _err(404, "NOTARY_TX_NOT_FOUND")
    if body.get("status"):
        row["status"] = body["status"]
        if body["status"] == "completed":
            row["completedAt"] = _now()
    row["updatedAt"] = _now()
    return row


# —— IDV (in-memory OTP) ——
@app.post("/v1/identity/challenge", status_code=201)
def idv_challenge(body: dict[str, Any]):
    method = body.get("method") or "email_otp"
    target = body.get("target") or ""
    if not target:
        raise _err(400, "VALIDATION_FAILED")
    if method in ("kba", "id_document", "face"):
        raise _err(501, "IDV_METHOD_NOT_IMPLEMENTED")
    code = f"{secrets.randbelow(1_000_000):06d}"
    vid = f"idv_{uuid.uuid4().hex[:12]}"
    _IDV[vid] = {
        "codeHash": hashlib.sha256(code.encode()).hexdigest(),
        "method": method,
        "target": target,
        "expiresAt": time.time() + 600,
    }
    # Dev: code returned only when HRSIGN_DEV_OTP=1
    out: dict[str, Any] = {
        "verificationId": vid,
        "method": method,
        "status": "pending",
        "expiresAt": _now(),
    }
    import os

    if os.getenv("HRSIGN_DEV_OTP") == "1":
        out["devCode"] = code
    return out


@app.post("/v1/identity/verify")
def idv_verify(body: dict[str, Any]):
    vid = body.get("verificationId")
    code = (body.get("code") or "").strip()
    row = _IDV.get(vid or "")
    if not row:
        return {"status": "failed", "remainingAttempts": 0}
    if time.time() > row["expiresAt"]:
        return {"status": "expired", "remainingAttempts": 0}
    ok = hashlib.sha256(code.encode()).hexdigest() == row["codeHash"]
    return {"status": "verified" if ok else "failed", "remainingAttempts": 0 if ok else 3}


# seed timestamps
_ACCOUNTS["acct_default"]["createdAt"] = _now()
_ACCOUNTS["acct_default"]["updatedAt"] = _now()
