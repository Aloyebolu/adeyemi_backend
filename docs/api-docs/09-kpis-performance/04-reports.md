## 1. Purpose

This document defines how **performance reports** are generated, accessed, and consumed during and after an internship.

Reports are **derived artifacts** built on top of finalized or in-progress KPI data and are used for:

* Student self-awareness
* Employer review
* Admin oversight
* Certification readiness checks

Reports **do not drive decisions**; they reflect them.

---

## 2. Report Types

### 2.1 Student Performance Report

Visible to students during and after the internship.

Includes:

* Attendance summary
* Task completion overview
* Training completion status
* High-level KPI progress indicators
* Employer evaluation summary (after submission)

Does **not** include:

* Raw KPI formulas
* Threshold values
* Employer internal notes

---

### 2.2 Employer Performance Report

Visible to employers for internships they own.

Includes:

* Detailed task and attendance breakdowns
* Training completion by student
* KPI aggregates
* Submitted evaluation copy

Employers do **not** see cross-internship comparisons.

---

### 2.3 Admin Oversight Report

Visible only to admins.

Includes:

* Full KPI data
* Raw performance signals
* Aggregation metadata
* Risk flags
* Completion readiness indicators

Used for audits and dispute resolution.

---

## 3. Report Generation Rules

* Reports are generated **on demand**
* No scheduled batch exports by default
* Reports are **read-only**
* Report views never mutate data

All data is sourced from authoritative KPI records.

---

## 4. Temporal Accuracy

Reports reflect data as of:

* The moment of request
* Or a clearly indicated snapshot timestamp

Reports must display:

* “As of” timestamp
* Internship state at time of generation

---

## 5. Finalization Effects

When KPIs are finalized:

* Student and employer reports become **locked**
* Report content becomes immutable
* Historical access is preserved

Final reports are used by `10-certification`.

---

## 6. Access Control

| Role        | Access                      |
| ----------- | --------------------------- |
| Student     | Own reports                 |
| Employer    | Reports for own internships |
| Admin       | All reports                 |
| AI Services | ❌ None                      |

Unauthorized access returns `403 FORBIDDEN`.

---

## 7. Export & Download Rules

* Reports may be downloadable as PDF (optional)
* Exports reflect **exactly what is visible**
* No hidden data in exports
* Exports are watermarked and timestamped

---

## 8. Error Scenarios

### 8.1 Report Not Available

```json
{
  "error": {
    "code": "REPORT_NOT_AVAILABLE",
    "message": "Performance report is not available at this time"
  }
}
```

---

## 9. Non-Negotiable Constraints

* Reports cannot be edited
* Admins cannot alter report content
* Reports cannot override KPI outcomes
* No cross-student comparisons

---

## 🔒 Lock Statement

Performance reports are **reflective, immutable views** of KPI data.
No domain may use reports as a source of truth over KPIs.

