## 1. Purpose

This document defines how **internship tasks are assigned, submitted, reviewed, and tracked** during an active internship.

Tasks represent **actual work output** and are a primary input into **performance evaluation and KPIs**.

---

## 2. Canonical Rules (Reinforced)

* Tasks exist **only within an active internship**
* Task submissions are **append-only**
* Deadlines affect KPIs, not task validity
* Students submit work; employers review
* Backend enforces all state and timing rules

---

## 3. Task Ownership & Roles

### 3.1 Employer

* Creates tasks
* Defines deadlines and expectations
* Reviews submissions

### 3.2 Student

* Views assigned tasks
* Submits task outputs
* Cannot edit submissions after submission

### 3.3 Admin

* Read-only oversight
* Audit access only

---

## 4. Task Definition

### 4.1 Task Object (Conceptual)

```json
{
  "taskId": "task_4402",
  "internshipInstanceId": "inst_3001",
  "title": "Build Landing Page UI",
  "description": "Create responsive landing page using provided design",
  "assignedAt": "2026-02-20T10:00:00Z",
  "dueAt": "2026-02-27T23:59:59Z",
  "status": "open"
}
```

Tasks are immutable once assigned.

---

## 5. Task Assignment Rules

* Tasks can be assigned only when:

  * Internship state = `active`
* Tasks cannot be backdated
* Tasks cannot be deleted
* Task edits are not allowed after assignment

Any correction requires a **new task**.

---

## 6. Task Submission Flow

### 6.1 Submission Action

A student may submit a task only if:

* Task status = `open`
* Internship is `active`
* Student is assigned to the internship

---

### 6.2 Task Submission Object

```json
{
  "submissionId": "sub_9023",
  "taskId": "task_4402",
  "submittedAt": "2026-02-26T18:45:00Z",
  "artifacts": [
    {
      "type": "github_link",
      "value": "https://github.com/example/repo"
    }
  ]
}
```

Submissions are **final and immutable**.

---

## 7. Late Submissions

* Submissions after `dueAt` are allowed
* Marked as `late`
* KPI penalties (if any) are handled downstream
* Late submissions are never rejected automatically

---

## 8. Employer Review

### 8.1 Review Actions

Employers may:

* Mark submission as `accepted`
* Mark submission as `needs_revision`
* Add internal feedback notes

Review outcomes affect KPIs, not task validity.

---

## 9. Task & Submission States

### 9.1 Task States

| State       | Meaning             |
| ----------- | ------------------- |
| `open`      | Awaiting submission |
| `submitted` | Submission received |
| `reviewed`  | Employer reviewed   |

---

### 9.2 Submission States

| State            | Meaning            |
| ---------------- | ------------------ |
| `submitted`      | Awaiting review    |
| `accepted`       | Approved           |
| `needs_revision` | Revision requested |

Revisions require **new submissions**, not edits.

---

## 10. Visibility Rules

| Role        | Visibility                               |
| ----------- | ---------------------------------------- |
| Student     | Own tasks and submissions                |
| Employer    | Tasks and submissions for own internship |
| Admin       | Read-only                                |
| AI Services | Read-only                                |

---

## 11. Error Scenarios

### 11.1 Submission Not Allowed

```json
{
  "error": {
    "code": "TASK_SUBMISSION_NOT_ALLOWED",
    "message": "Task cannot be submitted in its current state"
  }
}
```

---

### 11.2 Internship Not Active

```json
{
  "error": {
    "code": "INTERNSHIP_NOT_ACTIVE",
    "message": "Task submissions are not allowed"
  }
}
```

---

## 12. Non-Negotiable Constraints

* No task deletion
* No submission edits
* No admin overrides
* No auto-acceptance by AI

---

## 🔒 Lock Statement

Task submissions are **immutable records of work output**.
No domain may rewrite or erase them.
