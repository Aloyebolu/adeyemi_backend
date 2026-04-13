export const DOCUMENT_STATUS = {
  NOT_STARTED: 'notStarted',
  UPLOADED: 'uploaded',
  UNDER_REVIEW: 'underReview',
  VERIFIED: 'verified',
  REJECTED: 'rejected'
};

export const DOCUMENT_REJECTION_REASONS = {
  BLURRY: 'blurry',
  INCOMPLETE: 'incomplete',
  EXPIRED: 'expired',
  FAKE: 'fake',
  WRONG_DOCUMENT: 'wrongDocument',
  OTHER: 'other'
};

export const DOCUMENT_VERIFICATION_SCORE = {
  MINIMUM_REQUIRED: 0.7,
  AUTOMATIC_VERIFICATION_THRESHOLD: 0.9
};

export const MAX_DOCUMENT_SIZE_MB = 5;
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg'
];