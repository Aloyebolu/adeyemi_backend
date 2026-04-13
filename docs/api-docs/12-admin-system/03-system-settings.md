## 1. Purpose

This document defines how **global system settings** are configured, updated, and enforced.

System settings affect **platform-wide behavior** and therefore carry **critical risk**.
They are tightly controlled and heavily audited.

---

## 2. What Counts as a System Setting

System settings are **global configuration values** that influence multiple domains.

Examples include:

* Feature flags
* Global thresholds
* Integration enablement
* Platform-wide limits
* Emergency controls

System settings are **not** user preferences.

---

## 3. Who Can Modify System Settings

Only users with role:

* `super_admin`

Standard admins, auditors, employers, and students **cannot** modify system settings.

---

## 4. Categories of System Settings

### 4.1 Feature Flags

Used to:

* Enable or disable features
* Gradually roll out functionality
* Kill-switch unstable components

**Rules**

* Flags are environment-scoped
* Default state must be explicit
* Flags must not bypass Canon rules

---

### 4.2 Global Thresholds

Examples:

* Minimum profile completeness percentage
* Attendance tolerance limits
* KPI default thresholds (future internships only)

**Rules**

* Changes apply **prospectively only**
* Never affect active or completed internships
* Historical data remains unchanged

---

### 4.3 Integration Controls

Examples:

* AI recommendation engine enablement
* External verification services
* Email/SMS providers

**Rules**

* Disabling integrations must degrade gracefully
* No data loss on disable
* Re-enable must be safe and idempotent

---

### 4.4 Emergency Controls

Examples:

* Freeze all applications
* Pause internship starts
* Disable certificate issuance temporarily

**Rules**

* Explicit activation required
* Time-bound where possible
* Immediate audit log entry mandatory

---

## 5. System Setting Object (Canonical)

```json
{
  "settingKey": "FEATURE_AI_RECOMMENDATIONS",
  "value": true,
  "environment": "production",
  "updatedBy": "super_admin_01",
  "updatedAt": "2026-01-10T12:00:00Z",
  "reason": "Gradual rollout phase 2"
}
```

---

## 6. Change Management Rules

Every system setting change requires:

* Explicit reason
* Immediate audit log entry
* Optional secondary approval (policy-defined)
* Optional cooling-off period

No silent or bulk changes are allowed.

---

## 7. Rollback Strategy

* Rollbacks are treated as **new setting changes**
* Previous values are not overwritten
* Rollback reason must be recorded
* Rollback itself is audited

---

## 8. Visibility Rules

| Role        | Visibility                     |
| ----------- | ------------------------------ |
| Student     | ❌ None                         |
| Employer    | ❌ None                         |
| Admin       | Read-only (non-critical flags) |
| Super Admin | Full                           |
| Auditor     | Read-only                      |

---

## 9. Error Scenarios

### 9.1 Unauthorized Setting Change

```json
{
  "error": {
    "code": "SYSTEM_SETTING_PERMISSION_DENIED",
    "message": "You are not authorized to modify system settings"
  }
}
```

---

### 9.2 Invalid Setting Value

```json
{
  "error": {
    "code": "INVALID_SYSTEM_SETTING",
    "message": "Provided value is not valid for this setting"
  }
}
```

---

## 10. Non-Negotiable Constraints

* No environment cross-contamination
* No retroactive effect
* No hidden defaults
* No undocumented settings

---

## 🔒 Lock Statement

System settings are **critical infrastructure controls**.
No domain may introduce hidden configuration switches.