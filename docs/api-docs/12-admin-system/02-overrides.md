## 1. Purpose

This document defines **admin override mechanisms** — controlled actions that allow admins to intervene when the system’s automated rules cannot safely resolve an edge case.

Overrides exist to **correct reality**, not to bend rules.

---

## 2. Override Philosophy (Non-Negotiable)

Admin overrides must always be:

* **Exceptional** (not routine)
* **Explicit** (never implicit)
* **Justified** (reason required)
* **Auditable** (immutable logs)
* **Non-destructive** (history preserved)

Overrides **do not rewrite canon** and **do not change historical outcomes**.

---

## 3. What an Override Is (and Is Not)

### 3.1 Overrides ARE

* Manual interventions for edge cases
* Corrective actions when automation fails
* Safety valves for legal/compliance issues

### 3.2 Overrides are NOT

* Shortcuts
* Optimizations
* Alternatives to fixing bugs
* Ways to bypass gates or KPIs

---

## 4. Allowed Override Types

### 4.1 Profile Overrides

* Correct verified profile fields
* Lock or unlock profiles (policy-bound)
* Attach compliance flags

**Constraints**

* Cannot change ownership
* Cannot alter snapshots
* Cannot fabricate completion

---

### 4.2 Document Overrides

* Verify or reject documents
* Annotate documents with internal notes

**Constraints**

* Cannot modify file contents
* Cannot unverify verified documents
* Cannot delete documents

---

### 4.3 Internship Overrides

* Pause an internship
* Terminate an internship early (with cause)
* Resolve compliance holds

**Constraints**

* Cannot mark internship as completed
* Cannot bypass duration rules
* Cannot alter KPI data

---

### 4.4 Certificate Overrides

* Approve revocation
* Approve re-issuance (formatting only)

**Constraints**

* Cannot issue without eligibility
* Cannot modify certificate data
* Cannot hide revocation

---

## 5. Override Execution Flow

Every override follows the same flow:

1. Admin selects override action
2. Admin provides mandatory reason
3. Backend validates:

   * Permission
   * Preconditions
   * Policy compliance
4. Override is executed
5. Audit trail is written
6. Affected parties are notified (unless prohibited)

No step is optional.

---

## 6. Override Record (Canonical)

```json
{
  "overrideId": "ovr_4412",
  "adminId": "admin_22",
  "actionType": "INTERNSHIP_PAUSED",
  "targetType": "internship_instance",
  "targetId": "inst_3001",
  "reason": "Compliance investigation initiated",
  "occurredAt": "2026-03-10T09:45:00Z"
}
```

Override records are immutable.

---

## 7. Visibility Rules

| Role     | Visibility                 |
| -------- | -------------------------- |
| Student  | Outcome only (sanitized)   |
| Employer | Outcome only (if relevant) |
| Admin    | Full details               |
| Auditor  | Full details               |

Internal reasoning is never exposed to end users.

---

## 8. Reversibility Rules

* Some overrides are reversible (policy-defined)
* Reversal is itself a **new override**
* Original override remains unchanged

No “undo” without trace.

---

## 9. Error Scenarios

### 9.1 Override Not Allowed

```json
{
  "error": {
    "code": "OVERRIDE_NOT_ALLOWED",
    "message": "This override is not permitted by policy"
  }
}
```

---

### 9.2 Missing Reason

```json
{
  "error": {
    "code": "OVERRIDE_REASON_REQUIRED",
    "message": "A reason is required to perform this override"
  }
}
```

---

## 10. Non-Negotiable Constraints

* No silent overrides
* No batch overrides
* No override-only workflows
* No override without audit

---

## 🔒 Lock Statement

Overrides are **controlled exceptions**, not alternative logic paths.
Anything not explicitly allowed here is forbidden.