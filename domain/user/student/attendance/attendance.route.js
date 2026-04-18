// attendance.routes.js
import express from 'express';
import {
  createAttendanceSession,
  markAttendance,
  bulkMarkAttendance,
  getAttendanceReport,
  getStudentAttendanceAnalytics,
  getCourseAttendanceAnalytics,
  toggleSessionStatus
} from './attendance.controller.js';
import authenticate from '#middlewares/authenticate.js';

const router = express.Router();

// Protect all routes

// Session management
router.post('/sessions', authenticate(['lecturer', 'course_rep']), createAttendanceSession);
router.put('/sessions/:id/status', authenticate(['lecturer']), toggleSessionStatus);

// Attendance marking
router.post('/mark', authenticate(['lecturer', 'course_rep']), markAttendance);
router.post('/mark/bulk', authenticate(['lecturer']), bulkMarkAttendance);

// Reports and analytics
router.get('/report/assignment/:assignment_id', getAttendanceReport);
router.get('/analytics/student', getStudentAttendanceAnalytics);
router.get('/analytics/course', getCourseAttendanceAnalytics);

export default router;