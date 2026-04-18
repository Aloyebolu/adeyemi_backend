import mongoose from "mongoose";
import { APPLICATION_STATUS, AUDIT_ACTIONS, AGGREGATE_WEIGHTS } from "#domain/admission/constants/admission.constants.js";
import AdmissionApplication from "#domain/admission/models/admissionApplication.model.js";
import AdmissionDocument from "#domain/admission/models/admissionDocument.model.js";
import AdmissionDecision from "#domain/admission/models/admissionDecision.model.js";
import AdmissionAcceptance from "#domain/admission/models/admissionAcceptance.model.js";
import AdmissionSettings from "#domain/admission/models/admissionSettings.model.js";
import FileService from "#domain/files/files.service.js";

export class AdmissionService {
  /**
   * Create audit context for all mutating operations
   */
  static createAuditContext(action, status, message, metadata, changes) {
    return {
      action,
      status,
      message,
      timestamp: new Date(),
      metadata,
      changes
    };
  }

  /**
   * Submit application (draft → submitted)
   */
  static async submitApplication(applicationId, userId, userRole) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const application = await AdmissionApplication
        .findById(applicationId)
        .session(session);
      
      if (!application) {
        throw new Error("Application not found");
      }
      
      if (application.status !== APPLICATION_STATUS.DRAFT) {
        throw new Error(`Cannot submit application in ${application.status} status`);
      }
      
      // Validate minimum requirements
      const requiredDocs = await this.validateSubmissionRequirements(applicationId);
      if (!requiredDocs.met) {
        throw new Error(`Missing required documents: ${requiredDocs.missing.join(", ")}`);
      }
      
      // Check JAMB eligibility
      const jambEligible = await this.checkJAMBEligibility(applicationId);
      if (!jambEligible) {
        throw new Error("JAMB score does not meet minimum requirements");
      }
      
      // Update status
      const previousStatus = application.status;
      application.status = APPLICATION_STATUS.SUBMITTED;
      application.submittedAt = new Date();
      await application.save({ session });
      
      // Create audit context
      const auditContext = this.createAuditContext(
        AUDIT_ACTIONS.APPLICATION_SUBMITTED,
        "SUCCESS",
        "Application submitted successfully",
        {
          entityId: application._id,
          performedBy: userRole,
          performedByUserId: userId,
          applicantId: application.applicantId,
          admissionApplicationId: application._id,
          admissionCycleId: application.admissionCycleId
        },
        {
          before: { status: previousStatus },
          after: { status: APPLICATION_STATUS.SUBMITTED, submittedAt: application.submittedAt }
        }
      );
      
      await session.commitTransaction();
      
