## 1. Purpose

This document defines the **canonical KPI definitions** used to evaluate internship performance.

It specifies:

* What KPIs exist
* What signals they consume
* How they are interpreted
* Which KPIs are mandatory vs optional

This file defines **what is measured**, not **how it is calculated**.

---

## 2. KPI Design Principles

* KPIs are **signal-based**, not subjective
* KPIs aggregate immutable execution data
* KPIs are internship-specific
* KPIs are comparable **within an internship**, not across internships
* KPI thresholds are enforced by backend rules

---

## 3. KPI Categories

### 3.1 Attendance KPIs

Derived from clock-in data.

**Common KPIs**

* Attendance rate
* Late arrival frequency
* Consecutive absence flags

**Signals Used**

* Daily clock-in records
* Late / absent markers

Attendance KPIs are **mandatory**.

---

### 3.2 Task Performance KPIs

Derived from task submissions and reviews.

**Common KPIs**

* Task completion rate
* On-time submission rate
* Revision frequency

**Signals Used**

* Task due dates
* Submission timestamps
* Employer review outcomes

Task KPIs are **mandatory**.

---

### 3.3 Training KPIs

Derived from training module completion.

**Common KPIs**

* Mandatory training completion rate
* Late training completion count

**Signals Used**

* Training assignment records
* Completion timestamps

Training KPIs may be **mandatory or optional** depending on internship configuration.

---

### 3.4 Professionalism & Soft Skills KPIs

Derived from employer evaluations.

**Common KPIs**

* Communication
* Reliability
* Initiative
* Team collaboration

These KPIs are **qualitative**, but normalized internally.

---

## 4. KPI Object (Conceptual)

```json
{
  "kpiId": "kpi_attendance_rate",
  "category": "attendance",
  "mandatory": true,
  "signals": ["clock_in_records"],
  "evaluatedAt": "completion_time"
}
```

This object is **definition-only**, not a score.

---

## 5. Mandatory vs Optional KPIs

| Category         | Mandatory   |
| ---------------- | ----------- |
| Attendance       | ✅           |
| Task Performance | ✅           |
| Training         | Conditional |
| Professionalism  | ✅           |

An internship **cannot complete** without all mandatory KPIs finalized.

---

## 6. Internship-Specific KPI Sets

* Each internship defines which KPIs apply
* Default KPI set exists per internship type
* Custom KPIs must be approved by admin
* KPI definitions are snapshotted at internship start

---

## 7. Thresholds & Completion Criteria

* Each mandatory KPI has a minimum threshold
* Thresholds are **not exposed** to students
* Falling below threshold blocks completion
* Admins cannot override thresholds

---

## 8. Immutability Rules

* KPI definitions are immutable once internship starts
* KPI sets cannot change mid-internship
* Historical KPI definitions remain archived

---

## 9. Error Scenarios

### 9.1 Undefined KPI Reference

```json
{
  "error": {
    "code": "KPI_DEFINITION_NOT_FOUND",
    "message": "Referenced KPI is not defined for this internship"
  }
}
```

---

## 🔒 Lock Statement

KPI definitions are **canonical and immutable per internship**.
No domain may redefine KPIs after execution begins.