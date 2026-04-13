## Key Principles

This document defines the **non-negotiable principles** that guide all API design, implementation, and usage across the Virtual Internship Platform.

These principles exist to ensure **consistency, safety, scalability, and clarity** as the system grows.

If a technical decision violates one of these principles, it must be reconsidered.

---

## 1. Single Source of Truth

The platform is the **authoritative source** for:

* Internship states
* Student participation
* Performance data
* Evaluations
* Certification status

External systems, frontend clients, and integrations **must not** maintain their own conflicting versions of this data.

APIs must always return **current, canonical state**.

---

## 2. State-Driven Behavior

All meaningful entities in the system are **stateful**.

Examples:

* Students
* Internships
* Applications
* Certificates

Actions are allowed **only** when the entity is in a valid state.

The API must:

* Validate state transitions
* Reject invalid actions
* Return clear error messages

There is no “best effort” behavior.

---

## 3. Role-Based Access Control by Default

Every API endpoint:

* Has explicitly defined allowed roles
* Rejects unauthorized access
* Does not rely on frontend enforcement

Roles are derived from authentication tokens and cannot be spoofed.

---

## 4. Explicit Over Implicit

The API favors **explicitness** over convenience.

This means:

* No hidden defaults
* No inferred behavior
* No undocumented side effects

If the system performs an action, it must be **clearly documented**.

---

## 5. Immutability of Critical Records

Once finalized, the following records are **read-only**:

* KPI results
* Employer evaluations
* Issued certificates

Corrections require:

* Admin intervention
* Audit logging
* New records (not silent edits)

This protects trust and auditability.

---

## 6. Screen-First API Design

Endpoints exist because a **frontend screen needs them**.

Each endpoint must:

* Map to one or more screens
* Return exactly the data required
* Avoid over-fetching or under-fetching

Generic “dump everything” endpoints are not allowed.

---

## 7. Predictable Error Handling

Errors must:

* Be consistent
* Be human-readable
* Be actionable by frontend logic

The same error condition must always produce the same error code and structure.

---

## 8. Versioning Over Breaking Changes

Breaking changes are handled by:

* New API versions
* Clear deprecation windows
* Explicit communication

Silent breaking changes are forbidden.

---

## 9. Auditability and Traceability

All sensitive actions must be traceable:

* Who did it
* When it happened
* Why it happened (where applicable)

This applies especially to:

* Admin overrides
* Evaluations
* Certification actions

---

## 10. Security by Design

Security is not an afterthought.

The API must:

* Validate all inputs
* Enforce ownership checks
* Rate-limit sensitive endpoints
* Protect against data leakage across roles

---

## Relationship to Canon

These principles **support and enforce** the canonical rules defined in:

* `01-canon / 00-canonical-decisions.md`
* `01-canon / 01-roles-and-permissions.md`

They must never contradict canon.

