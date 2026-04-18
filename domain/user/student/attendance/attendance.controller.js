// attendance.controller.js
import * as attendanceService from './attendance.service.js';

export const createAttendanceSession = async (req, res, next) => {
  try {
    const session = await attendanceService.createAttendanceSession(req.body, req.user);
    
    // Audit logging
    req.auditContext = {
      action: "CREATE_ATTENDANCE_SESSION",
      resource: "AttendanceSession",
      severity: "MEDIUM",
      entityId: session._id,
      status: "SUCCESS",
      reason: "Attendance session created successfully",
      metadata: {
        creatorId: req.user._id,
        creatorRole: req.user.role,
        sessionId: session._id,
        courseId: session.course,
        assignmentId: session.assignment,
        date: session.session_date,
        method: session.attendance_method
      }
    };

    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
};

export const markAttendance = async (req, res, next) => {
  try {
    const { session_id, student_id, method } = req.body;
    const result = await attendanceService.markAttendance(
      session_id,
      student_id,
      method,
      req.user
    );

    // Audit logging
    req.auditContext = {
      action: "MARK_ATTENDANCE",
      resource: "AttendanceRecord",
      severity: "LOW",
      entityId: result.record._id,
      status: "SUCCESS",
      reason: "Attendance marked successfully",
      metadata: {
        markerId: req.user._id,
        markerRole: req.user.role,
        sessionId: session_id,
        studentId: student_id,
        method,
        courseId: result.session.course
      }
    };

    res.json({ success: true, message: "Attendance marked successfully" });
  } catch (err) {
    next(err);
  }
};

export const bulkMarkAttendance = async (req, res, next) => {
  try {
    const { session_id, attendance_list } = req.body; // array of {student_id, status, method?}
    const result = await attendanceService.bulkMarkAttendance(
      session_id,
      attendance_list,
      req.user
    );

    // Audit logging
    req.auditContext = {
      action: "BULK_MARK_ATTENDANCE",
      resource: "AttendanceRecord",
      severity: "MEDIUM",
      entityId: session_id,
      status: "SUCCESS",
      reason: `Bulk attendance marked for ${result.markedCount} students`,
      metadata: {
        markerId: req.user._id,
        markerRole: req.user.role,
        sessionId: session_id,
        totalStudents: attendance_list.length,
        markedCount: result.markedCount,
        failedCount: result.failedCount
      }
    };

    res.json({ 
      success: true, 
      message: `Attendance marked for ${result.markedCount} students`,
      ...result
    });
  } catch (err) {
    next(err);
  }
};

export const getAttendanceReport = async (req, res, next) => {
  try {
    const { assignment_id } = req.params;
    const { start_date, end_date, group_by } = req.query;
    
    const report = await attendanceService.getAttendanceReport(
      assignment_id,
      { start_date, end_date, group_by }
    );

    res.json({ success: true, ...report });
  } catch (err) {
    next(err);
  }
};

export const getStudentAttendanceAnalytics = async (req, res, next) => {
  try {
    const { student_id, course_id, semester_id } = req.query;
    const analytics = await attendanceService.getStudentAttendanceAnalytics(
      student_id,
      course_id,
      semester_id
    );

    res.json({ success: true, analytics });
  } catch (err) {
    next(err);
  }
};

export const getCourseAttendanceAnalytics = async (req, res, next) => {
  try {
    const { course_id, semester_id } = req.query;
    const analytics = await attendanceService.getCourseAttendanceAnalytics(
      course_id,
      semester_id
    );

    res.json({ success: true, analytics });
  } catch (err) {
    next(err);
  }
};

export const toggleSessionStatus = async (req, res, next) => {
  try {
    const { session_id, is_active } = req.body;
    const session = await attendanceService.toggleSessionStatus(
      session_id,
      is_active,
      req.user
    );

    // Audit logging
    req.auditContext = {
      action: "TOGGLE_SESSION_STATUS",
      resource: "AttendanceSession",
      severity: "MEDIUM",
      entityId: session_id,
      status: "SUCCESS",
      reason: `Session ${is_active ? 'activated' : 'deactivated'}`,
      changes: {
        before: { is_active: !is_active },
        after: { is_active }
      },
      metadata: {
        updaterId: req.user._id,
        updaterRole: req.user.role,
        sessionId: session_id,
        newStatus: is_active
      }
    };

    res.json({ 
      success: true, 
      message: `Session ${is_active ? 'activated' : 'deactivated'}`,
      session 
    });
  } catch (err) {
    next(err);
  }
};