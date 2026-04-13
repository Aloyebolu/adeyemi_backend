# Student — Certificate View

## 1. Screen Purpose

The **Certificate View** screen allows a student to **review, verify, and access official certification** issued after successful internship completion.

Its purpose is to:

* Provide formal recognition of internship completion
* Present a verified summary of performance
* Enable certificate download and sharing
* Mark the final milestone in the student journey

This screen represents the **end state** of the internship lifecycle for a student.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Student

### Preconditions

* Student is authenticated
* Internship status is **completed**
* Final evaluations are submitted
* Certification has been issued by an authorized body (Admin / Partner / Institution)

If certification has not yet been issued, this screen is inaccessible or shows a pending state.

---

## 3. Required Data to Render

To render the Certificate View screen, the system provides:

* Student identity details (read-only)
* Internship summary:

  * Organization
  * Role
  * Duration
* Completion date
* Final performance status
* Certificate metadata:

  * Certificate ID
  * Issuing authority
  * Issue date
  * Verification status
* Certificate file or secure preview
* Sharing and verification links (if supported)

All data is immutable at this stage.

---

## 4. Screen Structure & Sections

The Certificate View screen is typically structured as:

1. **Completion Summary**

   * Internship title and organization
   * Completion confirmation message

2. **Certificate Preview**

   * Visual preview or secure placeholder
   * Certificate identifier and issuer

3. **Performance Snapshot**

   * High-level KPI outcome
   * Final evaluation indicator (pass / completed)

4. **Actions Panel**

   * Download certificate
   * Copy verification reference
   * Share certificate (if enabled)

No editing or feedback actions are present.

---

## 5. User Actions

The student can:

* View certificate details
* Download the certificate
* Copy or share verification information
* Navigate back to internship history (if available)

The student **cannot** modify or regenerate the certificate.

---

## 6. System Responses (Conceptual)

### On Screen Load

* System validates certificate authenticity
* Certificate status is confirmed as issued

### On Download Action

* Certificate file is retrieved
* Download is initiated securely

### On Share / Verify Action

* Verification reference is generated or copied
* External verification (if supported) is enabled

All actions are read-only and non-destructive.

---

## 7. Success & Failure Flows

### Normal Flow

* Student views and downloads certificate successfully
* Verification details are accessible

### Pending State

* Certification not yet issued
* Screen displays “Certificate Pending” with clear explanation

### Failure Cases

* Certificate retrieval failure → retry option shown
* Temporary system issue → safe fallback with no data loss

Failures never affect certificate validity.

---

## 8. State Transitions

| Previous State       | Action               | New State |
| -------------------- | -------------------- | --------- |
| Internship Completed | Certificate issued   | Certified |
| Certified            | View certificate     | Certified |
| Certified            | Download certificate | Certified |

This screen does not trigger further lifecycle transitions.

---

## 9. Exit Conditions

The student exits this screen when:

* Navigating to internship history or dashboard (read-only)
* Logging out

This screen is always accessible after certification issuance.

---
