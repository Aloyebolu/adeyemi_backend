// studentSuspension.constants.js

//  Suspension Types
export const SUSPENSION_TYPES = Object.freeze({
  PUNISHMENT: "punishment",
  ADMINISTRATIVE: "administrative"
});


//  Suspension Status
export const SUSPENSION_STATUS = Object.freeze({
  ACTIVE: "active",
  LIFTED: "lifted",
  EXPIRED: "expired"
});


//  Suspension Reasons (expand as needed)
export const SUSPENSION_REASONS = Object.freeze({
  NO_REGISTRATION: "NO_REGISTRATION",
  SCHOOL_APPROVED: "SCHOOL_APPROVED",
  DISCIPLINARY: "DISCIPLINARY",
  ACADEMIC: "ACADEMIC"
});


//  Audit Log Messages (VERY IMPORTANT)
export const SUSPENSION_AUDIT = Object.freeze({
  CREATED: "Student suspension created",
  LIFTED: "Student suspension lifted",
  EXPIRED: "Student suspension expired"
});


//  Access Control Messages
export const SUSPENSION_ACCESS = Object.freeze({
  BLOCKED_ADMINISTRATIVE: "Temporarily restricted due to administrative suspension",
  BLOCKED_PUNISHMENT: "Blocked due to disciplinary suspension"
});