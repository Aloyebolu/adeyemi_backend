# Permission System Guide

This document explains how the **Permission System** works in the university platform. It is designed to be simple to reason about, safe for real academic operations, and easy to plug into an existing Express app.

This guide is the **single source of truth** for how authority is granted, used, limited, and audited.

---

## 1. Purpose of the Permission System

The permission system exists to answer one question clearly and defensibly:

**Who allowed this action to happen, under what limits, and for how long?**

It is NOT meant to:

* Replace roles
* Permanently elevate users
* Handle authentication

It IS meant to:

* Delegate temporary authority
* Limit power by scope, time, and quantity
* Integrate cleanly with audit logs

---

## 2. Core Concepts

### Roles

Roles describe **who a user is**.
Examples:

* admin
* hod
* lecturer
* student

Roles are stable and long-lived.

---

### Permissions

Permissions describe **what a user is allowed to do temporarily**.

Permissions are:

* Signed
* Scoped
* Time-bound
* Optional

A user may have a role without a permission, but no sensitive action should occur without authority.

---

### Delegated Authority

Permissions represent delegated authority.

Example:

* An admin delegates result termination power to a HOD
* The HOD does NOT become an admin
* The power expires automatically

This mirrors real university approval processes.

---

## 3. When Permissions Are Required

Permissions are required for actions that:

* Modify academic records
* Change student status (termination, withdrawal, probation)
* Perform bulk or automated decisions
* Override system rules
* Affect payments or approvals

Permissions are NOT required for:

* Read-only operations
* Viewing dashboards
* Fetching lists

---

## 4. Permission Token Structure

Each permission is issued as a **signed token** containing:

* permission_id
* action
* granted_to (user id and role)
* granted_by (admin or system)
* scope (department, faculty, session, semester)
* constraints (time, quantity, limits)
* issued_at
* expires_at

This token is trusted by middleware and never modified downstream.

---

## 5. Scope

Scope limits where a permission is valid.

Common scope fields:

* department_id
* faculty_id
* session
* semester

A permission is invalid if the requested action exceeds its scope.

---

## 6. Constraints

Constraints limit how much power a permission grants.

Supported constraint types:

* Time window (expires_at)
* Maximum number of affected records

Example use cases:

* Terminate at most 15 students
* Process results only within 2 hours

Constraints are enforced during request handling.

---

## 7. Permission Lifecycle

1. **Request**

   * User (e.g. HOD) requests permission

2. **Approval**

   * Admin or policy engine approves and issues permission

3. **Usage**

   * Permission token is attached to requests

4. **Expiration**

   * Permission automatically becomes invalid

No manual revocation is required in most cases.

---

## 8. Middleware Responsibilities

Permission middleware must:

* Verify token signature
* Check expiration
* Validate action against route intent
* Validate scope
* Enforce constraints

On success:

* Attach immutable permission_context to the request

On failure:

* Reject the request immediately

The middleware must NOT:

* Modify data
* Log audit records
* Make business decisions

---

## 9. Interaction With Audit System

The permission system and audit system are separate.

Relationship:

* Permission system decides **whether** an action may happen
* Audit system records **what** happened

Audit logs may read permission_context if present.

Audit logs must never enforce permissions.

---

## 10. System and Automated Actions

Some actions are executed by the system itself.

In these cases:

* Permissions may be issued by policy engines
* permitted_by may be SYSTEM_POLICY

This allows automation without pretending a human acted.

---

## 11. Design Rules (Non-Negotiable)

* Never elevate roles temporarily
* Never reuse expired permissions
* Never modify permission context after middleware
* Never skip permissions for sensitive routes
* Never log fake authorities

---

## 12. Mental Model

Roles = Identity
Permissions = Authority
Audit Logs = Accountability

If these three are kept separate, the system remains safe, explainable, and scalable.

---

## 13. Why This Design Works

* Matches real university approval flows
* Prevents accidental abuse
* Survives audits and disputes
* Easy to extend to new features
* Minimal changes to existing codebase

---

End of guide.

I want to give you a whole system and lets fix this system, here are some known issues below, 
1. The typing should not be shown to who is typing
2. The ChatInterface should properly diffrentiate between the attendant and who they are attending to.
3. Chats should be closed properly.
4. A user should not have two sessions
5. The backend should handle automatic closing of sessions when the one who is being attended to goes offline or the chat stays opend for 5min with no message from both parties
6. The handling of files should be fixed.
7. The chat bubble should display the proper user name and also position itself based on the user just like a modern chat interface.
8. There should be support for sounds with proper error handling if file doesn not exist
9. The know errors are the onese i listed above, if you see any other one or have any suggestion to make the system perfect feel free to include them



---
### Note:
This domain is not yet implemented into the system, if it would be needed later then there should be consideration of the amount of times a permit can be used before it expres
* The database tracks the amount of times a particular token is being used and when it reaches its peak then the token becomes useless but must remain in the database.
* The time of expiry of a token should also be stored together with the token so that it can be safely removed from the databse after expiry thereby depending on jwt to reject expired tokens safely