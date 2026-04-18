/**
 * Security Utilities Module
 * Provides comprehensive security functions for input validation, sanitization,
 * and protection against common web vulnerabilities.
 * Always study this file and use it to secure sensitive routes and functions
 * It should be use for Webhook Signature Verification, Sanitizing search terms
 * @module securityUtils
 * @version 1.0.0
 */

import { randomBytes, createHash, createHmac, timingSafeEqual, createCipheriv, createDecipheriv } from 'crypto';
import xss from 'xss';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import AppError from '#shared/errors/AppError.js';
import mongoose from 'mongoose';

// ============================================================================
// Input Sanitization Functions
// ============================================================================

/**
 * Sanitizes search terms to prevent NoSQL injection and XSS attacks
 * @param {string} searchTerm - Raw search input from user
 * @returns {string} - Sanitized search term safe for database queries
 */
const sanitizeSearchTerm = (searchTerm) => {
    if (!searchTerm || typeof searchTerm !== 'string') {
        return '';
    }

    // Remove NoSQL operators ($where, $regex, $gt, etc.)
    let sanitized = searchTerm.replace(/\$/g, '');

    // Remove MongoDB operators
    const mongoOperators = [
        'gt', 'gte', 'lt', 'lte', 'ne', 'in', 'nin',
        'or', 'and', 'not', 'nor', 'exists', 'type',
        'regex', 'options', 'text', 'search', 'language'
    ];

    mongoOperators.forEach(op => {
        const regex = new RegExp(`\\b${op}\\s*:`, 'gi');
        sanitized = sanitized.replace(regex, '');
    });

    // Remove SQL injection patterns
    const sqlPatterns = [
        /'\s*OR\s*'1'='1/i,
        /'\s*OR\s*1=1/i,
        /--/g,
        /;/g,
        /\/\*/g,
        /\*\//g,
        /xp_/i,
        /sp_/i,
        /UNION\s+SELECT/i,
        /DROP\s+TABLE/i,
        /DELETE\s+FROM/i,
        /INSERT\s+INTO/i,
        /UPDATE\s+SET/i
    ];

    sqlPatterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
    });

    // Apply XSS sanitization
    sanitized = xss(sanitized, {
        whiteList: {}, // No HTML tags allowed
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style']
    });

    // Escape special regex characters if using in regex queries
    sanitized = sanitized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Trim and limit length
    sanitized = sanitized.trim().substring(0, 100);

    return sanitized;
};



/**
 * Sanitizes HTML content while preserving safe tags
 * @param {string} html - Raw HTML content
 * @param {Object} options - Customization options
 * @returns {string} - Sanitized HTML
 */
const sanitizeHtml = (html, options = {}) => {
    if (!html || typeof html !== 'string') return '';

    const defaultWhiteList = {
        p: ['class', 'style'],
        br: [],
        strong: [],
        em: [],
        u: [],
        ul: [],
        ol: [],
        li: [],
        a: ['href', 'title', 'target'],
        h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
        blockquote: [],
        pre: [],
        code: ['class']
    };

    return xss(html, {
        whiteList: options.whiteList || defaultWhiteList,
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
        css: {
            whiteList: {
                'text-align': /^left|right|center|justify$/,
                'color': /^#[0-9a-fA-F]{3,6}$/,
                'background-color': /^#[0-9a-fA-F]{3,6}$/
            }
        },
        onTagAttr: (tag, name, value) => {
            // Additional security for links
            if (tag === 'a' && name === 'href') {
                if (!value.startsWith('http://') &&
                    !value.startsWith('https://') &&
                    !value.startsWith('mailto:') &&
                    !value.startsWith('/')) {
                    return '';
                }
            }
        }
    });
};

/**
 * Sanitizes file names to prevent path traversal attacks
 * @param {string} filename - Original file name
 * @returns {string} - Safe file name
 */
