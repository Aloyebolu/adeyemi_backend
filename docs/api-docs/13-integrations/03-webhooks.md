## 1. Purpose

This document defines how **webhooks** are used to notify **external systems** about significant platform events.

Webhooks are **outbound-only integration mechanisms**.
They inform — they do not instruct.

---

## 2. Canonical Constraints (Absolute)

All webhook integrations must obey these rules:

* Webhooks are **outbound only**
* External systems **cannot** trigger platform actions via webhooks
* Webhooks **never** carry authority
* Webhooks **never** replace internal events or logs
* All webhook deliveries are **logged and auditable**

If a webhook fails, **nothing inside the platform changes**.

---

## 3. Approved Webhook Use Cases

Webhooks may be used to notify partners about:

* Internship started
* Internship completed
* Certificate issued
* Certificate revoked
* Compliance status changes (high-level only)

Webhooks must **never** expose internal decision logic.

---

## 4. Webhook Event Model

Each webhook payload represents **a single immutable event**.

Example payload:

```json
{
  "event": "CERTIFICATE_ISSUED",
  "occurredAt": "2026-05-15T10:00:00Z",
  "data": {
    "certificateId": "cert_9012",
    "studentId": "external_ref_441",
    "internshipId": "external_ref_7781"
  }
}
```

IDs may be **mapped or masked** for partner systems.

---

## 5. Delivery Guarantees

* Webhooks are delivered **at least once**
* Duplicate deliveries are possible
* Partners must handle idempotency

No exactly-once guarantees are provided.

---

## 6. Retry & Backoff Strategy

* Automatic retries on failure
* Exponential backoff
* Retry limit enforced
* Permanent failures are logged

Webhook retries **do not block** core workflows.

---

## 7. Security & Verification

* Webhooks are signed (HMAC or equivalent)
* Shared secrets are rotated periodically
* TLS is mandatory
* IP allow-listing supported

Unsigned or invalid payloads must be rejected by receivers.

---

## 8. Configuration Rules

Each webhook subscription defines:

* Subscribed event types
* Target endpoint
* Secret
* Retry policy
* Active / inactive state

Changes require admin approval and are audited.

---

## 9. Visibility & Control

| Role     | Visibility                         |
| -------- | ---------------------------------- |
| Student  | ❌ None                             |
| Employer | ❌ None                             |
| Admin    | Full configuration & delivery logs |
| Auditor  | Read-only logs                     |

End users never manage webhooks.

---

## 10. Error Scenarios

### 10.1 Delivery Failure

```json
{
  "error": {
    "code": "WEBHOOK_DELIVERY_FAILED",
    "message": "Webhook delivery failed after retries"
  }
}
```

This error is **internal only**.

---

## 11. Non-Negotiable Constraints

* No inbound webhooks
* No synchronous blocking
* No business logic delegation
* No hidden webhook consumers

---

## 🔒 Lock Statement

Webhooks are **notification channels, not control planes**.
No external system may influence platform state via webhooks.