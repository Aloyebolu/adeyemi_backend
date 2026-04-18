/**
 * Validation service for admission business rules
 */
import { APPLICATION_STATUS } from "#domain/admission/constants/admission.constants.js";

export class AdmissionValidationService {
  /**
   * Validate status transition
   */
  static validateStatusTransition(currentStatus, newStatus, userRole) {
    const validTransitions = {
      [APPLICATION_STATUS.DRAFT]: {
        next: [APPLICATION_STATUS.SUBMITTED],
        allowedRoles: ["applicant", "admin"],
        description: "Applicant submits application"
      },
      [APPLICATION_STATUS.SUBMITTED]: {
        next: [
          APPLICATION_STATUS.UNDER_REVIEW,
          APPLICATION_STATUS.POST_UTME_SCHEDULED
        ],
        allowedRoles: ["admin", "admissionOfficer"],
        description: "Admin reviews or schedules Post-UTME"
      },
      [APPLICATION_STATUS.UNDER_REVIEW]: {
        next: [
          APPLICATION_STATUS.POST_UTME_SCHEDULED,
          APPLICATION_STATUS.REJECTED
        ],
        allowedRoles: ["admin", "admissionOfficer"],
        description: "Admin decides next step"
      },
      [APPLICATION_STATUS.POST_UTME_SCHEDULED]: {
        next: [APPLICATION_STATUS.POST_UTME_SCORE_RECEIVED],
        allowedRoles: ["admin", "admissionOfficer"],
        description: "Record Post-UTME score"
      },
      [APPLICATION_STATUS.POST_UTME_SCORE_RECEIVED]: {
        next: [APPLICATION_STATUS.AGGREGATE_CALCULATED],
        allowedRoles: ["system", "admin"],
        description: "System calculates aggregate"
      },
      [APPLICATION_STATUS.AGGREGATE_CALCULATED]: {
        next: [
          APPLICATION_STATUS.ADMITTED,
          APPLICATION_STATUS.REJECTED,
          APPLICATION_STATUS.WAITLISTED
        ],
        allowedRoles: ["admin", "admissionCommittee"],
        description: "Admission decision"
      },
      [APPLICATION_STATUS.ADMITTED]: {
        next: [], // Terminal state for admission flow
        allowedRoles: [],
        description: "Final admission state"
      },
      [APPLICATION_STATUS.REJECTED]: {
        next: [], // Terminal state
        allowedRoles: [],
        description: "Final rejection state"
      },
      [APPLICATION_STATUS.WAITLISTED]: {
        next: [APPLICATION_STATUS.ADMITTED, APPLICATION_STATUS.REJECTED],
        allowedRoles: ["admin"],
        description: "Move from waitlist"
      }
    };
    
    const transition = validTransitions[currentStatus];
    
    if (!transition) {
      return {
        valid: false,
        error: `Invalid current status: ${currentStatus}`
      };
    }
    
    if (!transition.next.includes(newStatus)) {
      return {
        valid: false,
        error: `Cannot transition from ${currentStatus} to ${newStatus}. Valid transitions: ${transition.next.join(", ")}`
      };
    }
    
    if (!transition.allowedRoles.includes(userRole)) {
      return {
        valid: false,
        error: `Role ${userRole} not allowed to perform this transition. Allowed roles: ${transition.allowedRoles.join(", ")}`
      };
    }
    
    return {
      valid: true,
      transition: {
        from: currentStatus,
        to: newStatus,
        description: transition.description,
        allowedBy: userRole
      }
    };
  }

  /**
   * Validate document requirements for status
   */
  static async validateDocumentRequirements(applicationId, targetStatus) {
    const requirements = {
      [APPLICATION_STATUS.SUBMITTED]: {
        required: ["jambResult", "oLevelResult", "birthCertificate", "passportPhotograph"],
        minVerified: 0,
        message: "All required documents must be uploaded"
      },
      [APPLICATION_STATUS.POST_UTME_SCHEDULED]: {
        required: ["jambResult", "oLevelResult", "birthCertificate", "passportPhotograph"],
        minVerified: 4, // All must be verified
        message: "All required documents must be verified"
      },
      [APPLICATION_STATUS.ADMITTED]: {
        required: ["jambResult", "oLevelResult", "birthCertificate", "passportPhotograph", "referenceLetter"],
        minVerified: 5,
        message: "All documents including reference letter must be verified"
      }
    };
    
    const requirement = requirements[targetStatus];
    
    if (!requirement) {
      return {
        met: true,
        message: "No document requirements for this status"
      };
    }
    
    // Get document status
    const AdmissionDocument = (await import("../models/admissionDocument.model.js")).default;
    const documents = await AdmissionDocument.find({
      admissionApplicationId: applicationId,
      category: { $in: requirement.required }
    });
    
    const verifiedCount = documents.filter(d => d.status === "verified").length;
    const uploadedCount = documents.filter(d => d.status !== "notStarted").length;
    
    const missingCategories = requirement.required.filter(cat => 
      !documents.some(d => d.category === cat)
    );
    
    return {
      met: verifiedCount >= requirement.minVerified && uploadedCount >= requirement.required.length,
      verifiedCount,
      requiredCount: requirement.required.length,
      missingCategories,
      message: requirement.message
    };
  }

  /**
   * Validate JAMB score against cutoff
   */
  static async validateJAMBScore(applicationId) {
    const AdmissionDocument = (await import("../models/admissionDocument.model.js")).default;
    const AdmissionSettings = (await import("../models/admissionSettings.model.js")).default;
    
    const jambDoc = await AdmissionDocument.findOne({
      admissionApplicationId: applicationId,
      category: "jambResult",
      status: { $in: ["uploaded", "underReview", "verified"] }
    });
    
    if (!jambDoc) {
      return {
        valid: false,
        error: "JAMB result not found"
      };
    }
    
    const jambScore = jambDoc.metadata?.get("score") || 0;
    
    const settings = await AdmissionSettings.findOne().sort({ createdAt: -1 });
    const cutoffMark = settings?.cutoffMark || 180;
    
    return {
      valid: jambScore >= cutoffMark,
      score: jambScore,
      cutoff: cutoffMark,
      difference: jambScore - cutoffMark,
      message: jambScore >= cutoffMark ? 
        `JAMB score meets cutoff (${jambScore} >= ${cutoffMark})` :
        `JAMB score below cutoff (${jambScore} < ${cutoffMark})`
    };
  }

  /**
   * Validate aggregate score against programme cutoff
   */
  static async validateAggregateScore(applicationId) {
    const AdmissionApplication = (await import("../models/admissionApplication.model.js")).default;
    const Programme = (await import("../../academic/models/programme.model.js")).default;
    
    const application = await AdmissionApplication.findById(applicationId)
      .populate("programmeId");
    
    if (!application || !application.score) {
      return {
        valid: false,
        error: "Application or aggregate score not found"
      };
    }
    
    const programme = application.programmeId;
    const programmeCutoff = programme.admissionCutoff || 50; // Default cutoff
    
    return {
      valid: application.score >= programmeCutoff,
      aggregate: application.score,
      cutoff: programmeCutoff,
      difference: application.score - programmeCutoff,
      programme: programme.name,
      message: application.score >= programmeCutoff ?
        `Aggregate meets programme cutoff (${application.score} >= ${programmeCutoff})` :
        `Aggregate below programme cutoff (${application.score} < ${programmeCutoff})`
    };
  }
}

export default AdmissionValidationService;