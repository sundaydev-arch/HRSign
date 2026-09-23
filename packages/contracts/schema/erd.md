# Envelope domain ERD

```mermaid
erDiagram
  Account ||--o{ Envelope : owns
  Account ||--o{ Brand : has
  User ||--o{ Envelope : creates
  Envelope ||--|{ EnvelopeDocument : contains
  Envelope ||--|{ Recipient : routes
  EnvelopeDocument ||--o{ Tab : places
  Recipient ||--o{ Tab : assigned
  Envelope ||--o| CertificateOfCompletion : produces
  Envelope ||--o{ EnvelopeComment : discusses
  Envelope ||--o{ EnvelopeEvent : audits

  Account {
    string id PK
    string name
    string slug
  }

  Envelope {
    string id PK
    string accountId FK
    string status
    string subject
    string emailBlurb
    datetime sentAt
    datetime completedAt
    datetime voidedAt
    string voidReason
    datetime expiresAt
    string legacyTaskId
  }

  EnvelopeDocument {
    string id PK
    string envelopeId FK
    int documentOrder
    string name
    string storageKey
    string sha256
    int pageCount
  }

  Recipient {
    string id PK
    string envelopeId FK
    string recipientType
    int routingOrder
    string name
    string email
    string status
    string userId
    string accessTokenHash
  }

  Tab {
    string id PK
    string envelopeDocumentId FK
    string recipientId FK
    string tabType
    json coordinates
    boolean required
    string value
    json conditional
  }
```

## Status enums

See `state-machines/envelope.yaml` and `state-machines/recipient.yaml`.

## Legacy bridge

`Envelope.legacyTaskId` → optional FK to `SigningTask` for dual-read during migration.
Older HR APIs (`/api/tasks`) remain until UI cutover completes.
