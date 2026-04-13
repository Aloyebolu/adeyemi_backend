## 1. Purpose

This document defines the **student-facing internship dashboard** during an active internship.

The dashboard is a **read-and-act surface** that aggregates execution data but **does not own business logic**.

All actions initiated from the dashboard are validated and enforced server-side.

---

## 2. Dashboard Scope

The student dashboard provides a unified view of:

* Internship status and timeline
* Daily clock-in / attendance status
* Assigned tasks and submission states
* Training modules and completion
* High-level KPI progress indicators

It is **internship-instance specific**.

---

## 3. Access Preconditions

The dashboard is accessible only if:

* Internship instance state ∈ {`active`, `paused`}
* Student is the owner of the internship instance

Completed internships use a **different read-only summary view**.

---

## 4. Dashboard Data Sections

### 4.1 Internship Overview

Displayed fields:

* Internship title
* Employer name
* Start date
* Expected end date
* Current internship state

No editable fields exist here.

---

### 4.2 Attendance Widget

Displays:

* Today’s clock-in status
* Attendance streak (informational)
* Absences and late days summary

Clock-in action:

* Navigates to clock-in endpoint
* No offline or bulk clock-ins

---

### 4.3 Tasks Section

Displays:

* Assigned tasks
* Due dates
* Submission status
* Employer review status

Actions:

* Submit task
* View feedback (if available)

No task edits allowed.

---

### 4.4 Training Modules Section

Displays:

* Assigned modules
* Mandatory vs optional markers
* Completion status
* Due dates

Actions:

* Launch module
* Mark completion (when applicable)

---

### 4.5 KPI Progress (Read-Only)

Displays:

* High-level progress indicators
* Completion bars or percentages
* No raw scores or formulas

KPI logic is defined in `09-kpis-performance`.

---

## 5. Real-Time vs Cached Data

* Attendance and task status should be near-real-time
* KPI progress may be slightly delayed
* Dashboard must tolerate partial data availability

Backend remains authoritative.

---

## 6. Visibility & Privacy

* Student sees only their own internship
* No comparison with peers
* No employer-internal notes
* No admin audit data

---

## 7. Error Scenarios

### 7.1 No Active Internship

```json
{
  "error": {
    "code": "NO_ACTIVE_INTERNSHIP",
    "message": "You do not have an active internship"
  }
}
```

---

### 7.2 Internship Paused

```json
{
  "meta": {
    "warning": "Internship is temporarily paused"
  }
}
```

This is **not an error**.

---

## 8. Non-Negotiable Constraints

* Dashboard cannot mutate state directly
* All actions are validated by backend
* No admin overrides via dashboard
* No AI-driven auto-actions

---

## 🔒 Lock Statement

The student dashboard is a **presentation and initiation layer only**.
All authority resides in backend domains.

