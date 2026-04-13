## 1. Purpose

This document defines **audit trails**, which are **immutable, admin-only records** of sensitive or high-impact actions across the platform.

Audit trails exist to support:

* Compliance
* Legal accountability
* Security investigations
* Internal governance

They record **who did what, when, and why**.

---

## 2. Audit Trails vs Other Logs

| Aspect      | Activity Logs | Audit Trails   |
| ----------- | ------------- | -------------- |
| Audience    | Users         | Admins only    |
| Sensitivity | Low–Medium    | High           |
| Mutability  | Immutable     | Immutable      |
| Purpose     | Transparency  | Accountability |

Audit trails are **never user-visible**.

---

## 3. Actions That Require Audit Trails

Audit trails are mandatory for actions including (but not limited to):

### Admin Actions

* Profile overrides
* Document verification / rejection
* Profile locking / unlocking
* Internship termination
* KPI threshold enforcement actions
* Certificate issuance
* Certificate revocation

---

### System Actions

* Automatic internship termination
* Compliance holds
* Security-related access denials
* Critical background job failures

---

## 4. Audit Trail Object (Canonical)

```json
{
  "auditId": "audit_5501",
  "actorId": "admin_22",
  "actorRole": "admin",
  "action": "CERTIFICATE_REVOKED",
  "targetType": "certificate",
  "targetId": "cert_9012",
  "reason": "Post-issuance fraud detected",
  "occurredAt": "2026-06-01T12:00:00Z",
  "metadata": {
    "internshipInstanceId": "inst_3001"
  }
}
```

---

## 5. Immutability & Retention

* Audit trails are **append-only**
* Cannot be edited or deleted
* Retention period is policy-defined (default: permanent)
* Stored in secure, access-controlled storage

---

## 6. Access Control

Only users with:

* Role: `admin`
* Explicit permission: `AUDIT_VIEW`

may access audit trails.

All audit trail access is **itself audited**.

---

## 7. Audit Query Rules

* Queries are read-only
* Filters allowed by:

  * Date range
  * Actor
  * Action type
  * Target type
* Bulk export requires elevated approval

---

## 8. Privacy & Redaction

Audit trails may contain sensitive data.

Rules:

* No PII unless strictly required
* No raw documents or files
* Metadata must be minimal and relevant

Redaction is **not allowed** after creation.

---

## 9. Error Scenarios

### 9.1 Unauthorized Audit Access

```json
{
  "error": {
    "code": "AUDIT_ACCESS_DENIED",
    "message": "You are not authorized to access audit trails"
  }
}
```

---

## 10. Non-Negotiable Constraints

* No audit suppression
* No audit editing
* No admin bypass
* No client-side audit logic

---

## 🔒 Lock Statement

Audit trails are the **highest-trust records in the system**.
If an action is not auditable here, it must not exist.