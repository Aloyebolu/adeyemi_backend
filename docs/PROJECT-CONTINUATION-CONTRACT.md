# `docs/PROJECT-CONTINUATION-CONTRACT.md`

> **This file is the single source of truth for structure, progress, and continuation of the Virtual Internship Platform documentation project.**

---

## 1. Purpose of This File

This document exists to solve **one problem**:

> How to continue a very large documentation project across many ChatGPT chats **without losing context**.

It defines:

* What documentation parts exist
* Where each part lives
* What each part is allowed to describe
* The **exact rules** ChatGPT must follow when continuing
* The **one-line protocol** for resuming work from anywhere

If something is not defined here, **it does not exist**.

---

## 2. Project Overview (Context Anchor)

This project documents a **Virtual Internship Platform** that:

* Prepares students
* Matches them to internships
* Manages internship execution
* Tracks KPIs and performance
* Issues verifiable certificates

This high-level flow is fixed and already agreed upon.

---

## 3. Documentation Parts (FINAL & LOCKED)

The project documentation is divided into **FOUR PARTS ONLY**, written **in this order**.

---

### ✅ PART 1 — `api-docs/` (**COMPLETED & LOCKED**)

**Purpose:**
Defines *system truth*.

This part answers:

* What rules exist?
* What states exist?
* What is allowed or forbidden?
* Who has authority?

**Contents:**

```
api-docs/
├── 00-introduction/
├── 01-canon/
├── 02-conventions/
├── 03-auth-identity/
├── 04-user-profiles/
├── 05-preparation/
├── 06-internship-discovery/
├── 07-applications-selection/
├── 08-internship-execution/
├── 09-kpis-performance/
├── 10-certification/
├── 11-notifications-logs/
├── 12-admin-system/
└── 13-integrations/
```

**Rules:**

* This part is DONE.
* Nothing in the project may contradict it.
* It is never re-written, only referenced.

---

### ✅ PART 2 — `screen-interactions/` (**COMPLETED & LOCKED**)

**Purpose:**
Defines the **truth of frontend ↔ backend interaction at the screen level**.

This part answers:

> “What happens on each screen, step by step?”

**What it contains:**

* Screen purpose
* Preconditions (role + state)
* Data needed to render
* User actions
* Backend calls (conceptual, not HTTP)
* Success & failure flows
* State transitions

**What it MUST NOT contain:**

* HTTP details
* REST paths
* WebSockets
* GraphQL
* Caching
* Performance tuning

**Structure:**

```
screen-interactions/
├── 00-overview/
│   └── 00-purpose-and-rules.md
│
├── student/
│   ├── 01-profile-setup.md
│   ├── 02-preparation-dashboard.md
│   ├── 03-resume-drill.md
│   ├── 04-interview-drill.md
│   ├── 05-internship-discovery.md
│   ├── 06-application-flow.md
│   ├── 07-internship-dashboard.md
│   └── 08-certificate-view.md
│
├── employer/
│   ├── 01-employer-profile.md
│   ├── 02-internship-management.md
│   ├── 03-applicant-review.md
│   ├── 04-interviews.md
│   └── 05-evaluations.md
│
├── admin/
│   ├── 01-admin-dashboard.md
│   ├── 02-overrides.md
│   ├── 03-certification-management.md
│   └── 04-reports.md
│
└── 99-appendix/
    └── common-patterns.md
```

**Rules:**

* This part is DONE.
* It defines all user-visible behavior.
* All downstream parts must map to it.

---

### ✅ PART 3 — `api-surface/` (**COMPLETED & LOCKED**)

**Purpose:**
Defines the **actual transport-level contract** between frontend and backend.

This is where you document:

* REST endpoints
* WebSocket events
* GraphQL queries & mutations
* Caching rules
* Pagination
* Rate limits
* Idempotency
* Real request/response payloads

**Critical Rule:**

> Everything in `api-surface/` must be a **direct mapping** of `screen-interactions/`.
> No new behavior is allowed here.

**Structure (FINAL):**

```
api-surface/
├── rest/
│   ├── auth/
│   ├── users/
│   ├── preparation/
│   ├── internships/
│   ├── applications/
│   ├── execution/
│   ├── kpis/
│   └── certificates/
│
├── websocket/
│   ├── notifications.md
│   ├── attendance.md
│   └── live-updates.md
│
├── graphql/
│   ├── schema.md
│   ├── queries.md
│   └── mutations.md
│
├── caching/
│   ├── read-models.md
│   ├── invalidation.md
│   └── ttl-policy.md
│
└── 99-appendix/
    ├── error-codes.md
    └── rate-limits.md
```

#### WebSocket Clarification (IMPORTANT)

* Only the three files above may exist under `websocket/`
* **No README.md or shared file is allowed**
* Global WebSocket rules must be **duplicated verbatim** at the top of each file

**Rules:**

* PART 3 is DONE.
* It is now LOCKED.
* Any new endpoint requires updates to `screen-interactions/` first.

---

### 🟡 PART 4 — `implementation-notes/` (**ADVISORY, DEFINED**)

**Purpose:**
Engineering, architectural, frontend, backend, realtime, data, and operational guidance.

**Authority Level:**
Non-authoritative.
Helpful, but never binding.

**Rules:**

* May NOT introduce behavior
* May NOT override any previous part
* May evolve freely
* Exists to support implementation, not define truth

**Structure (DEFINED & COMPLETE):**

```
implementation-notes/
├── 00-overview.md
├── 98-developer-onboarding.md
├── 99-handoff.md
│
├── backend/
│   ├── service-boundaries.md
│   └── data-ownership.md
│
├── frontend/
│   ├── state-management.md
│   └── data-fetching.md
│
├── realtime/
│   └── event-handling.md
│
├── data/
│   └── persistence-strategy.md
│
└── operations/
    ├── observability.md
    ├── deployment.md
    ├── security.md
    └── failure-scenarios.md
```

#### Special Files

* **`99-handoff.md`**
  Canonical project handoff and continuation guide.

* **`98-developer-onboarding.md`**
  Step-by-step onboarding checklist to prevent contract violations.

---

## 4. Progress Tracking (THIS IS THE KEY)

At **any moment**, project state is defined by **one line**:

```
CURRENT LOCATION = <part>/<path>/<file.md>
```

Examples:

```
screen-interactions/student/02-preparation-dashboard.md
api-surface/rest/internships/list.md
api-surface/websocket/notifications.md
implementation-notes/frontend/state-management.md
```

Nothing else is required.

---

## 5. Universal Continuation Prompt (COPY–PASTE)

### 🧠 CONTINUE PROJECT PROMPT

> You are working on a **Virtual Internship Platform**.
>
> The project is governed by:
>
> ```
> docs/PROJECT-CONTINUATION-CONTRACT.md
> ```
>
> `api-docs/`, `screen-interactions/`, and `api-surface/` are **completed and locked**.
>
> ---
>
> **CURRENT LOCATION:**
>
> ```
> <paste exact path here>
> ```
>
> ---
>
> Continue work from this location.
>
> Rules:
>
> * Do not re-explain completed parts
> * Do not modify locked sections
> * Do not introduce new behavior
> * Stay consistent with all prior work

---

## 6. Final Lock Statement

This file:

* Controls structure
* Controls order
* Controls continuation
* Controls ChatGPT behavior
* Preserves cross-chat context

If continuation ever feels confusing, **this file was not followed**.
