import { AdmissionDocumentService } from "../services/admissionDocument.service.js";
import { validateDocumentUpload, validateDocumentVerification } from "../validators/admissionDocument.validator.js";

export class AdmissionDocumentController {
  /**
   * Upload document
   */
  static async uploadDocument(req, res, next) {
    try {
      const uploadData = req.body;
      const file = req.file;
      const { userId, role } = req.user;
      
      if (!file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded"
        });
      }
      
      // Validate request
      await validateDocumentUpload.validateAsync(uploadData);
      
      // Call service
      const result = await AdmissionDocumentService.uploadDocument(uploadData, file, userId, role);
      
      // Attach audit context
      req.auditContext = result.auditContext;
      
      res.status(200).json({
        success: true,
        data: {
          document: result.document,
          file: result.file,
          autoVerification: result.autoVerification
        },
        message: "Document uploaded successfully"
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify document (manual review)
   */
  static async verifyDocument(req, res, next) {
    try {
      const { documentId } = req.params;
      const verificationData = req.body;
      const { userId, role } = req.user;
      
      // Validate request
      await validateDocumentVerification.validateAsync({ documentId, ...verificationData });
      
      // Call service
      const result = await AdmissionDocumentService.verifyDocument(documentId, verificationData, userId, role);
      
      // Attach audit context
      req.auditContext = result.auditContext;
      
      res.status(200).json({
        success: true,
        data: {
          document: result.document
        },
        message: `Document ${verificationData.isVerified ? 'verified' : 'rejected'} successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get application documents
   */
  static async getApplicationDocuments(req, res, next) {
    try {
      const { applicationId } = req.params;
      const { includeUrls } = req.query;
      
      const documents = await AdmissionDocumentService.getApplicationDocuments(
        applicationId,
        includeUrls === "true"
      );
      
      res.status(200).json({
        success: true,
        data: documents
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get documents for manual review
   */
  static async getDocumentsForReview(req, res, next) {
    try {
      const filters = req.query;
      
      const result = await AdmissionDocumentService.getDocumentsForReview(filters);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Download document file
   */
  static async downloadDocument(req, res, next) {
    try {
      const { documentId } = req.params;
      const { userId, role } = req.user;
      
      const document = await AdmissionDocument.findById(documentId)
        .populate("fileId");
      
      if (!document) {
        return res.status(404).json({
          success: false,
          message: "Document not found"
        });
      }
      
      // Check access permission
      const hasAccess = await AdmissionDocumentService.checkDocumentAccess(document, userId, role);
      
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }
      
      // Get signed URL from file service
      const signedUrl = await FileService.getSignedUrl(document.fileId._id, 3600);
      
      // Redirect to signed URL
      res.redirect(signedUrl);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check document verification status
   */
  static async checkVerificationStatus(req, res, next) {
    try {
      const { applicationId } = req.params;
      
      const status = await AdmissionDocumentService.areAllDocumentsVerified(applicationId);
      
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AdmissionDocumentController;