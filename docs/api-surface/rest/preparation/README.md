
```
api-surface/rest/preparation/
```

---

# `api-surface/rest/preparation/README.md`

## Purpose

Endpoints supporting **student preparation workflows**:

* Resume Drill
* Interview Drill
* Drill progress & feedback

**Mapped directly from:**

* `screen-interactions/student/02-preparation-dashboard.md`
* `screen-interactions/student/03-resume-drill.md`
* `screen-interactions/student/04-interview-drill.md`

---

## Rules

* Student-only access
* Preparation is **stateful** but state is evaluated server-side
* No scoring logic is exposed via API
* Progress is read-only except where explicitly allowed

---

## Endpoints Index

| Method | Path                              | Purpose                       |
| ------ | --------------------------------- | ----------------------------- |
| GET    | `/preparation/overview`           | Preparation dashboard summary |
| GET    | `/preparation/resume`             | Resume drill status           |
| POST   | `/preparation/resume/submit`      | Submit resume                 |
| GET    | `/preparation/interview`          | Interview drill status        |
| POST   | `/preparation/interview/session`  | Start interview session       |
| POST   | `/preparation/interview/feedback` | Submit interview attempt      |

---

# `api-surface/rest/preparation/overview.md`

## GET `/preparation/overview`

### Description

Returns preparation progress for dashboard rendering.

### Success Response — `200 OK`

```json
{
  "resumeDrill": {
    "status": "not_started | in_progress | completed",
    "progress": 60
  },
  "interviewDrill": {
    "status": "not_started | in_progress | completed",
    "progress": 40
  }
}
```

---

# `api-surface/rest/preparation/resume.md`

## GET `/preparation/resume`

### Description

Returns resume drill state and feedback.

### Success Response

```json
{
  "status": "in_progress",
  "lastSubmittedAt": "iso-date",
  "feedback": [
    {
      "reviewer": "hr_volunteer",
      "comment": "Improve bullet clarity",
      "createdAt": "iso-date"
    }
  ]
}
```

---

# `api-surface/rest/preparation/resume-submit.md`

## POST `/preparation/resume/submit`

### Description

Uploads a resume for review.

### Request (multipart/form-data)

* `file`: binary PDF/DOC
* `versionNote`: string (optional)

### Success Response — `201 Created`

```json
{
  "submissionId": "uuid",
  "status": "under_review"
}
```

---

# `api-surface/rest/preparation/interview.md`

## GET `/preparation/interview`

### Description

Returns interview drill status and history.

### Success Response

```json
{
  "status": "in_progress",
  "attempts": 2,
  "latestScore": 72
}
```

---

# `api-surface/rest/preparation/interview-session.md`

## POST `/preparation/interview/session`

### Description

Initializes a new interview drill session.

### Success Response — `201 Created`

```json
{
  "sessionId": "uuid",
  "startedAt": "iso-date"
}
```

---

# `api-surface/rest/preparation/interview-feedback.md`

## POST `/preparation/interview/feedback`

### Description

Submits an interview attempt for evaluation.

### Request Body

```json
{
  "sessionId": "uuid",
  "responses": [
    {
      "questionId": "uuid",
      "answer": "string"
    }
  ]
}
```

### Success Response

```json
{
  "evaluated": true,
  "score": 78
}
```

---

## ✅ PREPARATION MODULE STATUS

Complete. Locked.

---
