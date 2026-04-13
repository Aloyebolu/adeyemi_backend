# Employer — Internship Management

## 1. Screen Purpose

The **Internship Management** screen allows approved employers to **create, manage, and control internships** offered on the platform.

Its purpose is to:

* Enable structured internship creation
* Define requirements and expectations clearly
* Control internship availability and lifecycle
* Serve as the foundation for student discovery and applications

This screen is the employer’s primary tool for offering opportunities.

---

## 2. Actor & Preconditions

### Actor

* **Role:** Employer

### Preconditions

* Employer is authenticated
* Employer profile status is **approved**
* Employer account is not restricted or suspended

If the employer is not approved, this screen is inaccessible.

---

## 3. Required Data to Render

To render the Internship Management screen, the system provides:

* Employer organization profile summary
* Existing internship listings (if any)
* Internship creation rules and constraints
* Internship status indicators (draft, open, closed)
* Internship limits or quotas (if applicable)

---

## 4. Screen Structure & Sections

The screen is typically organized into:

1. **Internship Listings Overview**

   * List of created internships
   * Current status for each internship

2. **Create New Internship**

   * Action to initiate internship creation

3. **Internship Detail Editor**

   * Role title and description
   * Duration and schedule
   * Required skills and eligibility criteria
   * Number of positions
   * Application deadline

4. **Lifecycle Controls**

   * Publish / unpublish internship
   * Close applications
   * Archive internship

---

## 5. User Actions

The employer can:

* Create a new internship listing
* Edit an existing internship (before or during applications, as allowed)
* Publish an internship to make it visible to students
* Close or pause applications
* View summary application counts per internship

The employer **cannot** directly select students from this screen.

---

## 6. System Responses (Conceptual)

### On Internship Creation

* System validates required fields
* Internship is saved as **draft**

### On Publish Action

* Internship becomes visible in student discovery
* Application window opens

### On Edit Action

* Changes are validated
* Visibility and eligibility rules are re-evaluated

### On Close Applications

* New applications are blocked
* Existing applications remain reviewable

---

## 7. Success & Failure Flows

### Normal Flow

* Employer creates and publishes internships
* Students begin applying

### Restricted Flow

* Attempt to publish invalid internship → clear validation feedback
* Attempt to edit restricted fields → action blocked with explanation

### Failure Cases

* Save failure → retry without data loss
* Temporary system issue → internships remain unchanged

---

## 8. State Transitions

| Previous State        | Action             | New State             |
| --------------------- | ------------------ | --------------------- |
| None                  | Create internship  | Draft                 |
| Draft                 | Publish            | Open for Applications |
| Open for Applications | Close applications | Closed                |
| Closed                | Archive            | Archived              |

Only **Open for Applications** internships appear to students.

---

## 9. Exit Conditions

The employer exits this screen when:

* Navigating to Applicant Review for a specific internship
* Creating or editing internships
* Logging out

This screen does not handle applicant evaluation directly.

---