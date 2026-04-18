import { AdmissionAcceptanceService } from "#domain/admission/services/admissionAcceptance.service.js";
import { validateAcceptance, validateFeeVerification } from "#domain/admission/validators/admissionAcceptance.validator.js";

export class AdmissionAcceptanceController {
  /**
   * Record admission acceptance
   */
  static async recordAcceptance(req, res, next) {
    try {
      const acceptanceData = req.body;
      const { userId, role } = req.user;
      
      // Validate request
      await validateAcceptance.validateAsync(acceptanceData);
      
      // Call service
      const result = await AdmissionAcceptanceService.recordAcceptance(acceptanceData, userId, role);
      
      // Attach audit context
      req.auditContext = result.auditContext;
      
      res.status(200).json({
        success: true,
        data: {
          acceptance: result.acceptance,
          admissionLetter: result.admissionLetter
        },
        message: "Admission acceptance recorded successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify acceptance fee payment (webhook)
   */
  static async verifyAcceptanceFee(req, res, next) {
    try {
      const { applicationId } = req.params;
      const paymentData = req.body;
      const { userId, role } = req.user;
      
      // Validate request
      await validateFeeVerification.validateAsync({ applicationId, ...paymentData });
      
      // Call service
      const result = await AdmissionAcceptanceService.verifyAcceptanceFee(applicationId, paymentData, userId, role);
      
      // Attach audit context
      req.auditContext = result.auditContext;
      
      res.status(200).json({
        success: true,
        data: {
          application: result.application,
          paymentVerified: result.paymentVerified
        },
        message: "Acceptance fee verified successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get acceptance status
   */
  static async getAcceptanceStatus(req, res, next) {
    try {
      const { applicationId } = req.params;
      
      const status = await AdmissionAcceptanceService.getAcceptanceStatus(applicationId);
      
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download admission letter
   */
  static async downloadAdmissionLetter(req, res, next) {
    try {
      const { applicationId } = req.params;
      const { userId, role } = req.user;
      
      const application = await AdmissionApplication.findById(applicationId);
      
      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Application not found"
        });
      }
      
      // Check access permission
      if (role === "applicant" && application.applicantId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
      
      if (!application.metadata?.admissionLetter) {
        return res.status(404).json({
          success: false,
          message: "Admission letter not generated yet"
        });
      }
      
      // Get signed URL
      const signedUrl = await FileService.getSignedUrl(
        application.metadata.admissionLetter.fileId,
        3600
      );
      
      // Redirect to signed URL
      res.redirect(signedUrl);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Regenerate admission letter
   */
  static async regenerateAdmissionLetter(req, res, next) {
    try {
      const { applicationId } = req.params;
      const { userId, role } = req.user;
      
      const application = await AdmissionApplication.findById(applicationId);
      
      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Application not found"
        });
      }
      
      // Check if admission is accepted
      const acceptance = await AdmissionAcceptance.findOne({ admissionApplicationId: applicationId });
      
      if (!acceptance || !acceptance.accepted) {
        return res.status(400).json({
          success: false,
          message: "Admission must be accepted first"
        });
      }
      
      // Regenerate letter
      const result = await AdmissionAcceptanceService.generateAdmissionLetter(application, userId);
      
      // Attach audit context
      req.auditContext = result.auditContext;
      
      res.status(200).json({
        success: true,
        data: {
          file: result.file
        },
        message: "Admission letter regenerated successfully"
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AdmissionAcceptanceController;