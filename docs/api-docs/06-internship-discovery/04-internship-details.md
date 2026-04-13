## 1. Purpose

This document defines the **internship detail view** exposed to students during discovery.

The detail view provides **full, contextual information** about a single internship, while still respecting:

* Eligibility rules
* Read-only constraints
* Snapshot boundaries

No application or mutation actions occur here.

---

## 2. Access Preconditions

A student may view internship details only if:

* Internship is visible in discovery listings
* Preparation gating is satisfied
* Student has no active internship

If the internship is not visible in listings, its details are **not accessible directly**.

---

## 3. Detail View Scope

The detail view expands upon the listing summary and includes:

* Internship description
* Responsibilities
* Required and preferred skills
* Duration and schedule
* Stipend details (if applicable)
* Application timeline
* Employer public profile information

---

## 4. Internship Detail Payload (Example)

```json
{
  "internshipId": "intern_7781",
  "title": "Frontend Developer Intern",
  "company": {
    "name": "Acme Technologies",
    "industry": "Technology"
  },
  "description": "Work with the frontend team to build modern web interfaces.",
  "responsibilities": [
    "Implement UI components",
    "Collaborate with backend engineers",
    "Participate in code reviews"
  ],
  "requiredSkills": ["JavaScript", "React"],
  "preferredSkills": ["TypeScript"],
  "durationWeeks": 12,
  "locationType": "remote",
  "stipend": {
    "amount": 8000,
    "currency": "INR"
  },
  "applicationWindow": {
    "opensAt": "2026-01-25",
    "closesAt": "2026-02-10"
  }
}
```

---

## 5. Hidden Information

Students do **not** see:

* Employer internal notes
* Number of applicants
* AI ranking scores
* Selection criteria weights
* Admin moderation comments

---

## 6. Snapshot & Consistency Rules

* Students always view the **current live version**
* When a student applies:

  * The internship is snapshotted
  * Evaluation uses the snapshot, not the live version
* Detail view does **not** indicate snapshot status

---

## 7. Call-to-Action Constraints

The detail view may show:

* “Apply” button (navigational only)

The detail view may **not**:

* Submit applications
* Validate eligibility
* Perform side effects

Actual application logic lives in `07-applications-selection`.

---

## 8. Error Scenarios

### 8.1 Direct Access Blocked

```json
{
  "error": {
    "code": "INTERNSHIP_NOT_ACCESSIBLE",
    "message": "This internship is not available for viewing"
  }
}
```

---

## 9. Non-Negotiable Constraints

* Internship details cannot bypass listing visibility
* Employers cannot customize detail visibility per student
* Admins cannot expose hidden fields to students
* No mutation endpoints exist in this file

---

## 🔒 Lock Statement

Internship details are **informational, gated, and read-only**.
No application or selection logic belongs here.

---

## ✅ Domain Completion Recap

`06-internship-discovery` now fully defines:

* Listing visibility
* AI-assisted discovery
* Search and filtering
* Detailed internship views

The domain is **complete and locked**.
