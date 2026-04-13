# Student — Profile Setup

## 1. Screen Purpose

The **Profile Setup** screen exists to transform a newly registered student into a **fully eligible platform participant**.

This screen ensures the system collects all required identity, academic, and skill-related information needed to:

* Enable preparation tools (Resume Drill, Interview Drill)
* Allow internship discovery and applications
* Support AI-driven matching and evaluation
* Enforce platform eligibility rules

Until this screen is successfully completed, the student **cannot progress** to any other functional area of the platform.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Student

### Preconditions

* Student account has been created
* Student has successfully authenticated
* Student profile status is **incomplete**
* Student is not yet eligible for preparation or internship flows

---

## 3. Required Data to Render

To display this screen, the system provides:

* Basic account identifiers (name, email)
* Profile completion requirements checklist
* Supported document types and constraints
* Skill category taxonomy
* Education level options
* Geographic and availability options (if applicable)

Some fields may be pre-filled from registration but remain editable until submission.

---

## 4. Screen Structure & Sections

The Profile Setup screen is presented as a **guided, step-by-step flow**, not a single free-form form.

Typical sections include:

1. **Personal Information**

   * Full name
   * Date of birth (if required by policy)
   * Location

2. **Education Details**

   * Institution
   * Field of study
   * Current level or graduation status

3. **Skills & Interests**

   * Selectable skill tags
   * Areas of interest
   * Preferred internship domains

4. **Document Upload**

   * Resume / CV
   * Identity or verification documents (if required)

5. **Availability & Preferences**

   * Internship type preferences
   * Time availability

Progress indicators clearly show completion status.

---

## 5. User Actions

The student can perform the following actions:

* Enter or update profile information
* Upload required documents
* Save progress without submitting
* Navigate between steps
* Submit the completed profile for validation

The student **cannot skip mandatory sections**.

---

## 6. System Responses (Conceptual)

### On Field Interaction

* Inputs are validated for format and completeness
* Missing or invalid data is flagged immediately

### On Document Upload

* Documents are checked for type and size
* Upload success or failure is shown instantly

### On Save Progress

* Current profile state is persisted
* Profile remains marked as incomplete

### On Final Submission

* System verifies all required sections are complete
* Profile is submitted for acceptance
* Profile status transitions from **incomplete** to **completed**

---

## 7. Success & Failure Flows

### Successful Completion

* Student receives confirmation that profile setup is complete
* Preparation Dashboard becomes accessible
* Internship discovery is unlocked
* Profile becomes eligible for AI evaluation

### Failure Cases

* Missing required fields → user is guided to unresolved sections
* Invalid document upload → clear error with retry option
* System error during submission → profile remains editable, no progress lost

Failures never partially complete the profile.

---

## 8. State Transitions

| Previous State     | Action               | New State          |
| ------------------ | -------------------- | ------------------ |
| Registered         | Start profile setup  | Incomplete Profile |
| Incomplete Profile | Save progress        | Incomplete Profile |
| Incomplete Profile | Submit valid profile | Completed Profile  |

Only **Completed Profile** state allows progression to preparation and internship flows.

---

## 9. Exit Conditions

The student exits this screen when:

* Profile status is **completed**
* System redirects the student to the **Preparation Dashboard**

There is no alternative exit path.

---
