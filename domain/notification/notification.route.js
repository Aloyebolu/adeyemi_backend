import express from "express";
import { createTemplate, deleteTemplate, getNotifications, getTemplates, getTopUnread, getUnreadNotificationCount, sendNotification, updateTemplate } from "./notification.controller.js";
import authenticate from "#middlewares/authenticate.js";

const router = express.Router();
router.get("/", authenticate(["admin", "hod", "lecturer", "student",  "dean"]), getNotifications);
router.get("/unread-count", authenticate(["admin", "hod", "lecturer", "student",  "dean"]), getUnreadNotificationCount);
router.get("/top-unread", authenticate(["admin", "hod", "lecturer", "student",  "dean"]), getTopUnread);

// ADMIN ONLY ROUTES
router.use(authenticate("admin"))
router.get("/templates", authenticate(["admin", "hod", "lecturer", "student", "dean"]), getTemplates)
router.post("/templates", createTemplate)
router.put("/templates/:id", updateTemplate)
router.delete("/templates/:id", deleteTemplate)
router.post("/send", sendNotification);

export default router;
