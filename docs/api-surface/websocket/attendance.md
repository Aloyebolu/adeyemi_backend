# `Attendance Documentation`

## Purpose

This document defines **real-time attendance-related events** delivered over WebSocket during an active internship.

Attendance events exist to:

* Instantly reflect clock-in results in the UI
* Prevent duplicate submissions
* Keep admin and monitoring views synchronized

Attendance **state changes always occur via REST first**.
WebSocket events only **announce** those changes.

---

## Source Mapping (Authoritative)

Events in this file are emitted strictly as a consequence of REST flows defined in:

* `screen-interactions/student/07-internship-dashboard.md`
* `api-surface/rest/execution/clock-in.md`
* `screen-interactions/admin/04-reports.md`

No new attendance behavior is introduced here.

---

## WebSocket Rules (GLOBAL)

These rules apply to all events in this file:

1. WebSockets are **event-only**
2. No attendance state is mutated via WebSocket
3. Events are emitted **after REST success**
4. Delivery is **at-least-once**
5. Ordering is **not guaranteed**
6. Clients must be **idempotent**
7. Clients must recover state via REST on reconnect

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

---

## Events

### `attendance.clocked_in`

#### Emitted When

* A student successfully completes a daily clock-in via:

  ```
  POST /execution/clock-in
  ```

This event is emitted **once per successful attendance record**.

---

#### Payload

```json
{
  "event": "attendance.clocked_in",
  "payload": {
    "studentId": "uuid",
    "internshipId": "uuid",
    "date": "YYYY-MM-DD",
    "clockedInAt": "iso-date"
  },
  "timestamp": "iso-date"
}
```

---

#### Field Semantics

| Field          | Meaning                |
| -------------- | ---------------------- |
| `studentId`    | Student who clocked in |
| `internshipId` | Active internship      |
| `date`         | Attendance date        |
| `clockedInAt`  | Server-recorded time   |

---

### `attendance.locked`

#### Emitted When

* The attendance window for a given day is closed by the system
* No further clock-ins are allowed for that date

This event may be emitted **globally** or **per internship**, depending on system policy.

---

#### Payload

```json
{
  "event": "attendance.locked",
  "payload": {
    "date": "YYYY-MM-DD",
    "scope": "global | internship",
    "reason": "window_closed"
  },
  "timestamp": "iso-date"
}
```

---

## Client Responsibilities

Upon receiving attendance events, clients must:

1. Update attendance UI immediately
2. Disable further clock-in attempts if locked
3. Avoid duplicate submissions
4. Treat REST as the source of truth

Clients must **not** infer attendance completion solely from WebSocket events.

---

## Failure & Reconnection Behavior

* No replay is guaranteed
* On reconnect, clients must re-fetch attendance state via REST
* Missed events must not cause incorrect UI state

---

## Non-Goals (Explicit)

This file does **not** define:

* Attendance validation logic
* Time window rules
* Admin overrides
* Historical attendance retrieval

Those belong to REST and internal services.

---