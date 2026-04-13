# Employer — Evaluations

## 1. Screen Purpose

The **Evaluations** screen allows employers to **make final hiring decisions and provide structured evaluations** for interviewed candidates.

Its purpose is to:

* Capture final employer judgment in a standardized way
* Decide whether to offer an internship
* Record evaluation data used for KPIs and certification
* Transition candidates into onboarding or closure states

This screen represents the **final employer-controlled decision point**.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Employer

### Preconditions

* Employer is authenticated
* Employer profile status is **approved**
* Internship exists and is owned by the employer
* Applicant status is **final evaluation**
* Interview has been completed and recorded

If an applicant has not completed interviews, they cannot appear here.

---

## 3. Required Data to Render

To render the Evaluations screen, the system provides:

* Internship summary
* Applicant profile snapshot
* Resume and interview references
* Interview outcome summary
* Evaluation criteria and scoring framework
* Offer configuration options

---

## 4. Screen Structure & Sections

The screen is typically structured as:

1. **Candidate Overview**

   * Applicant identity and role applied for
   * Interview summary

2. **Evaluation Form**

   * Skill assessment
   * Communication and professionalism
   * Overall recommendation

3. **Decision Panel**

   * Offer internship
   * Reject application

4. **Comments & Notes**

   * Optional evaluator comments
   * Internal-only notes

---

## 5. User Actions

The employer can:

* Complete evaluation criteria
* Submit final evaluation
* Choose to offer the internship
* Reject the applicant

Once submitted, the evaluation decision is **final**.

---

## 6. System Responses (Conceptual)

### On Evaluation Submission

* Evaluation data is stored
* Applicant status updates based on decision

### On Offer Decision

* Offer record is created
* Applicant status updates to **offer issued**
* Student is notified

### On Rejection Decision

* Applicant status updates to **rejected**
* Student is notified

---

## 7. Success & Failure Flows

### Offer Flow

* Employer submits positive evaluation
* Offer is issued
* Student proceeds to onboarding

### Rejection Flow

* Employer submits rejection
* Applicant exits hiring pipeline

### Failure Cases

* Missing evaluation fields → submission blocked
* System error → evaluation not saved, retry allowed

---

## 8. State Transitions

| Previous State   | Action           | New State             |
| ---------------- | ---------------- | --------------------- |
| Final Evaluation | Offer internship | Offer Issued          |
| Final Evaluation | Reject           | Rejected              |
| Offer Issued     | Student accepts  | Internship Onboarding |
| Offer Issued     | Student declines | Closed                |

Employer responsibility ends after offer issuance.

---

## 9. Exit Conditions

The employer exits this screen when:

* Evaluation is submitted
* Returning to Internship Management
* Logging out

No further employer action is required for rejected candidates.

---