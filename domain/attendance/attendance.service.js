// attendance.service.js
import AttendanceSession from './attendance.model.js';
import AttendanceRecord from './attendanceRecordModel.js';
import mongoose from 'mongoose';
import CourseAssignment from '../course/courseAssignment.model.js';
import Student from '../student/student.model.js';

export const createAttendanceSession = async (data, user) => {
  const { assignment_id, date, start_time, end_time, topic, method } = data;
  
  // Validate assignment and permissions
  const assignment = await CourseAssignment.findById(assignment_id)
    .populate("course lecturer semester");
  
  if (!assignment) {
    throw new Error("Assignment not found");
  }

  // Check if user is lecturer, course rep, or assigned to course
  const isLecturer = assignment.lecturer._id.toString() === user._id.toString();
  const isCourseRep = user.role === 'course_rep' && 
    assignment.course._id.toString() === user.course_id?.toString();
  const isAssignedLecturer = assignment.co_lecturers?.some(
    co => co._id.toString() === user._id.toString()
  );

  if (!isLecturer && !isCourseRep && !isAssignedLecturer) {
    throw new Error("Unauthorized to create session");
  }

  // Check for existing session
  const existing = await AttendanceSession.findOne({
    assignment: assignment_id,
    session_date: date,
    start_time,
  });

  if (existing) {
    throw new Error("Session already exists for this time");
  }

  // Generate QR code token if method is QR
  let qr_code_token = null;
  if (method === 'qr_code') {
    qr_code_token = generateQRToken();
  }

  const session = await AttendanceSession.create({
    assignment: assignment_id,
    course: assignment.course._id,
    lecturer: assignment.lecturer._id,
    co_lecturers: assignment.co_lecturers || [],
    semester: assignment.semester._id,
    session_date: date,
    start_time,
    end_time,
    topic,
    attendance_method: method,
    qr_code_token,
    created_by: user._id,
    created_by_role: user.role
  });

  return session;
};

export const markAttendance = async (sessionId, studentId, method, user) => {
  const session = await AttendanceSession.findById(sessionId);
  
  if (!session || !session.is_active) {
    throw new Error("Invalid or closed session");
  }

  // Check permissions - only lecturer, course rep, or co-lecturers can mark
  const canMark = await canUserMarkAttendance(session, user);
  if (!canMark) {
    throw new Error("Unauthorized to mark attendance");
  }

  // Check if already marked
  const existing = await AttendanceRecord.findOne({ 
    session: sessionId, 
    student: studentId 
  });
  
  if (existing) {
    throw new Error("Attendance already marked");
  }

  // Create attendance record
  const record = await AttendanceRecord.create({
    session: sessionId,
    student: studentId,
    status: "present",
    check_in_time: new Date(),
    check_in_method: method,
    marked_by: user._id,
    marked_by_role: user.role
  });

  // Update session counts
  await AttendanceSession.findByIdAndUpdate(sessionId, {
    $inc: { present_count: 1 },
  });

  // Update student's attendance statistics
  await updateStudentAttendanceStats(studentId, session.course, session.semester);

  return { record, session };
};

export const bulkMarkAttendance = async (sessionId, attendanceList, user) => {
  const session = await AttendanceSession.findById(sessionId);
  
  if (!session || !session.is_active) {
    throw new Error("Invalid or closed session");
  }

  // Check permissions - only lecturer can bulk mark
  const canBulkMark = user.role === 'lecturer' && 
    (session.lecturer.toString() === user._id.toString() ||
     session.co_lecturers.some(co => co.toString() === user._id.toString()));
  
  if (!canBulkMark) {
    throw new Error("Only lecturers can bulk mark attendance");
  }

  const results = {
    markedCount: 0,
    failedCount: 0,
    errors: []
  };

  for (const item of attendanceList) {
    try {
      // Skip if already marked
      const existing = await AttendanceRecord.findOne({ 
        session: sessionId, 
        student: item.student_id 
      });

      if (existing) {
        results.errors.push({
          student_id: item.student_id,
          error: "Already marked"
        });
        results.failedCount++;
        continue;
      }

      await AttendanceRecord.create({
        session: sessionId,
        student: item.student_id,
        status: item.status || "present",
        check_in_time: new Date(),
        check_in_method: item.method || "manual",
        marked_by: user._id,
        marked_by_role: user.role
      });

      results.markedCount++;
    } catch (error) {
      results.errors.push({
        student_id: item.student_id,
        error: error.message
      });
      results.failedCount++;
    }
  }

  // Update session counts
  await AttendanceSession.findByIdAndUpdate(sessionId, {
    $inc: { present_count: results.markedCount },
  });

  // Update all students' attendance statistics
  const studentIds = attendanceList.map(item => item.student_id);
  await updateBulkStudentAttendanceStats(studentIds, session.course, session.semester);

  return results;
};

