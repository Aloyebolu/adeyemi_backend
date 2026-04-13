## 1. Domain Purpose

The **Preparation** domain governs all **pre-internship readiness mechanisms** that a student must complete **before** they are allowed to apply for internships.

This domain exists to:

* Standardize student readiness
* Improve application quality
* Enforce fairness across applicants
* Act as a **hard gate** before internship discovery and application

No student may bypass this domain.

---

## 2. Core Principle (Canon-Aligned)

> **Resume Drill and Interview Drill are mandatory hard gates before internship application.**

Completion is **binary**, not subjective:

* Either the student has passed the required drills
* Or they are blocked from applying

AI feedback is **advisory only** and does not override gate rules.

---

## 3. In-Scope Responsibilities

This domain is responsible for:

* Resume Drill execution
* Interview Drill execution
* Drill progress tracking
* Drill completion status
* Readiness gating for downstream domains

This domain does **not** select internships, rank students, or issue certifications.

---

## 4. Out-of-Scope Responsibilities

Explicitly excluded:

* Profile data management
  → handled by `04-user-profiles`
* Internship listing and recommendations
  → handled by `06-internship-discovery`
* Application submission
  → handled by `07-applications-selection`
* KPI scoring
  → handled by `09-kpis-performance`
* Certificates
  → handled by `10-certification`

---

## 5. Preparation Components

The domain contains **two mandatory components**:

### 5.1 Resume Drill

* Structured resume review
* Feedback loop (human + AI)
* Completion-based, not score-based

### 5.2 Interview Drill

* Mock interview sessions
* Question banks + simulations
* AI-generated feedback and suggestions

Both must be completed to unlock applications.

---

## 6. Preparation State Model

Each student has a **preparation status**:

| State                   | Meaning                 |
| ----------------------- | ----------------------- |
| `not_started`           | No drills attempted     |
| `resume_in_progress`    | Resume drill ongoing    |
| `resume_completed`      | Resume drill passed     |
| `interview_in_progress` | Interview drill ongoing |
| `completed`             | All drills completed    |

State transitions are enforced server-side only.

---

## 7. Hard Gating Rules

### 7.1 Application Gate

To apply for internships, the student must have:

* Profile completeness ≥ 80%
* Resume Drill = completed
* Interview Drill = completed

Failure in any condition results in a hard block.

---

### 7.2 Non-Bypassable

* Admins **cannot** mark drills as completed manually
* Employers have **no influence**
* AI cannot auto-complete drills

Only successful drill completion unlocks progression.

---

## 8. Visibility Rules

| Role        | Visibility          |
| ----------- | ------------------- |
| Student     | Full drill progress |
| Employer    | ❌ No visibility     |
| Admin       | Read-only oversight |
| AI Services | Read-only           |

Drill feedback is **never exposed** to employers.

---

## 9. Dependency Map

This domain blocks access to:

* `06-internship-discovery`
* `07-applications-selection`

And depends on:

* `04-user-profiles` (profile completeness)

---

## 10. Failure & Recovery Philosophy

* Students may retry drills
* Failures are non-punitive
* Progress is saved incrementally
* Only final completion matters

---

## 11. Files in This Domain

```
05-preparation/
├── 00-domain-overview.md   ✅ (this file)
├── 01-resume-drill.md
├── 02-interview-drill.md
└── 03-preparation-gating.md
```

---

## 🔒 Domain Lock Statement

Preparation rules are **hard gates**.
No downstream domain may weaken or skip them.
