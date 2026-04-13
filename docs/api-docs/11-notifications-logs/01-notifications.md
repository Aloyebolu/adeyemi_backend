## 1. Purpose

This document defines how **user-facing notifications** are generated, delivered, and tracked.

Notifications:

* Inform users about important events
* Do **not** enforce rules
* Do **not** replace system state
* Are best-effort and non-blocking

If a notification fails, the underlying action **must still succeed**.

---

## 2. Notification Triggers (Event-Driven)

Notifications are emitted in response to **domain events**, including but not limited to:

### Student-Facing Events

* Application submitted
* Application shortlisted
* Interview scheduled / rescheduled
* Offer issued
* Offer accepted / expired
* Internship started
* Internship completed
* Certificate issued
* Certificate revoked

---

### Employer-Facing Events

* New application received
* Application withdrawn
* Interview accepted / missed
* Offer accepted / rejected
* Internship completed

---

### Admin-Facing Events

* Document submitted for verification
* Compliance flag raised
* Certificate revocation executed
* System anomalies (high severity)

---

## 3. Notification Object (Conceptual)

```json
{
  "notificationId": "notif_5519",
  "recipientId": "user_12345",
  "recipientRole": "student",
  "type": "OFFER_ISSUED",
  "title": "You received an internship offer",
  "message": "Acme Technologies has issued you an offer.",
  "createdAt": "2026-02-07T11:31:00Z",
  "read": false
}
```

---

## 4. Delivery Channels

Notifications may be delivered through:

| Channel | Guaranteed  |
| ------- | ----------- |
| In-app  | ✅           |
| Email   | Best-effort |
| Push    | Optional    |

Channel availability depends on:

* User preferences
* System configuration
* Regional compliance

---

## 5. Channel Selection Rules

* In-app notifications are **always generated**
* Email and push are optional
* Critical events may force email delivery (policy-driven)

Notification content may vary slightly by channel, but meaning must remain consistent.

---

## 6. Read & Acknowledgement Behavior

* Notifications are marked `read` only by explicit user action
* Auto-read on delivery is forbidden
* Read state is **per user**

Read state has **no effect** on system workflows.

---

## 7. Retry & Failure Handling

* Delivery failures are retried (policy-defined)
* Permanent failures are logged
* No user-visible error is shown for notification failure

Notifications never block workflows.

---

## 8. Idempotency Rules

* Each domain event generates **at most one notification**
* Duplicate notifications for the same event are forbidden
* Idempotency keys are enforced server-side

---

## 9. Visibility Rules

| Role     | Can Receive          |
| -------- | -------------------- |
| Student  | Student events only  |
| Employer | Employer events only |
| Admin    | Admin events only    |

Cross-role notifications are not allowed.

---

## 10. Error Scenarios

### 10.1 Invalid Recipient

```json
{
  "error": {
    "code": "NOTIFICATION_RECIPIENT_INVALID",
    "message": "Notification recipient is invalid"
  }
}
```

This error is **internal only** and not exposed to end users.

---

## 11. Non-Negotiable Constraints

* No notification-triggered state changes
* No user replies via notifications
* No notification-only workflows
* No silent critical events

---

## 🔒 Lock Statement

Notifications are **informational side-effects only**.
No domain may rely on notifications for correctness.