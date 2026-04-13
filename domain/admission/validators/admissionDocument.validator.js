import Joi from "joi";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUS, REJECTION_REASONS } from "../constants/admission.constants.js";

export const validateDocumentUpload = Joi.object({
  admissionApplicationId: Joi.string().hex().length(24).required(),
  category: Joi.string().valid(...Object.values(DOCUMENT_CATEGORIES)).required(),
  metadata: Joi.object().optional()
});

export const validateDocumentVerification = Joi.object({
  documentId: Joi.string().hex().length(24).required(),
  isVerified: Joi.boolean().required(),
  score: Joi.when("isVerified", {
    is: true,
    then: Joi.number().min(0).max(1).required(),
    otherwise: Joi.optional()
  }),
  remarks: Joi.string().max(500).optional(),
  rejectionReason: Joi.when("isVerified", {
    is: false,
    then: Joi.string().valid(...Object.values(REJECTION_REASONS)).required(),
    otherwise: Joi.optional()
  }),
  rejectionNotes: Joi.when("isVerified", {
    is: false,
    then: Joi.string().max(500).optional(),
    otherwise: Joi.optional()
  })
});

export const validateDocumentFilters = Joi.object({
  category: Joi.string().valid(...Object.values(DOCUMENT_CATEGORIES)).optional(),
  status: Joi.string().valid(...Object.values(DOCUMENT_STATUS)).optional(),
  admissionCycleId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});