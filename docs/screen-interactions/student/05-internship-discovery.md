# Student — Internship Discovery

## 1. Screen Purpose

The **Internship Discovery** screen enables eligible students to **find, evaluate, and select internships** that match their profile, preparation performance, and interests.

Its goals are to:

* Present available internships in a structured, transparent way
* Surface AI-recommended opportunities based on student readiness
* Allow informed decision-making before application
* Act as the gateway to the application flow

This screen is only accessible once preparation requirements are satisfied (unless policy explicitly allows partial access).

---

## 2. Actor & Preconditions

### Actor

* **Role:** Student

### Preconditions

* Student is authenticated
* Student profile status is **completed**
* Preparation status is **completed** (or meets minimum eligibility threshold)
* Student is not currently blocked or restricted from applications

If preparation is incomplete, this screen remains locked.

---

## 3. Required Data to Render

To render the Internship Discovery screen, the system provides:

* List of currently available internships
* Internship metadata:

  * Title, organization, domain
  * Duration, location / mode
  * Required skills
  * Application deadline
* AI recommendation indicators (recommended / good fit / stretch)
* Student eligibility flags per internship
* Filtering and sorting options
* Saved or previously viewed internships (if applicable)

---

## 4. Screen Structure & Sections

The screen is typically organized into:

1. **Discovery Header**

   * Explanation of how internships are matched
   * Student readiness indicator

2. **Internship Listings**

   * Card or list view of internships
   * Clear visibility of key requirements and status

3. **AI Recommendations**

   * Highlighted internships ranked by fit
   * Reasoning indicators (e.g. skill match, drill performance)

4. **Filters & Search**

   * Domain, duration, location, skills
   * Application status filters

5. **Internship Detail Preview**

   * Expanded view or modal with full description
   * Clear call-to-action to apply

---

## 5. User Actions

The student can:

* Browse internship listings
* Search and filter internships
* View detailed internship information
* See AI-based fit indicators
* Save or bookmark internships (if supported)
* Proceed to apply for an internship

The student **cannot bypass eligibility checks**.

---

## 6. System Responses (Conceptual)

### On Screen Load

* System evaluates student eligibility
* Internships are ranked and filtered accordingly
* AI recommendations are generated

### On Filter or Search

* Internship list updates dynamically
* Eligibility and recommendation indicators are recalculated

### On View Internship Details

* Full internship information is loaded
* Student-specific eligibility is displayed clearly

### On Apply Action

* System validates application eligibility
* Student is transitioned to the Application Flow

---

## 7. Success & Failure Flows

### Normal Flow

* Student finds suitable internship
* Student proceeds to application

### Restricted Flow

* Student selects ineligible internship
* System explains missing requirements clearly
* No application is initiated

### Failure Cases

* Data load failure → fallback message with retry
* Recommendation unavailable → internships still listed without AI ranking

Failures never affect student eligibility state.

---

## 8. State Transitions

| Previous State            | Action            | New State                 |
| ------------------------- | ----------------- | ------------------------- |
| Preparation Completed     | Enter discovery   | Eligible for Applications |
| Eligible for Applications | Select internship | Application Initiated     |
| Eligible for Applications | Save internship   | No state change           |

Discovery itself does not commit the student to an internship.

---

## 9. Exit Conditions

The student exits this screen when:

* Proceeding to the Application Flow
* Navigating back to the Preparation Dashboard (read-only)

There is no direct path to internship execution from this screen.

