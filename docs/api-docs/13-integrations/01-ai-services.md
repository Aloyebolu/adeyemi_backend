## 1. Purpose

This document defines how **data corrections** are performed when **incorrect or inconsistent data** exists due to user error, system error, or external factors.

Data corrections are **surgical fixes**, not retroactive rewrites.

---

## 2. Data Correction vs Override (Important)

| Aspect    | Override         | Data Correction |
| --------- | ---------------- | --------------- |
| Intent    | Policy / control | Data accuracy   |
| Scope     | Behavioral       | Factual         |
| Frequency | Rare             | Very rare       |
| History   | Preserved        | Preserved       |

Both are auditable, but **corrections focus strictly on factual inaccuracies**.

---

## 3. Who Can Perform Data Corrections

Only users with role:

* `super_admin`

Standard admins **cannot** perform data corrections.

---

## 4. Valid Data Correction Scenarios

Data corrections are permitted only for:

* Proven system bugs
* Verified data corruption
* External authority corrections (legal name spelling, institution rename)
* Migration or integration errors

Corrections are **never permitted** for:

* Performance outcomes
* KPI results
* Evaluations
* Certification eligibility

---

## 5. Correction Rules (Non-Negotiable)

All data corrections must:

* Be backed by evidence
* Be minimal in scope
* Preserve original values
* Create a full audit trail
* Never alter derived outcomes

If a correction would change an outcome, **it must not be performed**.

---

## 6. Data Correction Flow

1. Issue is identified
2. Evidence is attached
3. Super admin proposes correction
4. Backend validates correction scope
5. Correction is applied
6. Audit trail is written
7. Impacted users are notified (if applicable)

No step is optional.

---

## 7. Data Correction Record (Canonical)

```json
{
  "correctionId": "corr_1188",
  "performedBy": "super_admin_01",
  "targetType": "user_profile",
  "targetId": "profile_9f8a21",
  "field": "education.institution",
  "oldValue": "ABC College",
  "newValue": "ABC Institute of Technology",
  "reason": "Institution renamed officially in 2024",
  "occurredAt": "2026-01-15T09:00:00Z"
}
```

Original values are **never deleted**.

---

## 8. Visibility Rules

| Role        | Visibility               |
| ----------- | ------------------------ |
| Student     | Outcome only (sanitized) |
| Employer    | ❌ None                   |
| Admin       | Limited                  |
| Super Admin | Full                     |
| Auditor     | Full                     |

Internal evidence is never exposed to end users.

---

## 9. Reversibility

* Corrections may be reversed only by:

  * Another data correction
* Reversal requires:

  * New evidence
  * New audit record

No silent rollback is allowed.

---

## 10. Error Scenarios

### 10.1 Correction Not Allowed

```json
{
  "error": {
    "code": "DATA_CORRECTION_NOT_ALLOWED",
    "message": "This data cannot be corrected due to policy constraints"
  }
}
```

---

## 11. Non-Negotiable Constraints

* No bulk corrections
* No automated corrections
* No correction without audit
* No correction affecting certificates

---

## 🔒 Lock Statement

Data corrections are **last-resort factual fixes**.
If correction risks trust, it must not be performed.

---