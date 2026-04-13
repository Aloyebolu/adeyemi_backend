# Admin — Overrides

## 1. Screen Purpose

The **Overrides** screen allows administrators to **intervene in exceptional situations** where automated rules or normal workflows must be adjusted.

Its purpose is to:

* Resolve blocked or inconsistent states
* Correct data or state errors safely
* Enforce governance and compliance decisions
* Provide a controlled mechanism for manual authority

This screen exists for **exception handling only**, not routine operations.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Admin

### Preconditions

* Admin is authenticated
* Admin has override permissions
* Target entity (student, employer, internship, application) exists

If override permissions are not granted, this screen is inaccessible.

---

## 3. Required Data to Render

To render the Overrides screen, the system provides:

* Search and lookup capabilities for entities
* Entity current state and history
* Allowed override actions per entity type
* Reason and justification requirements
* Audit visibility indicators

---

## 4. Screen Structure & Sections

The screen is designed for **precision and accountability**, typically including:

1. **Entity Lookup**

   * Search by ID, name, or reference
   * Entity type selection

2. **Current State Overview**

   * Entity status and lifecycle position
   * Recent actions and history

3. **Override Action Panel**

   * Allowed manual actions
   * State transition options

4. **Justification & Confirmation**

   * Mandatory reason entry
   * Explicit confirmation step

---

## 5. User Actions

The admin can:

* Locate a specific entity
* Review its current and past states
* Apply an allowed override action
* Provide a justification
* Confirm override execution

Overrides **cannot be undone** without another override.

---

## 6. System Responses (Conceptual)

### On Override Attempt

* System validates admin permissions
* Allowed actions are enforced

### On Override Confirmation

* State transition is applied
* Audit record is created
* Affected users are notified (if applicable)

---

## 7. Success & Failure Flows

### Successful Override

* Entity state is updated
* Override is logged permanently
* Normal workflow may resume

### Failure Cases

* Invalid override → blocked with explanation
* Missing justification → submission blocked
* System error → no state change, retry allowed

---

## 8. State Transitions

Overrides may trigger **non-standard transitions**, but always within allowed admin authority.

All override transitions are:

* Explicit
* Audited
* Traceable

---

## 9. Exit Conditions

The admin exits this screen when:

* Override is completed
* Returning to Admin Dashboard
* Logging out

This screen should be used sparingly.

---
