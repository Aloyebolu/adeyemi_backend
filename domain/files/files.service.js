import { v4 as uuidv4 } from "uuid";
import { extname, join } from "path";
import FileModel from "./files.model.js";
import { supabase } from "#config/supabase.js";
import AppError from "#shared/errors/AppError.js";
import fs from "fs";

const PUBLIC_BUCKET = "afued_storage_bucket";
const PRIVATE_BUCKET = "private-files";

class FileService {
  /**
   * Upload a single file (SAFE VERSION)
   */
  static async uploadFile(file, uploadedBy, domain, domainId = null, metadata = {}) {
    // throw 'ds'
    if (!file) throw new AppError("No file provided", 500);
    if (!domain) throw new AppError("Domain is required", 500);

    // 🔐 Normalize file object (works with express-fileupload & multer)
    const originalName =
      file.originalname ||
      file.name ||
      file.filename;

    if (!originalName) {
      throw new AppError("Invalid file object: missing original filename", 500);
    }

    const fileBuffer =
      file.buffer ||
      file.data;

if (!fileBuffer || fileBuffer.length === 0) {
  throw new AppError("Uploaded file is empty", 400);
}

    const mimeType =
      file.mimetype ||
      file.type ||
      "application/octet-stream";

    const fileSize = fileBuffer.length;

    const extension = extname(originalName).toLowerCase();
    const fileName = `${uuidv4()}${extension}`;
    const storagePath = `uploads/${domain}/${fileName}`;

    const isPublic = metadata.isPublic !== false;
    const bucket = isPublic ? PUBLIC_BUCKET : PRIVATE_BUCKET;

    // 📦 Upload to Supabase Storage
const uploadBody = fileBuffer instanceof Uint8Array
  ? fileBuffer
  : new Uint8Array(fileBuffer);

const { error: uploadError } = await supabase.storage
  .from(bucket)
  .upload(storagePath, uploadBody, {
    contentType: mimeType,
    upsert: false
  });

    if (uploadError) {
      throw new AppError(`File upload temporarily unavailable`, 404, uploadError);
    }

    // 🌍 Public URL (only for public files)
    let url = null;
    if (isPublic) {
      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);
      url = data?.publicUrl || null;
    }

    // 🧾 Save metadata to MongoDB
    const savedFile = await FileModel.create({
      name: fileName,
      originalName,
      url,
      type: mimeType,
      extension,
      size: fileSize,
      domain,
      domainId,
      uploadedBy,
      storagePath,
      bucketName: bucket,
      isPublic,
      accessRoles: metadata.accessRoles || [],
      accessUsers: metadata.accessUsers || [],
      category: metadata.category,
      tags: metadata.tags || [],
      metadata: metadata.customMetadata || {},
      expiresAt: metadata.expiresAt ? new Date(metadata.expiresAt) : null
    });

