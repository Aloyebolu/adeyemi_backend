// Add security middleware and validation functions at the top
import { Types } from 'mongoose';
import validator from 'validator';

// Security helpers
export const securityUtils = {
  // Validate MongoDB ObjectId
  isValidObjectId: (id) => {
    if (!id) return false;
    return Types.ObjectId.isValid(id) && 
           (new Types.ObjectId(id)).toString() === id;
  },

  // Sanitize search term to prevent ReDoS
  sanitizeSearchTerm: (term, maxLength = 100) => {
    if (!term || typeof term !== 'string') return '';
    const trimmed = term.trim().slice(0, maxLength);
    // Escape regex special characters
    return trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  // Validate export filename to prevent path traversal
  sanitizeFileName: (fileName) => {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Prevent directory traversal
    if (safeName.includes('..') || safeName.includes('/') || safeName.includes('\\')) {
      return `export_${Date.now()}`;
    }
    return safeName;
  },

  // Sanitize query parameters
  sanitizeQueryParams: (params) => {
    const sanitized = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        sanitized[key] = validator.escape(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(v => 
          typeof v === 'string' ? validator.escape(v) : v
        );
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
};