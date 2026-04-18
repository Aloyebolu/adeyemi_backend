import mongoose from "mongoose";
import { AUDIT_ACTIONS } from "#domain/admission/constants/admission.constants.js";
import AdmissionApplication from "#domain/admission/models/admissionApplication.model.js";
import AdmissionAcceptance from "#domain/admission/models/admissionAcceptance.model.js";
import AdmissionDocument from "#domain/admission/models/admissionDocument.model.js";
import FileService from "#domain/files/files.service.js";

export class AdmissionAcceptanceService {
  /**
   * Record admission acceptance by applicant
   */
  static async recordAcceptance(acceptanceData, userId, userRole) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const { admissionApplicationId, accepted, acceptanceFeeReference } = acceptanceData;
      
      // Get application
      const application = await AdmissionApplication
        .findById(admissionApplicationId)
        .session(session);
      
      if (!application) {
        throw new Error("Application not found");
      }
      
      if (application.status !== "admitted") {
        throw new Error("Only admitted applications can be accepted");
      }
      
      // Check if acceptance already exists
      const existingAcceptance = await AdmissionAcceptance.findOne({
        admissionApplicationId
      }).session(session);
      
      if (existingAcceptance) {
        throw new Error("Acceptance already recorded");
      }
      
      // Verify all documents are verified
      const docsVerified = await AdmissionDocumentService.areAllDocumentsVerified(admissionApplicationId);
      if (!docsVerified.allVerified) {
        throw new Error(`Missing verified documents: ${docsVerified.missing.join(", ")}`);
      }
      
      // Create acceptance record
      const acceptance = new AdmissionAcceptance({
        admissionApplicationId,
        accepted,
        acceptedAt: accepted ? new Date() : null
      });
      
      await acceptance.save({ session });
      
      // Update application metadata with acceptance fee reference
      if (acceptanceFeeReference) {
        application.metadata = {
          ...application.metadata,
          acceptanceFee: {
            reference: acceptanceFeeReference,
            paidAt: new Date(),
            verified: false // Will be verified by payment webhook
          }
        };
        await application.save({ session });
      }
      
      // If accepted, generate admission letter
      let admissionLetter = null;
      if (accepted) {
        admissionLetter = await this.generateAdmissionLetter(application, userId, session);
      }
      
      // Create audit context
      const auditContext = AdmissionService.createAuditContext(
        AUDIT_ACTIONS.ACCEPTANCE_RECORDED,
        "SUCCESS",
        `Admission ${accepted ? 'accepted' : 'declined'} by applicant`,
        {
          entityId: acceptance._id,
          performedBy: userRole,
          performedByUserId: userId,
          applicantId: application.applicantId,
          admissionApplicationId,
          admissionCycleId: application.admissionCycleId
        },
        {
          before: { acceptance: null },
          after: {
            acceptance: {
              accepted,
              acceptedAt: acceptance.acceptedAt,
              feeReference: acceptanceFeeReference
            }
          }
        }
      );
      
      await session.commitTransaction();
      
