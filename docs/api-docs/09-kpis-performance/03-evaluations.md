## 1. Purpose

This document defines how **employer evaluations** are captured and incorporated into internship performance.

Evaluations represent **qualitative judgment** that complements quantitative KPI signals.

They are **mandatory** for internship completion.

---

## 2. Who Can Submit Evaluations

Only users with role:

* `employer`

Admins, students, and AI services **cannot** submit evaluations.

---

## 3. Evaluation Timing Rules

An employer may submit an evaluation only if:

* Internship instance state = `active` or `ready_for_review`
* Minimum internship duration has been met
* All mandatory tasks have been submitted

Backend enforces all timing constraints.

---

## 4. Evaluation Structure

### 4.1 Evaluation Object (Conceptual)

```json
{
  "evaluationId": "eval_7711",
  "internshipInstanceId": "inst_3001",
  "submittedBy": "employer_88",
  "submittedAt": "2026-05-12T14:30:00Z",
  "ratings": {
    "communication": 4,
    "reliability": 5,
    "initiative": 4,
    "technical_skill": 3
  },
  "summary": "Strong contributor, met expectations consistently."
}
```

---

## 5. Rating Rules

* Rating scale is internship-defined (e.g., 1–5)
* All required categories must be rated
* Free-text summary is optional but encouraged
* Ratings are normalized internally for KPI use

---

## 6. Immutability Rules

* Evaluations are **final once submitted**
* Employers cannot edit or retract evaluations
* Admins cannot modify evaluations
* Corrections require formal audit annotations, not edits

---

## 7. Visibility Rules

| Role        | Visibility                   |
| ----------- | ---------------------------- |
| Student     | Summary + high-level ratings |
| Employer    | Full evaluation              |
| Admin       | Full evaluation              |
| AI Services | Anonymized aggregates only   |

Students never see internal employer notes.

---

## 8. Completion Dependency

An internship **cannot be finalized** unless:

* Employer evaluation exists
* All mandatory KPIs are finalized
* Minimum duration is met

Missing evaluation blocks completion.

---

## 9. Error Scenarios

### 9.1 Evaluation Not Allowed

```json
{
  "error": {
    "code": "EVALUATION_NOT_ALLOWED",
    "message": "Evaluation cannot be submitted at this stage"
  }
}
```

---

### 9.2 Duplicate Evaluation

```json
{
  "error": {
    "code": "EVALUATION_ALREADY_SUBMITTED",
    "message": "An evaluation has already been submitted"
  }
}
```

---

## 10. Non-Negotiable Constraints

* No partial evaluations
* No draft evaluations
* No student responses
* No AI-generated evaluations

---

## 🔒 Lock Statement

Employer evaluations are **final, mandatory, and immutable**.
No domain may bypass or alter them.