export const getAttendanceReport = async (assignmentId, filters = {}) => {
  const { start_date, end_date, group_by } = filters;
  
  let query = { assignment: assignmentId };
  
  if (start_date && end_date) {
    query.session_date = {
      $gte: new Date(start_date),
      $lte: new Date(end_date)
    };
  }

  const sessions = await AttendanceSession.find(query)
    .populate("course lecturer co_lecturers")
    .lean();

  // Get all records for these sessions
  const sessionIds = sessions.map(s => s._id);
  const records = await AttendanceRecord.find({ session: { $in: sessionIds } })
    .populate("student", "matric_number full_name department level")
    .populate("marked_by", "name email")
    .lean();

  // Group records by session
  const recordsBySession = {};
  records.forEach(record => {
    if (!recordsBySession[record.session]) {
      recordsBySession[record.session] = [];
    }
    recordsBySession[record.session].push(record);
  });

  // Attach records to sessions
  sessions.forEach(session => {
    session.records = recordsBySession[session._id] || [];
    session.absent_count = session.total_students - session.present_count;
    session.attendance_rate = session.total_students > 0 
      ? (session.present_count / session.total_students) * 100 
      : 0;
  });

  // Group by if specified
  let groupedData = sessions;
  if (group_by === 'date') {
    groupedData = groupByDate(sessions);
  } else if (group_by === 'week') {
    groupedData = groupByWeek(sessions);
  }

  return {
    sessions: groupedData,
    summary: {
      total_sessions: sessions.length,
      total_present: sessions.reduce((sum, s) => sum + s.present_count, 0),
      total_absent: sessions.reduce((sum, s) => sum + (s.total_students - s.present_count), 0),
      average_attendance_rate: sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + s.attendance_rate, 0) / sessions.length 
        : 0
    }
  };
};

export const getStudentAttendanceAnalytics = async (studentId, courseId, semesterId) => {
  const matchStage = { student: new mongoose.Types.ObjectId(studentId) };
  
  if (courseId) {
    matchStage["session.course"] = new mongoose.Types.ObjectId(courseId);
  }
  
  if (semesterId) {
    matchStage["session.semester"] = new mongoose.Types.ObjectId(semesterId);
  }

  const analytics = await AttendanceRecord.aggregate([
    {
      $lookup: {
        from: "attendancesessions",
        localField: "session",
        foreignField: "_id",
        as: "session"
      }
    },
    { $unwind: "$session" },
    { $match: matchStage },
    {
      $lookup: {
        from: "courses",
        localField: "session.course",
        foreignField: "_id",
        as: "course"
      }
    },
    { $unwind: "$course" },
    {
      $group: {
        _id: {
          course: "$session.course",
          course_name: "$course.name",
          semester: "$session.semester"
        },
        total_sessions: { $sum: 1 },
        present_count: {
          $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
        },
        late_count: {
          $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] }
        },
        attendance_rate: {
          $avg: { $cond: [{ $in: ["$status", ["present", "late"]] }, 100, 0] }
        }
      }
    },
    {
      $project: {
        course_id: "$_id.course",
        course_name: "$_id.course_name",
        semester_id: "$_id.semester",
        total_sessions: 1,
        present_count: 1,
        late_count: 1,
        absent_count: { $subtract: ["$total_sessions", { $add: ["$present_count", "$late_count"] }] },
        attendance_rate: { $round: ["$attendance_rate", 2] },
        trend: { 
          $cond: [
            { $gt: ["$attendance_rate", 75] }, 
            "GOOD", 
            { $cond: [{ $gt: ["$attendance_rate", 50] }, "AVERAGE", "POOR"] }
          ]
        }
      }
    }
  ]);

  // Calculate overall statistics
  const overall = analytics.reduce((acc, curr) => {
    acc.total_sessions += curr.total_sessions;
    acc.total_present += curr.present_count;
    acc.total_late += curr.late_count;
    return acc;
  }, { total_sessions: 0, total_present: 0, total_late: 0 });

  overall.total_absent = overall.total_sessions - overall.total_present - overall.total_late;
  overall.overall_rate = overall.total_sessions > 0 
    ? ((overall.total_present + overall.total_late) / overall.total_sessions) * 100 
    : 0;

  return { analytics, overall };
};

