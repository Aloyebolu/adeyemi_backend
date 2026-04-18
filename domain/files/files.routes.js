import { Router } from "express";
const router = Router();
import FileController from "./files.controller.js";
import authenticate from "#middlewares/authenticate.js";

// Single file upload
router.post("/upload", authenticate(), FileController.upload);

// Multiple files upload
router.post("/upload/multiple", authenticate(), FileController.uploadMultiple);

// Get files with filtering
router.get("/", authenticate(), FileController.getFiles);

// Get single file
router.get("/:fileId", authenticate(), FileController.getFile);

// Delete file (with optional role check)
router.delete("/:fileId", authenticate(), FileController.deleteFile);

// Optional: Download file endpoint
router.get("/download/:fileId", authenticate(), async (req, res) => {
  // Implement signed URL generation for secure downloads
  
});

export default router;