## 1. Purpose

This document defines how **training modules** are delivered, consumed, and tracked during an active internship.

Training modules:

* Supplement task-based work
* Reinforce required knowledge
* Contribute to KPI signals
* Are **mandatory or optional** depending on internship configuration

Training is part of execution, **not preparation**.

---

## 2. Canonical Rules (Reinforced)

* Training modules exist **only within an active internship**
* Completion status is tracked server-side
* Training data is **append-only**
* Missed or incomplete training affects KPIs, not internship state
* Backend is the final authority

---

## 3. Training Module Types

Training modules may include:

* Video lessons
* Reading materials
* Quizzes or assessments
* Interactive exercises

The platform treats all types uniformly at the tracking level.

---

## 4. Training Module Definition

### 4.1 Training Module Object (Conceptual)

```json
{
  "moduleId": "tm_1204",
  "internshipInstanceId": "inst_3001",
  "title": "Frontend Code Standards",
  "type": "video",
  "mandatory": true,
  "assignedAt": "2026-02-18T09:00:00Z",
  "dueAt": "2026-02-22T23:59:59Z"
}
```

Modules are immutable once assigned.

---

## 5. Assignment Rules

* Modules can be assigned only when:

  * Internship state = `active`
* Modules cannot be deleted
* Modules cannot be backdated
* Corrections require assigning a **new module**

---

## 6. Student Participation

### 6.1 Access Rules

A student may access a module only if:

* Internship is `active`
* Module is assigned to their internship

---

### 6.2 Completion Tracking

When a student completes a module:

```json
{
  "completionId": "tmc_8811",
  "moduleId": "tm_1204",
  "completedAt": "2026-02-20T16:10:00Z",
  "status": "completed"
}
```

Completion records are **final and immutable**.

---

## 7. Mandatory vs Optional Modules

| Type      | Effect if Not Completed |
| --------- | ----------------------- |
| Mandatory | KPI penalty             |
| Optional  | No penalty              |

Mandatory modules **do not block** internship continuation directly.

---

## 8. Late Completion

* Late completion is allowed
* Marked as `late`
* KPI penalties handled downstream
* Late completion never invalidates the module

---

## 9. Visibility Rules

| Role        | Visibility               |
| ----------- | ------------------------ |
| Student     | Own modules & completion |
| Employer    | Completion status only   |
| Admin       | Read-only                |
| AI Services | Read-only                |

Employers do **not** see training content interaction details.

---

## 10. Error Scenarios

### 10.1 Module Not Accessible

```json
{
  "error": {
    "code": "TRAINING_MODULE_NOT_ACCESSIBLE",
    "message": "This training module is not available"
  }
}
```

---

### 10.2 Internship Not Active

```json
{
  "error": {
    "code": "INTERNSHIP_NOT_ACTIVE",
    "message": "Training modules are not available"
  }
}
```

---

## 11. Non-Negotiable Constraints

* No module deletion
* No completion edits
* No admin completion overrides
* No auto-completion by AI

---

## 🔒 Lock Statement

Training modules are **execution-time learning artifacts**.
No domain may rewrite or erase training participation records.
