## 1. Purpose

The **Resume Drill** ensures that every student reaches a **minimum, standardized resume readiness level** before applying for internships.

This drill evaluates:

* Structural completeness
* Clarity and relevance
* Alignment with declared skills and education

It does **not** rank students or judge employability.

---

## 2. Core Rules (Canon-Aligned)

* Resume Drill is **mandatory**
* Completion is a **hard gate** for internship applications
* Scoring is **internal only**
* AI feedback is **advisory**
* Employers never see resume drill feedback

---

## 3. Preconditions

A student may start the Resume Drill only if:

* Authenticated as `student`
* Profile completeness ≥ 80%
* Resume document uploaded in `04-user-profiles`

Failure blocks access with a hard error.

---

## 4. Resume Drill Flow

### 4.1 Drill Initialization

* Student initiates Resume Drill
* System creates a `resumeDrillSession`

Initial state:

```json
{
  "state": "in_progress",
  "startedAt": "2026-01-20T09:00:00Z"
}
```

---

### 4.2 Resume Review Stages

The drill consists of **structured stages**:

1. Resume structure validation
2. Content alignment with profile
3. Skill-to-experience mapping
4. Formatting and clarity checks

Stages may be completed asynchronously.

---

### 4.3 Feedback Sources

Feedback may come from:

* AI analysis
* Human reviewers (if enabled)

All feedback is:

* Stored internally
* Versioned
* Immutable once submitted

---

## 5. Completion Criteria

Resume Drill is considered **completed** when:

* All required stages are marked `passed`
* Mandatory feedback acknowledgements are submitted

No numeric score is exposed to the student.

---

## 6. Resume Drill States

| State              | Meaning                    |
| ------------------ | -------------------------- |
| `not_started`      | Drill not initiated        |
| `in_progress`      | Review ongoing             |
| `changes_required` | Student must revise resume |
| `completed`        | Drill passed               |

Only `completed` unlocks progression.

---

## 7. Revision Cycle

* Students may upload revised resumes
* Each upload creates a **new revision**
* Feedback is tied to revision ID
* Previous revisions remain archived

Unlimited retries are allowed.

---

## 8. Visibility Rules

| Role        | Visibility              |
| ----------- | ----------------------- |
| Student     | Own feedback and status |
| Employer    | ❌ None                  |
| Admin       | Read-only               |
| AI Services | Read-only               |

Resume drill feedback is **never visible to employers**.

---

## 9. Failure Scenarios

### 9.1 Attempt Without Resume Upload

```json
{
  "error": {
    "code": "RESUME_REQUIRED",
    "message": "Upload a resume before starting the Resume Drill"
  }
}
```

---

### 9.2 Gate Violation

```json
{
  "error": {
    "code": "PROFILE_INCOMPLETE",
    "message": "Profile must be at least 80% complete"
  }
}
```

---

## 10. Non-Negotiable Constraints

* Admins cannot force completion
* Employers have zero influence
* Resume Drill completion cannot be revoked once passed
* Drill state is snapshotted for audits

---

## 🔒 Lock Statement

Resume Drill completion rules are **binding and irreversible**.
No system actor may bypass or auto-complete this drill.