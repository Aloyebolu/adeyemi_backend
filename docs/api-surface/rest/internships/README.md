# `api-surface/rest/internships/README.md`

## Purpose

Internship discovery, listing, and recommendation endpoints.

These endpoints power **student browsing**, **AI recommendations**, and **internship visibility rules**.

**Mapped directly from:**

* `screen-interactions/student/05-internship-discovery.md`
* `screen-interactions/employer/02-internship-management.md`

---

## Rules

* Students can only view **eligible** internships
* Employers can only manage internships they own
* AI recommendation logic is opaque
* No application actions occur here (see `applications/`)

---

## Endpoints Index

| Method | Path                        | Purpose                      |
| ------ | --------------------------- | ---------------------------- |
| GET    | `/internships`              | List available internships   |
| GET    | `/internships/recommended`  | AI-recommended internships   |
| GET    | `/internships/{id}`         | Internship details           |
| POST   | `/internships`              | Create internship (employer) |
| PATCH  | `/internships/{id}`         | Update internship            |
| POST   | `/internships/{id}/publish` | Publish internship           |

---

# `api-surface/rest/internships/list.md`

## GET `/internships`

### Description

Returns paginated internships visible to the student.

### Query Params

* `page` (default: 1)
* `limit` (default: 10)
* `location` (optional)
* `keyword` (optional)

### Success Response

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Frontend Intern",
      "company": "Acme Corp",
      "location": "Remote",
      "duration": "3 months"
    }
  ],
  "pagination": {
    "page": 1,
    "totalPages": 5
  }
}
```

---

# `api-surface/rest/internships/recommended.md`

## GET `/internships/recommended`

### Description

Returns AI-ranked internships for the student.

### Success Response

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "AI Research Intern",
      "matchScore": 92
    }
  ]
}
```

---

# `api-surface/rest/internships/detail.md`

## GET `/internships/{id}`

### Description

Returns full internship details.

### Success Response

```json
{
  "id": "uuid",
  "title": "Backend Intern",
  "description": "string",
  "requirements": ["Node.js", "SQL"],
  "kpis": ["task_completion", "attendance"]
}
```

---

# `api-surface/rest/internships/create.md`

## POST `/internships`

### Description

Creates a draft internship (employer-only).

### Request Body

```json
{
  "title": "string",
  "description": "string",
  "duration": "string"
}
```

### Success Response — `201 Created`

```json
{
  "id": "uuid",
  "status": "draft"
}
```

---

# `api-surface/rest/internships/publish.md`

## POST `/internships/{id}/publish`

### Description

Publishes a draft internship.

### Success Response

```json
{
  "published": true
}
```

---

## ✅ INTERNSHIPS MODULE STATUS

Complete. Locked.

---