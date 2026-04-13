# Screen Interactions — Purpose & Rules

## 1. Purpose of `screen-interactions/`

The `screen-interactions/` documentation layer defines the **behavioral contract between frontend screens and backend logic**, expressed at the **screen level**, not the transport level.

Its purpose is to answer one question precisely:

> **What happens, step by step, when a user interacts with a specific screen?**

This layer translates the *system truth* defined in `api-docs/` into **concrete, user-facing flows** without yet committing to HTTP, REST, GraphQL, or WebSocket details.

It acts as the **single source of truth** for frontend behavior and as the **mandatory blueprint** for the real API contracts defined later in `api-surface/`.

---

## 2. What This Layer Represents

Each document in `screen-interactions/` represents **one screen or tightly-coupled screen flow** and describes:

* Why the screen exists
* Who can access it
* Under what conditions it is accessible
* What data must be available to render it
* What actions the user can perform
* What backend capabilities are invoked conceptually
* What happens on success or failure
* How system state changes as a result

This layer is **user-journey–driven**, not technical-stack–driven.

---

## 3. What This Layer MUST Contain

Every screen interaction document **must** be structured around the following concepts (exact section naming may vary, but the meaning must be present):

1. **Screen Purpose**

   * Why this screen exists in the platform
   * What user problem it solves

2. **Actors & Preconditions**

   * User role (Student, Employer, Admin)
   * Required system state (e.g. profile completed, internship accepted)

3. **Required Data**

   * Data objects needed to render the screen
   * Data visibility rules (read-only vs editable)

4. **User Actions**

   * Explicit actions the user can take on this screen
   * No hidden or implied actions

5. **System Responses**

   * What the system does when each action is triggered
   * Conceptual backend behavior (not technical calls)

6. **Success & Failure Flows**

   * What happens when an action succeeds
   * What happens when it fails
   * User-visible feedback

7. **State Transitions**

   * How user or system state changes as a result
   * What new screens or states become accessible

---

## 4. What This Layer MUST NOT Contain (Critical)

The following are **explicitly forbidden** in `screen-interactions/`:

* HTTP methods (`GET`, `POST`, etc.)
* REST paths or URLs
* GraphQL schemas, queries, or mutations
* WebSocket event names
* Request/response payload schemas
* Database tables or fields
* Caching strategies
* Performance optimizations
* Retry logic
* Pagination mechanics
* Authorization tokens or headers

If any of the above appear, the document is **invalid** and must be corrected.

---

## 5. Relationship to Other Documentation Parts

### Relationship to `api-docs/` (PART 1)

* `api-docs/` defines **what is allowed to exist**
* `screen-interactions/` defines **how users experience it**

Rules:

* Nothing here may contradict `api-docs/`
* No new system rules may be invented here
* All behavior must be explainable using concepts already defined there

---

### Relationship to `api-surface/` (PART 3)

* `screen-interactions/` defines **what must happen**
* `api-surface/` defines **how it is technically executed**

Rules:

* Every endpoint, event, or operation in `api-surface/` must map back to a screen interaction
* No behavior may exist in `api-surface/` that is not first described here

This makes `screen-interactions/` the **gatekeeper** for real API design.

---

## 6. Level of Precision Required

This layer must be:

* **Precise enough** that frontend developers can implement screens without guessing
* **Abstract enough** that backend engineers can choose appropriate transport mechanisms later

If a frontend developer asks:

> “What happens if the user clicks this?”

The answer **must already exist** in this documentation.

---

## 7. Scope of This Part

This part covers screens for:

* Students
* Employers
* Administrators

Each role is documented separately, but all follow the same interaction principles defined here.

Shared or cross-cutting patterns are documented only in:

```
screen-interactions/99-appendix/common-patterns.md
```

---

## 8. Final Rule (Non-Negotiable)

> **If a screen exists in the product, it must exist in `screen-interactions/`.
> If it exists in `screen-interactions/`, it must be implemented exactly as described.**

There are no exceptions.

---
