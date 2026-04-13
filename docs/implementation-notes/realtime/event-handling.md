# `implementation-notes/realtime/event-handling.md`

## Purpose

This document provides **implementation guidance for handling realtime events** delivered via WebSockets.

The goals are to:

* Integrate realtime events safely
* Preserve REST as the source of truth
* Avoid UI inconsistency and race conditions
* Keep realtime logic simple and defensive

This document is **advisory** and does not define protocol behavior (see `api-surface/websocket/`).

---

## Core Principle

> **Realtime events are signals, not state.**

They inform the client *that something changed* —
they do not fully describe *what the system is now*.

---

## Event Handling Lifecycle

A recommended lifecycle for handling any realtime event:

1. Receive event
2. Validate event type and payload shape
3. Check relevance to current user/session
4. Apply minimal UI updates (if any)
5. Trigger REST/GraphQL refetch when appropriate

Steps 4 and 5 are optional but must be **intentional**.

---

## Event Relevance Filtering

Not every event should affect every client.

Clients should filter events by:

* User ID
* Internship ID
* Application ID
* Active screen context

If an event is not relevant, it should be ignored silently.

---

## Idempotency & Duplication

Because delivery is **at-least-once**:

* Duplicate events are expected
* Clients must tolerate reprocessing
* State updates must be idempotent

Recommended techniques:

* Compare IDs and timestamps
* Avoid incrementing counters blindly
* Prefer replace-over-append updates

---

## Ordering & Race Conditions

Event ordering is **not guaranteed**.

To handle this safely:

* Never assume chronological order
* Avoid state transitions based solely on events
* Re-fetch authoritative state when order matters

REST responses always win over realtime assumptions.

---

## Recommended UI Reactions

### Notifications

* Display immediately
* Do not auto-navigate
* Let the user choose the next action

### Status Changes

* Update visible labels or badges
* Schedule a background refetch

### KPI or Progress Updates

* Patch visible values if safe
* Refresh full data set asynchronously

---

## Reconnection Strategy

On WebSocket reconnect:

1. Clear transient realtime assumptions
2. Re-fetch critical server state
3. Resume listening for events

Do not attempt to “catch up” missed events via WebSocket.

---

## Error Handling

* Invalid payloads should be ignored
* Unknown event types should be logged (if supported)
* WebSocket failures must not break core UI flows

The app must remain usable without realtime connectivity.

---

## Performance Considerations

* Avoid heavy computation inside event handlers
* Debounce refetches if events burst
* Prefer batching refetches where possible

Realtime handling should remain lightweight.

---

## Security Considerations

* Never trust event payloads blindly
* Always rely on authenticated session context
* Do not expose sensitive data through events

---

## Non-Goals (Explicit)

This document does **not** define:

* WebSocket protocol details
* Event schemas
* Retry logic
* Message acknowledgements

Those are defined in `api-surface/websocket/`.
