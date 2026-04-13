# `api-surface/caching/ttl-policy.md`

## Purpose

This document defines **time-to-live (TTL) policies** for cached read models.

TTL exists to:

* Prevent indefinite staleness
* Provide a safety net for missed invalidations
* Bound cache memory usage

TTL **does not replace invalidation**.
It is a **secondary consistency mechanism**.

---

## Source Mapping (Authoritative)

TTL policies apply only to read models defined in:

```
api-surface/caching/read-models.md
```

TTL is independent of client behavior and REST APIs.

---

## Global TTL Rules

1. TTL is **mandatory** for all cached read models
2. TTL expiration must not block reads
3. Expired entries are lazily or eagerly refreshed
4. TTL values are conservative, not aggressive
5. TTL does not guarantee freshness

---

## TTL Policy by Read Model

### `StudentDashboardReadModel`

* **TTL:** 5 minutes
* **Rationale:**
  High-read frequency, frequent invalidations, UI tolerates slight staleness

---

### `EmployerInternshipOverviewReadModel`

* **TTL:** 10 minutes
* **Rationale:**
  Moderate write frequency, aggregation-heavy, not time-critical

---

### `AdminReportingReadModel`

* **TTL:** 30 minutes
* **Rationale:**
  Reporting use-case, tolerant of staleness, expensive to rebuild

---

## Expiration Behavior

When TTL expires:

* Cached entry is marked stale
* Next read may:

  * Trigger background refresh, or
  * Serve stale data and refresh asynchronously

Blocking refreshes are discouraged.

---

## Forced Refresh Scenarios

TTL may be bypassed when:

* Admin explicitly requests fresh data
* System performs reconciliation
* Manual cache rebuild is triggered

These are internal-only actions.

---

## Failure & Safety

* TTL expiration must never surface errors to clients
* Cache misses must gracefully fall back to source data
* Refresh failures must not cascade

---

## Non-Goals (Explicit)

This file does **not** define:

* Cache eviction algorithms
* Memory limits
* Distributed cache coordination
* Client cache headers

Those belong to implementation notes.

---