## 1. Purpose

This document lists **common implementation and design mistakes** observed in systems of this scale, along with the **correct canonical approach** used in this platform.

This appendix exists to:

* Prevent regressions
* Align frontend and backend thinking
* Stop “quick fixes” from becoming technical debt

If a mistake appears here, it has already happened somewhere before.

---

## 2. Mistake: Trusting the Frontend

### ❌ Wrong

* Frontend disables buttons and assumes rules are enforced
* Backend accepts requests without re-validating gates

### ✅ Correct

* Frontend is **advisory**
* Backend re-validates **all** gates, states, and permissions
* UI checks exist only for UX

> Backend is always the final enforcer.

---

## 3. Mistake: Using AI as an Authority

### ❌ Wrong

* AI auto-shortlists candidates
* AI decides eligibility
* AI-generated scores drive completion

### ✅ Correct

* AI outputs are **advisory only**
* All AI decisions are reversible or ignorable
* System rules override AI in all cases

---

## 4. Mistake: Editing History

### ❌ Wrong

* Modifying attendance records
* Editing task submissions
* Updating KPI scores retroactively

### ✅ Correct

* All historical data is **append-only**
* Corrections use:

  * Overrides
  * Annotations
  * New records

History is never rewritten.

---

## 5. Mistake: Silent Admin Actions

### ❌ Wrong

* Admin fixes something “quietly”
* No reason recorded
* No audit trail

### ✅ Correct

* Every admin action:

  * Requires intent
  * Requires reason
  * Writes audit logs
  * Notifies affected users (unless prohibited)

Silence is a policy violation.

---

## 6. Mistake: Blurring Domain Boundaries

### ❌ Wrong

* Application logic inside discovery
* KPI logic inside execution
* Certification logic inside admin UI

### ✅ Correct

* Each domain owns **only its responsibilities**
* Cross-domain effects happen via:

  * Events
  * Snapshots
  * Explicit transitions

---

## 7. Mistake: Allowing Partial Completion

### ❌ Wrong

* Completing internship without evaluation
* Issuing certificate with missing KPIs
* Ignoring minimum duration

### ✅ Correct

* Completion is **all-or-nothing**
* Missing any mandatory requirement blocks completion
* No partial certificates

---

## 8. Mistake: Leaking Internal Data

### ❌ Wrong

* Showing KPI formulas to students
* Exposing admin notes
* Revealing AI scores

### ✅ Correct

* Students see:

  * Status
  * Progress
  * Outcomes
* Internal mechanics stay internal

---

## 9. Mistake: Overloading Error Messages

### ❌ Wrong

* Stack traces in API responses
* Internal IDs in errors
* Ambiguous error codes

### ✅ Correct

* Stable error codes
* Clear human messages
* Internal details logged only

---

## 10. Mistake: Making Integrations Critical

### ❌ Wrong

* System fails if email provider is down
* AI outage blocks discovery
* Webhook failure stops certification

### ✅ Correct

* Integrations are **best-effort**
* Core workflows are independent
* Failures degrade gracefully

---

## 🔒 Lock Statement

If an implementation choice contradicts this document,
**the implementation is wrong** — not the documentation.