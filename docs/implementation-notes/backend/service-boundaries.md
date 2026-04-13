# `implementation-notes/backend/service-boundaries.md`

## Purpose

This document proposes **backend service boundaries** for implementing the Virtual Internship Platform.

These boundaries are **advisory**, not prescriptive.
They exist to help teams:

* Reason about ownership
* Reduce coupling
* Scale development safely

All behavior described here must already exist in:

* `api-docs/`
* `screen-interactions/`
* `api-surface/`

---

## Guiding Principles

1. Business rules live in **domain services**
2. Transport layers are thin
3. Read models are isolated from writes
4. Cross-domain communication is explicit
5. No service owns another service’s data

---

## Suggested Service Decomposition

### 1. Identity Service

**Responsibilities**

* Authentication
* Session management
* Role resolution
* Account status (active, suspended)

**Primary Sources**

* `api-surface/rest/auth/`
* `api-surface/graphql/mutations.md` (login)

**Owns**

* User credentials
* Tokens
* Authentication errors

**Does NOT own**

* User profile data
* Permissions beyond role

---

### 2. User Profile Service

**Responsibilities**

* Profile data
* Documents
* Profile completeness evaluation

**Primary Sources**

* `api-surface/rest/users/`

**Owns**

* Personal information
* Skill & interest data
* Document metadata

**Notes**

* Profile completeness should be computed here
* Exposed only as derived flags

---

### 3. Preparation Service

**Responsibilities**

* Resume drill
* Interview drill
* Preparation progress tracking

**Primary Sources**

* `api-surface/rest/preparation/`

**Owns**

* Drill submissions
* Feedback records
* Preparation state

**Notes**

* Scoring algorithms should be internal
* External consumers only see status & progress

---

### 4. Internship Service

**Responsibilities**

* Internship creation
* Publishing
* Visibility rules

**Primary Sources**

* `api-surface/rest/internships/`

**Owns**

* Internship definitions
* KPI definitions
* Lifecycle state

---

### 5. Application Service

**Responsibilities**

* Application submission
* Shortlisting
* Acceptance / rejection

**Primary Sources**

* `api-surface/rest/applications/`

**Owns**

* Application state machine
* Transition validation

**Notes**

* This service is a **gateway** to execution
* Emits events on state changes

---

### 6. Execution Service

**Responsibilities**

* Internship execution
* Attendance
* Task management
* Training access

**Primary Sources**

* `api-surface/rest/execution/`
* `api-surface/websocket/attendance.md`

**Owns**

* Attendance records
* Task submissions
* Execution timelines

---

### 7. KPI & Evaluation Service

**Responsibilities**

* KPI tracking
* Employer evaluations
* Score aggregation

**Primary Sources**

* `api-surface/rest/kpis/`

**Owns**

* KPI scores
* Evaluation records

**Notes**

* KPI recalculation may be async
* Emits live-update events

---

### 8. Certification Service

**Responsibilities**

* Certificate issuance
* Verification
* Certificate lifecycle

**Primary Sources**

* `api-surface/rest/certificates/`

**Owns**

* Certificate records
* Verification codes

---

## Cross-Service Communication

Recommended mechanisms:

* Domain events (async)
* Explicit API calls (sync)
* No shared databases

Avoid:

* Implicit coupling
* Cross-service joins
* Circular dependencies

---

## Transaction Boundaries

* Each service commits independently
* Cross-service consistency is eventual
* Compensating actions preferred over distributed transactions

---

## Non-Goals (Explicit)

This document does **not** define:

* Exact microservice count
* Deployment topology
* Technology stack
* Message broker choice

Those decisions belong to the implementation team.

---
