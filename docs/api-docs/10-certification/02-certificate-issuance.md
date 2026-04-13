## 1. Purpose

This document defines **how certificates are issued** once an internship is completed and deemed eligible.

Certificate issuance is a **controlled, admin-authorized act** that converts completion into **official recognition**.

---

## 2. Issuance Authority

Certificates may be issued only by:

* **Admin**
* Authorized partner entities (e.g., NGO, Government body)
  → acting under admin-delegated authority

Students and employers **cannot** issue certificates.

---

## 3. Issuance Preconditions (Hard Rules)

A certificate may be issued only if:

* Internship state = `completed`
* Completion eligibility = `true`
* Certification snapshot has been successfully created
* No active compliance or legal holds exist

All checks are enforced server-side.

---

## 4. Certificate Snapshot (Immutable)

At issuance time, the system locks a **certification snapshot** containing:

* Student identity (profile snapshot)
* Internship details
* Internship duration
* Final KPI results
* Employer evaluation
* Issuing authority metadata
* Issuance timestamp

This snapshot is:

* Immutable
* Versioned
* Legally authoritative

---

## 5. Certificate Object (Conceptual)

```json
{
  "certificateId": "cert_9012",
  "studentId": "user_12345",
  "internshipInstanceId": "inst_3001",
  "issuedBy": "admin_22",
  "issuedAt": "2026-05-15T10:00:00Z",
  "status": "active",
  "verificationCode": "VRT-9X21-PLM8"
}
```

---

## 6. Issuance Flow

### 6.1 Admin Action

When an authorized issuer initiates issuance:

1. System re-validates completion eligibility
2. Certification snapshot is finalized
3. Certificate record is created
4. Certificate file is generated (PDF or equivalent)
5. Certificate status set to `active`
6. Student is notified

All steps are **atomic**.

---

## 7. Certificate File Rules

* Certificate files are generated server-side
* Files are immutable once generated
* Files include:

  * Student name
  * Internship title
  * Duration
  * Issuing authority
  * Verification code / QR

Re-generation creates a **new file version**, not a new certificate.

---

## 8. Multiple Certificates Constraint

* One certificate per internship instance
* Re-issuance is allowed only for:

  * Formatting corrections
  * Authority branding changes

Re-issuance does **not** change certificate ID.

---

## 9. Visibility & Access

| Role              | Access                          |
| ----------------- | ------------------------------- |
| Student           | View & download own certificate |
| Employer          | ❌ None                          |
| Admin             | Full access                     |
| External Verifier | Verification-only endpoint      |

---

## 10. Error Scenarios

### 10.1 Issuance Not Allowed

```json
{
  "error": {
    "code": "CERTIFICATE_ISSUANCE_NOT_ALLOWED",
    "message": "Internship is not eligible for certification"
  }
}
```

---

### 10.2 Duplicate Issuance Attempt

```json
{
  "error": {
    "code": "CERTIFICATE_ALREADY_ISSUED",
    "message": "A certificate has already been issued for this internship"
  }
}
```

---

## 11. Non-Negotiable Constraints

* No student-initiated issuance
* No employer-initiated issuance
* No KPI overrides
* No silent issuance

---

## 🔒 Lock Statement

Certificate issuance is a **final, authoritative act**.
No domain may issue certificates outside this flow.