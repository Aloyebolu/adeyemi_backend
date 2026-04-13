# `implementation-notes/99-handoff.md`

## Purpose

This document serves as the **official handoff and continuation guide** for the Virtual Internship Platform project.

It answers:

* What is finished
* What is locked
* What can change
* How new contributors should proceed
* How to avoid breaking system truth

This file is **advisory**, but it is the **recommended starting point** for any new engineer, team, or maintainer.

---

## Project Status Summary

### ✅ Completed & Locked

The following parts are **finished and must not be modified without explicit governance**:

* `api-docs/`
  → Canonical rules, roles, states, authority

* `screen-interactions/`
  → Screen-by-screen behavioral truth

* `api-surface/`
  → REST, WebSocket, GraphQL, caching, rate limits

These three together define **what the system is**.

---

### 🟡 Advisory & Flexible

The following part is **guidance only** and may evolve:

* `implementation-notes/`

Changes here must:

* Respect all upstream contracts
* Never introduce new behavior
* Never contradict locked sections

---

## How to Continue Development Safely

### Adding New Features

When adding a new feature, the correct order is:

1. **Update `api-docs/`**
   (only if new rules or states are required)

2. **Update `screen-interactions/`**
   (define exact user behavior)

3. **Update `api-surface/`**
   (define transport contracts)

4. **Optionally update `implementation-notes/`**

Skipping steps leads to inconsistency.

---

### Making Implementation Changes

If you are:

* Refactoring services
* Changing infrastructure
* Improving performance
* Replacing technologies

You should:

* Touch **only** `implementation-notes/`
* Ensure behavior remains unchanged
* Validate against API contracts

---

## What Must Never Happen

🚫 Adding endpoints without screen definitions
🚫 Introducing behavior only in implementation
🚫 Letting frontend invent logic
🚫 Letting WebSockets mutate state
🚫 Treating caches as source of truth
🚫 Modifying locked folders casually

If any of these happen, the contract is broken.

---

## Recommended First Steps for New Teams

1. Read `docs/PROJECT-CONTINUATION-CONTRACT.md`
2. Read `api-docs/00-introduction/`
3. Skim `screen-interactions/` for your role
4. Use `api-surface/` as the build contract
5. Refer to `implementation-notes/` only for guidance

---

## Governance Recommendation (Non-Binding)

For long-term health, consider:

* Code reviews that reference documentation paths
* PR templates that ask “Which folder is affected?”
* Periodic audits of contract adherence

Documentation is part of the system, not an afterthought.

---

## Final Statement

At this point, the project is:

* **Structurally complete**
* **Internally consistent**
* **Safe to implement**
* **Safe to hand off**
* **Safe to scale**

Any future confusion should be resolved by returning to:

```
docs/PROJECT-CONTINUATION-CONTRACT.md
```

---