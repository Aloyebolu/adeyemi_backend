# Employer — Interviews

## 1. Screen Purpose

The **Interviews** screen allows employers to **schedule, conduct, and record outcomes of interviews** for shortlisted applicants.

Its purpose is to:

* Coordinate interviews in a structured, auditable way
* Give employers full control over interview decisions
* Capture interview outcomes consistently
* Act as the final evaluation stage before selection or rejection

This screen represents the **decision-critical phase** of the hiring flow.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Employer

### Preconditions

* Employer is authenticated
* Employer profile status is **approved**
* Internship exists and is owned by the employer
* Applicant status is **interview pending** or **interview scheduled**
* Internship is not archived

If no applicants have reached interview stage, this screen shows an empty state.

---

## 3. Required Data to Render

To render the Interviews screen, the system provides:

* Internship summary (read-only)
* List of applicants in interview stage
* For each applicant:

  * Student profile snapshot
  * Resume reference
  * Interview status
  * Interview history (if any)
* Interview scheduling configuration
* Interview outcome options

---

## 4. Screen Structure & Sections

The screen is typically structured as:

1. **Interview Overview**

   * Internship context
   * Number of interviews pending / completed

2. **Interview Candidate List**

   * Applicants awaiting scheduling
   * Applicants with scheduled interviews
   * Applicants already interviewed

3. **Interview Scheduling Panel**

   * Date and time selection
   * Interview mode (virtual / in-person / external)
   * Notes or instructions for the student

4. **Interview Outcome Panel**

   * Outcome selection
   * Evaluation notes
   * Next-step action

---

## 5. User Actions

The employer can:

* Schedule an interview for a shortlisted applicant
* Update or reschedule an interview
* Mark an interview as completed
* Record interview outcome
* Proceed to final selection or rejection

The employer **cannot bypass the interview stage** once entered.

---

## 6. System Responses (Conceptual)

### On Schedule Interview

* Interview details are recorded
* Applicant status updates to **interview scheduled**
* Student is notified with interview details

### On Reschedule

* Interview details are updated
* Student is notified of changes

### On Mark Interview Completed

* Interview status updates to **completed**
* Outcome entry becomes mandatory

### On Record Outcome

* Interview outcome is stored
* Applicant status updates accordingly

---

## 7. Success & Failure Flows

### Successful Interview Flow

* Interview is conducted
* Outcome is recorded
* Applicant progresses to final evaluation

### Rejection Flow

* Applicant fails interview
* Status updates to **rejected**
* Student is notified

### Failure Cases

* Scheduling conflict → clear error, retry allowed
* Notification failure → interview remains scheduled
* Temporary system issue → no interview data lost

---

## 8. State Transitions

| Previous State      | Action             | New State           |
| ------------------- | ------------------ | ------------------- |
| Interview Pending   | Schedule interview | Interview Scheduled |
| Interview Scheduled | Mark completed     | Interview Completed |
| Interview Completed | Pass               | Final Evaluation    |
| Interview Completed | Fail               | Rejected            |

Only applicants passing interviews proceed further.

---

## 9. Exit Conditions

The employer exits this screen when:

* Proceeding to final evaluation
* Returning to Applicant Review
* Logging out

Offers are not issued from this screen.

---