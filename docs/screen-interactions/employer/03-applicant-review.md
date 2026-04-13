# Employer — Applicant Review

## 1. Screen Purpose

The **Applicant Review** screen enables employers to **evaluate, shortlist, and progress student applications** for a specific internship.

Its purpose is to:

* Present all applications in a structured, comparable way
* Surface AI-assisted insights without removing employer control
* Support fair, informed shortlisting decisions
* Act as the decision gateway to interviews and final selection

This screen is where employer judgment is formally applied.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Employer

### Preconditions

* Employer is authenticated
* Employer profile status is **approved**
* Internship exists and is owned by the employer
* Internship status is **open** or **closed** (but not archived)
* At least one student application exists

If no applications exist, the screen shows an empty state.

---

## 3. Required Data to Render

To render the Applicant Review screen, the system provides:

* Internship summary (read-only)
* List of submitted applications
* For each applicant:

  * Student profile snapshot
  * Resume reference
  * Preparation status summary
  * Interview drill indicators (if available)
  * Application submission timestamp
* AI-generated ranking or fit indicators (if enabled)
* Current application status per applicant

All data reflects the snapshot taken at application time.

---

## 4. Screen Structure & Sections

The screen is typically structured as:

1. **Internship Context Header**

   * Internship title and status
   * Application count

2. **Applicant List**

   * Sortable and filterable list
   * Clear status labels (submitted, shortlisted, rejected)

3. **Applicant Detail View**

   * Expanded view of selected applicant
   * Resume access
   * Profile and preparation highlights

4. **Decision Controls**

   * Shortlist
   * Reject
   * Proceed to interview

AI insights are shown as **assistive indicators**, never as enforced decisions.

---

## 5. User Actions

The employer can:

* View and compare applications
* Open individual applicant details
* Shortlist applicants
* Reject applicants
* Move shortlisted applicants to interview stage

The employer **cannot edit student-submitted data**.

---

## 6. System Responses (Conceptual)

### On Screen Load

* Applications are loaded and ordered
* AI fit indicators are calculated and displayed

### On Shortlist Action

* Application status updates to **shortlisted**
* Student is notified of status change

### On Reject Action

* Application status updates to **rejected**
* Student is notified (with platform-defined messaging)

### On Proceed to Interview

* Application status updates to **interview pending**
* Interview flow becomes available

---

## 7. Success & Failure Flows

### Normal Flow

* Employer reviews applications
* Applicants are shortlisted or rejected
* Interview pipeline is formed

### Restricted Flow

* Attempt to act on closed or archived internship → action blocked
* Attempt to re-evaluate finalized decision → blocked with explanation

### Failure Cases

* Status update failure → retry allowed
* Temporary system issue → no application state lost

---

## 8. State Transitions

| Previous State    | Action               | New State           |
| ----------------- | -------------------- | ------------------- |
| Submitted         | Shortlist            | Shortlisted         |
| Submitted         | Reject               | Rejected            |
| Shortlisted       | Proceed to interview | Interview Pending   |
| Interview Pending | Interview scheduled  | Interview Scheduled |

Rejected applications do not re-enter the pipeline unless policy allows.

---

## 9. Exit Conditions

The employer exits this screen when:

* Navigating to Interviews for a shortlisted applicant
* Returning to Internship Management
* Logging out

This screen does not issue offers directly.

---