      return {
        application,
        auditContext,
        nextSteps: ["documentVerification", "postUTMEScheduling"]
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Check JAMB eligibility against cutoff
   */
  static async checkJAMBEligibility(applicationId) {
    const application = await AdmissionApplication.findById(applicationId);
    
    // Get current cutoff mark
    const settings = await AdmissionSettings.findOne().sort({ createdAt: -1 });
    const cutoffMark = settings?.cutoffMark || 180;
    
    // In production: Fetch actual JAMB score from documents
    // For now, we'll use a placeholder
    const jambDocument = await AdmissionDocument.findOne({
      admissionApplicationId: applicationId,
      category: "jambResult",
      status: { $in: ["uploaded", "underReview", "verified"] }
    });
    
    if (!jambDocument) {
      return false;
    }
    
    // Extract JAMB score from document metadata
    const jambScore = jambDocument.metadata?.get("score") || 0;
    
    return jambScore >= cutoffMark;
  }

  /**
   * Validate submission requirements
   */
  static async validateSubmissionRequirements(applicationId) {
    const requiredCategories = [
      "jambResult",
      "oLevelResult",
      "birthCertificate",
      "passportPhotograph"
    ];
    
    const existingDocs = await AdmissionDocument.find({
      admissionApplicationId: applicationId,
      category: { $in: requiredCategories },
      status: { $in: ["uploaded", "underReview", "verified"] }
    });
    
    const existingCategories = existingDocs.map(doc => doc.category);
    const missing = requiredCategories.filter(cat => !existingCategories.includes(cat));
    
    return {
      met: missing.length === 0,
      missing,
      existing: existingCategories
    };
  }

  /**
   * Schedule Post-UTME (submitted → postUTMEScheduled)
   */
  static async schedulePostUTME(applicationId, scheduleData, userId, userRole) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const application = await AdmissionApplication
        .findById(applicationId)
        .session(session);
      
      if (!application) {
        throw new Error("Application not found");
      }
      
      if (application.status !== APPLICATION_STATUS.SUBMITTED) {
        throw new Error(`Cannot schedule Post-UTME for application in ${application.status} status`);
      }
      
      // Verify all documents are verified
      const pendingDocs = await AdmissionDocument.countDocuments({
        admissionApplicationId: applicationId,
        status: { $in: ["notStarted", "uploaded", "underReview", "rejected"] }
      });
      
      if (pendingDocs > 0) {
        throw new Error("Cannot schedule Post-UTME with pending document verification");
      }
      
      // Update status
      const previousStatus = application.status;
      application.status = APPLICATION_STATUS.POST_UTME_SCHEDULED;
      await application.save({ session });
      
      // Store schedule in metadata
      application.metadata = {
        ...application.metadata,
        postUTMESchedule: {
          date: scheduleData.date,
          venue: scheduleData.venue,
          time: scheduleData.time,
          scheduledBy: userId,
          scheduledAt: new Date()
        }
      };
      
      // Create audit context
      const auditContext = this.createAuditContext(
        AUDIT_ACTIONS.POST_UTME_SCHEDULED,
        "SUCCESS",
        "Post-UTME scheduled successfully",
        {
          entityId: application._id,
          performedBy: userRole,
          performedByUserId: userId,
          applicantId: application.applicantId,
          admissionApplicationId: application._id,
          admissionCycleId: application.admissionCycleId
        },
        {
          before: { status: previousStatus },
          after: { 
            status: APPLICATION_STATUS.POST_UTME_SCHEDULED,
            postUTMESchedule: scheduleData
          }
        }
      );
      
      await session.commitTransaction();
      
      return {
        application,
        auditContext,
        schedule: scheduleData
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Record Post-UTME score (postUTMEScheduled → postUTMEScoreReceived)
   */
  static async recordPostUTMEScore(applicationId, scoreData, userId, userRole) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const application = await AdmissionApplication
        .findById(applicationId)
        .session(session);
      
      if (!application) {
        throw new Error("Application not found");
      }
      
      if (application.status !== APPLICATION_STATUS.POST_UTME_SCHEDULED) {
        throw new Error(`Cannot record Post-UTME score for application in ${application.status} status`);
      }
      
      // Validate score
      if (scoreData.score < 0 || scoreData.score > 100) {
        throw new Error("Post-UTME score must be between 0 and 100");
      }
      
      // Update status
      const previousStatus = application.status;
      application.status = APPLICATION_STATUS.POST_UTME_SCORE_RECEIVED;
      application.metadata = {
        ...application.metadata,
        postUTMEScore: {
          score: scoreData.score,
          recordedBy: userId,
          recordedAt: new Date(),
          remarks: scoreData.remarks
        }
      };
      await application.save({ session });
      
      // Create Post-UTME document record
      const postUTMEDoc = new AdmissionDocument({
        admissionApplicationId: applicationId,
        category: "postUTMEResult",
        status: "verified",
        metadata: {
          score: scoreData.score,
          recordedBy: userId,
          recordingDate: new Date()
        }
      });
      await postUTMEDoc.save({ session });
      
      // Calculate aggregate score
      await this.calculateAggregateScore(applicationId, userId, userRole, session);
      
      // Create audit context
      const auditContext = this.createAuditContext(
        AUDIT_ACTIONS.POST_UTME_SCORE_RECORDED,
        "SUCCESS",
        "Post-UTME score recorded successfully",
        {
          entityId: application._id,
          performedBy: userRole,
          performedByUserId: userId,
          applicantId: application.applicantId,
          admissionApplicationId: application._id,
          admissionCycleId: application.admissionCycleId
        },
        {
          before: { status: previousStatus },
          after: { 
            status: APPLICATION_STATUS.POST_UTME_SCORE_RECEIVED,
            postUTMEScore: scoreData.score
          }
        }
      );
      
      await session.commitTransaction();
      
      return {
        application,
        auditContext,
        score: scoreData.score
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Calculate aggregate score (postUTMEScoreReceived → aggregateCalculated)
   */
  static async calculateAggregateScore(applicationId, userId, userRole, existingSession = null) {
    const session = existingSession || await mongoose.startSession();
    const shouldCommit = !existingSession;
    
    try {
      if (!existingSession) {
        session.startTransaction();
      }
      
      const application = await AdmissionApplication
        .findById(applicationId)
        .session(session);
      
      if (!application) {
        throw new Error("Application not found");
      }
      
      if (application.status !== APPLICATION_STATUS.POST_UTME_SCORE_RECEIVED) {
        throw new Error(`Cannot calculate aggregate for application in ${application.status} status`);
      }
      
      // Get JAMB score
      const jambDoc = await AdmissionDocument.findOne({
        admissionApplicationId: applicationId,
        category: "jambResult",
        status: "verified"
      }).session(session);
      
      if (!jambDoc) {
        throw new Error("Verified JAMB result not found");
      }
      
      const jambScore = jambDoc.metadata?.get("score") || 0;
      const jambPercentage = (jambScore / 400) * 100; // Convert to percentage
      
      // Get Post-UTME score
      const postUTMEScore = application.metadata?.postUTMEScore?.score || 0;
      
      // Calculate aggregate
      const aggregate = (
        (jambPercentage * AGGREGATE_WEIGHTS.JAMB) + 
        (postUTMEScore * AGGREGATE_WEIGHTS.POST_UTME)
      );
      
      // Update application
      const previousStatus = application.status;
      application.status = APPLICATION_STATUS.AGGREGATE_CALCULATED;
      application.score = parseFloat(aggregate.toFixed(2));
      application.metadata = {
        ...application.metadata,
        aggregateCalculation: {
          jambScore: jambScore,
          jambPercentage: parseFloat(jambPercentage.toFixed(2)),
          postUTMEScore: postUTMEScore,
          aggregate: application.score,
          weights: AGGREGATE_WEIGHTS,
          calculatedBy: userId,
          calculatedAt: new Date()
        }
      };
      await application.save({ session });
      
      // Create audit context
      const auditContext = this.createAuditContext(
        AUDIT_ACTIONS.AGGREGATE_CALCULATED,
        "SUCCESS",
        `Aggregate score calculated: ${application.score}`,
        {
          entityId: application._id,
          performedBy: userRole,
          performedByUserId: userId,
          applicantId: application.applicantId,
          admissionApplicationId: application._id,
          admissionCycleId: application.admissionCycleId
        },
        {
          before: { 
            status: previousStatus,
            score: null 
          },
          after: { 
            status: APPLICATION_STATUS.AGGREGATE_CALCULATED,
            score: application.score,
            calculation: application.metadata.aggregateCalculation
          }
        }
      );
      
      if (shouldCommit) {
        await session.commitTransaction();
      }
      
      return {
        application,
        auditContext,
        aggregate: application.score,
        breakdown: {
          jambScore,
          jambPercentage: parseFloat(jambPercentage.toFixed(2)),
          postUTMEScore,
          weights: AGGREGATE_WEIGHTS
        }
      };
      
    } catch (error) {
      if (shouldCommit) {
        await session.abortTransaction();
      }
      throw error;
    } finally {
      if (shouldCommit) {
        session.endSession();
      }
    }
  }

  /**
   * Make admission decision (aggregateCalculated → admitted/rejected/waitlisted)
   */
  static async makeAdmissionDecision(decisionData, userId, userRole) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const { applicationId, decision, notes } = decisionData;
      
      const application = await AdmissionApplication
        .findById(applicationId)
        .session(session);
      
      if (!application) {
        throw new Error("Application not found");
      }
      
      if (application.status !== APPLICATION_STATUS.AGGREGATE_CALCULATED) {
        throw new Error(`Cannot make decision for application in ${application.status} status`);
      }
      
      // Validate decision
      const validDecisions = ["admitted", "rejected", "waitlisted"];
      if (!validDecisions.includes(decision)) {
        throw new Error(`Invalid decision: ${decision}`);
      }
      
      // Create decision record
      const admissionDecision = new AdmissionDecision({
        admissionApplicationId: applicationId,
        decision,
        decidedBy: userId,
        notes,
        decisionDate: new Date()
      });
      await admissionDecision.save({ session });
      
      // Update application status
      const previousStatus = application.status;
      application.status = decision;
      await application.save({ session });
      
      // Create audit context
      const auditContext = this.createAuditContext(
        AUDIT_ACTIONS.ADMISSION_DECIDED,
        "SUCCESS",
        `Admission decision: ${decision}`,
        {
          entityId: application._id,
          performedBy: userRole,
          performedByUserId: userId,
          applicantId: application.applicantId,
          admissionApplicationId: application._id,
          admissionCycleId: application.admissionCycleId
        },
        {
          before: { status: previousStatus },
          after: { 
            status: decision,
            decision: admissionDecision 
          }
        }
      );
      
      await session.commitTransaction();
      
      return {
        application,
        decision: admissionDecision,
        auditContext
      };
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get application dashboard data for UI
   */
  static async getApplicantDashboard(applicantId) {
    const applications = await AdmissionApplication.find({ applicantId })
      .populate("admissionCycleId")
      .populate("programmeId")
      .populate("departmentId")
      .sort({ createdAt: -1 });
    
    const dashboard = await Promise.all(applications.map(async (app) => {
      // Get documents status
      const documents = await AdmissionDocument.find({
        admissionApplicationId: app._id
      });
      
      // Get decision if exists
      const decision = await AdmissionDecision.findOne({
        admissionApplicationId: app._id
      }).sort({ decisionDate: -1 });
      
      // Get acceptance if exists
      const acceptance = await AdmissionAcceptance.findOne({
        admissionApplicationId: app._id
      });
      
      // Calculate progress percentage
      const progress = this.calculateApplicationProgress(app, documents);
      
      return {
        application: app,
        documents: {
          total: documents.length,
          verified: documents.filter(d => d.status === "verified").length,
          pending: documents.filter(d => d.status === "underReview" || d.status === "uploaded").length,
          rejected: documents.filter(d => d.status === "rejected").length,
          list: documents
        },
        decision,
        acceptance,
        progress,
        nextAction: this.getNextAction(app, documents, decision, acceptance)
      };
    }));
    
    return dashboard;
  }

  /**
   * Calculate application progress for UI
   */
  static calculateApplicationProgress(application, documents) {
    const stages = {
      documents: 25,
      verification: 25,
      postUTME: 20,
      decision: 15,
      acceptance: 15
    };
    
    let progress = 0;
    
    // Documents stage
    const requiredDocs = ["jambResult", "oLevelResult", "birthCertificate", "passportPhotograph"];
    const uploadedDocs = documents.filter(d => requiredDocs.includes(d.category) && d.status !== "notStarted");
    progress += (uploadedDocs.length / requiredDocs.length) * stages.documents;
    
    // Verification stage
    const verifiedDocs = documents.filter(d => d.status === "verified");
    progress += (verifiedDocs.length / documents.length) * stages.verification;
    
    // Post-UTME stage
    if (application.status === "postUTMEScheduled" || 
        application.status === "postUTMEScoreReceived" ||
        application.status === "aggregateCalculated") {
      progress += stages.postUTME;
    }
    
    // Decision stage
    if (["admitted", "rejected", "waitlisted"].includes(application.status)) {
      progress += stages.decision;
    }
    
    // Acceptance stage
    const acceptance = application.status === "admitted" ? 1 : 0;
    progress += acceptance * stages.acceptance;
    
    return Math.min(100, Math.round(progress));
  }

  /**
   * Determine next action for UI
   */
  static getNextAction(application, documents, decision, acceptance) {
    if (application.status === "draft") {
      return "SUBMIT_APPLICATION";
    }
    
    if (application.status === "submitted") {
      const pendingDocs = documents.filter(d => 
        d.status === "notStarted" || 
        d.status === "rejected"
      );
      if (pendingDocs.length > 0) {
        return "UPLOAD_DOCUMENTS";
      }
      return "AWAITING_VERIFICATION";
    }
    
    if (application.status === "admitted" && !acceptance) {
      return "ACCEPT_ADMISSION";
    }
    
    if (acceptance && !acceptance.accepted) {
      return "PAY_ACCEPTANCE_FEE";
    }
    
    return "AWAITING_NEXT_STEP";
  }

  /**
   * Get admin review queue
   */
  static async getAdminReviewQueue(filters = {}) {
    const {
      status,
      admissionCycleId,
      departmentId,
      page = 1,
      limit = 20
    } = filters;
    
    const query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (admissionCycleId) {
      query.admissionCycleId = admissionCycleId;
    }
    
    if (departmentId) {
      query.departmentId = departmentId;
    }
    
    const skip = (page - 1) * limit;
    
    const applications = await AdmissionApplication.find(query)
      .populate("applicantId")
      .populate("admissionCycleId")
      .populate("programmeId")
      .populate("departmentId")
      .skip(skip)
      .limit(limit)
      .sort({ submittedAt: -1 });
    
    const total = await AdmissionApplication.countDocuments(query);
    
    // Enhance with document verification status
    const enhanced = await Promise.all(applications.map(async (app) => {
      const documents = await AdmissionDocument.find({
        admissionApplicationId: app._id
      });
      
      const pendingVerification = documents.filter(d => 
        d.status === "underReview" || d.status === "uploaded"
      ).length;
      
      const rejectedDocuments = documents.filter(d => 
        d.status === "rejected"
      ).length;
      
      return {
        ...app.toObject(),
        documentStats: {
          total: documents.length,
          verified: documents.filter(d => d.status === "verified").length,
          pendingVerification,
          rejectedDocuments
        }
      };
    }));
    
    return {
      applications: enhanced,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

export default AdmissionService;