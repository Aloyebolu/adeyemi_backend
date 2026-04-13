## 1. Purpose

This document defines how **issued certificates are verified and, in rare cases, revoked**.

Verification enables **external trust**.
Revocation exists for **legal, compliance, or fraud-related exceptions only**.

Both processes are **strictly controlled and auditable**.

---

## 2. Certificate Verification

### 2.1 Verification Use Cases

Certificate verification may be performed by:

* Employers
* Educational institutions
* Government bodies
* Third-party platforms

Verification confirms:

* Certificate authenticity
* Issuance authority
* Internship completion validity

---

### 2.2 Verification Mechanism

Certificates include:

* Unique verification code
* Optional QR code

Verification is performed via a **public, read-only endpoint**.

Example verification response:

```json
{
  "certificateId": "cert_9012",
  "status": "active",
  "studentName": "Aarav Sharma",
  "internshipTitle": "Frontend Developer Intern",
  "issuedAt": "2026-05-15T10:00:00Z",
  "issuer": "Virtual Internship Platform"
}
```

No additional personal data is exposed.

---

## 3. Verification Constraints

* Verification does **not** require authentication
* Rate limiting is enforced
* Verification responses are immutable views
* No downloadable artifacts via verification endpoints

---

## 4. Certificate Revocation

### 4.1 Revocation Authority

Certificates may be revoked only by:

* Admin
* Authorized issuing authority (under admin control)

Students and employers **cannot** request or perform revocation.

---

### 4.2 Valid Revocation Reasons

Revocation is permitted only for:

* Fraudulent information discovered post-issuance
* Legal or regulatory requirement
* Systemic issuance error
* Proven policy violation

Revocation reasons are mandatory and logged.

---

## 5. Revocation Effects

When a certificate is revoked:

* Certificate status → `revoked`
* Verification endpoint reflects revocation
* Certificate file remains accessible but watermarked as revoked
* Student is notified with reason (sanitized)

Revocation does **not**:

* Delete the certificate
* Modify internship history
* Alter KPI data

---

## 6. Revocation Object (Conceptual)

```json
{
  "certificateId": "cert_9012",
  "revokedAt": "2026-06-01T12:00:00Z",
  "revokedBy": "admin_22",
  "reason": "Post-issuance fraud detected"
}
```

---

## 7. Immutability & Audit

* Revocation records are immutable
* Revocation cannot be undone
* All revocations are permanently auditable

If a replacement certificate is legally required, it must:

* Reference the revoked certificate
* Carry a new verification code

---

## 8. Visibility Rules

| Role              | Visibility                 |
| ----------------- | -------------------------- |
| Student           | Revocation status + reason |
| Employer          | ❌ None                     |
| Admin             | Full                       |
| External Verifier | Status only                |

---

## 9. Error Scenarios

### 9.1 Invalid Verification Code

```json
{
  "error": {
    "code": "CERTIFICATE_NOT_FOUND",
    "message": "Certificate could not be verified"
  }
}
```

---

### 9.2 Unauthorized Revocation Attempt

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not authorized to revoke certificates"
  }
}
```

---

## 10. Non-Negotiable Constraints

* No silent revocations
* No student-initiated revocations
* No retroactive KPI changes
* No certificate deletion

---

## 🔒 Lock Statement

Certificate verification and revocation are **legally sensitive, final operations**.
No domain may bypass or weaken these rules.