      return {
        acceptance,
        admissionLetter,
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
   * Generate admission letter
   */
  static async generateAdmissionLetter(application, userId, session) {
    try {
      // Get applicant details
      const applicant = await mongoose.model("Applicant").findById(application.applicantId);
      
      // Get programme details
      const programme = await mongoose.model("Programme").findById(application.programmeId);
      
      // Get admission decision
      const decision = await mongoose.model("AdmissionDecision").findOne({
        admissionApplicationId: application._id
      });
      
      // Generate letter content
      const letterContent = this.generateLetterContent(applicant, programme, decision, application);
      
      // Create PDF (placeholder - integrate with PDF generation library)
      const pdfBuffer = Buffer.from(letterContent);
      
      // Upload to file service
      const fileName = `admission_letter_${application._id}.pdf`;
      
      const file = await FileService.uploadFile(
        {
          buffer: pdfBuffer,
          originalname: fileName,
          mimetype: 'application/pdf',
          size: pdfBuffer.length
        },
        userId,
        "admissionLetter",
        application._id,
        {
          category: "admission_letter",
          isPublic: false,
          accessRoles: ["admin", "admissionOfficer", "student"],
          tags: ["admission", "letter", "official"],
          customMetadata: {
            applicantId: applicant._id,
            applicationId: application._id,
            programme: programme.name,
            generatedBy: userId,
            generatedAt: new Date()
          }
        }
      );
      
      // Update application metadata with letter reference
      application.metadata = {
        ...application.metadata,
        admissionLetter: {
          fileId: file._id,
          generatedAt: new Date(),
          generatedBy: userId,
          downloadUrl: await FileService.getSignedUrl(file._id, 86400) // 24 hours
        }
      };
      
      await application.save({ session });
      
      // Create audit context for letter generation
      const auditContext = AdmissionService.createAuditContext(
        AUDIT_ACTIONS.ADMISSION_LETTER_GENERATED,
        "SUCCESS",
        "Admission letter generated",
        {
          entityId: application._id,
          performedBy: "system",
          performedByUserId: userId,
          applicantId: applicant._id,
          admissionApplicationId: application._id,
          fileId: file._id
        },
        {
          before: { admissionLetter: null },
          after: { admissionLetter: application.metadata.admissionLetter }
        }
      );
      
      return {
        file,
        content: letterContent,
        auditContext
      };
      
    } catch (error) {
      throw new Error(`Failed to generate admission letter: ${error.message}`);
    }
  }

  /**
   * Generate admission letter content
   */
  static generateLetterContent(applicant, programme, decision, application) {
    const letter = `
      ADMISSION LETTER
      =================
      
      Federal University of Technology
      Office of the Registrar
      
      Date: ${new Date().toLocaleDateString()}
      
      To: ${applicant.firstName} ${applicant.lastName}
      Email: ${applicant.email}
      
      SUBJECT: PROVISIONAL ADMISSION OFFER
      
      Dear ${applicant.firstName},
      
      We are pleased to inform you that you have been offered provisional admission to study:
      
      Programme: ${programme.name}
      Department: ${application.departmentId.name}
      Admission Type: ${application.admissionCycleId.admissionType}
      Academic Session: ${application.admissionCycleId.academicSessionId.name}
      
      Your aggregate score: ${application.score}
      Decision Date: ${decision.decisionDate.toLocaleDateString()}
      
      CONDITIONS OF ADMISSION:
      1. This offer is provisional subject to verification of all documents.
      2. You must accept this offer within 14 days.
      3. Acceptance fee must be paid within the stipulated period.
      4. All original documents must be presented for physical verification during registration.
      
      NEXT STEPS:
      1. Log in to your admission portal to accept this offer.
      2. Pay the acceptance fee as instructed.
      3. Upload additional required documents if any.
      4. Awurther clearance and registration instructions.
      
      Congratulations on your admission!
      
      Yours faithfully,
      
      _______________________
      University Registrar
      Federal University of Technology
    `;
    
    return letter;
  }

  /**
   * Verify acceptance fee payment (webhook integration)
   */
  static async verifyAcceptanceFee(applicationId, paymentData, userId, userRole) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const application = await AdmissionApplication
        .findById(applicationId)
        .session(session);
      
      if (!application) {
        throw new Error("Application not found");
      }
      
      // Verify payment with external service (placeholder)
      const paymentVerified = await this.verifyPaymentWithGateway(paymentData);
      
      if (!paymentVerified) {
        throw new Error("Payment verification failed");
      }
      
      // Update application metadata
      application.metadata = {
        ...application.metadata,
        acceptanceFee: {
          ...application.metadata?.acceptanceFee,
          verified: true,
          verificationDate: new Date(),
          verifiedBy: userId,
          paymentDetails: paymentData
        }
      };
      
      await application.save({ session });
      
      // Create audit context
      const auditContext = AdmissionService.createAuditContext(
        "ACCEPTANCE_FEE_VERIFIED",
        "SUCCESS",
        "Acceptance fee payment verified",
        {
          entityId: application._id,
          performedBy: userRole,
          performedByUserId: userId,
          applicantId: application.applicantId,
          admissionApplicationId: applicationId,
          paymentReference: paymentData.reference
        },
        {
          before: { acceptanceFee: { verified: false } },
          after: { acceptanceFee: application.metadata.acceptanceFee }
        }
      );
      
      await session.commitTransaction();
      
      return {
        application,
        paymentVerified: true,
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
   * Verify payment with payment gateway (placeholder)
   */
  static async verifyPaymentWithGateway(paymentData) {
    // Integrate with Flutterwave, Paystack, etc.
    // This is a placeholder implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(paymentData.reference && paymentData.amount > 0);
      }, 1000);
    });
  }

  /**
   * Get acceptance status for application
   */
  static async getAcceptanceStatus(admissionApplicationId) {
    const acceptance = await AdmissionAcceptance.findOne({ admissionApplicationId });
    
    if (!acceptance) {
      return {
        hasAccepted: false,
        status: "pending",
        message: "Admission not yet accepted"
      };
    }
    
    const application = await AdmissionApplication.findById(admissionApplicationId);
    
    const status = {
      hasAccepted: true,
      accepted: acceptance.accepted,
      acceptedAt: acceptance.acceptedAt,
      feeStatus: application.metadata?.acceptanceFee?.verified ? "paid" : "pending",
      admissionLetter: application.metadata?.admissionLetter ? {
        generated: true,
        downloadUrl: application.metadata.admissionLetter.downloadUrl,
        generatedAt: application.metadata.admissionLetter.generatedAt
      } : null,
      nextSteps: this.getAcceptanceNextSteps(acceptance, application)
    };
    
    return status;
  }

  /**
   * Determine next steps after acceptance
   */
  static getAcceptanceNextSteps(acceptance, application) {
    const steps = [];
    
    if (acceptance.accepted) {
      if (!application.metadata?.acceptanceFee?.verified) {
        steps.push("PAY_ACCEPTANCE_FEE");
      }
      
      if (!application.metadata?.admissionLetter) {
        steps.push("GENERATE_ADMISSION_LETTER");
      }
      
      if (steps.length === 0) {
        steps.push("AWAITING_REGISTRATION");
      }
    } else {
      steps.push("ADMISSION_DECLINED");
    }
    
    return steps;
  }
}

export default AdmissionAcceptanceService;