# `implementation-notes/frontend/data-fetching.md`

## Purpose

This document provides **guidance on frontend data fetching strategies** for the platform.

The goals are to:

* Keep data access predictable
* Minimize redundant requests
* Respect backend contracts
* Integrate REST, GraphQL, and WebSockets cleanly

This document is **advisory** and must not override API contracts.

---

## Core Principle

> **Fetch data because the screen needs it,
> not because the application happens to be running.**

Data fetching should be:

* Screen-driven
* Intentional
* Explicitly scoped

---

## Fetching Layers

The platform exposes **three data access mechanisms**, each with a clear role.

---

### 1. REST

**Primary use**

* Mutations (writes)
* Simple reads
* File uploads
* Side-effectful actions

**Characteristics**

* Explicit
* Predictable
* Source of truth

**Guidance**

* Prefer REST for writes
* Treat responses as authoritative
* Use REST for refetch after realtime events

---

### 2. GraphQL

**Primary use**

* Aggregated reads
* Complex dashboards
* Screens requiring multiple datasets

**Characteristics**

* Flexible
* Read-optimized
* Declarative

**Guidance**

* Avoid using GraphQL for writes unless necessary
* Keep queries screen-scoped
* Avoid deeply nested queries without pagination

---

### 3. WebSockets

**Primary use**

* Realtime hints
* Status updates
* UI responsiveness

**Characteristics**

* Event-driven
* At-least-once delivery
* Non-authoritative

**Guidance**

* Never treat events as complete state
* Use events to trigger refetch or invalidate caches

---

## Screen-Driven Fetching Model

Recommended pattern:

1. Screen mounts
2. Required data is fetched
3. UI renders from server state
4. Realtime events adjust UI hints
5. Refetch occurs when needed

Avoid global “preload everything” strategies.

---

## Fetch Timing Strategies

### On Screen Entry

* Fetch essential data immediately
* Defer secondary data if possible

### On User Action

* Fetch only what the action requires
* Avoid refetching unrelated data

### On Realtime Event

* Validate relevance
* Refetch affected resources only

---

## Caching Guidance

Frontend caching should:

* Be time-bounded
* Be invalidated explicitly
* Never outlive a session

Avoid:

* Permanent caches
* Manual cache mutation
* Cross-user reuse

---

## Pagination & Incremental Loading

Recommended:

* Cursor or page-based pagination
* Incremental loading for lists
* Explicit “load more” interactions

Avoid:

* Unbounded lists
* Implicit infinite scroll without limits

---

## Error Handling in Fetching

* Treat network and server errors distinctly
* Surface actionable messages
* Preserve retry paths
* Avoid silent failures

Errors should be local to the request context.

---

## Security Considerations

* Never trust cached data across logouts
* Clear sensitive data on session end
* Avoid embedding secrets in requests
* Respect backend authorization errors

---

## Non-Goals (Explicit)

This document does **not** define:

* HTTP client libraries
* Query caching frameworks
* Retry algorithms
* Request batching techniques

Those choices belong to the frontend team.

---