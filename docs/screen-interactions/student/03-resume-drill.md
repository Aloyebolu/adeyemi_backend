# Student — Resume Drill

## 1. Screen Purpose

The **Resume Drill** screen exists to help students produce a **job-ready, validated resume** that meets platform standards and improves internship matching quality.

This screen ensures that:

* Students receive structured guidance on resume quality
* Resume readiness is measurable and trackable
* Resume data can be reliably used by AI matching and employers
* Resume completion is enforced before internship applications (if required)

---

## 2. Actor & Preconditions

### Actor

* **Role:** Student

### Preconditions

* Student is authenticated
* Student profile status is **completed**
* Student has access to the Preparation Dashboard
* Resume Drill status is **not completed**

If preparation is locked or profile is incomplete, this screen is inaccessible.

---

## 3. Required Data to Render

To render the Resume Drill screen, the system provides:

* Current resume drill status
* Existing resume document (if previously uploaded)
* Resume evaluation criteria
* Feedback history (if any)
* Progress indicators
* Allowed resume formats and constraints

---

## 4. Screen Structure & Sections

The Resume Drill is presented as a **guided improvement workflow**, typically including:

1. **Resume Status Overview**

   * Current completion state
   * Readiness score or indicator

2. **Resume Upload / Replace Section**

   * Upload new resume
   * Replace existing resume

3. **Feedback & Review Section**

   * Structured feedback items
   * Suggestions for improvement
   * Highlighted deficiencies (if any)

4. **Progress Tracker**

   * Steps completed
   * Steps remaining

5. **Action Controls**

   * Save progress
   * Submit for review
   * Re-upload resume

---

## 5. User Actions

The student can:

* Upload a resume document
* Replace an existing resume
* View feedback and suggestions
* Save progress without submission
* Submit resume for evaluation
* Re-submit after feedback

The student **cannot mark the drill as complete manually**.

---

## 6. System Responses (Conceptual)

### On Resume Upload

* System validates file type and size
* Resume is stored and associated with the student
* Resume status updates to **uploaded**

### On Submission for Review

* System evaluates resume against defined criteria
* Feedback is generated (AI-assisted or human-assisted)
* Resume status updates to **under review**

### On Feedback Generation

* Feedback items are attached to the resume
* Student is notified that feedback is available
* Resume status updates to **revision required** or **accepted**

---

## 7. Success & Failure Flows

### Successful Completion

* Resume meets required quality threshold
* Resume Drill status updates to **completed**
* Preparation progress is updated
* Resume becomes visible to employers (when applicable)

### Revision Flow

* Resume does not meet requirements
* Student receives actionable feedback
* Student may revise and re-submit without penalty

### Failure Cases

* Invalid file upload → clear error with retry
* Evaluation failure → resume remains editable
* Temporary system error → no progress is lost

---

## 8. State Transitions

| Previous State    | Action            | New State         |
| ----------------- | ----------------- | ----------------- |
| Not Started       | Upload resume     | Uploaded          |
| Uploaded          | Submit for review | Under Review      |
| Under Review      | Feedback required | Revision Required |
| Revision Required | Re-submit resume  | Under Review      |
| Under Review      | Accepted          | Completed         |

Only **Completed** satisfies preparation requirements.

---

## 9. Exit Conditions

The student exits this screen when:

* Returning to the Preparation Dashboard
* Resume Drill status becomes **completed**

Completion automatically updates preparation progress.
