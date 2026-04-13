# `Notifications Documentation`

## Purpose

This document defines **real-time notification events** delivered to users over WebSocket.

Notifications are **informational signals** that something has changed in the system and that the client **should refresh state via REST if needed**.

They are used to:

* Improve responsiveness
* Reduce polling
* Keep users aware of important state changes

---

## Source Mapping (Authoritative)

These events are emitted only as a result of REST-side state changes defined in:

* `screen-interactions/student/06-application-flow.md`
* `screen-interactions/student/07-internship-dashboard.md`
* `screen-interactions/student/08-certificate-view.md`
* `screen-interactions/employer/03-applicant-review.md`
* `screen-interactions/admin/03-certification-management.md`

No event defined here may introduce new behavior.

---

## WebSocket Rules (GLOBAL)

These rules apply to **all events in this file**:

1. WebSockets are **event-only**
2. No state mutation occurs via WebSocket
3. Every event mirrors an already-completed REST action
4. Delivery is **at-least-once**
5. Ordering is **not guaranteed**
6. Clients must be **idempotent**
7. No acknowledgements are required

---

## Event Envelope (Mandatory)

All messages follow this structure:

```json
{
  "event": "string",
  "payload": {},
  "timestamp": "iso-date"
}
```

Clients must ignore unknown fields.

---

## Events

### `notification.created`

#### Emitted When

A user-visible event occurs that requires attention, including:

* Application status change (submitted → shortlisted / rejected / accepted)
* Internship acceptance
* Certificate issuance
* Administrative intervention affecting the user

This event is **not emitted for silent background changes**.

---

#### Payload

```json
{
  "event": "notification.created",
  "payload": {
    "id": "uuid",
    "category": "application | internship | certificate | system",
    "title": "string",
    "message": "string",
    "actionUrl": "/relative/path/in/app",
    "priority": "low | normal | high"
  },
  "timestamp": "iso-date"
}
```

---

#### Field Semantics

| Field       | Meaning                                |
| ----------- | -------------------------------------- |
| `id`        | Notification identifier                |
| `category`  | Domain that triggered the notification |
| `title`     | Short, UI-friendly heading             |
| `message`   | Human-readable description             |
| `actionUrl` | Optional deep link                     |
| `priority`  | Display urgency only (no logic impact) |

---

## Client Responsibilities

Upon receiving `notification.created`, the client must:

1. Display the notification
2. Optionally persist it locally
3. Navigate using `actionUrl` if the user interacts
4. Fetch authoritative state via REST if needed

Clients **must not** assume the payload reflects full system state.

---

## Non-Goals (Explicit)

This file does **not** define:

* Read/unread tracking
* Notification storage
* Delivery guarantees
* Retry behavior
* User preferences

Those concerns are handled via REST or internal services.

---
