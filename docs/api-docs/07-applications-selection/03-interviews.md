## 1. Purpose

This document defines how **interviews are scheduled, conducted, and tracked** for shortlisted applications.

Interviews are a **controlled evaluation phase** that occurs **after shortlisting and before offers**.

---

## 2. Who Can Manage Interviews

* **Employers**: schedule, update, complete interviews
* **Students**: view interview details, attend interviews
* **Admins**: read-only oversight
* **AI services**: advisory only (no decisions)

No other role may interact with interviews.

---

## 3. Interview Preconditions

An interview may be scheduled only if:

* Application state = `shortlisted`
* Internship is still active
* No offer has been issued for the application

Backend enforces all checks.

---

## 4. Interview Object (Conceptual)

```json
{
  "interviewId": "int_9021",
  "applicationId": "app_5512",
  "scheduledAt": "2026-02-05T14:00:00Z",
  "mode": "video",
  "status": "scheduled",
  "createdBy": "employer_88"
}
```

---

## 5. Interview Scheduling

### 5.1 Scheduling Rules

When an employer schedules an interview:

* Application state transitions to `interview_scheduled`
* Interview record is created
* Student is notified

Only **one active interview** may exist per application at a time.

---

### 5.2 Rescheduling

* Employers may reschedule before the interview occurs
* Rescheduling updates the interview record
* All changes are logged
* Students are notified of changes

---

## 6. Interview Modes

Supported modes (extensible):

* `video`
* `audio`
* `in_person`

Interview logistics (links, locations) are stored but not exposed publicly.

---

## 7. Interview Completion

### 7.1 Completion Action

After the interview occurs, employer marks it as completed:

* Interview status → `completed`
* Application state → `interview_completed`
* Timestamp is recorded

---

### 7.2 No-Show Handling

If a student does not attend:

* Employer marks interview as `no_show`
* Application state remains `shortlisted`
* Employer may:

  * Reschedule
  * Reject application

No automatic penalties are applied.

---

## 8. Interview Feedback

* Employers may record **internal interview notes**
* Notes are:

  * Private to employer
  * Not visible to students
  * Not used as system scores

Admins may view notes for audit only.

---

## 9. State Transitions

| From                  | To                    | Allowed |
| --------------------- | --------------------- | ------- |
| `shortlisted`         | `interview_scheduled` | ✅       |
| `interview_scheduled` | `interview_completed` | ✅       |
| `interview_scheduled` | `shortlisted`         | ❌       |
| `interview_completed` | `shortlisted`         | ❌       |

No regression is allowed.

---

## 10. Error Scenarios

### 10.1 Interview Scheduling Not Allowed

```json
{
  "error": {
    "code": "INTERVIEW_NOT_ALLOWED",
    "message": "Interview cannot be scheduled in the current application state"
  }
}
```

---

### 10.2 Unauthorized Access

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not authorized to manage interviews for this application"
  }
}
```

---

## 11. Non-Negotiable Constraints

* Interviews cannot exist without an application
* Admins cannot schedule interviews
* AI cannot auto-complete interviews
* Interview outcomes do not auto-select candidates

---

## 🔒 Lock Statement

Interviews are a **controlled, employer-driven evaluation step**.
No domain may bypass or automate this phase.
