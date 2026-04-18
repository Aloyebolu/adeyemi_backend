import mongoose from "mongoose";
import { DOCUMENT_STATUS, AUDIT_ACTIONS, DOCUMENT_CATEGORIES } from "#domain/admission/constants/admission.constants.js";
import AdmissionDocument from "#domain/admission/models/admissionDocument.model.js";
import FileService from "#domain/files/files.service.js";
import FileUtils from "#domain/files/file.utils.js";

export class AdmissionDocumentService {
  /**
   * Upload admission document
   */
  static async uploadDocument(uploadData, file, userId, userRole) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const { admissionApplicationId, category, metadata = {} } = uploadData;
      
      // Validate category
      if (!Object.values(DOCUMENT_CATEGORIES).includes(category)) {
        throw new Error(`Invalid document category: ${category}`);
      }
      
      // Check if document already exists
      let document = await AdmissionDocument.findOne({
        admissionApplicationId,
        category
      }).session(session);
      
      if (!document) {
        // Create new document record
        document = new AdmissionDocument({
          admissionApplicationId,
          category,
          status: DOCUMENT_STATUS.UPLOADED,
          metadata: new Map(Object.entries(metadata))
        });
      } else {
        // Update existing document
        if (document.status === DOCUMENT_STATUS.VERIFIED) {
          throw new Error("Cannot modify verified document");
        }
        
        document.status = DOCUMENT_STATUS.UPLOADED;
        metadata.forEach((value, key) => {
          document.metadata.set(key, value);
        });
      }
      
      // Validate file using FileUtils
      const uploadOptions = FileUtils.getUploadOptions("admissionDocument");
      FileUtils.validateFile(file, uploadOptions);
      
      // Extract OCR metadata if possible
      const ocrMetadata = await this.extractDocumentMetadata(file, category);
      
      // Merge metadata
      const finalMetadata = {
        ...metadata,
        ...ocrMetadata,
        uploadedBy: userId,
        uploadedAt: new Date(),
        category,
        originalFilename: file.originalname
      };
      
      // Upload to file service
      const uploadedFile = await FileService.uploadFile(
        file,
        userId,
        "admissionDocument",
        document._id,
        {
          category: `admission_${category}`,
          isPublic: false,
          accessRoles: ["admin", "admissionOfficer"],
          tags: ["admission", category],
          customMetadata: finalMetadata
        }
      );
      
      // Update document with file reference
      document.fileId = uploadedFile._id;
      document.uploadedAt = new Date();
      document.uploadAttempts += 1;
      document.lastUploadedAt = new Date();
      
      // Auto-verify certain document types with basic checks
      const autoVerificationResult = await this.performAutoVerification(document, uploadedFile);
      
      if (autoVerificationResult.passed) {
        document.status = DOCUMENT_STATUS.VERIFIED;
        document.verificationScore = autoVerificationResult.score;
        document.metadata.set("autoVerified", true);
        document.metadata.set("verificationDetails", autoVerificationResult.details);
      } else {
        document.status = DOCUMENT_STATUS.UNDER_REVIEW;
        document.metadata.set("verificationDetails", autoVerificationResult.details);
        document.metadata.set("needsManualReview", true);
        document.metadata.set("reviewReasons", autoVerificationResult.reasons);
      }
      
      await document.save({ session });
      
      // Create audit context
      const auditContext = AdmissionService.createAuditContext(
        AUDIT_ACTIONS.DOCUMENT_UPLOADED,
        "SUCCESS",
        `Document ${category} uploaded${autoVerificationResult.passed ? ' and auto-verified' : ''}`,
        {
          entityId: document._id,
          performedBy: userRole,
          performedByUserId: userId,
          admissionApplicationId,
          documentCategory: category,
          fileId: uploadedFile._id
        },
        {
          before: document._id ? {
            status: document.status,
            uploadAttempts: document.uploadAttempts - 1
          } : null,
          after: {
            status: document.status,
            fileId: uploadedFile._id,
            uploadAttempts: document.uploadAttempts,
            uploadedAt: document.uploadedAt,
            verificationScore: document.verificationScore
          }
        }
      );
      
      await session.commitTransaction();
      
