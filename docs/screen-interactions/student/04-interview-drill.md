# Student — Interview Drill

## 1. Screen Purpose

The **Interview Drill** screen prepares students to perform confidently in real internship interviews by simulating interview scenarios and providing structured, actionable feedback.

Its goals are to:

* Improve communication and interview readiness
* Expose students to realistic interview questions
* Measure interview performance in a consistent way
* Generate data used for readiness assessment and AI matching

Completion of this drill contributes directly to internship eligibility.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Student

### Preconditions

* Student is authenticated
* Student profile status is **completed**
* Student has access to the Preparation Dashboard
* Interview Drill status is **not completed**

If preparation access is restricted, this screen is not accessible.

---

## 3. Required Data to Render

To render the Interview Drill screen, the system provides:

* Current interview drill status
* Interview categories and question sets
* Attempt history (if any)
* Feedback and scoring criteria
* Progress indicators
* Instructions and expectations

---

## 4. Screen Structure & Sections

The Interview Drill is presented as a **guided practice environment**, typically including:

1. **Interview Overview**

   * Explanation of drill purpose
   * Completion requirements

2. **Question Session Area**

   * Interview questions (one at a time or grouped)
   * Timed or untimed response mode

3. **Response Capture**

   * Text, audio, or video response interface (as configured)
   * Clear instructions for submission

4. **Feedback & Evaluation**

   * AI-generated or reviewer feedback
   * Strengths and improvement areas

5. **Progress Tracker**

   * Attempts completed
   * Attempts remaining

---

## 5. User Actions

The student can:

* Start an interview drill session
* Respond to interview questions
* Submit responses for evaluation
* Review feedback from completed attempts
* Retry or continue the drill as allowed

The student **cannot skip required questions**.

---

## 6. System Responses (Conceptual)

### On Session Start

* System loads interview questions
* Drill attempt is initialized

### On Response Submission

* Responses are recorded and validated
* Attempt status updates to **submitted**

### On Evaluation

* Responses are evaluated against defined criteria
* Feedback and scores are generated
* Attempt status updates to **reviewed**

---

## 7. Success & Failure Flows

### Successful Completion

* Student meets interview readiness threshold
* Interview Drill status updates to **completed**
* Preparation progress is updated
* Student becomes closer to internship eligibility

### Improvement Flow

* Performance does not meet threshold
* Student receives feedback
* Additional attempts are allowed (within policy)

### Failure Cases

* Submission interruption → attempt can be resumed or retried
* Evaluation delay → status shown as pending
* System error → no completed attempts are lost

---

## 8. State Transitions

| Previous State | Action                 | New State   |
| -------------- | ---------------------- | ----------- |
| Not Started    | Start drill            | In Progress |
| In Progress    | Submit responses       | Submitted   |
| Submitted      | Evaluated              | Reviewed    |
| Reviewed       | Meets criteria         | Completed   |
| Reviewed       | Does not meet criteria | In Progress |

Only **Completed** satisfies interview preparation requirements.

---

## 9. Exit Conditions

The student exits this screen when:

* Returning to the Preparation Dashboard
* Interview Drill status becomes **completed**

Completion immediately updates preparation readiness.
