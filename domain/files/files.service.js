import { v4 as uuidv4 } from "uuid";
import { extname } from "path";
import FileModel from "./files.model.js";
import { supabase } from "../../config/supabase.js";
import AppError from "../errors/AppError.js";

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
}

export default FileService;