export const getCourseAttendanceAnalytics = async (courseId, semesterId) => {
  const matchStage = { course: new mongoose.Types.ObjectId(courseId) };
  
  if (semesterId) {
    matchStage.semester = new mongoose.Types.ObjectId(semesterId);
  }

  const analytics = await AttendanceSession.aggregate([
    { $match: matchStage },
    {
      $lookup: {
        from: "attendancerecords",
        localField: "_id",
        foreignField: "session",
        as: "records"
      }
    },
    {
      $project: {
        session_date: 1,
        topic: 1,
        total_students: 1,
        present_count: 1,
        attendance_rate: {
          $multiply: [
            { $divide: ["$present_count", { $max: [1, "$total_students"] }] },
            100
          ]
        },
        student_breakdown: {
          $map: {
            input: "$records",
            as: "record",
            in: {
              student_id: "$$record.student",
              status: "$$record.status",
              check_in_time: "$$record.check_in_time"
            }
          }
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$session_date" }
        },
        sessions: { $push: "$$ROOT" },
        avg_attendance_rate: { $avg: "$attendance_rate" },
        total_present: { $sum: "$present_count" }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  return analytics;
};

export const toggleSessionStatus = async (sessionId, isActive, user) => {
  const session = await AttendanceSession.findById(sessionId);
  
  if (!session) {
    throw new Error("Session not found");
  }

  // Check permissions
  const canToggle = user.role === 'lecturer' && 
    (session.lecturer.toString() === user._id.toString() ||
     session.co_lecturers.some(co => co.toString() === user._id.toString()));
  
  if (!canToggle) {
    throw new Error("Only lecturers can toggle session status");
  }

  session.is_active = isActive;
  await session.save();

  return session;
};

// Helper functions
const canUserMarkAttendance = async (session, user) => {
  // Lecturer or co-lecturers can always mark
  if (user.role === 'lecturer') {
    if (session.lecturer.toString() === user._id.toString()) return true;
    if (session.co_lecturers?.some(co => co.toString() === user._id.toString())) return true;
  }
  
  // Course rep can mark for their course
  if (user.role === 'course_rep') {
    const student = await Student.findOne({ user_id: user._id });
    if (student && student.course_id?.toString() === session.course.toString()) {
      return true;
    }
  }
  
  return false;
};

const updateStudentAttendanceStats = async (studentId, courseId, semesterId) => {
  // Calculate attendance stats for this student in this course and semester
  const stats = await AttendanceRecord.aggregate([
    {
      $lookup: {
        from: "attendancesessions",
        localField: "session",
        foreignField: "_id",
        as: "session"
      }
    },
    { $unwind: "$session" },
    {
      $match: {
        student: new mongoose.Types.ObjectId(studentId),
        "session.course": new mongoose.Types.ObjectId(courseId),
        "session.semester": new mongoose.Types.ObjectId(semesterId)
      }
    },
    {
      $group: {
        _id: null,
        total_sessions: { $sum: 1 },
        present_count: {
          $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] }
        },
        late_count: {
          $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] }
        }
      }
    }
  ]);

  if (stats.length > 0) {
    const stat = stats[0];
    const attendance_rate = stat.total_sessions > 0 
      ? ((stat.present_count + stat.late_count) / stat.total_sessions) * 100 
      : 0;

    // Update student model with attendance stats
    await Student.findByIdAndUpdate(studentId, {
      $set: {
        "attendance_stats.course_attendance_rate": attendance_rate,
        "attendance_stats.last_updated": new Date()
      }
    });
  }
};

const updateBulkStudentAttendanceStats = async (studentIds, courseId, semesterId) => {
  // Update stats for multiple students
  for (const studentId of studentIds) {
    await updateStudentAttendanceStats(studentId, courseId, semesterId);
  }
};

const generateQRToken = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const groupByDate = (sessions) => {
  const grouped = {};
  sessions.forEach(session => {
    const date = session.session_date.toISOString().split('T')[0];
    if (!grouped[date]) {
      grouped[date] = {
        date,
        sessions: [],
        total_present: 0,
        total_absent: 0
      };
    }
    grouped[date].sessions.push(session);
    grouped[date].total_present += session.present_count;
    grouped[date].total_absent += (session.total_students - session.present_count);
  });
  return Object.values(grouped);
};

const groupByWeek = (sessions) => {
  const grouped = {};
  sessions.forEach(session => {
    const week = getWeekNumber(session.session_date);
    if (!grouped[week]) {
      grouped[week] = {
        week,
        sessions: [],
        total_present: 0,
        total_absent: 0
      };
    }
    grouped[week].sessions.push(session);
    grouped[week].total_present += session.present_count;
    grouped[week].total_absent += (session.total_students - session.present_count);
  });
  return Object.values(grouped);
};

const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
};