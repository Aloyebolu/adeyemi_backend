## 1. Purpose

This document defines **activity logs**, which are **user-visible records** of important actions and state changes that affect a user.

Activity logs exist to:

* Improve transparency
* Help users understand system behavior
* Support basic self-auditing

They explain **what happened**, not **why it happened internally**.

---

## 2. Activity Logs vs Notifications

| Aspect      | Notifications    | Activity Logs     |
| ----------- | ---------------- | ----------------- |
| Delivery    | Push-based       | Pull-based        |
| Persistence | May be dismissed | Always retained   |
| Purpose     | Alert user       | Historical record |
| Blocking    | Never            | Never             |

Every significant notification-worthy event **must also generate an activity log**.

---

## 3. Who Can See Activity Logs

| Role     | Visibility                  |
| -------- | --------------------------- |
| Student  | Own activity logs           |
| Employer | Own activity logs           |
| Admin    | ❌ (uses audit logs instead) |

Users can **only see their own logs**.

---

## 4. Activity Log Triggers

Activity logs are generated for events such as:

### Student Activity

* Profile completed
* Resume drill completed
* Interview drill completed
* Internship application submitted
* Application status changes
* Offer received / accepted / rejected
* Internship started
* Internship completed
* Certificate issued / revoked

---

### Employer Activity

* Internship published
* Application received
* Candidate shortlisted
* Interview scheduled / completed
* Offer issued
* Offer accepted / rejected
* Internship completed

---

## 5. Activity Log Object (Conceptual)

```json
{
  "activityLogId": "act_8821",
  "actorId": "user_12345",
  "actorRole": "student",
  "eventType": "OFFER_ACCEPTED",
  "description": "You accepted the internship offer from Acme Technologies",
  "occurredAt": "2026-02-08T09:10:00Z"
}
```

Descriptions are **human-readable** and role-specific.

---

## 6. Immutability Rules

* Activity logs are **append-only**
* Logs cannot be edited or deleted
* Corrections require **new log entries**

Logs represent historical truth.

---

## 7. Ordering & Pagination

* Logs are ordered by `occurredAt` (descending)
* Pagination is mandatory
* Infinite scroll is allowed at UI level

Backend controls ordering.

---

## 8. Privacy & Redaction

Activity logs:

* Never include sensitive PII
* Never include internal system IDs
* Never expose admin-only data

Descriptions are sanitized.

---

## 9. Error Scenarios

### 9.1 Access Denied

```json
{
  "error": {
    "code": "ACTIVITY_LOG_ACCESS_DENIED",
    "message": "You are not authorized to view these activity logs"
  }
}
```

---

## 10. Non-Negotiable Constraints

* No cross-user visibility
* No admin edits
* No AI-generated activity logs
* No log suppression

---

## 🔒 Lock Statement

Activity logs are **user-facing historical records**.
No domain may bypass or mutate them.
