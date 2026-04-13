# File Module Documentation

## Overview
A production-ready, domain-agnostic file management system with Supabase storage integration, access control, and comprehensive metadata tracking.

## Core Components

### 1. File Model (`files.model.js`)
**Schema Definition:**
```javascript
{
  // Core file info
  name: String,               // Generated unique filename (uuid + extension)
  originalName: String,       // Original filename from upload
  url: String,                // Public URL (for public files only)
  type: String,               // MIME type
  extension: String,          // File extension (.pdf, .jpg, etc.)
  size: Number,              // File size in bytes
  
  // Domain reference system (FLEXIBLE)
  domain: {                  // Context/entity type
    type: String,
    enum: [
      'course', 'user', 'product', 'blog', 'message', 'custom',
      'admission', 'admissionDocument', 'applicant', 'admissionLetter'
      // Add new domains as needed
    ]
  },
  domainId: {               // Reference to specific entity in domain
    type: Schema.Types.ObjectId,
    required: false,
    refPath: 'domain'       // Dynamic reference based on domain field
  },
  
  // Uploader info
  uploadedBy: {             // User who uploaded the file
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  // Security & Access Control
  isPublic: {               // Public/private flag
    type: Boolean,
    default: true
  },
  accessRoles: [{           // Roles that can access (if private)
    type: String           // e.g., ['admin', 'teacher', 'student']
  }],
  accessUsers: [{          // Specific users who can access (if private)
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  
  // Custom metadata
  metadata: {               // Flexible key-value store
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  
  // Categorization
  category: String,         // e.g., 'profile', 'assignment', 'product_image'
  tags: [String],          // Searchable tags
  
  // Storage information
  storagePath: String,      // Path in storage bucket
  bucketName: String,       // Supabase bucket name
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  expiresAt: Date          // Optional auto-expiry
}
```

**Indexes:**
- `{ domain: 1, domainId: 1 }` - Fast domain-based queries
- `{ uploadedBy: 1 }` - User file queries
- `{ createdAt: -1 }` - Recent files
- `{ isPublic: 1 }` - Public/private filtering
- `{ category: 1 }` - Category-based queries
- `{ tags: 1 }` - Tag-based queries

### 2. File Service (`files.service.js`)
**Core Methods:**

#### `uploadFile(file, uploadedBy, domain, domainId, metadata)`
```javascript
// Parameters:
// - file: File object (from multer/express-fileupload)
// - uploadedBy: User ID who uploaded
// - domain: Domain context (e.g., 'admission', 'user')
// - domainId: Optional reference to domain entity
// - metadata: Optional metadata object

// Returns: Saved File document

// Example:
const uploadedFile = await FileService.uploadFile(
  req.file,
  req.user._id,
  'admissionDocument',
  admissionDocId,
  {
    category: 'jamb_result',
    isPublic: false,
    accessRoles: ['admin', 'admissionOfficer'],
    tags: ['jamb', 'result'],
    customMetadata: {
      documentType: 'JAMB Result',
      year: '2024'
    }
  }
);
```

#### `uploadMultipleFiles(files, uploadedBy, domain, domainId, metadata)`
Upload multiple files at once (max 10 recommended).

#### `getFiles(filters)`
Get files with filtering, pagination, and sorting.
```javascript
// Filter options:
{
  domain: 'admission',
  domainId: admissionAppId,
  uploadedBy: userId,
  isPublic: false,
  category: 'o_level',
  tags: ['WAEC', 'verified'],
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
}
```

#### `getFile(fileId)`
Get single file with populated references.

#### `deleteFile(fileId)`
Delete file from both storage and database.

#### `getSignedUrl(fileId, expiresIn)`
Generate temporary access URL for private files.
```javascript
// Returns signed URL valid for expiresIn seconds
const signedUrl = await FileService.getSignedUrl(fileId, 3600); // 1 hour
```

#### `updateFile(fileId, updates)`
Update file metadata.
```javascript
await FileService.updateFile(fileId, {
  category: 'verified',
  tags: [...existingTags, 'verified'],
  metadata: { verifiedBy: userId, verifiedAt: new Date() }
});
```

#### `getFilesByDomain(domain, domainId, options)`
Convenience method for domain-based queries.

### 3. File Controller (`files.controller.js`)
**Endpoints:**
- `POST /files/upload` - Single file upload
- `POST /files/upload/multiple` - Multiple files upload
- `GET /files` - List files with filtering
- `GET /files/:fileId` - Get single file
- `DELETE /files/:fileId` - Delete file

**Request Format for Upload:**
```javascript
// FormData with:
// - file: File binary
// - domain: String (required)
// - domainId: String (optional)
// - metadata: JSON string (optional)
```

### 4. File Utils (`file.utils.js`)
**Domain-specific configurations:**
```javascript
const domainConfigs = {
  // Default
  default: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    isPublic: true,
    category: 'general'
  },
  
  // User avatars
  user: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    category: 'avatar'
  },
  
  // Course materials
  course: {
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['application/pdf', 'video/mp4', 'image/*', 'application/msword'],
    category: 'course_material'
  },
  
  // Admission documents
  admissionDocument: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
    category: 'admission_document',
    isPublic: false
  },
  
  // Applicant photos
  applicant: {
    maxSize: 3 * 1024 * 1024, // 3MB
    allowedTypes: ['image/jpeg', 'image/png'],
    category: 'applicant_photo',
    isPublic: false
  },
  
  // Admission letters
  admissionLetter: {
    maxSize: 2 * 1024 * 1024, // 2MB
    allowedTypes: ['application/pdf'],
    category: 'admission_letter',
    isPublic: false
  }
};
```

