/**
 * Utility functions for file handling across the application
 */

import AppError from "../errors/AppError.js";


class FileUtils {
  /**
   * Generate file upload options for a specific domain
   */
  static getUploadOptions(domain, options = {}) {
    const defaultOptions = {
      maxSize: 10 * 1024 * 1024, // 10MB default
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
      isPublic: true,
      category: domain,
    };

    // Domain-specific overrides
    const domainConfigs = {
      user: {
        maxSize: 5 * 1024 * 1024, // 5MB for user avatars
        allowedTypes: ['image/jpeg', 'image/png'],
        category: 'avatar',
      },
      course: {
        maxSize: 50 * 1024 * 1024, // 50MB for course materials
        allowedTypes: ['application/pdf', 'video/mp4', 'image/*'],
        category: 'course_material',
      },
      product: {
        maxSize: 20 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        category: 'product_image',
      },
      // Feedback domain
      feedback: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/json',
          'text/csv'
        ],
        category: 'feedback_attachment',
        isPublic: false,
        allowedRoles: ['admin', 'customer_service', 'feedback_manager'],
        description: 'Feedback system attachments'
      },

      // Feedback response attachments
      feedbackResponse: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        category: 'response_attachment',
        isPublic: false,
        allowedRoles: ['admin', 'customer_service', 'feedback_manager'],
        description: 'Feedback response attachments'
      }
    };

    return { ...defaultOptions, ...domainConfigs[domain], ...options };
  }

  /**
   * Validate file before upload
   */
  static validateFile(file, options) {
    if (!file) {
      throw new AppError('No file provided');
    }

    if (file.size > options.maxSize) {
      throw new AppError(`File size exceeds limit of ${options.maxSize / (1024 * 1024)}MB`);
    }

    if (!options.allowedTypes.includes(file.mimetype) &&
      !options.allowedTypes.some(type => type.endsWith('/*') &&
        file.mimetype.startsWith(type.replace('/*', '')))) {
      throw new AppError(`File type ${file.mimetype} not allowed`);
    }

    return true;
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Extract metadata from request for file upload
   */
  static extractMetadata(req, domain) {
    const metadata = {
      category: req.body.category || domain,
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
      isPublic: req.body.isPublic !== 'false',
      accessRoles: req.body.accessRoles ? JSON.parse(req.body.accessRoles) : [],
      customMetadata: {}
    };

    // Add any additional metadata fields
    const metaFields = ['description', 'title', 'altText'];
    metaFields.forEach(field => {
      if (req.body[field]) {
        metadata.customMetadata[field] = req.body[field];
      }
    });

    return metadata;
  }
}

export default FileUtils;