# PAdES / operator CA setup

HRSign Phase 1 defaults to visual seals. Cryptographic PAdES (PKCS#7 detached CMS) is available when you supply an organization certificate.

## Enable

Set in `.env` (or upload PEMs via admin settings when supported):

```bash
PADES_CERT_PEM="-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----"
PADES_KEY_PEM="-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----"
```

Or file paths:

```bash
PADES_CERT_PATH=/secrets/org.crt
PADES_KEY_PATH=/secrets/org.key
```

Restart the app. `GET /api/v1/trust/providers` should show `PADES` with `status: "available"` and `configured: true`.

## Legal note

This stack produces **demo / internal evidence** PKCS#7 signatures (PAdES-B-B style). It is **not**:

- PAdES-B-LTV with OCSP/CRL
- A PRC 《电子签名法》可靠电子签名 product claim
- eIDAS qualified electronic signature

Use your CA’s issuance policy and legal counsel for production compliance. Third-party CA adapters can plug in via `SignatureProvider`.
