import express from "express";
import authenticate from "#middlewares/authenticate.js";
import {
  getSettings,
  updateSettings,
  resetSettings,
} from "./settings.controller.js";

const router = express.Router();

// 🟢 Public — anyone can view the current settings
router.get("/", getSettings);

// 🔒 Admin — update or reset settings
router.patch("/", authenticate("admin"), updateSettings);
router.post("/reset", authenticate("admin"), resetSettings);

export default router;