const sanitizeFilename = (filename) => {
    if (!filename || typeof filename !== 'string') return '';

    // Remove path traversal attempts
    let sanitized = filename.replace(/\.\./g, '');
    sanitized = sanitized.replace(/[\/\\]/g, '');

    // Remove null bytes and control characters
    sanitized = sanitized.replace(/\0/g, '');
    sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f]/g, '');

    // Only allow safe characters
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Prevent double extensions
    const parts = sanitized.split('.');
    if (parts.length > 2) {
        sanitized = `${parts[0]}.${parts[parts.length - 1]}`;
    }

    // Add timestamp to prevent collisions
    const timestamp = Date.now();
    const ext = sanitized.split('.').pop();
    const name = sanitized.substring(0, sanitized.lastIndexOf('.'));

    return `${name}_${timestamp}.${ext}`;
};

/**
 * Sanitizes object for logging (removes sensitive data)
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized object
 */
const sanitizeForLogging = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    const sensitiveFields = [
        'password', 'pass', 'pwd', 'secret', 'token', 'api_key', 'apikey',
        'private_key', 'privatekey', 'access_token', 'refresh_token',
        'credit_card', 'card_number', 'cvv', 'ssn', 'social_security'
    ];

    const sanitized = JSON.parse(JSON.stringify(obj));

    const redact = (obj) => {
        if (!obj || typeof obj !== 'object') return;

        Object.keys(obj).forEach(key => {
            const lowerKey = key.toLowerCase();

            if (sensitiveFields.some(field => lowerKey.includes(field))) {
                obj[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object') {
                redact(obj[key]);
            }
        });
    };

    redact(sanitized);
    return sanitized;
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates and sanitizes IDs (UUID, MongoID, or integer)
 * @param {string} id - ID to validate
 * @returns {boolean} - Whether ID is valid
 */
const isValidId = (id) => {
    if (!id || typeof id !== 'string') return false;

    // Check for UUID
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // Check for MongoDB ObjectId
    const mongoIdPattern = /^[0-9a-fA-F]{24}$/;

    // Check for integer ID
    const integerPattern = /^\d+$/;

    return uuidPattern.test(id) || mongoIdPattern.test(id) || integerPattern.test(id);
};

/**
 * Validates password strength
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result with score and feedback
 */
const validatePasswordStrength = (password) => {
    if (!password || typeof password !== 'string') {
        return { valid: false, score: 0, feedback: ['Password is required'] };
    }

    const feedback = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
        feedback.push('Password must be at least 8 characters long');
    } else if (password.length >= 12) {
        score += 2;
    } else {
        score += 1;
    }

    // Complexity checks
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Include at least one lowercase letter');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Include at least one uppercase letter');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Include at least one number');

    if (/[^a-zA-Z0-9]/.test(password)) score += 2;
    else feedback.push('Include at least one special character');

    // Common password check (simplified)
    const commonPasswords = ['password', '123456', 'qwerty', 'admin', 'letmein'];
    if (commonPasswords.some(p => password.toLowerCase().includes(p))) {
        score = Math.max(0, score - 3);
        feedback.push('Password is too common or easily guessable');
    }

    // Repeated characters check
    if (/(.)\1{2,}/.test(password)) {
        score -= 1;
        feedback.push('Avoid repeated characters');
    }

    // Sequential characters check
    const sequences = ['abcdefgh', '12345678', 'qwertyui'];
    const lowerPass = password.toLowerCase();
    if (sequences.some(seq => lowerPass.includes(seq))) {
        score -= 1;
        feedback.push('Avoid sequential characters');
    }

    const strength = score >= 6 ? 'strong' : score >= 4 ? 'medium' : 'weak';

    return {
        valid: score >= 4,
        score: Math.max(0, Math.min(8, score)),
        strength,
        feedback: feedback.length > 0 ? feedback : ['Password meets requirements']
    };
};

/**
 * Validates request payload against a schema
 * @param {Object} payload - Request payload
 * @param {Object} schema - Validation schema
 * @returns {Object} - Validation result
 */
