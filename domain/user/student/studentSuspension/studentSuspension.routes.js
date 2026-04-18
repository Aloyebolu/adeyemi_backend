import express from "express";
import {
  createSuspension,
  getActiveSuspension,
  getStudentSuspensions,
  liftSuspension
} from "./studentSuspension.controller.js";

const router = express.Router();

router.post("/:student_id", createSuspension);

router.get("/:student_id/active", getActiveSuspension);

router.get("/:student_id", getStudentSuspensions);

router.patch("/:student_id/:suspension_id/lift", liftSuspension);

export default router;