      return {
        document,
        file: uploadedFile,
        autoVerification: autoVerificationResult,
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
   * Perform automatic verification on uploaded document
   */
  static async performAutoVerification(document, file) {
    const result = {
      passed: false,
      score: 0,
      details: {},
      reasons: []
    };
    
    try {
      let score = 0;
      let totalChecks = 0;
      const details = {};
      
      // Check 1: File type validity
      totalChecks++;
      const validTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
      if (validTypes.includes(file.type)) {
        score++;
        details.fileType = "valid";
      } else {
        details.fileType = "invalid";
        result.reasons.push("Invalid file type");
      }
      
      // Check 2: File size (max 5MB)
      totalChecks++;
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size <= maxSize) {
        score++;
        details.fileSize = "within_limit";
      } else {
        details.fileSize = "exceeds_limit";
        result.reasons.push("File size exceeds limit");
      }
      
      // Check 3: File not corrupted (basic check)
      totalChecks++;
      if (file.size > 100) { // Basic corruption check
        score++;
        details.integrity = "ok";
      } else {
        details.integrity = "suspicious";
        result.reasons.push("File appears to be corrupted or empty");
      }
      
      // Category-specific checks
      totalChecks++;
      const categoryChecks = await this.performCategorySpecificChecks(document.category, file);
      if (categoryChecks.passed) {
        score++;
        details.categoryChecks = categoryChecks.details;
      } else {
        details.categoryChecks = categoryChecks.details;
        result.reasons.push(...categoryChecks.reasons);
      }
      
      // Calculate final score
      result.score = score / totalChecks;
      result.details = details;
      result.passed = result.score >= 0.8; // 80% threshold for auto-verification
      
      if (!result.passed && result.reasons.length === 0) {
        result.reasons.push("Failed automatic verification checks");
      }
      
    } catch (error) {
      result.details.error = error.message;
      result.reasons.push("Error during automatic verification");
    }
    
    return result;
  }

  /**
   * Perform category-specific verification checks
   */
  static async performCategorySpecificChecks(category, file) {
    const result = {
      passed: false,
      details: {},
      reasons: []
    };
    
    switch (category) {
      case DOCUMENT_CATEGORIES.JAMB_RESULT:
        // Check for JAMB-specific patterns
        result.details.check = "jamb_pattern_check";
        // In production: Use OCR to extract JAMB score, reg number, etc.
        result.passed = true; // Placeholder
        break;
        
      case DOCUMENT_CATEGORIES.O_LEVEL_RESULT:
        result.details.check = "olevel_pattern_check";
        // Check for WAEC/NECO headers, candidate number, etc.
        result.passed = true;
        break;
        
      case DOCUMENT_CATEGORIES.PASSPORT_PHOTOGRAPH:
        result.details.check = "photo_validation";
        // Check image dimensions, aspect ratio, etc.
        if (file.type.startsWith("image/")) {
          result.passed = true;
          result.details.isImage = true;
        } else {
          result.reasons.push("Passport must be an image file");
        }
        break;
        
      default:
        result.passed = true;
        result.details.check = "generic_check";
    }
    
    return result;
  }

  /**
   * Extract metadata from document using OCR
   */
  static async extractDocumentMetadata(file, category) {
    const metadata = {};
    
    // This is a placeholder for OCR integration
    // In production, integrate with Tesseract.js, Google Vision, etc.
    
    if (category === DOCUMENT_CATEGORIES.JAMB_RESULT) {
      metadata.documentType = "JAMB Result Slip";
      metadata.extractionMethod = "placeholder";
    } else if (category === DOCUMENT_CATEGORIES.O_LEVEL_RESULT) {
      metadata.documentType = "O'Level Result";
      metadata.examinationBody = file.originalname.includes("WAEC") ? "WAEC" : "NECO";
      metadata.extractionMethod = "placeholder";
    }
    
    return metadata;
  }

  /**
   * Verify document (manual review)
   */
  static async verifyDocument(documentId, verificationData, userId, userRole) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const { isVerified, score, remarks } = verificationData;
      
      const document = await AdmissionDocument
        .findById(documentId)
        .session(session);
      
      if (!document) {
        throw new Error("Document not found");
      }
      
      if (document.status === DOCUMENT_STATUS.VERIFIED) {
        throw new Error("Document already verified");
      }
      
      const previousStatus = document.status;
      
