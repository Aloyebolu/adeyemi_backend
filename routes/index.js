import express from "express";
const router = express.Router();

// 
import deleteRoutes from "../delete/delete.routes.js";
router.use("/delete", authenticate('admin'), deleteRoutes);
// 


import userRoutes from "#domain/user/index.js";
import semesterRoutes from "#domain/semester/index.js";
import settingsRoutes from "#domain/system/settings/index.js";
import courseRoutes from "#domain/course/index.js";
import programmeRoutes from "#domain/programme/programme.routes.js"
import departmentRoutes from "#domain/organization/department/index.js";
import facultyRoutes from "#domain/organization/faculty/faculty.routes.js";
import studentRoutes from "#domain/user/student/student.routes.js";
import resultRoutes from "#domain/result/index.js";
import lecturerRoutes from "#domain/user/lecturer/index.js";
// import applicantRoutes from "#domain/applicant/index.js"; 
import paymentRoutes from "#domain/payment/index.js";
import notificationRoutes from "#domain/notification/index.js";
import adminRoutes from "#domain/admin/index.js"
import admissionRoutes from "#domain/admission/routes/index.js"
import announcementRoutes from "#domain/announcement/index.js";
import computationRoutes from "#domain/computation/routes/computation.routes.js";
import systemMonitorRoutes from "#domain/system/systemMonitor.js"
import authRoutes from "#domain/auth/index.js"
import auditRoutes from "#domain/auditlog/auditlog.routes.js";
import carryoverRoutes from "#domain/user/student/carryover/carryover.routes.js";
import fileRoutes from "#domain/files/files.routes.js"
import authenticate from "../middlewares/authenticate.js";
import attendanceRoutes from "#domain/user/student/attendance/attendance.route.js"
import { rankingRoutes } from "#domain/ranking/index.js";
import createScriptsRouter from "#domain/system/scripts/scripts.routes.js";
import userModel from "#domain/user/user.model.js";
import { queueDepartmentJob } from "#jobs/worker.js";
import feedbackRoutes from "#domain/feedback/feedback.routes.js";
import databaseRoutes from "#domain/system/database/index.js";
import studentSuspension from "#domain/user/student/studentSuspension/index.js";
import ai from "#domain/ai/ai.routes.js";
import errorLog from "#domain/system/errors/errorLog.routes.js";
import whatsAppRoutes from "#domain/notification/routes/whatsapp.routes.js"
import OrganizationalUnitRoutes from "#domain/organization/routes/organization.routes.js";
// import chatRoutes from "#domain/chat/chat.routes.js";
// app.js or server.js



// Add payment monitoring middleware
router.use((req, res, next) => {
  if (req.path.includes('/payments')) {
    console.log(`💰 Payment Request: ${req.method} ${req.path}`);
  }
  next();
});

/* -------------------------USER ROUTES-------------------- */
router.use("/user", userRoutes);
router.use("/student",(req, res, next)=>{
  console.warn("This route has been moved to /user/student, consider correcting its usage before it gets removed finally")
next()
}, studentRoutes);
router.use("/students", studentRoutes);
router.use("/student-suspensions", studentSuspension);
router.use("/lecturers", (req, res, next)=>{
  console.warn("This route has been moved to /user/lecturers, consider correcting its usage before it gets removed finally")
next()
}, lecturerRoutes);
router.use("/admin", adminRoutes)

/* -------------------------SETTINGS ROUTES-------------------- */
router.use("/semester", semesterRoutes);
router.use("/settings", settingsRoutes);

router.use("/course", courseRoutes);
router.use("/programme", programmeRoutes)
router.use("/department", departmentRoutes);
router.use("/faculty", facultyRoutes);
router.use("/results", resultRoutes);
// router.use("/applicants", applicantRoutes); 
router.use("/payments", paymentRoutes);
router.use("/notifications", notificationRoutes);
router.use("/announcements", announcementRoutes);
router.use("/computation", computationRoutes)
router.use('/system', systemMonitorRoutes);
router.use('/auth', authRoutes);
router.use("/audit", auditRoutes);
router.use("/carryover", carryoverRoutes);
router.use("/files", fileRoutes)
router.use("/admission", admissionRoutes)
router.use("/attendance", attendanceRoutes)
router.use('/ranking', rankingRoutes);
// router.use("/chat", chatRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/database", databaseRoutes)
router.use("/ai", ai)
router.use("/errors", errorLog)
router.use("/whatsapp", whatsAppRoutes)
router.use("/admin-units", OrganizationalUnitRoutes)
router.use("/organization", OrganizationalUnitRoutes)

// Models collection
const models = {
  User: userModel,
  // Result,
  // Course,
  // MasterSheet
  // Add other models as needed
};
const services = {
  addDepartmentJob: () => queueDepartmentJob
}


// Routes
router.use('/admin/scripts', createScriptsRouter(models, services));



export default router;
