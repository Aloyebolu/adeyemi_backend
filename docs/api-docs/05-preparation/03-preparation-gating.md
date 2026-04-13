## 1. Purpose

This document defines the **gating logic** that enforces completion of preparation requirements before a student may progress to downstream domains.

Preparation gating is a **hard enforcement layer**, not a UI suggestion.

---

## 2. Gated Actions

Preparation gating applies to the following actions:

| Action                     | Blocked If             |
| -------------------------- | ---------------------- |
| View internship listings   | Preparation incomplete |
| Receive AI recommendations | Preparation incomplete |
| Apply to internship        | Preparation incomplete |
| Accept interview invite    | Preparation incomplete |

Gating is enforced **server-side**.

---

## 3. Gating Conditions (Canonical)

A student is considered **preparation-complete** only if:

* Profile completeness ≥ 80%
* Resume Drill state = `completed`
* Interview Drill state = `completed`

All three conditions must be satisfied.

---

## 4. Gating Evaluation Logic

On every gated request, backend evaluates:

```text
isProfileComplete &&
isResumeDrillCompleted &&
isInterviewDrillCompleted
```

If any condition fails, the request is rejected.

---

## 5. Rejection Behavior

### 5.1 Standard Gate Failure Response

```json
{
  "error": {
    "code": "PREPARATION_INCOMPLETE",
    "message": "Complete Resume and Interview preparation to continue",
    "missing": [
      "resume_drill",
      "interview_drill"
    ]
  }
}
```

Frontend must display:

* Clear explanation
* Direct navigation to missing drills

---

## 6. No Bypass Rules

* Admins cannot override preparation gates
* Employers cannot waive preparation
* AI cannot auto-complete drills
* No feature flags may disable gating in production

Any bypass attempt is a **policy violation**.

---

## 7. Regression Handling

If a student:

* Deletes or invalidates resume
* Edits profile causing completeness < 80%

Then:

* Preparation status is **retained**
* Application access is **re-blocked**
* Student must re-satisfy missing conditions

---

## 8. Audit & Logging

Each gated rejection logs:

* Student ID
* Blocked action
* Missing requirements
* Timestamp

Logs are used for:

* Debugging
* Compliance
* Abuse detection

---

## 9. Dependency Enforcement

This gating layer blocks entry into:

* `06-internship-discovery`
* `07-applications-selection`

No downstream domain may re-implement or weaken this logic.

---

## 🔒 Lock Statement

Preparation gating rules are **absolute**.
If preparation is incomplete, progression **must stop**.
