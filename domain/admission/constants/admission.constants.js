/**
 * Admission Domain Constants
 * camelCase only, no underscores
 */

export const APPLICATION_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "underReview",
  POST_UTME_SCHEDULED: "postUTMEScheduled",
  POST_UTME_SCORE_RECEIVED: "postUTMEScoreReceived",
  AGGREGATE_CALCULATED: "aggregateCalculated",
  ADMITTED: "admitted",
  REJECTED: "rejected",
  WAITLISTED: "waitlisted"
};

export const DOCUMENT_CATEGORIES = {
  JAMB_RESULT: "jambResult",
  O_LEVEL_RESULT: "oLevelResult",
  BIRTH_CERTIFICATE: "birthCertificate",
  REFERENCE_LETTER: "referenceLetter",
  LOCAL_GOVERNMENT_IDENTIFICATION: "localGovernmentIdentification",
  PASSPORT_PHOTOGRAPH: "passportPhotograph",
  POST_UTME_RESULT: "postUTMEResult"
};

export const DOCUMENT_STATUS = {
  NOT_STARTED: "notStarted",
  UPLOADED: "uploaded",
  UNDER_REVIEW: "underReview",
  VERIFIED: "verified",
  REJECTED: "rejected"
};

export const REJECTION_REASONS = {
  BLURRY: "blurry",
  INCOMPLETE: "incomplete",
  EXPIRED: "expired",
  FAKE: "fake",
  WRONG_DOCUMENT: "wrongDocument",
  OTHER: "other"
};

export const ADMISSION_TYPES = {
  UTME: "utme",
  DIRECT_ENTRY: "directEntry",
  POSTGRADUATE: "postgraduate"
};

export const AUDIT_ACTIONS = {
  APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED",
  DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED",
  DOCUMENT_VERIFIED: "DOCUMENT_VERIFIED",
  DOCUMENT_REJECTED: "DOCUMENT_REJECTED",
  POST_UTME_SCHEDULED: "POST_UTME_SCHEDULED",
  POST_UTME_SCORE_RECORDED: "POST_UTME_SCORE_RECORDED",
  AGGREGATE_CALCULATED: "AGGREGATE_CALCULATED",
  ADMISSION_DECIDED: "ADMISSION_DECIDED",
  ACCEPTANCE_RECORDED: "ACCEPTANCE_RECORDED",
  ADMISSION_LETTER_GENERATED: "ADMISSION_LETTER_GENERATED"
};

export const NOTIFICATION_TYPES = {
  DOCUMENT_UPLOADED: "documentUploaded",
  DOCUMENT_VERIFIED: "documentVerified",
  DOCUMENT_REJECTED: "documentRejected",
  POST_UTME_SCHEDULED: "postUTMEScheduled",
  ADMISSION_DECIDED: "admissionDecided",
  ACCEPTANCE_REQUIRED: "acceptanceRequired",
  PAYMENT_REQUIRED: "paymentRequired"
};

export const AGGREGATE_WEIGHTS = {
  JAMB: 0.6,      // 60% of aggregate
  POST_UTME: 0.4  // 40% of aggregate
};