import express from "express";
import { AdmissionController } from "#domain/admission/controllers/admission.controller.js";
import { AdmissionDocumentController } from "#domain/admission/controllers/admissionDocument.controller.js";
import { AdmissionAcceptanceController } from "#domain/admission/controllers/admissionAcceptance.controller.js";
// import { authenticate, authorize } from "../../middleware/auth.js";
// import { upload } from "../../files/middleware/upload.js";
import * as admissionValidators from "#domain/admission/validators/admission.validator.js";
import * as documentValidators from "#domain/admission/validators/admissionDocument.validator.js";
import * as acceptanceValidators from "#domain/admission/validators/admissionAcceptance.validator.js";
import validate from "#middlewares/validate.js";
import authenticate from "#middlewares/authenticate.js";

const router = express.Router();

// Applicant routes (authenticated applicants only)
router.use(authenticate);
router.use(authenticate(["applicant"]));

// Dashboard
router.get("/dashboard", AdmissionController.getApplicantDashboard);

// Application status
router.get("/applications/:applicationId", 
  validate(admissionValidators.validateApplicationId, "params"),
  AdmissionController.getApplicationDetails
);

// Document upload
// router.post("/documents/upload",
//   upload.single("file"),
//   validate(documentValidators.validateDocumentUpload, "body"),
//   AdmissionDocumentController.uploadDocument
// );

// Get application documents
router.get("/applications/:applicationId/documents",
  validate(admissionValidators.validateApplicationId, "params"),
  AdmissionDocumentController.getApplicationDocuments
);

// Download document
router.get("/documents/:documentId/download",
  validate(documentValidators.validateDocumentId, "params"),
  AdmissionDocumentController.downloadDocument
);

// Check verification status
router.get("/applications/:applicationId/verification-status",
  validate(admissionValidators.validateApplicationId, "params"),
  AdmissionDocumentController.checkVerificationStatus
);

// Admission acceptance
router.post("/acceptance",
  validate(acceptanceValidators.validateAcceptance, "body"),
  AdmissionAcceptanceController.recordAcceptance
);

// Get acceptance status
router.get("/applications/:applicationId/acceptance-status",
  validate(admissionValidators.validateApplicationId, "params"),
  AdmissionAcceptanceController.getAcceptanceStatus
);

// Download admission letter
router.get("/applications/:applicationId/admission-letter",
  validate(admissionValidators.validateApplicationId, "params"),
  AdmissionAcceptanceController.downloadAdmissionLetter
);

export const applicantAdmissionRoutes = router;