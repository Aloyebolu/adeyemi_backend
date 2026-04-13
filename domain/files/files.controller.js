import multer, { memoryStorage } from "multer";
import FileService from "./files.service.js";

const storage = memoryStorage();
const upload = multer({ storage });

class FileController {
  static upload = [
    upload.single("file"),
    async (req, res, next) => {
      try {
        const { domain, domainId, metadata } = req.body;
        const uploadedBy = req.user._id;
        
        // Parse metadata if provided as JSON string
        const parsedMetadata = metadata ? JSON.parse(metadata) : {};

        const savedFile = await FileService.uploadFile(
          req.file, 
          uploadedBy, 
          domain, 
          domainId,
          parsedMetadata
        );
        
        res.status(201).json({ 
          success: true, 
          file: savedFile 
        });
      } catch (err) {
        next(err)
      }
    },
  ];

  static getFiles = async (req, res, next) => {
    try {
      const { domain, domainId, uploadedBy, page = 1, limit = 20 } = req.query;
      
      const files = await FileService.getFiles({
        domain,
        domainId,
        uploadedBy,
        page: parseInt(page),
        limit: parseInt(limit)
      });
      
      res.json({ 
        success: true, 
        files: files.data,
        pagination: files.pagination
      });
    } catch (err) {
      next(err)
    }
  };

  static getFile = async (req, res, next) => {
    try {
      const { fileId } = req.params;
      const file = await FileService.getFile(fileId);
      res.json({ 
        success: true, 
        file 
      });
    } catch (err) {
      next(err)
    }
  };

  static deleteFile = async (req, res, next) => {
    try {
      const { fileId } = req.params;
      await FileService.deleteFile(fileId, req.user._id);
      res.json({ 
        success: true, 
        message: "File deleted successfully" 
      });
    } catch (err) {
      next(err)
    }
  };

  static uploadMultiple = [
    upload.array("files", 10), // Max 10 files
    async (req, res, next) => {
      try {
        const { domain, domainId, metadata } = req.body;
        const uploadedBy = req.user._id;
        const parsedMetadata = metadata ? JSON.parse(metadata) : {};

        const savedFiles = await FileService.uploadMultipleFiles(
          req.files,
          uploadedBy,
          domain,
          domainId,
          parsedMetadata
        );

        res.status(201).json({ 
          success: true, 
          files: savedFiles 
        });
      } catch (err) {
        next(err)
      }
    },
  ];
}

export default FileController;