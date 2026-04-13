# `implementation-notes/frontend/state-management.md`

## Purpose

This document provides **guidance on frontend state management** for the Virtual Internship Platform.

The goal is to:

* Keep UI state predictable
* Avoid duplication of backend truth
* Cleanly integrate REST, GraphQL, and WebSocket data
* Scale complexity without fragile state trees

This document is **advisory** and must not redefine system behavior.

---

## Core Principle

> **The backend is the source of truth.
> The frontend holds only derived and ephemeral state.**

Frontend state exists to:

* Render screens
* Track UI interactions
* Bridge async data flows

It must **never** become authoritative.

---

## State Categories

Frontend state should be consciously divided into **four categories**.

---

### 1. Server State

**Definition**
Data fetched from REST or GraphQL.

**Examples**

* User profile
* Internship listings
* Applications
* Tasks
* KPIs
* Certificates

**Rules**

* Cacheable
* Serializable
* Replaceable
* Re-fetchable at any time

**Guidance**

* Prefer normalized server state
* Avoid deep mutation
* Treat as immutable snapshots

---

### 2. UI State

**Definition**
Local, view-specific state.

**Examples**

* Modal open/closed
* Active tab
* Form input values
* Loading indicators
* Error banners

**Rules**

* Local to screen or component
* Short-lived
* Never shared across unrelated screens

---

### 3. Session State

**Definition**
State tied to the authenticated session.

**Examples**

* Auth token
* User role
* Feature flags
* Onboarding completion flags

**Rules**

* Initialized at login
* Cleared on logout
* Stored securely

---

### 4. Realtime Derived State

**Definition**
State updated by WebSocket events.

**Examples**

* Notification counts
* Live KPI changes
* Application status updates
* Attendance confirmations

**Rules**

* Must reconcile with server state
* Never overwrite authoritative data blindly
* Always tolerant of duplicates

---

## Recommended Data Flow

```
REST / GraphQL
      ↓
  Server State Store
      ↓
   UI Rendering
      ↑
 WebSocket Events
```

WebSocket events should:

* Trigger invalidation
* Patch visible UI
* Prompt refetch when needed

They should **not** replace fetches.

---

## Handling WebSocket Events Safely

Recommended pattern:

1. Receive event
2. Validate relevance to current screen
3. Update minimal UI hints
4. Schedule a REST refetch (immediate or deferred)

Never:

* Assume ordering
* Assume completeness
* Assume uniqueness

---

## Error State Management

* Errors are data, not exceptions
* Display user-facing messages
* Preserve retry ability
* Clear errors on success

Avoid global “error blobs”.

---

## Loading State Strategy

Prefer:

* Per-request loading flags
* Skeleton screens
* Optimistic UI only when safe

Avoid:

* Global loading locks
* Long blocking spinners

---

## Offline & Reconnect Considerations

On reconnect:

* Drop realtime-derived assumptions
* Re-fetch critical server state
* Reset volatile UI state if needed

Offline support is optional, not assumed.

---

## Non-Goals (Explicit)

This document does **not** define:

* Specific state libraries
* Hook implementations
* Store structure
* UI frameworks

Those are team decisions.

---