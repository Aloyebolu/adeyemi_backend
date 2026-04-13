# `implementation-notes/98-developer-onboarding.md`

## Purpose

This document provides a **step-by-step onboarding checklist** for developers joining the Virtual Internship Platform project.

It ensures new contributors:

* Understand system boundaries
* Know where to make changes
* Avoid violating locked contracts
* Can become productive quickly and safely

This document is **advisory**.

---

## Phase 1 — Orientation (Read-Only)

☐ Read `docs/PROJECT-CONTINUATION-CONTRACT.md`
☐ Understand the four documentation parts
☐ Identify which parts are **locked**
☐ Acknowledge that behavior is documentation-driven

> If this step is skipped, mistakes are guaranteed.

---

## Phase 2 — System Understanding

☐ Read `api-docs/00-introduction/`
☐ Skim all domain folders in `api-docs/`
☐ Identify core roles (student, employer, admin)
☐ Understand system states (preparation, execution, certification)

At this stage, **do not think about code yet**.

---

## Phase 3 — Behavior Familiarization

☐ Locate relevant screens in `screen-interactions/`
☐ Read screen files end-to-end
☐ Note:

* Preconditions
* User actions
* State transitions
* Failure paths

If something is unclear here, **code will be wrong**.

---

## Phase 4 — API Contract Awareness

☐ Locate corresponding files in `api-surface/`
☐ Identify REST endpoints involved
☐ Check WebSocket events for that flow
☐ Review GraphQL exposure (if applicable)

Code must follow contracts — not reinterpret them.

---

## Phase 5 — Implementation Context

☐ Read relevant `implementation-notes/` files
☐ Identify:

* Owning service
* Data ownership
* Read vs write models
* Realtime implications

Remember: implementation notes **guide**, they do not define truth.

---

## Phase 6 — Local Development Setup (Team-Specific)

☐ Set up local environment
☐ Verify authentication flow
☐ Verify at least one end-to-end happy path
☐ Confirm error handling paths surface correct codes

This phase varies by team and stack.

---

## Phase 7 — Making Your First Change (Safely)

Before writing code:

☐ Identify **which folder** your change belongs to
☐ Confirm whether the change:

* Adds behavior ❓
* Changes behavior ❓
* Only refactors ❓

### Decision Guide

| Change Type         | Allowed Folder                    |
| ------------------- | --------------------------------- |
| New rule / state    | ❌ requires governance             |
| New screen behavior | `screen-interactions/` first      |
| New endpoint        | `api-surface/` only after screens |
| Refactor            | `implementation-notes/` only      |
| Performance         | `implementation-notes/`           |

---

## Phase 8 — Code Review Self-Check

Before opening a PR:

☐ Does this change violate any locked docs?
☐ Did I invent logic not documented?
☐ Did I bypass REST via WebSocket?
☐ Did I mutate data I don’t own?
☐ Did I treat caches as truth?

If any answer is “yes”, stop.

---

## Phase 9 — Long-Term Contribution Hygiene

☐ Keep changes small and scoped
☐ Reference documentation paths in PRs
☐ Update advisory notes when patterns change
☐ Raise questions early when contracts feel limiting

Good contributors protect system clarity.

---

## Common Onboarding Mistakes (Avoid These)

🚫 Starting with implementation notes
🚫 Treating frontend state as authoritative
🚫 Adding endpoints ad hoc
🚫 Using WebSockets for writes
🚫 Bypassing screen-interaction definitions
🚫 Assuming “this is obvious” without checking docs

---

## Final Reminder

> **This project is documentation-driven.
> Code follows docs — not the other way around.**

When in doubt, stop and re-read the contract.

---
