# Soft-Delete & Safe-Deletion Architecture (Express.js)

This backend enforces a **strict, centralized soft-delete system** with **pre-delete scanning** and **confirmation-based execution**.

There is:

* ❌ No hard delete from the API
* ❌ No frontend-controlled delete logic
* ✅ One global backend delete service
* ✅ Mandatory dependency scanning before deletion

---

## 1. Core Principle

> **Deletion is a two-phase backend-controlled operation.**

1. **Scan Phase**
   Determines what will be affected by a delete request.
2. **Commit Phase**
   Executes the soft delete only after explicit confirmation.

Both phases are handled by **one backend service**.

---

## 2. Deletion States

A document exists in one of two states:

| State    | deletedAt | Meaning                |
| -------- | --------- | ---------------------- |
| Active   | null      | Normal, visible record |
| Archived | Date      | Soft-deleted record    |

There is **no API-accessible hard delete**.

---

## 3. High-Level Request Flow

```text
Request
  ↓
Auth Middleware (role, permissions)
  ↓
Delete Intent Resolver
  ↓
Dependency Scan Engine
  ↓
Delete Service (scan | commit)
  ↓
Controller Response
```

The controller does **not** decide deletion logic.

---

## 4. Single Delete Entry Point

All delete operations go through **one service**.

Conceptually:

```text
softDeleteService({
  model,
  id,
  mode: "scan" | "commit",
  reason,
  user
})
```

No other delete logic is allowed anywhere else in the codebase.

---

## 5. Phase 1: Scan Mode (Preview / Warning)

### Purpose

Determine whether a document:

* Can be safely archived
* Is linked to other active records
* Requires confirmation
* Should be blocked entirely

### Behavior

* No mutation occurs
* No timestamps are changed
* No data is hidden

### Output (conceptual shape)

```js
{
  canDelete: true | false,
  requiresConfirmation: true | false,
  affectedRelations: [
    {
      model: "Enrollment",
      count: 3,
      severity: "block" | "warn"
    }
  ],
  message: "This course is used by 3 enrollments"
}
```

Frontend uses this **only for display**.

---

## 6. Phase 2: Commit Mode (Soft Delete)

### Rules

* Scan is always re-run internally
* Frontend confirmation is never trusted
* State must still be valid at execution time

### Commit Conditions

| Condition                        | Result  |
| -------------------------------- | ------- |
| Blocking dependencies exist      | Reject  |
| Warnings exist + no confirmation | Reject  |
| State changed since scan         | Reject  |
| All rules satisfied              | Archive |

### Archive Action

```js
{
  deletedAt: new Date(),
  deletedBy: user.id,
  deleteReason
}
```

---

## 7. Dependency Scan Engine

### Responsibility

The scan engine determines **what references a document**.

This is **explicit**, not inferred.

---

### Dependency Definition (Per Model)

Each model declares what depends on it.

Example concept:

```js
Course.dependencies = [
  {
    model: "Enrollment",
    foreignKey: "courseId",
    severity: "block"
  },
  {
    model: "BorrowedCourse",
    foreignKey: "courseId",
    severity: "warn"
  }
];
```

---

### Scan Rules

* Only **active records** are considered
* Archived dependents are ignored
* Severity determines behavior:

  * `block` → deletion forbidden
  * `warn` → confirmation required

---


## 8. Express Controller Responsibility

Controllers:

* Do not scan
* Do not delete
* Do not inspect dependencies

They only:

* Validate input
* Call the delete service
* Return structured results

Example flow:

* `DELETE /courses/:id/scan`
* `DELETE /courses/:id/confirm`

Both routes call the **same service** with different modes.

---

## 9. Middleware Rules

### Authentication Middleware

* Resolves user
* Attaches role and permissions

### Authorization Rules

* Only privileged roles may delete
* Role does **not** bypass dependency rules

Admins may:

* Override warnings
* Never override blocks

---

## 10. Schema-Level Archive Enforcement

All queries enforce archive visibility automatically.

Controllers MUST NOT filter `deletedAt`.

Example concept:

```js
schema.pre(/^find/, function () {
  const mode = this.getOptions().archiveMode || "exclude";

  if (mode === "exclude") {
    this.where({ deletedAt: null });
  }

  if (mode === "only") {
    this.where({ deletedAt: { $ne: null } });
  }
});
```

---

## 11. Restore Operations

Restore is the inverse of delete and must bypass filters.

### Mandatory Rule

> Restore queries MUST use `archiveMode: "all"`.

Example:

```js
Model.findByIdAndUpdate(
  id,
  { deletedAt: null },
  { new: true }
).setOptions({ archiveMode: "all" });
```

---

## 12. Frontend Contract (Enforced Server-Side)

Frontend may:

* Request scan results
* Confirm deletion after warnings
* Trigger restore

Frontend may NOT:

* Pass `deletedAt`
* Skip scan
* Force deletion
* Control cascade behavior

---

## 13. Hard Delete Policy

* No API route performs hard delete
* No frontend-triggered hard delete exists
* Hard delete (if ever needed):

  * Admin-only
  * CLI / migration / maintenance job
  * Fully logged

Hard delete is **operational**, not application behavior.

---

## 14. Common Failure Patterns (Disallowed)

❌ Multiple delete implementations
❌ Frontend-controlled delete flags
❌ Skipping scan during commit
❌ Controller-level dependency logic
❌ Hard delete routes

Any of these break safety guarantees.

---

## 15. Mental Model

> **Delete is a conversation, not an action.**

Scan first.
Understand impact.
Confirm deliberately.
Archive safely.

---

## 16. Final Notes

This system is intentionally strict.

It optimizes for:

* Data safety
* Predictability
* Long-term maintenance
* Zero accidental loss

If deletion logic changes, **this document must be updated**.

---