# Admin — Certification Management

## 1. Screen Purpose

The **Certification Management** screen allows administrators to **review internship outcomes and issue official certificates** to students.

Its purpose is to:

* Ensure certification is issued only after valid completion
* Enforce certification authority and policy
* Act as the final quality gate before recognition
* Maintain trust in platform-issued certificates

This screen represents the **last authoritative checkpoint** in the internship lifecycle.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Admin

### Preconditions

* Admin is authenticated
* Admin has certification authority
* Internship status is **completed**
* Employer final evaluation is submitted
* Required KPI data is available

If any prerequisite is missing, certification cannot proceed.

---

## 3. Required Data to Render

To render the Certification Management screen, the system provides:

* List of completed internships pending certification
* For each entry:

  * Student identity
  * Internship summary
  * Employer evaluation outcome
  * KPI performance summary
* Certification eligibility indicators
* Issuing authority configuration

---

## 4. Screen Structure & Sections

The screen is structured for **verification and approval**, typically including:

1. **Pending Certifications List**

   * Students awaiting certificates
   * Status indicators (ready / blocked)

2. **Certification Review Panel**

   * Detailed internship summary
   * Performance and KPI outcomes
   * Employer feedback

3. **Certification Decision**

   * Issue certificate
   * Withhold or delay certification

4. **Issuance Confirmation**

   * Issuing authority selection
   * Final confirmation step

---

## 5. User Actions

The admin can:

* Review internship completion details
* Verify KPI and evaluation data
* Issue a certificate
* Delay or deny certification (with reason)

Certification decisions are **final** unless overridden.

---

## 6. System Responses (Conceptual)

### On Certification Review

* System validates eligibility criteria
* Blocking issues are highlighted

### On Issue Certificate

* Certificate record is created
* Certificate metadata is generated
* Student status updates to **certified**
* Student is notified

### On Delay / Deny

* Certification status updates accordingly
* Reason is recorded and visible internally

---

## 7. Success & Failure Flows

### Successful Issuance

* Certificate is issued
* Certificate becomes available to student
* Internship lifecycle is fully closed

### Blocked Flow

* Missing data or failed criteria
* Certification remains pending with explanation

### Failure Cases

* Issuance failure → retry without duplication
* System error → no partial certificates created

---

## 8. State Transitions

| Previous State        | Action            | New State             |
| --------------------- | ----------------- | --------------------- |
| Internship Completed  | Issue certificate | Certified             |
| Internship Completed  | Delay / deny      | Certification Pending |
| Certification Pending | Issue certificate | Certified             |

Once certified, no further changes occur.

---

## 9. Exit Conditions

The admin exits this screen when:

* Certification decision is completed
* Returning to Admin Dashboard
* Logging out

This screen closes the internship loop.
