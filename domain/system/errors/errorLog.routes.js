import express from "express";
import {
  createErrorLog,
  getAllErrorLogs,
  getErrorLogsByType,
  deleteErrorLog
} from "./errorLog.controller.js";
import authenticate from "#middlewares/authenticate.js";

const router = express.Router();
// All routes in this router require admin authentication
router.use(authenticate("admin"));
router.post("/", createErrorLog);
router.get("/", getAllErrorLogs);
router.get("/type/:type", getErrorLogsByType);
router.delete("/:id", deleteErrorLog);

export default router;