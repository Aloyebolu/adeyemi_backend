# `Live updates Documentation`

## Purpose

This document defines **real-time state update events** that affect **active screens** during normal platform usage.

Live update events exist to:

* Keep UI state synchronized without polling
* Reflect backend-driven changes immediately
* Improve responsiveness during active workflows

These events **never replace REST** and **never introduce new behavior**.

---

## Source Mapping (Authoritative)

Events in this file are emitted strictly as a consequence of REST-side changes defined in:

* `screen-interactions/student/06-application-flow.md`
* `screen-interactions/student/07-internship-dashboard.md`
* `screen-interactions/employer/03-applicant-review.md`
* `screen-interactions/employer/05-evaluations.md`
* `api-surface/rest/applications/`
* `api-surface/rest/kpis/`
* `api-surface/rest/execution/`

---

## WebSocket Rules (GLOBAL)

The following rules apply to all events in this file:

1. WebSockets are **event-only**
2. No state mutation occurs via WebSocket
3. Every event mirrors a completed REST action
4. Delivery is **at-least-once**
5. Ordering is **not guaranteed**
6. Clients must be **idempotent**
7. REST remains the source of truth

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

Clients must ignore unknown events and fields gracefully.

---

## Events

### `application.status_changed`

#### Emitted When

* An employer changes an application state via:

  * shortlist
  * reject
  * accept

This event is emitted **after** the REST transition is persisted.

---

#### Payload

```json
{
  "event": "application.status_changed",
  "payload": {
    "applicationId": "uuid",
    "previousStatus": "submitted",
    "currentStatus": "shortlisted"
  },
  "timestamp": "iso-date"
}
```

---

### `kpi.updated`

#### Emitted When

* KPI scores are recalculated
* Employer evaluations are submitted
* System-driven KPI updates occur

---

#### Payload

```json
{
  "event": "kpi.updated",
  "payload": {
    "internshipId": "uuid",
    "kpiKey": "attendance",
    "newScore": 92
  },
  "timestamp": "iso-date"
}
```

---

### `task.evaluated`

#### Emitted When

* An employer evaluates a submitted task

---

#### Payload

```json
{
  "event": "task.evaluated",
  "payload": {
    "taskId": "uuid",
    "status": "approved | rejected",
    "score": 85
  },
  "timestamp": "iso-date"
}
```

---

## Client Responsibilities

For live update events, clients must:

1. Update only **currently visible UI state**
2. Avoid cascading side effects
3. Re-fetch full state via REST if needed
4. Handle duplicate events safely

Live updates must never trigger automatic navigation.

---

## Failure & Recovery

* Events may be missed during disconnects
* No replay or catch-up is guaranteed
* On reconnect, clients must rehydrate state via REST

---

## Non-Goals (Explicit)

This file does **not** define:

* Business rules
* Workflow logic
* Authorization decisions
* Historical data access

Those belong to REST and internal services.

---
