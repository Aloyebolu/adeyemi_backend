## 1. Purpose

This document defines the **admin view and control** over user profiles.

Admins are the **only role** with:

* Full visibility
* Corrective authority
* Verification power
* Locking capability

Admin access exists to **protect system integrity**, not to bypass rules.

---

## 2. Admin Scope of Access

Admins can view:

* Full student profile (all fields)
* Document metadata and files
* Verification history
* Profile state transitions
* Override history
* Audit logs related to the profile

No profile data is hidden from admins.

---

## 3. Admin Capabilities

### 3.1 Read Capabilities

Admins may:

* View live profiles
* View all historical snapshots
* Compare profile versions
* Inspect document submissions

Snapshots are read-only, even for admins.

---

### 3.2 Write Capabilities (Controlled)

Admins may:

* Correct profile fields
* Verify or reject documents
* Lock profiles
* Add internal notes

Admins may **not**:

* Change profile ownership
* Edit certificate-linked snapshots
* Alter KPI results or evaluations

---

## 4. Admin Profile Edits

### 4.1 Editable Fields

Admins may edit:

* Legal name
* Education details
* Skills
* Preferences

Each edit must include:

* A reason
* A before/after record

---

### 4.2 Restricted Edits

Admins cannot edit:

* `userId`
* Auth role
* Historical snapshots
* Certificate data

Attempts are rejected by backend.

---

## 5. Profile Locking

### 5.1 Lock Reasons

Profiles may be locked due to:

* Fraud detection
* Compliance investigation
* Certification snapshot creation
* Legal requests

---

### 5.2 Effects of Locking

When locked:

* Student edits are disabled
* Employer access remains snapshot-based
* Unlocking requires elevated admin approval

---

## 6. Audit & Accountability

Every admin action generates an immutable audit log:

```json
{
  "adminId": "admin_77",
  "profileId": "profile_9f8a21",
  "action": "PROFILE_LOCKED",
  "timestamp": "2026-01-18T11:30:00Z",
  "reason": "Certification snapshot created"
}
```

Audit logs:

* Are non-editable
* Are non-deletable
* Are visible only to admins

---

## 7. Notification Rules

Students are notified when:

* Profile data is corrected
* Documents are rejected
* Profile is locked

Notifications contain:

* What changed
* Why (sanitized)
* Who performed the action (role, not name)

---

## 8. Error Example

### 8.1 Unauthorized Admin Action

```json
{
  "error": {
    "code": "ADMIN_PERMISSION_REQUIRED",
    "message": "You do not have permission to perform this action"
  }
}
```

---

## 🔒 Lock Statement

Admin authority is **broad but constrained**.
Admins enforce rules — they do not rewrite them.