## 1. Purpose

The **Interview Drill** prepares students for real internship interviews by simulating common interview scenarios and evaluating **communication, clarity, and role readiness**.

This drill ensures a **baseline interview competency** before students are allowed to apply.

---

## 2. Core Rules (Canon-Aligned)

* Interview Drill is **mandatory**
* Completion is a **hard gate**
* AI feedback is **advisory only**
* No employer visibility
* No ranking or scoring exposed to students

---

## 3. Preconditions

A student may start the Interview Drill only if:

* Authenticated as `student`
* Profile completeness ≥ 80%
* Resume Drill state = `completed`

Failure blocks access.

---

## 4. Interview Drill Flow

### 4.1 Drill Initialization

* Student starts Interview Drill
* System creates an `interviewDrillSession`

Initial state:

```json
{
  "state": "in_progress",
  "startedAt": "2026-01-21T10:00:00Z"
}
```

---

### 4.2 Interview Structure

The drill consists of **multiple rounds**, such as:

1. Introduction & background
2. Role-specific questions
3. Scenario-based problem solving
4. Behavioral questions

Question sets are standardized and versioned.

---

### 4.3 Response Capture

Responses may be:

* Text
* Audio
* Video

Captured responses are:

* Stored securely
* Associated with the drill session
* Immutable once submitted

---

## 5. Feedback & Evaluation

Feedback sources:

* AI analysis (primary)
* Human reviewers (optional)

Feedback includes:

* Strengths
* Areas for improvement
* Suggested practice topics

Feedback does **not** determine completion directly.

---

## 6. Completion Criteria

Interview Drill is considered **completed** when:

* All required rounds are submitted
* Mandatory reflections (if any) are completed

No “pass/fail” score is shown.

---

## 7. Interview Drill States

| State         | Meaning                    |
| ------------- | -------------------------- |
| `not_started` | Drill not initiated        |
| `in_progress` | Drill ongoing              |
| `incomplete`  | Missing required responses |
| `completed`   | Drill completed            |

Only `completed` unlocks applications.

---

## 8. Retry & Improvement

* Students may retake the drill
* Each attempt is versioned
* Only the **latest completed attempt** is considered valid
* Past attempts remain archived

---

## 9. Visibility Rules

| Role        | Visibility              |
| ----------- | ----------------------- |
| Student     | Own feedback and status |
| Employer    | ❌ None                  |
| Admin       | Read-only               |
| AI Services | Read-only               |

---

## 10. Error Examples

### 10.1 Resume Drill Not Completed

```json
{
  "error": {
    "code": "RESUME_DRILL_REQUIRED",
    "message": "Complete Resume Drill before starting Interview Drill"
  }
}
```

---

### 10.2 Incomplete Submission

```json
{
  "error": {
    "code": "INTERVIEW_RESPONSES_MISSING",
    "message": "All interview rounds must be completed"
  }
}
```

---

## 11. Non-Negotiable Constraints

* Admins cannot mark interview drills as completed
* Employers have no access
* Drill completion is irreversible
* Drill data is audit-safe

---

## 🔒 Lock Statement

Interview Drill completion is a **hard, non-bypassable gate**.
No domain may override it.
