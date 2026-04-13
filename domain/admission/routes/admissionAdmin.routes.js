import express from "express";
import { AdmissionController } from "../controllers/admission.controller.js";
import { AdmissionDocumentController } from "../controllers/admissionDocument.controller.js";
import { AdmissionAcceptanceController } from "../controllers/admissionAcceptance.controller.js";
import * as admissionValidators from "../validators/admission.validator.js";
import * as documentValidators from "../validators/admissionDocument.validator.js";
import validate from "../../../middlewares/validate.js";
import authenticate from "../../../middlewares/authenticate.js";

const router = express.Router();

// Admin routes (authenticated staff only)
router.use(authenticate(["admin", "admissionOfficer", "reviewer"]));

// Review queue
router.get("/review-queue",
  validate(admissionValidators.validateApplicationFilters, "query"),
  AdmissionController.getAdminReviewQueue
);

// Application actions
router.post("/applications/:applicationId/submit",
  validate(admissionValidators.validateApplicationSubmission, "params"),
  AdmissionController.submitApplication
);

router.post("/applications/:applicationId/schedule-post-utme",
  validate(admissionValidators.validateApplicationId, "params"),
  validate(admissionValidators.validatePostUTMESchedule, "body"),
  AdmissionController.schedulePostUTME
);

router.post("/applications/:applicationId/record-post-utme-score",
  validate(admissionValidators.validateApplicationId, "params"),
  validate(admissionValidators.validatePostUTMEScore, "body"),
  AdmissionController.recordPostUTMEScore
);

router.post("/applications/decide",
  validate(admissionValidators.validateAdmissionDecision, "body"),
  AdmissionController.makeAdmissionDecision
);

// Document management
router.get("/documents/review",
  validate(documentValidators.validateDocumentFilters, "query"),
  AdmissionDocumentController.getDocumentsForReview
);

router.post("/documents/:documentId/verify",
  validate(documentValidators.validateDocumentId, "params"),
  validate(documentValidators.validateDocumentVerification, "body"),
  AdmissionDocumentController.verifyDocument
);

// Acceptance fee verification
router.post("/applications/:applicationId/verify-fee",
  validate(admissionValidators.validateApplicationId, "params"),
  AdmissionAcceptanceController.verifyAcceptanceFee
);

// Regenerate admission letter
router.post("/applications/:applicationId/regenerate-letter",
  validate(admissionValidators.validateApplicationId, "params"),
  AdmissionAcceptanceController.regenerateAdmissionLetter
);

// Statistics
router.get("/statistics/:admissionCycleId",
  validate(admissionValidators.validateAdmissionCycleId, "params"),
  AdmissionController.getApplicationStatistics
);

export const adminAdmissionRoutes = router;