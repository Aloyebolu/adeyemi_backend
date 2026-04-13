// computation/services/AcademicStandingEngine.js
import { ACADEMIC_RULES, STUDENT_STATUS, REMARK_CATEGORIES, SUSPENSION_REASONS } from "../utils/computationConstants.js";

class AcademicStandingEngine {

  /**
   * Optimized academic standing determination (without DB calls)
   * @param {Object} student - Student object
   * @param {number} semesterGPA - Current semester GPA
   * @param {number} currentCGPA - Cumulative GPA
   * @param {number} totalCarryovers - Total carryovers
   * @param {boolean} isFinal - Whether this is final computation
   * @returns {Object} Academic standing
   */
  async determineAcademicStanding(student, semesterGPA, currentCGPA, totalCarryovers, semesterId, isFinal = false, registered = true, activeSemester) {
    // Handle non-registration early
    const nonRegResult = await this._handleNonRegistration(student, semesterId, isFinal, registered, activeSemester);
    if (nonRegResult) return nonRegResult;

    // For non-final, just return a preview
    if (!isFinal) {
      return this._computeStanding(student, semesterGPA, currentCGPA, false, registered, activeSemester);
    }

    // Final computation
    return this._computeStanding(student, semesterGPA, currentCGPA, true, registered, activeSemester);
  }

  getPreviousSemester(currentSemester) {
    const semesters = ["first", "second"];
    const index = semesters.indexOf(currentSemester.name?.toLowerCase());

    let prevSemester, prevSession;

    if (index === 0) {
      // If the current semester is "first", previous is "second" of previous session
      prevSemester = "second";
      const [startYear, endYear] = currentSemester.session.split('/').map(Number);
      prevSession = `${startYear - 1}/${endYear - 1}`;
    } else if (index === 1) {
      // If the current semester is "second", previous is "first" of the same session
      prevSemester = "first";
      prevSession = currentSemester.session;
    } else {
      throw new Error("Semester must be 'first' or 'second'");
    }

    return { semester: prevSemester, session: prevSession };
  }
  /**
   * Compute academic standing (preview or final)
   */
  _computeStanding(student, semesterGPA, currentCGPA, isFinal, hasResults, activeSemester) {
    const rules = this._getAcademicRules(student, semesterGPA, currentCGPA, hasResults);

    const fromSemester = this.getPreviousSemester(activeSemester);

    // Construct reason
    // const reason = `No Registration Data for two consecutive semesters, from ${fromSemester.semester} ${fromSemester.session} to ${activeSemester.name} ${activeSemester.session}.`;
    const reason = `Registration data is missing for two consecutive semesters, spanning from ${fromSemester.semester} semester ${fromSemester.session} to ${activeSemester.name} semester ${activeSemester.session}.`;
    // Termination
    if (rules.termination) {
      return this._buildStanding({
        probationStatus: STUDENT_STATUS.NONE,
        terminationStatus: STUDENT_STATUS.TERMINATED,
        remark: REMARK_CATEGORIES.TERMINATED,
        actionTaken: isFinal ? "terminated_non_registration" : "would_be_terminated_non_registration",
        isPreview: !isFinal,
        reason: reason
      });
    }

    // Withdrawal
    if (rules.withdrawal) {
      return this._buildStanding({
        probationStatus: STUDENT_STATUS.NONE,
        terminationStatus: STUDENT_STATUS.WITHDRAWN,
        remark: REMARK_CATEGORIES.WITHDRAWN,
        actionTaken: isFinal ? "withdrawn_cgpa_low" : "would_be_withdrawn_cgpa_low",
        isPreview: !isFinal
      });
    }

    // Probation
    if (rules.probation) {
      return this._buildStanding({
        probationStatus: STUDENT_STATUS.PROBATION,
        terminationStatus: STUDENT_STATUS.NONE,
        remark: REMARK_CATEGORIES.PROBATION,
        actionTaken: student.probationStatus === STUDENT_STATUS.NONE
          ? (isFinal ? "placed_on_probation" : "would_be_placed_on_probation")
          : "probation_continued",
        isPreview: !isFinal
      });
    }

    // Performance remarks: excellent or good
    if (rules.excellent) {
      return this._buildStanding({
        remark: REMARK_CATEGORIES.EXCELLENT,
        isPreview: !isFinal
      });
    }

    if (rules.good) {
      return this._buildStanding({
        remark: REMARK_CATEGORIES.GOOD,
        isPreview: !isFinal
      });
    }

    // Default standing
    return this._buildStanding({
      remark: REMARK_CATEGORIES.GOOD,
      isPreview: !isFinal
    });
  }

