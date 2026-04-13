import Joi from "joi";

export const validateAcceptance = Joi.object({
  admissionApplicationId: Joi.string().hex().length(24).required(),
  accepted: Joi.boolean().required(),
  acceptanceFeeReference: Joi.when("accepted", {
    is: true,
    then: Joi.string().min(10).max(100).required()
      .messages({
        "any.required": "Acceptance fee reference is required when accepting admission"
      }),
    otherwise: Joi.optional()
  })
});

export const validateFeeVerification = Joi.object({
  applicationId: Joi.string().hex().length(24).required(),
  reference: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid("NGN", "USD", "EUR").default("NGN"),
  paymentMethod: Joi.string().valid("card", "bank_transfer", "ussd", "mobile_money").optional(),
  paymentDate: Joi.date().required()
});