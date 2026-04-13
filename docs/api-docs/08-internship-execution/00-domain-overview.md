## 1. Domain Purpose

The **Internship Execution** domain governs everything that happens **after an offer is accepted and before completion** of an internship.

This domain covers:

* Daily participation (clock-in / attendance)
* Task execution and submissions
* Training modules
* Student-facing internship dashboard

This is the **operational core** of the internship.

---

## 2. Canonical Constraints (Reinforced)

This domain operates under the following **non-negotiable rules**:

* A student may have **only one active internship**
* Clock-in is **mandatory** and affects KPIs
* Internship completion is **hybrid**:

  * Minimum duration
  * Required KPIs and tasks
* Backend enforces all timing and state rules
* KPI data is **append-only**

---

## 3. In-Scope Responsibilities

This domain is responsible for:

* Creating an internship instance upon offer acceptance
* Managing daily attendance and clock-ins
* Task assignments and submissions
* Training module participation
* Student internship dashboard data

---

## 4. Out-of-Scope Responsibilities

Explicitly excluded:

* Application and selection logic
  → handled by `07-applications-selection`
* KPI definitions and scoring
  → handled by `09-kpis-performance`
* Certification issuance
  → handled by `10-certification`
* Notifications
  → handled by `11-notifications-logs`

---

## 5. Primary Actors

### 5.1 Student

* Clocks in daily
* Completes tasks
* Participates in training
* Views progress dashboard

### 5.2 Employer

* Reviews submissions
* Monitors attendance
* Assigns tasks (where applicable)

### 5.3 Admin

* Oversight and audits
* Issue resolution

---

## 6. Internship Instance Concept

Upon offer acceptance, the system creates an **Internship Instance**:

```json
{
  "internshipInstanceId": "inst_3001",
  "studentId": "user_12345",
  "internshipId": "intern_7781",
  "state": "active",
  "startDate": "2026-02-15",
  "expectedEndDate": "2026-05-10"
}
```

This instance is the anchor for all execution data.

---

## 7. Internship States (High-Level)

| State        | Meaning                |
| ------------ | ---------------------- |
| `active`     | Internship in progress |
| `paused`     | Temporarily halted     |
| `completed`  | Execution finished     |
| `terminated` | Ended early            |

State transitions are backend-controlled.

---

## 8. Dependency Map

This domain depends on:

* `07-applications-selection`

This domain feeds into:

* `09-kpis-performance`
* `10-certification`

---

## 9. Failure Philosophy

* No silent failures
* Attendance gaps are recorded, not hidden
* Task failures affect KPIs, not state directly
* Early termination is explicit and logged

---

## 10. Files in This Domain

```
08-internship-execution/
├── 00-domain-overview.md   ✅ (this file)
├── 01-clock-in-attendance.md
├── 02-task-submissions.md
├── 03-training-modules.md
└── 04-student-dashboard.md
```

---

## 🔒 Domain Lock Statement

Internship Execution is **stateful, auditable, and time-bound**.
No domain may fabricate or retroactively alter execution data.

