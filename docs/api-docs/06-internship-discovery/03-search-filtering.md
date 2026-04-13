Continuing. 👇
Still aligned, still clean.

---

# 📁 `06-internship-discovery / 03-search-filtering.md`

## 1. Purpose

This document defines how students **search, filter, and refine** internship listings during discovery.

Search and filtering:

* Improve usability
* Do **not** override eligibility rules
* Operate only on listings already visible to the student

This is a **refinement layer**, not an access layer.

---

## 2. Core Principles

* Filtering is applied **after** eligibility checks
* Search never reveals hidden internships
* All filters are **optional**
* Backend is the single source of truth

Frontend sends intent; backend decides results.

---

## 3. Supported Filters

### 3.1 Domain Filters

* Internship domains (e.g., web-development, data-science)
* Multiple selections allowed
* OR-based matching

---

### 3.2 Location & Mode

* `remote`
* `on-site`
* `hybrid`

On-site filtering respects:

* Internship-defined location
* Student eligibility only (not preference)

---

### 3.3 Duration

* Minimum weeks
* Maximum weeks

Used for narrowing results only.

---

### 3.4 Stipend (Optional)

* Minimum stipend amount
* Currency normalized server-side

Filtering does not guarantee stipend availability.

---

### 3.5 Application Deadline

* Before a specific date
* Excludes expired listings automatically

---

## 4. Search (Keyword-Based)

Search operates on:

* Internship title
* Company name
* Domain tags
* High-level description fields

Search is:

* Case-insensitive
* Tokenized
* Partial-match tolerant

No full-text guarantees are implied.

---

## 5. Filter Request Example

```json
{
  "filters": {
    "domains": ["web-development"],
    "locationType": "remote",
    "minDurationWeeks": 8
  },
  "search": "frontend"
}
```

Backend ignores unsupported filters silently.

---

## 6. Ordering & Interaction with AI

Ordering priority:

1. AI recommendation rank (if enabled)
2. Active filters
3. Default listing order

Filters **do not** re-rank AI output — they constrain it.

---

## 7. Pagination Rules

* Paginated responses are mandatory
* Default page size enforced server-side
* Cursor- or offset-based pagination allowed (per conventions)

No unbounded result sets.

---

## 8. Error Scenarios

### 8.1 Invalid Filter Value

```json
{
  "error": {
    "code": "INVALID_FILTER",
    "message": "Unsupported filter value provided"
  }
}
```

---

### 8.2 No Results

```json
{
  "data": [],
  "meta": {
    "message": "No internships match your filters"
  }
}
```

This is **not an error**.

---

## 9. Non-Negotiable Constraints

* Filters cannot bypass eligibility
* Employers cannot influence filtering behavior
* Admins cannot force listings into results
* Search results are not cached client-side

---

## 🔒 Lock Statement

Search and filtering are **convenience mechanisms only**.
They do not and must not affect access control.
