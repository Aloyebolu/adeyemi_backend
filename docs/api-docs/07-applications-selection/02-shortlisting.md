## 1. Purpose

This document defines how **employers review and shortlist applications** after students apply.

Shortlisting is the **first decision point** in the selection process and determines which candidates advance toward interviews.

---

## 2. Who Can Shortlist

Only users with role:

* `employer`

Admins and AI systems **cannot** shortlist candidates.

---

## 3. Shortlisting Preconditions

An application may be shortlisted only if:

* Application state = `submitted` or `under_review`
* Internship is still valid (not closed or canceled)
* Employer owns the internship

Backend enforces all checks.

---

## 4. Employer Review Inputs

Employers may review:

* Application snapshot (student profile snapshot)
* Internship snapshot
* AI advisory ranking (if enabled)

Employers **do not** see:

* Live student profile
* Drill feedback
* Other employers’ data
* AI scores or weights

---

## 5. Shortlisting Action

### 5.1 Action Description

When an employer shortlists an application:

* Application state transitions to `shortlisted`
* Timestamp and employer ID are recorded
* Student is notified

This action is **explicit and auditable**.

---

### 5.2 Bulk Shortlisting

Employers may:

* Shortlist multiple candidates
* Reject multiple candidates

Each action is logged independently.

---

## 6. Rejection During Review

Employers may reject applications during review.

* Rejection is final
* Rejection reason is optional but encouraged
* State transitions to `rejected`

Rejected applications **cannot** be reopened.

---

## 7. Application State Transitions

| From           | To             | Allowed |
| -------------- | -------------- | ------- |
| `submitted`    | `under_review` | ✅       |
| `submitted`    | `shortlisted`  | ✅       |
| `under_review` | `shortlisted`  | ✅       |
| `submitted`    | `rejected`     | ✅       |
| `under_review` | `rejected`     | ✅       |
| `shortlisted`  | `submitted`    | ❌       |

State regression is not allowed.

---

## 8. Visibility Rules

| Role        | Visibility                       |
| ----------- | -------------------------------- |
| Student     | Own application status           |
| Employer    | Applications for own internships |
| Admin       | Read-only                        |
| AI Services | Read-only                        |

---

## 9. Error Scenarios

### 9.1 Unauthorized Shortlisting

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not authorized to shortlist this application"
  }
}
```

---

### 9.2 Invalid State Transition

```json
{
  "error": {
    "code": "INVALID_APPLICATION_STATE",
    "message": "Application cannot be shortlisted in its current state"
  }
}
```

---

## 10. Non-Negotiable Constraints

* Shortlisting decisions are final
* Admins cannot override shortlist decisions
* AI cannot auto-shortlist
* No automatic rejection rules

---

## 🔒 Lock Statement

Shortlisting is an **employer-only, explicit decision point**.
No domain may automate or override it.