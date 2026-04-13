import Joi from "joi";

export const validateApplicationSubmission = Joi.object({
  applicationId: Joi.string().hex().length(24).required()
    .messages({
      "string.hex": "Invalid application ID format",
      "string.length": "Application ID must be 24 characters",
      "any.required": "Application ID is required"
    })
});

export const validatePostUTMESchedule = Joi.object({
  applicationId: Joi.string().hex().length(24).required(),
  date: Joi.date().greater("now").required()
    .messages({
      "date.greater": "Schedule date must be in the future"
    }),
  venue: Joi.string().min(5).max(200).required(),
  time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    .messages({
      "string.pattern.base": "Time must be in HH:MM format"
    })
});

export const validatePostUTMEScore = Joi.object({
  applicationId: Joi.string().hex().length(24).required(),
  score: Joi.number().min(0).max(100).required()
    .messages({
      "number.min": "Score cannot be negative",
      "number.max": "Score cannot exceed 100"
    }),
  remarks: Joi.string().max(500).optional()
});

export const validateAdmissionDecision = Joi.object({
  applicationId: Joi.string().hex().length(24).required(),
  decision: Joi.string().valid("admitted", "rejected", "waitlisted").required(),
  notes: Joi.string().max(1000).optional()
});

export const validateApplicationFilters = Joi.object({
  status: Joi.string().valid(
    "draft", "submitted", "underReview", "postUTMEScheduled",
    "postUTMEScoreReceived", "aggregateCalculated", "admitted",
    "rejected", "waitlisted"
  ).optional(),
  admissionCycleId: Joi.string().hex().length(24).optional(),
  departmentId: Joi.string().hex().length(24).optional(),
  programmeId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});