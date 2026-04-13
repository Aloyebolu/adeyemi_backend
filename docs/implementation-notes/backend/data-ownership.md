# `implementation-notes/backend/data-ownership.md`

## Purpose

This document clarifies **data ownership boundaries** between backend services.

Clear ownership is critical to:

* Prevent tight coupling
* Avoid data duplication confusion
* Enable independent evolution of services
* Enforce correct write paths

This document is **advisory** and must not contradict authoritative contracts.

---

## Core Rule (Non-Negotiable)

> **Each piece of data has exactly one owning service.**

* Only the owning service may **create, update, or delete** that data
* Other services may only **read** or **cache projections**
* Shared databases are strongly discouraged

---

## Ownership vs Access

| Concept        | Meaning                  |
| -------------- | ------------------------ |
| **Ownership**  | Authority to mutate data |
| **Access**     | Ability to read data     |
| **Projection** | Derived, read-only copy  |

Access does **not** imply ownership.

---

## Service Ownership Map

### Identity Service

**Owns**

* Credentials
* Password hashes
* Session tokens
* Account status flags

**Read-only for others**

* User ID
* Role

---

### User Profile Service

**Owns**

* Personal profile data
* Skills and interests
* Uploaded document metadata
* Profile completeness status

**Read-only for others**

* Profile completeness flag
* Public profile fields (where allowed)

---

### Preparation Service

**Owns**

* Resume submissions
* Interview attempts
* Drill feedback
* Preparation progress

**Read-only for others**

* Preparation completion status

---

### Internship Service

**Owns**

* Internship listings
* Internship lifecycle state
* KPI definitions

**Read-only for others**

* Internship metadata
* Visibility state

---

### Application Service

**Owns**

* Application records
* Application state machine
* Transition timestamps

**Read-only for others**

* Application status
* Applicant–internship linkage

---

### Execution Service

**Owns**

* Attendance records
* Task assignments
* Task submissions
* Training completion state

**Read-only for others**

* Execution progress indicators

---

### KPI & Evaluation Service

**Owns**

* KPI scores
* Employer evaluations
* Aggregated performance metrics

**Read-only for others**

* KPI summaries
* Overall performance score

---

### Certification Service

**Owns**

* Certificate records
* Verification codes
* Issuance timestamps

**Read-only for others**

* Certificate existence
* Public verification results

---

## Data Duplication Rules

Duplication is allowed **only** when:

* Data is copied into a **read model**
* The copy is explicitly marked as derived
* The source of truth is documented
* Invalidation rules exist

Duplication is **not allowed** for:

* Convenience writes
* Cross-service updates
* Implicit synchronization

---

## Cross-Service Data Access Patterns

Recommended:

* API calls for synchronous reads
* Domain events for async propagation
* Cached projections for hot paths

Avoid:

* Direct database access
* Schema sharing
* Hidden dependencies

---

## Schema Evolution Guidance

* Owning service controls schema evolution
* Breaking changes require coordination
* Projections must tolerate missing fields
* Consumers should rely on contracts, not internals

---

## Non-Goals (Explicit)

This document does **not** define:

* Database schema designs
* Table structures
* Index strategies
* Migration tooling

Those belong to implementation details.

---