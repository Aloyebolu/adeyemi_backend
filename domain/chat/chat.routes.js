import express from "express";
import authenticate from "#middlewares/authenticate.js";
import { chatController } from "./chat.controller.js";
// import { chatController } from "../controllers/chatController.js";
// import authenticate from "#middlewares/authenticate.js";

const router = express.Router();

// User routes
router.get("/my-chats", authenticate(), chatController.getMyChats);
router.get("/history/:session_id", authenticate(), chatController.getChatHistory);
// router.get("/session/:session_id", authenticate(), chatController.);


// Admin routes
router.get("/admin/active-chats", authenticate(["admin"]), chatController.getAllActiveChats);
router.get("/admin/attendants", authenticate(["admin"]), chatController.getAvailableAttendants);
router.post("/admin/assign", authenticate(["admin"]), chatController.assignChat);

// File upload
router.post("/upload", authenticate(), chatController.uploadFile);

export default router;