    return savedFile;
  }

  /**
   * Upload multiple files
   */
  static async uploadMultipleFiles(files, uploadedBy, domain, domainId = null, metadata = {}) {
    if (!files || !files.length) throw new AppError("No files provided");

    return Promise.all(
      files.map(file =>
        this.uploadFile(file, uploadedBy, domain, domainId, metadata)
      )
    );
  }

  /**
   * Get files with filtering and pagination
   */
  static async getFiles(filters = {}) {
    const {
      domain,
      domainId,
      uploadedBy,
      isPublic,
      category,
      tags,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc"
    } = filters;

    const query = {};
    if (!/^[a-zA-Z0-9_-]+$/.test(domain)) {
  throw new AppError("Invalid domain value", 400);
}
    if (domain) query.domain = domain;
    if (domainId) query.domainId = domainId;
    if (uploadedBy) query.uploadedBy = uploadedBy;
    if (isPublic !== undefined) query.isPublic = isPublic;
    if (category) query.category = category;
    if (tags?.length) query.tags = { $in: tags };

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [data, total] = await Promise.all([
      FileModel.find(query)
        .populate("uploadedBy", "name email avatar")
        .populate("domainId")
        .sort(sort)
        .skip(skip)
        .limit(limit),
      FileModel.countDocuments(query)
    ]);

    return {
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single file
   */
  static async getFile(fileId) {
    const file = await FileModel.findById(fileId)
      .populate("uploadedBy", "name email avatar")
      .populate("domainId");

    if (!file) throw new AppError("File not found");
    return file;
  }

  /**
   * Delete file
   */
  static async deleteFile(fileId) {
    try{

      const file = await FileModel.findById(fileId);
      if (!file) throw new AppError("File not found");
  
      await supabase.storage
        .from(file.bucketName)
        .remove([file.storagePath])
        .catch(() => {});
  
      await file.deleteOne();
      return true;
    }catch(err){
      throw new AppError(null, 500, err)
    }
  }

  /**
   * Generate signed URL for private files
   */
  static async getSignedUrl(fileId, expiresIn = 3600) {
    const file = await FileModel.findById(fileId);
    if (!file) throw new AppError("File not found");

    if (file.isPublic) return file.url;

    const { data, error } = await supabase.storage
      .from(file.bucketName)
      .createSignedUrl(file.storagePath, expiresIn);

    if (error) throw new AppError("Unable to generate file access link", 500);

    return data.signedUrl;
  }

  /**
   * Update metadata
   */
  static async updateFile(fileId, updates) {
    const file = await FileModel.findByIdAndUpdate(
      fileId,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!file) throw new AppError("File not found");
    return file;
  }

  static async getFilesByDomain(domain, domainId, options = {}) {
    return this.getFiles({ domain, domainId, ...options });
  }





  //============================ CACHING=======================||
   /**
   * CACHE CONFIGURATION
   */
  static cacheConfig = {
    cacheDir: process.env.FILE_CACHE_DIR || "/tmp/afued-cache",
    defaultExpiry: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 1024 * 1024 * 1024, // 1GB max cache size
    cleanupInterval: 60 * 60 * 1000 // 1 hour
  };

  /**
   * Initialize cache directory
   */
  static async initCache() {
    try {
      await fs.mkdir(this.cacheConfig.cacheDir, { recursive: true });
      
      // Start cleanup interval if not already running
      if (!this.cleanupTimer) {
        this.cleanupTimer = setInterval(() => {
          this.cleanupCache().catch(console.error);
        }, this.cacheConfig.cleanupInterval);
      }
    } catch (error) {
      console.error("Failed to initialize cache directory:", error);
    }
  }

  /**
   * Generate cache key from parameters
   */
  static generateCacheKey(prefix, params = {}) {
    const data = {
      prefix,
      timestamp: Math.floor(Date.now() / (60 * 60 * 1000)), // Hourly granularity
      ...params
    };
    return crypto.createHash("md5").update(JSON.stringify(data)).digest("hex");
  }

  /**
   * Get cached file
   * @param {string} cacheKey - Unique cache key
   * @param {number} expiryMs - Cache expiry in milliseconds (optional)
   */
  static async getCachedFile(cacheKey, expiryMs = null) {
    try {
      const filePath = join(this.cacheConfig.cacheDir, `${cacheKey}.cache`);
      const stats = await fs.stat(filePath);
      
      const expiry = expiryMs || this.cacheConfig.defaultExpiry;
      if (Date.now() - stats.mtimeMs > expiry) {
        await this.invalidateCache(cacheKey);
        return null;
      }
      
      // Read cached file
      const buffer = await fs.readFile(filePath);
      const metadata = JSON.parse(await fs.readFile(`${filePath}.meta`, 'utf8').catch(() => '{}'));
      
      return {
        buffer,
        metadata,
        filePath,
        createdAt: stats.birthtime,
        lastAccessed: stats.mtime
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Save to cache
   * @param {string} cacheKey - Unique cache key
   * @param {Buffer} buffer - File buffer
   * @param {Object} metadata - Cache metadata (optional)
   */
  static async saveToCache(cacheKey, buffer, metadata = {}) {
    await this.initCache();
    
    const filePath = join(this.cacheConfig.cacheDir, `${cacheKey}.cache`);
    const metaPath = `${filePath}.meta`;
    
    // Check cache size before saving
    await this.ensureCacheSpace(buffer.length);
    
    // Write file buffer
    await fs.writeFile(filePath, buffer);
    
    // Write metadata
    await fs.writeFile(metaPath, JSON.stringify({
      ...metadata,
      cachedAt: new Date().toISOString(),
      size: buffer.length
    }));
    
    return filePath;
  }

  /**
   * Invalidate specific cache entry
   */
  static async invalidateCache(cacheKey) {
    try {
      const filePath = join(this.cacheConfig.cacheDir, `${cacheKey}.cache`);
      const metaPath = `${filePath}.meta`;
      
      await fs.unlink(filePath).catch(() => {});
      await fs.unlink(metaPath).catch(() => {});
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Invalidate cache by pattern (useful for bulk invalidation)
   */
  static async invalidateCachePattern(pattern) {
    try {
      const files = await fs.readdir(this.cacheConfig.cacheDir);
      const toDelete = files.filter(f => f.includes(pattern));
      
      await Promise.all(
        toDelete.map(async (file) => {
          const filePath = join(this.cacheConfig.cacheDir, file);
          await fs.unlink(filePath).catch(() => {});
        })
      );
      
      return toDelete.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Ensure cache doesn't exceed maximum size
   */
  static async ensureCacheSpace(requiredBytes) {
    try {
      const files = await fs.readdir(this.cacheConfig.cacheDir);
      const fileStats = await Promise.all(
        files
          .filter(f => f.endsWith('.cache'))
          .map(async (file) => {
            const filePath = join(this.cacheConfig.cacheDir, file);
            const stats = await fs.stat(filePath);
            return { path: filePath, size: stats.size, mtime: stats.mtime };
          })
      );
      
      const totalSize = fileStats.reduce((sum, f) => sum + f.size, 0);
      
      if (totalSize + requiredBytes > this.cacheConfig.maxSize) {
        // Sort by last modified (oldest first)
        fileStats.sort((a, b) => a.mtime - b.mtime);
        
        let freedSpace = 0;
        for (const file of fileStats) {
          if (freedSpace >= requiredBytes) break;
          await fs.unlink(file.path).catch(() => {});
          await fs.unlink(`${file.path}.meta`).catch(() => {});
          freedSpace += file.size;
        }
      }
    } catch (error) {
      console.error("Error ensuring cache space:", error);
    }
  }

  /**
   * Clean up old cache files
   */
  static async cleanupCache(expiryMs = null) {
    try {
      const expiry = expiryMs || this.cacheConfig.defaultExpiry;
      const files = await fs.readdir(this.cacheConfig.cacheDir);
      const now = Date.now();
      
      for (const file of files) {
        if (!file.endsWith('.cache')) continue;
        
        const filePath = join(this.cacheConfig.cacheDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > expiry) {
          await fs.unlink(filePath).catch(() => {});
          await fs.unlink(`${filePath}.meta`).catch(() => {});
        }
      }
    } catch (error) {
      console.error("Cache cleanup error:", error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats() {
    try {
      const files = await fs.readdir(this.cacheConfig.cacheDir);
      const cacheFiles = files.filter(f => f.endsWith('.cache'));
      
      let totalSize = 0;
      for (const file of cacheFiles) {
        const stats = await fs.stat(join(this.cacheConfig.cacheDir, file));
        totalSize += stats.size;
      }
      
      return {
        totalFiles: cacheFiles.length,
        totalSize: totalSize,
        maxSize: this.cacheConfig.maxSize,
        usagePercent: (totalSize / this.cacheConfig.maxSize) * 100,
        cacheDir: this.cacheConfig.cacheDir,
        defaultExpiry: this.cacheConfig.defaultExpiry
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Clear entire cache
   */
  static async clearCache() {
    try {
      const files = await fs.readdir(this.cacheConfig.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(join(this.cacheConfig.cacheDir, file)).catch(() => {}))
      );
      return true;
    } catch (error) {
      return false;
    }
  }
}

export default FileService;
