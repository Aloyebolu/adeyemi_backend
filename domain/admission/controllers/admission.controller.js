import { AdmissionService } from "#domain/admission/services/admission.service.js";
import { validateApplicationSubmission, validatePostUTMESchedule, validatePostUTMEScore, validateAdmissionDecision } from "#domain/admission/validators/admission.validator.js";

export class AdmissionController {
  /**
   * Submit application
   */
  static async submitApplication(req, res, next) {
    try {
      const { applicationId } = req.params;
      const { userId, role } = req.user;
      
      // Validate request
      await validateApplicationSubmission.validateAsync({ applicationId });
      
      // Call service
      const result = await AdmissionService.submitApplication(applicationId, userId, role);
      
      // Attach audit context
      req.auditContext = result.auditContext;
      
      res.status(200).json({
        success: true,
        data: {
          application: result.application,
          nextSteps: result.nextSteps
        },
        message: "Application submitted successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Schedule Post-UTME
   */
  static async schedulePostUTME(req, res, next) {
    try {
      const { applicationId } = req.params;
      const scheduleData = req.body;
      const { userId, role } = req.user;
      
      // Validate request
      await validatePostUTMESchedule.validateAsync({ applicationId, ...scheduleData });
      
      // Call service
      const result = await AdmissionService.schedulePostUTME(applicationId, scheduleData, userId, role);
      
      // Attach audit context
      req.auditContext = result.auditContext;
      
      res.status(200).json({
        success: true,
        data: {
          application: result.application,
          schedule: result.schedule
        },
        message: "Post-UTME scheduled successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record Post-UTME score
   */
  static async recordPostUTMEScore(req, res, next) {
    try {
      const { applicationId } = req.params;
      const scoreData = req.body;
      const { userId, role } = req.user;
      
      // Validate request
      await validatePostUTMEScore.validateAsync({ applicationId, ...scoreData });
      
      // Call service
      const result = await AdmissionService.recordPostUTMEScore(applicationId, scoreData, userId, role);
      
      // Attach audit context
      req.auditContext = result.auditContext;
      
      res.status(200).json({
        success: true,
        data: {
          application: result.application,
          score: result.score
        },
        message: "Post-UTME score recorded successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Make admission decision
   */
  static async makeAdmissionDecision(req, res, next) {
    try {
      const decisionData = req.body;
      const { userId, role } = req.user;
      
      // Validate request
      await validateAdmissionDecision.validateAsync(decisionData);
      
      // Call service
      const result = await AdmissionService.makeAdmissionDecision(decisionData, userId, role);
      
      // Attach audit context
      req.auditContext = result.auditContext;
      
      res.status(200).json({
        success: true,
        data: {
          application: result.application,
          decision: result.decision
        },
        message: `Application ${decisionData.decision} successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get applicant dashboard
   */
  static async getApplicantDashboard(req, res, next) {
    try {
      const { _id: applicantId } = req.user;
      
      const dashboard = await AdmissionService.getApplicantDashboard(applicantId);
      
      res.status(200).json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get application details
   */
  static async getApplicationDetails(req, res, next) {
    try {
      const { applicationId } = req.params;
      
      const application = await AdmissionApplication.findById(applicationId)
        .populate("applicantId")
        .populate("admissionCycleId")
        .populate("programmeId")
        .populate("departmentId");
      
      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Application not found"
        });
      }
      
      // Check access permission
      if (req.user.role === "applicant" && application.applicantId._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
      
      res.status(200).json({
        success: true,
        data: application
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get admin review queue
   */
  static async getAdminReviewQueue(req, res, next) {
    try {
      const filters = req.query;
      
      const queue = await AdmissionService.getAdminReviewQueue(filters);
      
      res.status(200).json({
        success: true,
        data: queue
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get application statistics
   */
  static async getApplicationStatistics(req, res, next) {
    try {
      const { admissionCycleId } = req.params;
      
      const stats = await AdmissionService.getApplicationStatistics(admissionCycleId);
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AdmissionController;