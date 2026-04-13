 `implementation-notes/00-overview.md`

## Purpose

This section contains **engineering and architectural notes** intended to help developers implement the system described in:

* `api-docs/` (canonical rules)
* `screen-interactions/` (behavioral flow)
* `api-surface/` (transport contracts)

**Nothing in `implementation-notes/` is authoritative.**
If a conflict exists, this section always loses.

---

## Intended Audience

These notes are written for:

* Backend engineers
* Frontend engineers
* DevOps / infrastructure engineers
* Technical leads onboarding onto the project

They assume familiarity with:

* REST APIs
* WebSockets
* GraphQL
* Event-driven systems

---

## Scope of This Section

`implementation-notes/` may include:

* Suggested service boundaries
* Example data flows
* Technology-agnostic architecture patterns
* Performance considerations
* Operational concerns
* Trade-offs and alternatives

It may **not**:

* Define new behavior
* Override API contracts
* Introduce new states or roles
* Redefine workflows

---

## Relationship to Other Parts

| Section                 | Authority           |
| ----------------------- | ------------------- |
| `api-docs/`             | 🔒 Absolute         |
| `screen-interactions/`  | 🔒 Behavioral truth |
| `api-surface/`          | 🔒 Transport truth  |
| `implementation-notes/` | 🟡 Advisory only    |

Think of this section as **“how we might build it”**, not **“what it is”**.

---

## Change Policy

* This section may evolve freely
* Backward compatibility is not guaranteed
* Notes may be added, revised, or removed
* No formal versioning is required

---

## Suggested Structure

A typical structure under this folder may look like:

```
implementation-notes/
├── 00-overview.md
├── backend/
├── frontend/
├── realtime/
├── data/
└── operations/
```

Subfolders are **guidance only** and may vary by team.

---

## Design Philosophy (Non-Binding)

* Prefer clarity over cleverness
* Optimize for maintainability
* Keep business rules centralized
* Treat REST as the system backbone
* Use WebSockets sparingly and deliberately

---