  /**
   * Generate rules for a student
   */
  _getAcademicRules(student, semesterGPA, currentCGPA, hasResults = true) {
    return {
      termination: !hasResults && student.suspension?.status && student.suspension.reason === "NO_REGISTRATION",
      withdrawal: currentCGPA < 1.0 && student.level > 100 && student.probationStatus === STUDENT_STATUS.PROBATION,
      probation: currentCGPA < ACADEMIC_RULES.PROBATION_THRESHOLD || semesterGPA < 1.0,
      excellent: currentCGPA >= ACADEMIC_RULES.EXCELLENT_GPA,
      good: currentCGPA >= ACADEMIC_RULES.GOOD_GPA
    };
  }

  /**
   * Build the standardized standing object
   */
  _buildStanding({ probationStatus = STUDENT_STATUS.NONE, terminationStatus = STUDENT_STATUS.NONE, remark = REMARK_CATEGORIES.GOOD, actionTaken = "none", isPreview = false, reason }) {
    return { probationStatus, terminationStatus, remark, actionTaken, isPreview, reason };
  }





  /**
   * Handle non-registration cases
   */
  async _handleNonRegistration(student, currentSemesterId, isFinal = false, registered = true, activeSemester) {

    const didNotRegister = !registered; // If there are no results, treat it as non-registration
    const fromSemester = this.getPreviousSemester(activeSemester);

    // Construct reason
    const reason = `No Registration Data for two consecutive semesters, from ${fromSemester.semester} ${fromSemester.session} to ${activeSemester.name} ${activeSemester.session}.`;
    if (!didNotRegister) return null;

    // Check existing suspension status
    if (student.suspension?.status) {
      // Second offense → terminate
      if (student.suspension.reason === SUSPENSION_REASONS.NO_REGISTRATION) {
        return {
          didNotRegister: true,
          probationStatus: STUDENT_STATUS.NONE,
          terminationStatus: STUDENT_STATUS.TERMINATED,
          remark: REMARK_CATEGORIES.TERMINATED,
          suspensionStatus: student.suspension.reason,
          actionTaken: isFinal
            ? "terminated_non_registration"
            : "would_be_terminated_non_registration",
          isPreview: !isFinal,
          reason
        };
      }

      // School-approved suspension → respect it
      else if (student.suspension.reason === SUSPENSION_REASONS.SCHOOL_APPROVED) {
        return {
          didNotRegister: true,
          probationStatus: STUDENT_STATUS.NONE,
          terminationStatus: STUDENT_STATUS.NONE,
          remark: SUSPENSION_REASONS.SCHOOL_APPROVED,
          suspensionStatus: student.suspension.reason,
          actionTaken: "school_approved_suspension_respected",
          isPreview: !isFinal
        };
      }
    }


    else {


      // First offense → suspend
      return {
        didNotRegister: true,
        probationStatus: STUDENT_STATUS.NONE,
        terminationStatus: STUDENT_STATUS.NONE,
        remark: SUSPENSION_REASONS.NO_REGISTRATION,
        reason: "Suspended due to no registration data",
        suspensionStatus: SUSPENSION_REASONS.NO_REGISTRATION,
        actionTaken: isFinal
          ? "suspended_no_registration"
          : "would_be_suspended_no_registration",
        suspension: {
          status: true,
          reason: SUSPENSION_REASONS.NO_REGISTRATION,
          sinceSemesterId: currentSemesterId
        },
        isPreview: !isFinal
      };
    }
  }


}

export default new AcademicStandingEngine();