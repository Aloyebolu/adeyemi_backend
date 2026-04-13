## 1. Purpose

This document defines the **exact criteria** that must be satisfied before an internship is considered **completed and eligible for certification**.

Completion is a **system decision**, not a user action.

---

## 2. Completion vs Certification (Important Distinction)

* **Completion** → Internship execution has ended successfully
* **Certification** → An official certificate has been issued

An internship may be *completed* but **not yet certified**.

---

## 3. Mandatory Completion Conditions

All of the following conditions **must be true simultaneously**:

### 3.1 Duration Requirement

* Internship must run for **at least the minimum duration**
* Minimum duration is defined per internship
* Early completion is **not allowed**, regardless of performance

Duration is calculated using:

* Internship start date
* Current or termination date
* Calendar days (not working days)

---

### 3.2 Attendance Requirement

* Attendance KPI must meet minimum threshold
* Missed days are allowed within tolerance
* Attendance data is final and immutable

Failure blocks completion.

---

### 3.3 Task Completion Requirement

* All **mandatory tasks** must be submitted
* Task quality does not affect completion directly
* Missing mandatory tasks blocks completion

Late submissions are allowed but penalized in KPIs.

---

### 3.4 Training Completion Requirement

* All **mandatory training modules** must be completed
* Optional modules do not affect completion
* Late completion may be penalized but allowed

---

### 3.5 KPI Thresholds

* All **mandatory KPIs** must be finalized
* All mandatory KPIs must meet minimum thresholds
* Thresholds are backend-defined and immutable

Admins cannot override KPI thresholds.

---

### 3.6 Employer Evaluation

* Employer evaluation must be submitted
* Evaluation must be complete
* Partial evaluations are not allowed

Missing evaluation blocks completion.

---

## 4. Completion Readiness State

When all conditions are met:

* Internship state transitions to `ready_for_completion`
* System marks internship as **completion-eligible**
* No user-visible action occurs yet

This is an internal state.

---

## 5. Completion Failure States

If any condition fails:

| Failure Type          | Result                      |
| --------------------- | --------------------------- |
| Duration not met      | Internship remains `active` |
| KPI threshold failure | Internship cannot complete  |
| Missing evaluation    | Internship blocked          |
| Compliance hold       | Internship paused           |

Failures are explicit and logged.

---

## 6. Re-Evaluation Rules

* Completion checks may be re-run
* Once an internship is marked `completed`, it **cannot revert**
* KPIs and evaluations cannot be re-submitted

Completion is a **one-way transition**.

---

## 7. Admin Visibility & Control

Admins can:

* View completion readiness
* See blocking reasons
* Resolve compliance holds (if allowed)

Admins **cannot**:

* Force completion
* Override KPIs
* Bypass duration requirements

---

## 8. Error Scenarios

### 8.1 Completion Attempt Too Early

```json
{
  "error": {
    "code": "MIN_DURATION_NOT_MET",
    "message": "Internship minimum duration has not been met"
  }
}
```

---

### 8.2 KPI Threshold Failure

```json
{
  "error": {
    "code": "KPI_THRESHOLD_NOT_MET",
    "message": "Required performance thresholds were not met"
  }
}
```

---

## 9. Non-Negotiable Constraints

* No manual completion triggers
* No partial completion
* No retroactive fixes
* No admin overrides

---

## 🔒 Lock Statement

Completion criteria are **strict, cumulative, and irreversible**.
No domain may weaken or bypass them.
