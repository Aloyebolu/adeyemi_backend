## 1. Purpose

This document defines how **internship listings are exposed to students** in the discovery phase.

It specifies:

* What an internship listing is
* Which listings are visible
* The structure of listing summaries
* Listing lifecycle states (read-only from student POV)

This file does **not** cover applications or employer management actions.

---

## 2. Internship Listing Concept

An **Internship Listing** represents an opportunity published by an employer and approved by the platform for student discovery.

Listings are:

* Versioned
* Moderated
* Read-only for students
* Snapshot-safe for applications

---

## 3. Listing Lifecycle States

| State            | Meaning                 | Visible to Students |
| ---------------- | ----------------------- | ------------------- |
| `draft`          | Employer drafting       | ❌                   |
| `pending_review` | Awaiting admin approval | ❌                   |
| `open`           | Accepting applications  | ✅                   |
| `paused`         | Temporarily unavailable | ❌                   |
| `closed`         | No longer accepting     | ❌                   |
| `archived`       | Historical              | ❌                   |

Only `open` listings are discoverable.

---

## 4. Student Visibility Preconditions

A listing is visible to a student only if **all** conditions are met:

* Listing state = `open`
* Application window is active
* Student has passed preparation gating
* Student has no active internship
* Student meets minimum eligibility rules (if defined)

Filtering is enforced server-side.

---

## 5. Listing Summary (Discovery View)

Students see a **condensed summary**, not the full listing object.

Example:

```json
{
  "internshipId": "intern_7781",
  "title": "Frontend Developer Intern",
  "companyName": "Acme Technologies",
  "locationType": "remote",
  "durationWeeks": 12,
  "stipend": {
    "amount": 8000,
    "currency": "INR"
  },
  "domains": ["web-development"],
  "applicationDeadline": "2026-02-10"
}
```

---

## 6. Hidden Listing Data

Students do **not** see:

* Internal employer notes
* Admin review comments
* Applicant counts
* AI ranking scores
* Eligibility rejection reasons
* Other applicants’ data

---

## 7. Listing Snapshot Rules

* Listings are snapshotted **at application time**
* Students always see the **current live listing**
* Employers evaluate against the **snapshot version**
* Listing edits after application do not affect existing applicants

---

## 8. Sorting & Default Ordering

Default ordering:

1. AI-recommended (if enabled)
2. Application deadline (ascending)
3. Recently posted

Actual sort logic is server-controlled.

---

## 9. Error Scenarios

### 9.1 Discovery Access Blocked

```json
{
  "error": {
    "code": "DISCOVERY_BLOCKED",
    "message": "Complete preparation to view internships"
  }
}
```

---

### 9.2 No Available Listings

```json
{
  "data": [],
  "meta": {
    "message": "No internships available at this time"
  }
}
```

This is **not an error**.

---

## 10. Non-Negotiable Constraints

* Students cannot favorite or bookmark listings (unless defined elsewhere)
* No application actions are allowed here
* Employers cannot target specific students
* Admins cannot force visibility of closed listings

---

## 🔒 Lock Statement

Internship listings are **filtered, read-only discovery objects**.
No downstream logic may assume broader access.