      if (isVerified) {
        document.status = DOCUMENT_STATUS.VERIFIED;
        document.verifiedAt = new Date();
        document.verifiedBy = userId;
        document.verificationScore = score || 1.0;
        document.metadata.set("manualVerification", true);
        document.metadata.set("verifiedBy", userId);
        document.metadata.set("verificationRemarks", remarks);
      } else {
        document.status = DOCUMENT_STATUS.REJECTED;
        document.rejectionReason = verificationData.rejectionReason;
        document.rejectionNotes = verificationData.rejectionNotes;
        document.metadata.set("rejectedBy", userId);
        document.metadata.set("rejectionDetails", verificationData);
      }
      
      await document.save({ session });
      
      // Create audit context
      const auditAction = isVerified ? 
        AUDIT_ACTIONS.DOCUMENT_VERIFIED : 
        AUDIT_ACTIONS.DOCUMENT_REJECTED;
      
      const auditMessage = isVerified ?
        `Document ${document.category} verified` :
        `Document ${document.category} rejected: ${verificationData.rejectionReason}`;
      
      const auditContext = AdmissionService.createAuditContext(
        auditAction,
        "SUCCESS",
        auditMessage,
        {
          entityId: document._id,
          performedBy: userRole,
          performedByUserId: userId,
          admissionApplicationId: document.admissionApplicationId,
          documentCategory: document.category
        },
        {
          before: { status: previousStatus },
          after: {
            status: document.status,
            verifiedAt: document.verifiedAt,
            verifiedBy: document.verifiedBy,
            verificationScore: document.verificationScore,
            rejectionReason: document.rejectionReason
          }
        }
      );
      
      await session.commitTransaction();
      
      return {
        document,
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
   * Get documents for an application
   */
  static async getApplicationDocuments(admissionApplicationId, includeFileUrls = false) {
    const documents = await AdmissionDocument.find({ admissionApplicationId })
      .sort({ category: 1, createdAt: -1 });
    
    if (includeFileUrls) {
      const documentsWithUrls = await Promise.all(
        documents.map(async (doc) => {
          const documentObj = doc.toObject();
          
          if (doc.fileId) {
            try {
              // Get signed URL for private files
              const signedUrl = await FileService.getSignedUrl(doc.fileId, 3600); // 1 hour
              documentObj.fileUrl = signedUrl;
            } catch (error) {
              documentObj.fileUrl = null;
              documentObj.fileError = error.message;
            }
          }
          
          return documentObj;
        })
      );
      
      return documentsWithUrls;
    }
    
    return documents;
  }

  /**
   * Get documents requiring manual review
   */
  static async getDocumentsForReview(filters = {}) {
    const {
      category,
      admissionCycleId,
      page = 1,
      limit = 20
    } = filters;
    
    const query = {
      status: DOCUMENT_STATUS.UNDER_REVIEW
    };
    
    if (category) {
      query.category = category;
    }
    
    if (admissionCycleId) {
      // Join with applications to filter by admission cycle
      const applications = await AdmissionApplication.find({
        admissionCycleId
      }).select("_id");
      
      const applicationIds = applications.map(app => app._id);
      query.admissionApplicationId = { $in: applicationIds };
    }
    
    const skip = (page - 1) * limit;
    
    const documents = await AdmissionDocument.find(query)
      .populate({
        path: "admissionApplicationId",
        populate: [
          { path: "applicantId" },
          { path: "admissionCycleId" },
          { path: "programmeId" }
        ]
      })
      .skip(skip)
      .limit(limit)
      .sort({ uploadedAt: 1 }); // Oldest first
    
    const total = await AdmissionDocument.countDocuments(query);
    
    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Check if all required documents are verified
   */
  static async areAllDocumentsVerified(admissionApplicationId) {
    const requiredCategories = [
      DOCUMENT_CATEGORIES.JAMB_RESULT,
      DOCUMENT_CATEGORIES.O_LEVEL_RESULT,
      DOCUMENT_CATEGORIES.BIRTH_CERTIFICATE,
      DOCUMENT_CATEGORIES.PASSPORT_PHOTOGRAPH
    ];
    
    const documents = await AdmissionDocument.find({
      admissionApplicationId,
      category: { $in: requiredCategories }
    });
    
    const verifiedDocs = documents.filter(doc => doc.status === DOCUMENT_STATUS.VERIFIED);
    
    return {
      allVerified: verifiedDocs.length === requiredCategories.length,
      verified: verifiedDocs.length,
      required: requiredCategories.length,
      missing: requiredCategories.filter(cat => 
        !documents.some(doc => doc.category === cat && doc.status === DOCUMENT_STATUS.VERIFIED)
      )
    };
  }
}

export default AdmissionDocumentService;