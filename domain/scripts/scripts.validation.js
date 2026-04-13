import { body } from 'express-validator';

/**
 * Validation rules for script execution
 */
export const runScriptValidation = [
  body('script')
    .notEmpty()
    .withMessage('Script name is required')
    .isString()
    .withMessage('Script name must be a string')
    .matches(/^[a-zA-Z0-9-]+$/)
    .withMessage('Script name can only contain letters, numbers, and hyphens'),
  
  body('params')
    .optional()
    .isObject()
    .withMessage('Params must be an object')
];

/**
 * Validation rules for listing scripts
 */
export const listScriptsValidation = [];