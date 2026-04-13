## 1. Purpose

This document defines the **student-owned profile**, including:

* Data the student is responsible for providing
* Fields the student may edit
* Completion and regression rules
* How student profile data is consumed by other domains

This file describes the profile **from the student’s point of view**, not the system’s internal mechanics.

---

## 2. Ownership & Responsibility

* Each student has **exactly one profile**
* The student is the **primary contributor** of profile data
* The backend is the **final authority** on validity and state
* The student **cannot self-verify** any information

The student profile is **never optional** and is created automatically after signup.

---

## 3. Student Profile Sections

### 3.1 Personal Information

**Student-provided fields**

* Legal name (mandatory)
* Preferred name (optional)
* Date of birth (mandatory)
* Primary location (mandatory)

**Rules**

* Legal name and DOB must match identity documents
* Changes after document verification may be restricted
* DOB is never exposed to employers

---

### 3.2 Education Details

**Student-provided fields**

* Current education status
* Institution name
* Field of study
* Start year
* Expected end year

**Rules**

* Entire section is mandatory
* Timeline validation is enforced server-side
* Inaccurate or misleading entries may trigger admin review

---

### 3.3 Skills Declaration

**Student-provided fields**

* Primary skills (mandatory, minimum enforced)
* Secondary skills (optional)

**Rules**

* Skills must be selected from a controlled taxonomy
* Self-assessed proficiency is informational only
* Skill edits may affect internship eligibility in real time

---

### 3.4 Preferences (Optional)

**Student-provided fields**

* Internship type preference
* Domain interests
* Availability
* Location flexibility

**Rules**

* Optional but improves AI recommendations
* Never required to pass gates
* Employers see only abstracted preferences

---

## 4. Document Uploads (Student Role)

Students are responsible for uploading:

| Document       | Mandatory |
| -------------- | --------- |
| Resume         | ✅         |
| Identity Proof | ✅         |

**Rules**

* Upload ≠ verification
* Students cannot edit or delete verified documents
* Re-upload is allowed only if document is unverified or rejected

Verification is handled separately in `04-document-verification.md`.

---

## 5. Profile Completion Rules (Student Perspective)

* Profile completion is **progressive**
* Partial saves are allowed
* Completion percentage is calculated by backend
* Some actions are blocked until minimum thresholds are met

Students **cannot** manually mark their profile as complete.

---

## 6. Completion Gates Affecting Students

| Action                   | Required Profile State  |
| ------------------------ | ----------------------- |
| Access Preparation Tools | ≥ 80% complete          |
| Apply to Internship      | `verified_partial`      |
| Start Internship         | `verified_full`         |
| Receive Certificate      | Profile snapshot locked |

Backend enforces all gates.

---

## 7. Edit Restrictions & Regression

### 7.1 Regression Scenarios

If a student edits:

* Legal name
* Education details
* Primary skills

The profile **may regress** to:

* `incomplete`
* Or require re-verification

Students are informed via API response metadata.

---

### 7.2 Locked Profile

When a profile is locked:

* Student access becomes read-only
* No further edits allowed
* Lock reason is visible (sanitized)

---

## 8. What Students Can Never Do

Students cannot:

* Verify documents
* Override profile state
* View audit logs
* Edit historical snapshots
* Bypass preparation or application gates

Attempts are rejected by backend.

---

## 9. Error Examples

### 9.1 Invalid Edit

```json
{
  "error": {
    "code": "PROFILE_EDIT_NOT_ALLOWED",
    "message": "Profile field cannot be edited after verification"
  }
}
```

---

### 9.2 Gate Violation

```json
{
  "error": {
    "code": "PROFILE_INCOMPLETE",
    "message": "Complete your profile to continue"
  }
}
```

---

## 🔒 Lock Statement

All rules in this file define the **maximum authority** a student has over their profile.
No downstream domain may grant additional powers.
