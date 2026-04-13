// courseMaterial.routes.js
import { Router } from "express";
import { deleteMaterial, getByWeek, getMaterial, getMaterials, reorderMaterials, updateMaterial, uploadMaterial } from "./courseMaterial.controller.js";
import authenticate from "../../../middlewares/authenticate.js";

const router = Router();

// All routes require authentication
// router.use(authenticate);

// CRUD operations (instructor/admin only)
router.post("/:courseId/materials", 
  authenticate(['instructor', 'admin', 'lecturer']), 
  uploadMaterial
);

router.put("/:courseAssignmentId/materials/reorder",
  authenticate(['instructor', 'admin', 'lecturer', 'hod']),
  reorderMaterials
);

router.put("/materials/:materialId",
  authenticate(['instructor', 'admin', 'lecturer', 'hod','ta']),
  updateMaterial
);

router.delete("/materials/:materialId",
  authenticate(['lecturer', 'hod', 'admin']),
  deleteMaterial
);

// Read operations (all authenticated users)
router.get("/:courseId/materials",
  authenticate(['student', 'instructor', 'admin', 'lecturer', 'hod','ta']),
  getMaterials
);

router.get("/:courseAssignmentId/materials/week",
  authenticate(['student', 'instructor', 'admin', 'lecturer', 'hod','ta']),
  getByWeek
);

router.get("/materials/:materialId",
  authenticate(['student', 'instructor', 'admin', 'lecturer', 'hod','ta']),
  getMaterial
);

export default router;