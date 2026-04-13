# `implementation-notes/data/persistence-strategy.md`

## Purpose

This document provides **guidance on data persistence strategies** for implementing the platform’s backend.

The goals are to:

* Preserve clear ownership boundaries
* Support scalability and resilience
* Align persistence with domain behavior
* Avoid accidental coupling through storage

This document is **advisory** and must not redefine authoritative behavior.

---

## Core Principle

> **Persistence follows domain boundaries, not convenience.**

Storage decisions should reflect:

* Service ownership
* Access patterns
* Consistency requirements

Not developer ergonomics alone.

---

## Persistence per Service

Each backend service should own **its own persistence layer**.

### Recommended Characteristics

* Separate databases or schemas per service
* Independent migrations
* No cross-service foreign keys
* Explicit APIs for data access

This reinforces autonomy and failure isolation.

---

## Write Models vs Read Models

### Write Models (Authoritative)

**Characteristics**

* Normalized
* Strongly consistent
* Owned by one service
* Optimized for correctness

**Examples**

* Applications
* Attendance records
* Task submissions
* Certificates

Write models should be boring and predictable.

---

### Read Models (Derived)

**Characteristics**

* Denormalized
* Eventually consistent
* Optimized for reads
* Disposable and rebuildable

**Examples**

* Dashboards
* Aggregated reports
* Overview screens

Read models may be stored separately from write models.

---

## Transaction Strategy

### Intra-Service Transactions

* Use local transactions freely
* Keep transaction scopes small
* Prefer optimistic locking where possible

### Cross-Service Consistency

* Avoid distributed transactions
* Use eventual consistency
* Apply compensating actions if needed

Events are preferred over synchronous chaining.

---

## Schema Design Guidance

* Favor explicit schemas
* Avoid polymorphic tables
* Keep enums stable
* Prefer additive schema changes

Breaking changes should be avoided or carefully coordinated.

---

## Identifiers & Keys

* Use immutable UUIDs as primary identifiers
* Never reuse identifiers
* Do not encode meaning in IDs
* Share IDs across services only for reference

IDs are references, not ownership signals.

---

## Data Retention & Archival

* Execution and KPI data may be archived after completion
* Certificates must be retained long-term
* Audit-relevant data should be immutable

Retention policies should be explicit and documented.

---

## Backup & Recovery Considerations

* Each service must support independent backup
* Restore procedures should be tested
* Read models must be rebuildable from source data

Never rely on caches as backup sources.

---

## Non-Goals (Explicit)

This document does **not** define:

* Specific database technologies
* ORM usage
* Query optimization techniques
* Migration tooling

Those decisions belong to implementation teams.

---