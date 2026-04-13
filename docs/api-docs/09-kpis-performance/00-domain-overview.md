## 1. Domain Purpose

The **KPIs & Performance** domain defines how **internship performance is measured, evaluated, and recorded**.

This domain transforms **execution signals** (attendance, tasks, training, reviews) into **structured performance outcomes** that are used for:

* Internship completion validation
* Employer evaluations
* Certification eligibility
* Reporting and audits

KPIs are **evaluative**, not operational.

---

## 2. Canonical Constraints (Reinforced)

This domain operates under the following **non-negotiable rules**:

* KPI data is **append-only**
* KPI calculations are **backend-owned**
* KPI results are **immutable once finalized**
* Internship completion is **hybrid**:

  * Minimum duration
  * Required KPI thresholds
* Employers evaluate, but **system enforces thresholds**
* Admins cannot retroactively change finalized KPIs

---

## 3. In-Scope Responsibilities

This domain is responsible for:

* Defining KPI structures
* Collecting performance signals
* Calculating KPI scores
* Recording employer evaluations
* Determining completion readiness
* Generating performance reports

---

## 4. Out-of-Scope Responsibilities

Explicitly excluded:

* Attendance capture
  → handled by `08-internship-execution`
* Task submission mechanics
  → handled by `08-internship-execution`
* Training delivery
  → handled by `08-internship-execution`
* Certification issuance
  → handled by `10-certification`
* Notifications
  → handled by `11-notifications-logs`

---

## 5. KPI Signal Sources

KPIs consume signals from:

* Clock-in / attendance records
* Task submissions and reviews
* Training module completion
* Employer qualitative evaluations

Signals are **never modified**, only aggregated.

---

## 6. KPI Evaluation Model (High-Level)

KPIs are grouped into logical categories:

| Category         | Examples              |
| ---------------- | --------------------- |
| Attendance       | Presence, punctuality |
| Task Performance | Timeliness, quality   |
| Learning         | Training completion   |
| Professionalism  | Employer feedback     |

Exact definitions live in `01-kpi-definitions.md`.

---

## 7. KPI Lifecycle

| Phase              | Description          |
| ------------------ | -------------------- |
| `collecting`       | Internship ongoing   |
| `ready_for_review` | Minimum duration met |
| `finalized`        | KPIs locked          |
| `archived`         | Historical reference |

Transitions are backend-controlled.

---

## 8. Completion Readiness

An internship is **eligible for completion** only if:

* Minimum duration satisfied
* All mandatory tasks submitted
* Mandatory training completed
* KPI thresholds met
* Employer evaluation submitted

Failure in any condition blocks completion.

---

## 9. Visibility Rules

| Role        | Visibility                       |
| ----------- | -------------------------------- |
| Student     | High-level KPI progress          |
| Employer    | Detailed KPI inputs + evaluation |
| Admin       | Full KPI data                    |
| AI Services | Read-only, anonymized            |

Raw KPI formulas are **not exposed** to students.

---

## 10. Dependency Map

This domain depends on:

* `08-internship-execution`

This domain feeds into:

* `10-certification`
* `11-notifications-logs`

---

## 11. Files in This Domain

```
09-kpis-performance/
├── 00-domain-overview.md   ✅ (this file)
├── 01-kpi-definitions.md
├── 02-performance-tracking.md
├── 03-evaluations.md
└── 04-reports.md
```

---

## 🔒 Domain Lock Statement

KPI and performance rules are **authoritative and irreversible once finalized**.
No domain may bypass or retroactively alter KPI outcomes.