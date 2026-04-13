## 1. Domain Purpose

The **Applications & Selection** domain governs how students **apply to internships** and how employers **review, shortlist, interview, and select candidates**.

This domain is where **mutations begin**:

* Applications are created
* Decisions are made
* State transitions occur

All actions here are **strictly auditable** and **rule-enforced by backend logic**.

---

## 2. Canonical Constraints (Reinforced)

This domain operates under the following **non-negotiable rules**:

* A student may apply **only after**:

  * Profile completeness ≥ 80%
  * Resume Drill = completed
  * Interview Drill = completed
* A student may have **only one active internship**
* Employers make the **final selection**
* AI rankings are **advisory only**
* All decisions must be **explicit and logged**
* Backend is the final enforcer of all rules

---

## 3. In-Scope Responsibilities

This domain is responsible for:

* Internship application submission
* Application state management
* Employer shortlisting
* Interview scheduling and tracking
* Offer issuance
* Offer acceptance or rejection

---

## 4. Out-of-Scope Responsibilities

Explicitly excluded:

* Internship discovery and browsing
  → handled by `06-internship-discovery`
* Internship execution and daily work
  → handled by `08-internship-execution`
* KPI tracking and performance scoring
  → handled by `09-kpis-performance`
* Certification
  → handled by `10-certification`

---

## 5. Primary Actors

### 5.1 Student

* Submits applications
* Tracks application status
* Accepts or rejects offers

### 5.2 Employer

* Reviews applications
* Shortlists candidates
* Conducts interviews
* Issues offers

### 5.3 Admin

* Oversight and audits
* Dispute resolution
* Policy enforcement (no selection power)

### 5.4 AI Services

* Provides advisory rankings and insights
* No decision authority

---

## 6. Application Lifecycle (High-Level)

An application progresses through well-defined states:

| State                 | Meaning               |
| --------------------- | --------------------- |
| `submitted`           | Student applied       |
| `under_review`        | Employer reviewing    |
| `shortlisted`         | Candidate shortlisted |
| `interview_scheduled` | Interview planned     |
| `interview_completed` | Interview done        |
| `offered`             | Offer issued          |
| `accepted`            | Offer accepted        |
| `rejected`            | Application rejected  |
| `withdrawn`           | Student withdrew      |

State transitions are **backend-controlled**.

---

## 7. Snapshot Rules (Critical)

* Application captures:

  * Student profile snapshot
  * Internship listing snapshot
* Snapshots are immutable
* Subsequent edits do **not** affect active applications

Snapshots ensure fairness and auditability.

---

## 8. Hard Gating at Application Time

At the moment of application submission, backend enforces:

* Preparation completion
* Profile completeness
* No active internship
* Application window validity

Failure returns a hard error.

---

## 9. Dependency Map

This domain depends on:

* `04-user-profiles`
* `05-preparation`
* `06-internship-discovery`

This domain feeds into:

* `08-internship-execution`
* `11-notifications-logs`

---

## 10. Failure Philosophy

* No silent rejections
* Clear error responses
* Explicit state transitions
* Student-visible outcomes

---

## 11. Files in This Domain

```
07-applications-selection/
├── 00-domain-overview.md   ✅ (this file)
├── 01-apply-internship.md
├── 02-shortlisting.md
├── 03-interviews.md
├── 04-offers.md
└── 05-acceptance-flow.md
```

---

## 🔒 Domain Lock Statement

Application and selection rules are **stateful, auditable, and irreversible where specified**.
No downstream domain may bypass or retroactively alter decisions.

