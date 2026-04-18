import express from "express";
import DatabaseController from "./database.controller.js";
import authenticate from "#middlewares/authenticate.js";

const router = express.Router();

router.use(authenticate("admin")) //Only an admin can access this route
router.post("/create", DatabaseController.createBackup);
router.get("/list", DatabaseController.listBackups);
router.post("/restore", DatabaseController.restoreBackup);
router.delete("/:backupId", DatabaseController.deleteBackup);

export default router;