const validatePayload = (payload, schema) => {
    const errors = [];
    const sanitized = {};

    if (!payload || typeof payload !== 'object') {
        return { valid: false, errors: ['Invalid payload'], sanitized: {} };
    }

    Object.keys(schema).forEach(field => {
        const rules = schema[field];
        let value = payload[field];

        // Required check
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`${field} is required`);
            return;
        }

        // Skip further validation if field is optional and not provided
        if (!rules.required && (value === undefined || value === null)) {
            return;
        }

        // Type validation and sanitization
        switch (rules.type) {
            case 'string':
                if (typeof value !== 'string') {
                    errors.push(`${field} must be a string`);
                    break;
                }
                value = value.trim();

                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} must not exceed ${rules.maxLength} characters`);
                    value = value.substring(0, rules.maxLength);
                }
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${field} format is invalid`);
                }
                if (rules.enum && !rules.enum.includes(value)) {
                    errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
                }

                // Apply specific sanitization based on field type
                else if (rules.format === 'search') {
                    value = sanitizeSearchTerm(value);
                } else if (rules.format === 'html') {
                    value = sanitizeHtml(value);
                } else {
                    value = xss(value, { whiteList: {} });
                }
                break;

            case 'number':
                value = Number(value);
                if (isNaN(value)) {
                    errors.push(`${field} must be a number`);
                    break;
                }
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`${field} must be at least ${rules.min}`);
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`${field} must not exceed ${rules.max}`);
                }
                break;

            case 'boolean':
                value = Boolean(value);
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    errors.push(`${field} must be an array`);
                    break;
                }
                if (rules.minItems && value.length < rules.minItems) {
                    errors.push(`${field} must contain at least ${rules.minItems} items`);
                }
                if (rules.maxItems && value.length > rules.maxItems) {
                    errors.push(`${field} must not exceed ${rules.maxItems} items`);
                    value = value.slice(0, rules.maxItems);
                }
                break;

            case 'object':
                if (typeof value !== 'object' || value === null) {
                    errors.push(`${field} must be an object`);
                    break;
                }
                break;
        }

        sanitized[field] = value;
    });

    return {
        valid: errors.length === 0,
        errors,
        sanitized
    };
};

// ============================================================================
// Rate Limiting & Brute Force Protection
// ============================================================================

// Rate limiter configurations
const rateLimiters = {
    auth: new RateLimiterMemory({
        points: 5, // 5 attempts
        duration: 60 * 15, // per 15 minutes
        blockDuration: 60 * 30 // block for 30 minutes
    }),

    api: new RateLimiterMemory({
        points: 100,
        duration: 60
    }),

    sensitive: new RateLimiterMemory({
        points: 3,
        duration: 60 * 60,
        blockDuration: 60 * 60 * 2
    })
};

/**
 * Checks rate limit for a specific key and type
 * @param {string} key - Unique identifier (e.g., IP, user ID)
 * @param {string} type - Limiter type ('auth', 'api', 'sensitive')
 * @returns {Promise<Object>} - Rate limit check result
 */
const checkRateLimit = async (key, type = 'api') => {
    try {
        const limiter = rateLimiters[type] || rateLimiters.api;
        await limiter.consume(key);
        return { allowed: true };
    } catch (error) {
        return {
            allowed: false,
            retryAfter: Math.ceil(error.msBeforeNext / 1000),
            points: error.consumedPoints
        };
    }
};

// ============================================================================
// Encryption & Hashing Functions
// ============================================================================

/**
 * Generates a secure random token
 * @param {number} length - Token length in bytes (default: 32)
 * @returns {string} - Hex encoded token
 */
const generateSecureToken = (length = 32) => {
    return randomBytes(length).toString('hex');
};

/**
 * Creates a hash of data using SHA-256
 * @param {string} data - Data to hash
 * @param {string} salt - Optional salt
 * @returns {string} - Hashed data
 */
const hashData = (data, salt = '') => {
    return createHash('sha256')
        .update(data + salt)
        .digest('hex');
};

/**
 * Creates HMAC signature for webhook verification
 * @param {Object|string} payload - Payload to sign
 * @param {string} secret - Secret key
 * @returns {string} - HMAC signature
 */
