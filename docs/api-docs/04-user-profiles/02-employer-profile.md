## 1. Purpose

This document defines how **employers view student profiles**, including:

* What profile data is exposed
* When access is granted
* Context-based visibility rules
* Snapshot behavior

Employers **never own** or modify student profiles.
They consume **read-only, filtered representations** provided by the backend.

---

## 2. Employer Access Preconditions

An employer may access a student profile **only** when one of the following contexts exists:

* Student has applied to the employer’s internship
* Student has been shortlisted by the employer
* Student is an active intern under the employer

Outside these contexts, **no profile access is permitted**.

---

## 3. Employer Profile View (Conceptual)

Employers do **not** receive the full profile object.

They receive a **scoped profile view** generated server-side.

Example (conceptual):

```json
{
  "studentProfile": {
    "name": "Aarav Sharma",
    "education": {
      "institution": "ABC Institute of Technology",
      "fieldOfStudy": "Computer Science",
      "expectedEndYear": 2026
    },
    "skills": ["JavaScript", "React", "Node.js"],
    "preferences": {
      "internshipType": ["remote"]
    }
  }
}
```

This payload is **already filtered** — frontend must not hide fields manually.

---

## 4. Explicitly Hidden Information

Employers must **never** see:

* Date of birth
* Nationality
* Exact address or location
* Identity documents
* Resume file metadata beyond filename
* Profile completeness percentage
* Verification timestamps
* Admin notes or audit data

Violations are treated as **security incidents**.

---

## 5. Snapshot-Based Visibility (Critical)

Employers **never view live profiles**.

### 5.1 Application Snapshot

* When a student applies:

  * A profile snapshot is created
  * Employer views this immutable snapshot
* Subsequent student edits do **not** affect what the employer sees

---

### 5.2 Reapplication Scenario

* If a student reapplies after editing their profile:

  * A new snapshot is created
  * Old snapshots remain unchanged

---

## 6. Visibility by Internship Phase

| Phase             | Employer Can See             |
| ----------------- | ---------------------------- |
| Applicant         | Snapshot profile             |
| Shortlisted       | Same snapshot                |
| Interview         | Same snapshot                |
| Active Internship | Internship-relevant snapshot |
| Completed         | Final snapshot only          |

No phase grants access to live profile data.

---

## 7. Employer Restrictions

Employers cannot:

* Edit any profile field
* Upload or replace student documents
* See document verification status
* Force profile completion
* Access historical admin corrections

All such attempts return `403 FORBIDDEN`.

---

## 8. Error Example

### 8.1 Unauthorized Profile Access

```json
{
  "error": {
    "code": "EMPLOYER_PROFILE_ACCESS_DENIED",
    "message": "You are not authorized to view this student profile"
  }
}
```

---

## 9. Downstream Dependencies

Employer profile views are consumed by:

* Internship applications list
* Shortlisting screens
* Interview scheduling
* Internship dashboard (employer side)

All consume **the same snapshot contract**.

---

## 🔒 Lock Statement

Employer access to profiles is **strictly read-only, snapshot-based, and minimal**.
No domain may expand employer visibility.
