import express from "express";
import {
  getAllStudents,
  createStudent,
  getStudentById,
  updateStudent,
  deleteStudent,
  getMyProfile,
  registerCourses,
  getMyCourses,
  viewResults,
  printTranscript,
  getStudentSemesterResult,
  restoreStudent,
  getStudentQuickStats,
} from "./student.controller.js";
import authenticate from "#middlewares/authenticate.js";

const router = express.Router();

// 🧩 ADMIN ROUTES
router.get("/", authenticate(["admin", "hod", "dean"]), getAllStudents);
router.post("/", authenticate(["admin", "hod", "dean"]), createStudent);
router.get("/profile", authenticate("student"), getMyProfile);
router.get("/result/:semesterId", authenticate(["student", "admin", "lecturer"]), getStudentSemesterResult);

router.patch("/restore/:id", authenticate("admin"), restoreStudent);
router.patch("/:id", authenticate(["admin", "hod", "dean"]), updateStudent);
router.delete("/:id", authenticate("admin"), deleteStudent);

// 🧩 STUDENT SELF-SERVICE ROUTES
router.get("/quick-stats", authenticate("student"), getStudentQuickStats);
router.get("/me", authenticate("student"), getMyProfile);
router.post("/register-courses", authenticate("student"), registerCourses);
router.get("/my-courses", authenticate("student"), getMyCourses);
router.get("/results", authenticate("student"), viewResults);
router.get("/transcript", authenticate("student"), printTranscript);
router.get("/:id", authenticate(["admin", "hod", "dean", "student"]), getStudentById);

export default router;
