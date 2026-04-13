# Student — Preparation Dashboard

## 1. Screen Purpose

The **Preparation Dashboard** is the student’s central hub for becoming **internship-ready**.

Its purpose is to:

* Provide visibility into preparation requirements
* Give access to preparation tools (Resume Drill and Interview Drill)
* Track readiness progress before internship applications
* Act as a controlled gateway between profile completion and internship discovery

This screen reinforces that preparation is **intentional and measurable**, not optional.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Student

### Preconditions

* Student is authenticated
* Student profile status is **completed**
* Student has not yet completed all preparation requirements (if mandatory)

If the profile is incomplete, the student cannot access this screen.

---

## 3. Required Data to Render

To render the Preparation Dashboard, the system provides:

* Student profile summary (read-only)
* Preparation requirements configuration
* Resume Drill status

  * Not started / In progress / Completed
* Interview Drill status

  * Not started / In progress / Completed
* Overall preparation progress indicator
* Eligibility flags for internship discovery (locked / unlocked)

---

## 4. Screen Structure & Sections

The dashboard is intentionally **simple and directive**, typically consisting of:

1. **Preparation Overview**

   * Explanation of why preparation is required
   * Overall readiness indicator

2. **Resume Drill Card**

   * Current status
   * Progress indicator
   * Action button to enter Resume Drill

3. **Interview Drill Card**

   * Current status
   * Progress indicator
   * Action button to enter Interview Drill

4. **Next Steps Guidance**

   * Clear messaging on what is required to unlock internship applications

No unrelated features are exposed on this screen.

---

## 5. User Actions

The student can:

* View preparation progress
* Enter the Resume Drill
* Enter the Interview Drill
* Return to profile (read-only or edit, if allowed by policy)

The student **cannot** apply for internships from this screen.

---

## 6. System Responses (Conceptual)

### On Screen Load

* System evaluates preparation completion status
* Eligibility for internship discovery is recalculated

### On Enter Resume Drill

* System transitions the student to the Resume Drill flow
* Current drill state is loaded

### On Enter Interview Drill

* System transitions the student to the Interview Drill flow
* Current drill state is loaded

Preparation progress updates are reflected immediately when returning to this dashboard.

---

## 7. Success & Failure Flows

### Normal Flow

* Student completes one or both drills
* Preparation progress increases accordingly
* Dashboard reflects updated statuses

### Completion Flow

* When all required preparation steps are completed:

  * Dashboard indicates readiness
  * Internship Discovery becomes accessible

### Failure Cases

* Drill temporarily unavailable → clear system message, retry allowed
* Data load failure → dashboard shows safe fallback with retry

Failures do not reset preparation progress.

---

## 8. State Transitions

| Previous State          | Action                       | New State               |
| ----------------------- | ---------------------------- | ----------------------- |
| Profile Completed       | View dashboard               | Preparation In Progress |
| Preparation In Progress | Complete one drill           | Preparation In Progress |
| Preparation In Progress | Complete all required drills | Preparation Completed   |

Only **Preparation Completed** unlocks internship discovery.

---

## 9. Exit Conditions

The student exits this screen when:

* Entering Resume Drill
* Entering Interview Drill
* Proceeding to Internship Discovery (only after completion)

There is no skip path around preparation.

---
