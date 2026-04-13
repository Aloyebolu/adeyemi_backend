## 1. Purpose

This document defines the **document verification process**, including:

* Which documents require verification
* Who can verify them
* Verification states and transitions
* Effects on profile eligibility and downstream gates

Document verification is **compliance-critical** and strictly admin-controlled.

---

## 2. Documents Subject to Verification

| Document Type   | Verification Required |
| --------------- | --------------------- |
| Resume          | ❌                     |
| Identity Proof  | ✅                     |
| Education Proof | Optional              |
| Offer Letter    | System-generated      |
| Certificate     | System-generated      |

Only verified documents influence **profile state progression**.

---

## 3. Verification Authority

* Only **Admins** may verify or reject documents
* Students cannot self-verify
* Employers have **no access** to verification controls or status

All verification actions are **audited**.

---

## 4. Verification States

Each document exists in exactly one state:

| State      | Meaning                         |
| ---------- | ------------------------------- |
| `uploaded` | File submitted, not reviewed    |
| `verified` | Approved by admin               |
| `rejected` | Explicitly rejected with reason |

No other states are valid.

---

## 5. Verification Flow

### 5.1 Admin Review

Admin reviews:

* File content
* Legibility
* Consistency with profile data

Admin chooses:

* **Verify**
* **Reject (with reason)**

---

### 5.2 Verify Action

On verification:

* Document is locked permanently
* File becomes immutable
* Verification timestamp and admin ID are recorded

This may trigger profile state progression.

---

### 5.3 Reject Action

On rejection:

* Rejection reason is mandatory
* Student may upload a replacement
* Rejected files remain archived

---

## 6. Profile State Impact

| Condition                      | Resulting Profile State |
| ------------------------------ | ----------------------- |
| Identity verified              | `verified_partial`      |
| All required docs verified     | `verified_full`         |
| Verified doc later invalidated | ❌ Not allowed           |

Once verified, a document **cannot be unverified**.

---

## 7. Replacement Rules

| Scenario                | Allowed |
| ----------------------- | ------- |
| Uploaded but unverified | ✅       |
| Rejected                | ✅       |
| Verified                | ❌       |
| Profile locked          | ❌       |

Replacement always creates a **new document record**.

---

## 8. Student Notifications

Students are notified when:

* A document is verified
* A document is rejected
* Verification status affects eligibility

Notifications include:

* Document type
* Outcome
* Rejection reason (if applicable)

---

## 9. Error Examples

### 9.1 Verification Attempt by Non-Admin

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Only admins may verify documents"
  }
}
```

---

### 9.2 Missing Rejection Reason

```json
{
  "error": {
    "code": "REJECTION_REASON_REQUIRED",
    "message": "A reason is required to reject a document"
  }
}
```

---

## 🔒 Lock Statement

Document verification rules are **final and binding**.
No domain may weaken or bypass them.
