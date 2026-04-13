## 1. Purpose

This document defines **how a student applies to an internship**, including:

* Preconditions for applying
* Application creation behavior
* Snapshot rules
* Duplicate and conflict handling
* Error scenarios

This is the **only entry point** for creating an application.

---

## 2. Who Can Apply

Only users with role:

* `student`

Employers, admins, and system services **cannot** create applications.

---

## 3. Application Preconditions (Hard Gates)

At the moment of application submission, the backend **must validate all** of the following:

### 3.1 Student Eligibility

* Profile completeness ≥ 80%
* Resume Drill = `completed`
* Interview Drill = `completed`
* No active internship exists

### 3.2 Internship Eligibility

* Internship state = `open`
* Application window is active
* Internship is visible to the student

Failure of any condition results in rejection.

---

## 4. Application Creation Flow

### 4.1 Trigger

* Student clicks “Apply” from internship details
* Frontend sends an application intent request

---

### 4.2 Backend Actions (Atomic)

On successful validation, backend:

1. Creates a new `Application` record
2. Captures **student profile snapshot**
3. Captures **internship listing snapshot**
4. Sets initial application state to `submitted`
5. Emits notification events

All steps succeed or fail **as a single transaction**.

---

## 5. Application Object (Conceptual)

```json
{
  "applicationId": "app_5512",
  "studentId": "user_12345",
  "internshipId": "intern_7781",
  "state": "submitted",
  "appliedAt": "2026-02-01T10:22:00Z"
}
```

Snapshots are referenced internally and not exposed directly.

---

## 6. Duplicate Application Rules

* A student may apply **only once** per internship
* Re-applying to the same internship is forbidden
* Withdrawing does **not** allow reapplication unless explicitly reopened by policy

---

## 7. Concurrent Application Rules

* Multiple applications to different internships are allowed
* Once an offer is **accepted**:

  * All other active applications are auto-closed
* If an internship becomes active:

  * New applications are blocked globally for that student

---

## 8. Student Withdrawal

### 8.1 Allowed

A student may withdraw an application if:

* Application state ∈ {`submitted`, `under_review`, `shortlisted`}

Withdrawal sets state to `withdrawn`.

---

### 8.2 Forbidden

Withdrawal is **not allowed** after:

* Interview completed
* Offer issued

Attempts return `409 CONFLICT`.

---

## 9. Error Scenarios

### 9.1 Preparation Incomplete

```json
{
  "error": {
    "code": "PREPARATION_INCOMPLETE",
    "message": "Complete Resume and Interview preparation before applying"
  }
}
```

---

### 9.2 Duplicate Application

```json
{
  "error": {
    "code": "DUPLICATE_APPLICATION",
    "message": "You have already applied to this internship"
  }
}
```

---

### 9.3 Active Internship Conflict

```json
{
  "error": {
    "code": "ACTIVE_INTERNSHIP_EXISTS",
    "message": "You cannot apply while an internship is active"
  }
}
```

---

## 10. Non-Negotiable Constraints

* Applications cannot be edited after submission
* Snapshots are immutable
* Admins cannot submit applications on behalf of students
* Employers cannot influence application creation

---

## 🔒 Lock Statement

Application creation is **strictly gated, atomic, and immutable**.
No downstream domain may recreate or alter this behavior.