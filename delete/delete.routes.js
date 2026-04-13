import express from "express";
import { scanDelete, confirmDelete } from "./delete.controller.js";
import authenticate from "../middlewares/authenticate.js";

const router = express.Router();

router.delete("/:model/:id/scan", authenticate('admin'), scanDelete);
router.delete("/:model/:id/confirm", authenticate('admin'), confirmDelete);

export default router;