**Utility Methods:**
- `getUploadOptions(domain, customOptions)` - Get config for domain
- `validateFile(file, options)` - Validate before upload
- `formatFileSize(bytes)` - Human-readable file size
- `extractMetadata(req, domain)` - Extract metadata from request

## Storage Configuration

### Supabase Setup
```javascript
// config/supabase.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Required buckets:
// 1. "afued_storage_bucket" - Public files
// 2. "private-files" - Private files
```

## Integration Patterns

### 1. Basic File Upload in Any Domain
```javascript
import FileService from '../files/files.service.js';
import FileUtils from '../files/file.utils.js';

// In your controller:
const uploadOptions = FileUtils.getUploadOptions('yourDomain');
FileUtils.validateFile(req.file, uploadOptions);

const metadata = FileUtils.extractMetadata(req, 'yourDomain');

const file = await FileService.uploadFile(
  req.file,
  req.user._id,
  'yourDomain',
  entityId, // Optional: ID of the entity this file belongs to
  metadata
);
```

### 2. Admission Document Upload Example
```javascript
async uploadAdmissionDocument(req, res) {
  // 1. Validate file
  const options = FileUtils.getUploadOptions('admissionDocument');
  FileUtils.validateFile(req.file, options);
  
  // 2. Create admission document record
  const admissionDoc = await AdmissionDocument.create({
    admissionApplicationId,
    documentType: 'jambResult',
    // ... other fields
  });
  
  // 3. Upload file
  const file = await FileService.uploadFile(
    req.file,
    req.user._id,
    'admissionDocument',
    admissionDoc._id, // Link file to document
    {
      category: 'jamb_result',
      isPublic: false,
      accessRoles: ['admin', 'admissionOfficer'],
      tags: ['JAMB', 'result', '2024'],
      customMetadata: {
        admissionApplicationId,
        applicantId
      }
    }
  );
  
  // 4. Update admission document with file reference
  admissionDoc.fileId = file._id;
  admissionDoc.fileUrl = await FileService.getSignedUrl(file._id, 86400); // 24h
  await admissionDoc.save();
  
  return { admissionDoc, file };
}
```

### 3. Retrieving Domain Files
```javascript
// Get all files for an admission application
const files = await FileService.getFiles({
  domain: 'admissionDocument',
  domainId: admissionApplicationId,
  isPublic: false
});

// Get signed URLs for private files
const filesWithUrls = await Promise.all(
  files.data.map(async (file) => ({
    ...file.toObject(),
    accessUrl: file.isPublic 
      ? file.url 
      : await FileService.getSignedUrl(file._id, 3600)
  }))
);
```

### 4. File Access Control Middleware
```javascript
async function checkFileAccess(req, res, next) {
  try {
    const file = await FileService.getFile(req.params.fileId);
    
    // Public files are accessible to all
    if (file.isPublic) return next();
    
    // Check role-based access
    if (file.accessRoles.includes(req.user.role)) return next();
    
    // Check user-based access
    if (file.accessUsers.includes(req.user._id)) return next();
    
    // Check if user owns the file
    if (file.uploadedBy.toString() === req.user._id.toString()) return next();
    
    // Check domain-specific permissions
    if (file.domain === 'admissionDocument') {
      // Add admission-specific logic
      const hasAdmissionAccess = await checkAdmissionAccess(req.user, file.domainId);
      if (hasAdmissionAccess) return next();
    }
    
    throw new AppError('Access denied', 403);
  } catch (error) {
    next(error);
  }
}
```

## Security Features

### 1. Access Control Layers
- **Public/Private flag** - Basic visibility control
- **Role-based access** - Restrict by user roles
- **User-based access** - Specific user allowlist
- **Domain-specific permissions** - Custom logic per domain

### 2. File Validation
- Size limits (domain-configurable)
- MIME type whitelisting
- File name sanitization
- Malware scanning (can be added)

### 3. Storage Security
- Private bucket for sensitive files
- Signed URLs with expiration
- No direct bucket access
- Automatic cleanup of orphaned files

## Best Practices

### 1. File Naming
- Use UUID for storage filenames
- Keep original name in metadata
- Include domain in storage path

### 2. Metadata Management
- Store business logic in domain entities
- Use File metadata for storage info only
- Add customMetadata for domain-specific data

### 3. Cleanup Strategy
```javascript
// Regularly clean up expired files
async function cleanupExpiredFiles() {
  const expiredFiles = await FileModel.find({
    expiresAt: { $lt: new Date() }
  });
  
  for (const file of expiredFiles) {
    await FileService.deleteFile(file._id);
  }
}
```

### 4. Error Handling
- Always validate before upload
- Handle storage failures gracefully
- Implement retry logic for transient errors
- Log all file operations for audit

## Migration/Extension Guide

### Adding New Domain
1. Add to `domain` enum in model
2. Add config to `FileUtils.domainConfigs`
3. Implement domain-specific access logic if needed

### Changing Storage Provider
Override `saveFileToStorage` and `getSignedUrl` methods in FileService while keeping the same interface.

### Adding Custom Validators
Extend `FileUtils.validateFile` with domain-specific validation logic.

---

## Quick Reference

**For AI Generation:**
When generating code for any domain that needs file uploads:
1. Import FileService and FileUtils
2. Use `FileUtils.getUploadOptions('yourDomain')` for validation
3. Use `FileService.uploadFile()` with appropriate domain and metadata
4. Store the returned file._id in your domain entity
5. For private files, use `FileService.getSignedUrl()` for access

**Environment Variables Required:**
```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
```

**Dependencies:**
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "multer": "^1.4.5",
    "uuid": "^9.0.0"
  }
}
```

This module is designed to be pluggable into any domain with minimal configuration while providing enterprise-grade file management capabilities.