const createSignature = (payload, secret) => {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return createHmac('sha512', secret)
        .update(data)
        .digest('hex');
};

/**
 * Verifies webhook signature
 * @param {Object|string} payload - Received payload
 * @param {string} signature - Received signature
 * @param {string} secret - Secret key
 * @returns {boolean} - Whether signature is valid
 */
const verifySignature = (payload, signature, secret) => {
    const expectedSignature = createSignature(payload, secret);
    return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
};

/**
 * Encrypts sensitive data (AES-256-GCM)
 * @param {string} text - Text to encrypt
 * @param {string} key - Encryption key (32 bytes)
 * @returns {Object} - Encrypted data with IV and auth tag
 */
const encrypt = (text, key) => {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
};

/**
 * Decrypts sensitive data (AES-256-GCM)
 * @param {Object} data - Encrypted data object
 * @param {string} key - Decryption key (32 bytes)
 * @returns {string} - Decrypted text
 */
const decrypt = (data, key) => {
    const decipher = createDecipheriv(
        'aes-256-gcm',
        Buffer.from(key, 'hex'),
        Buffer.from(data.iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

// ============================================================================
// Security Headers
// ============================================================================

/**
 * Generates security headers for Express responses
 * @returns {Object} - Security headers object
 */
const getSecurityHeaders = () => {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ].join('; '),
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    };
};

// ============================================================================
// Request Security Middleware
// ============================================================================

/**
 * Express middleware to sanitize all request inputs
 */
const sanitizeRequestMiddleware = (req, res, next) => {
    // Sanitize query parameters
    if (req.query) {
        Object.keys(req.query).forEach(key => {
            if (typeof req.query[key] === 'string') {
                req.query[key] = xss(req.query[key].trim(), { whiteList: {} });
            }
        });
    }

    // Sanitize body
    if (req.body && typeof req.body === 'object') {
        const sanitizeObject = (obj) => {
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'string') {
                    // Skip password fields from XSS sanitization (they'll be hashed)
                    if (!key.toLowerCase().includes('password')) {
                        obj[key] = xss(obj[key].trim(), { whiteList: {} });
                    }
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    sanitizeObject(obj[key]);
                }
            });
        };

        sanitizeObject(req.body);
    }

    // Add security headers
    const securityHeaders = getSecurityHeaders();
    Object.keys(securityHeaders).forEach(header => {
        res.setHeader(header, securityHeaders[header]);
    });

    next();
};

/**
 * Express middleware for ID parameter validation
 */
const validateIdMiddleware = (req, res, next) => {
    const idParams = ['id', 'userId', 'studentId', 'courseId', 'applicationId'];

    idParams.forEach(param => {
        if (req.params[param] && !isValidId(req.params[param])) {
            return res.status(400).json({
                error: 'Invalid ID format',
                message: `Parameter ${param} must be a valid identifier`
            });
        }
    });

    next();
};

const isValidObjectId = (objectId, strict = true) => {
    const ids = Array.isArray(objectId) ? objectId : [objectId];
    
    if (!ids.length || !ids.every(id => id && mongoose.Types.ObjectId.isValid(id))) {
        if(strict) console.log(JSON.stringify(objectId))
        if(strict) throw new AppError("Invalid ID provided", 400, {}, { objectId });
        return false;
    }
    return true;
}


// ============================================================================
// Export Module
// ============================================================================

export default {
    // Sanitization
    sanitizeSearchTerm,
    sanitizeHtml,
    sanitizeFilename,
    sanitizeForLogging,

    // Validation
    isValidId,
    validatePasswordStrength,
    validatePayload,
    isValidObjectId,

    // Rate Limiting
    checkRateLimit,
    rateLimiters,

    // Encryption & Security
    generateSecureToken,
    hashData,
    createSignature,
    verifySignature,
    encrypt,
    decrypt,

    // Headers & Middleware
    getSecurityHeaders,
    sanitizeRequestMiddleware,
    validateIdMiddleware,


    // Constants
    SENSITIVE_FIELDS: ['password', 'token', 'secret', 'key', 'authorization']
};