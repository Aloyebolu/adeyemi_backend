## 1. Purpose

This document defines how **AI-assisted internship recommendations** are generated and presented during the discovery phase.

AI recommendations exist to **assist decision-making**, not to enforce eligibility or automate actions.

---

## 2. Canonical Rule (Restated)

> **AI recommendations are advisory only.**

They:

* Do not block access
* Do not unlock access
* Do not apply on behalf of students
* Do not override backend eligibility rules

---

## 3. Inputs to AI Recommendation Engine

The AI system may consume the following **read-only inputs**:

### 3.1 Student Signals

* Profile data (skills, education, preferences)
* Preparation completion status
* Historical internship performance (if any)

### 3.2 Internship Signals

* Required skills
* Domain alignment
* Duration and format
* Employer-defined preferences

### 3.3 System Constraints

* Student eligibility filters
* Active internship constraint
* Listing visibility rules

AI never receives:

* Identity documents
* Dates of birth
* Admin notes
* Audit logs

---

## 4. Recommendation Output

AI produces a **ranked list** of internships already eligible for the student.

Example:

```json
{
  "recommendations": [
    {
      "internshipId": "intern_7781",
      "rank": 1,
      "matchSummary": "Strong match for React skills and remote preference"
    },
    {
      "internshipId": "intern_8892",
      "rank": 2,
      "matchSummary": "Good alignment with frontend experience"
    }
  ]
}
```

Only internships already visible via listing rules may appear.

---

## 5. Match Explanation Rules

* Explanations must be **high-level**
* No raw scores exposed
* No comparison against other students
* No deterministic language (e.g., “you will be selected”)

---

## 6. Override & Suppression

* Students may ignore AI recommendations
* System may silently suppress AI output
* Admins may disable AI recommendations globally

No audit log is required for AI suppression.

---

## 7. Failure Handling

### 7.1 AI Unavailable

If AI services are unavailable:

* Discovery still works
* Listings fall back to default sorting
* No error is shown to the student

---

## 8. Visibility Rules

| Role        | Visibility                     |
| ----------- | ------------------------------ |
| Student     | Recommendations + explanations |
| Employer    | ❌ None                         |
| Admin       | System-level metrics only      |
| AI Services | Internal                       |

---

## 9. Non-Negotiable Constraints

* AI cannot recommend ineligible listings
* AI cannot recommend during an active internship
* AI output cannot be cached client-side
* AI recommendations cannot be exported

---

## 🔒 Lock Statement

AI recommendations are **assistive, optional, and non-authoritative**.
No downstream domain may treat them as decisions.
