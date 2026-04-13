// domain/announcement/announcement.validation.js
import Joi from 'joi';

// Allowed values for some fields
const categories = ['Academic', 'Financial', 'Event', 'Accommodation'];
const priorities = ['low', 'medium', 'high'];
const audiences = ['all', 'undergraduate', 'postgraduate', 'international', 'domestic'];

// Create Announcement Schema
const createAnnouncementSchema = Joi.object({
    title: Joi.string()
        .max(200)
        .required()
        .messages({
            'string.base': 'title must be a string',
            'string.empty': 'title is required',
            'string.max': 'title cannot exceed 200 characters',
            'any.required': 'title is required'
        }),
    description: Joi.string()
        .max(1000)
        .required()
        .messages({
            'string.base': 'description must be a string',
            'string.empty': 'description is required',
            'string.max': 'description cannot exceed 1000 characters',
            'any.required': 'description is required'
        }),
    content: Joi.string()
        .required()
        .messages({
            'string.empty': 'content is required',
            'any.required': 'content is required'
        }),
    category: Joi.string()
        .valid(...categories)
        .required()
        .messages({
            'any.only': `category must be one of: ${categories.join(', ')}`,
            'any.required': 'category is required'
        }),
    priority: Joi.string()
        .valid(...priorities)
        .default('medium')
        .messages({
            'any.only': `priority must be one of: ${priorities.join(', ')}`
        }),
    image: Joi.string()
        .uri()
        .required()
        .messages({
            'string.uri': 'image must be a valid URL',
            'any.required': 'image is required'
        }),
    expiresAt: Joi.date()
        .greater('now')
        .required()
        .messages({
            'date.base': 'expiresAt must be a valid date',
            'date.greater': 'expiresAt must be in the future',
            'any.required': 'expiresAt is required'
        }),
    targetAudience: Joi.array()
        .items(Joi.string().valid(...audiences))
        .min(1)
        .default(['all'])
        .messages({
            'array.min': 'targetAudience must have at least one value',
            'any.only': `targetAudience items must be one of: ${audiences.join(', ')}`
        }),
    tags: Joi.array()
        .items(Joi.string().trim())
        .default([]),
    isActive: Joi.any()
});

// Update Announcement Schema
const updateAnnouncementSchema = Joi.object({
    title: Joi.string()
        .max(200)
        .messages({ 'string.max': 'title cannot exceed 200 characters' }),
    description: Joi.string()
        .max(1000)
        .messages({ 'string.max': 'description cannot exceed 1000 characters' }),
    content: Joi.string(),
    category: Joi.string()
        .valid(...categories)
        .messages({ 'any.only': `category must be one of: ${categories.join(', ')}` }),
    priority: Joi.string()
        .valid(...priorities)
        .messages({ 'any.only': `priority must be one of: ${priorities.join(', ')}` }),
    image: Joi.string().uri().messages({ 'string.uri': 'image must be a valid URL' }),
    expiresAt: Joi.date().greater('now').messages({ 'date.greater': 'expiresAt must be in the future' }),
    targetAudience: Joi.array()
        .items(Joi.string().valid(...audiences))
        .min(1)
        .messages({ 'array.min': 'targetAudience must have at least one value' }),
    tags: Joi.array().items(Joi.string().trim())
}).min(1); // Must provide at least one field to update

// Export schemas for validate.js middleware
export default {
    createAnnouncement: { body: createAnnouncementSchema },
    updateAnnouncement: {
        body: updateAnnouncementSchema,
        params: Joi.object({
            id: Joi.string()
                .hex()
                .length(24)
                .required()
                .messages({
                    'string.length': 'id must be a 24-character hex string',
                    'any.required': 'id is required'
                })
        })
    }
};
