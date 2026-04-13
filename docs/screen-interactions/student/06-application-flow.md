# Student — Application Flow

## 1. Screen Purpose

The **Application Flow** screen enables a student to **formally apply** to a selected internship in a controlled, auditable manner.

Its purpose is to:

* Capture student intent to apply
* Validate eligibility at the moment of application
* Lock the application snapshot used by employers
* Transition responsibility from student discovery to employer review

This flow represents a **commitment point** in the student journey.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Student

### Preconditions

* Student is authenticated
* Student profile status is **completed**
* Preparation status meets application eligibility requirements
* Internship is currently open for applications
* Student has not already applied to the same internship

If any precondition fails, the flow cannot be initiated.

---

## 3. Required Data to Render

To render the Application Flow, the system provides:

* Selected internship summary
* Student profile snapshot (read-only)
* Resume version to be submitted
* Interview drill summary (if applicable)
* Application requirements (custom questions, notes)
* Application deadline information

All displayed data reflects what will be visible to the employer.

---

## 4. Screen Structure & Steps

The Application Flow is presented as a **linear, confirmation-driven sequence**, typically including:

1. **Internship Summary**

   * Role details
   * Expectations
   * Duration and requirements

2. **Applicant Snapshot**

   * Profile highlights
   * Resume reference
   * Preparation indicators

3. **Additional Questions (if any)**

   * Short answers or confirmations
   * Motivation or availability questions

4. **Final Review**

   * Complete application preview
   * Clear confirmation warning

5. **Submit Application**

   * Explicit, irreversible action

There is no background or auto-submission.

---

## 5. User Actions

The student can:

* Review internship details
* Review submitted profile and resume
* Answer required application questions
* Cancel and return to Internship Discovery
* Submit the application

Once submitted, the application **cannot be edited or withdrawn** unless platform policy allows.

---

## 6. System Responses (Conceptual)

### On Flow Entry

* System locks a snapshot of student profile and resume
* Eligibility is revalidated

### On Answering Questions

* Inputs are validated for completeness
* Progress is saved until submission

### On Submission

* Application record is created
* Application status is set to **submitted**
* Internship slot availability is updated (if applicable)
* Student is notified of successful submission

---

## 7. Success & Failure Flows

### Successful Submission

* Student sees confirmation state
* Application becomes visible to employer
* Student can track application status

### Validation Failure

* Missing or invalid answers → inline correction
* Eligibility change → clear explanation, submission blocked

### System Failure

* Submission error → no application created
* Student can retry without data loss

Partial submissions are never recorded.

---

## 8. State Transitions

| Previous State            | Action            | New State                 |
| ------------------------- | ----------------- | ------------------------- |
| Eligible for Applications | Start application | Application In Progress   |
| Application In Progress   | Cancel            | Eligible for Applications |
| Application In Progress   | Submit            | Application Submitted     |

Once submitted, ownership of the process shifts to the employer.

---

## 9. Exit Conditions

The student exits this screen when:

* Application is successfully submitted
* Application flow is cancelled
* Student is redirected to application status tracking

There is no automatic internship assignment from this screen.
