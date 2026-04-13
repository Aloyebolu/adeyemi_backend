/**
 * Admission Domain Main Export
 */
export { AdmissionService } from "./services/admission.service.js";
export { AdmissionDocumentService } from "./services/admissionDocument.service.js";
export { AdmissionAcceptanceService } from "./services/admissionAcceptance.service.js";
export { AdmissionValidationService } from "./services/admissionValidation.service.js";

export { AdmissionController } from "./controllers/admission.controller.js";
export { AdmissionDocumentController } from "./controllers/admissionDocument.controller.js";
export { AdmissionAcceptanceController } from "./controllers/admissionAcceptance.controller.js";

export { applicantAdmissionRoutes, adminAdmissionRoutes } from "./routes/index.js";

export * from "./constants/admission.constants.js";