// config/permissions.js
// AUTO-GENERATED PERMISSIONS CONFIG - Based on all routes

export const PERMISSIONS = {
  // ============================================
  // USER MANAGEMENT
  // ============================================
  
  VIEW_USERS: {
    allowedRoles: ["admin"],
    description: "View all users in the system",
    routes: ["GET /user", "GET /user/:id"]
  },
  
  CREATE_USER: {
    allowedRoles: ["admin"],
    description: "Create new user accounts",
    routes: ["POST /user/signup"]
  },
  
  DELETE_USER: {
    allowedRoles: ["admin"],
    description: "Delete user accounts",
    routes: ["DELETE /user/:id"]
  },
  
  UPLOAD_AVATAR: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Upload profile avatar",
    routes: ["POST /user/profile/avatar"]
  },
  
  UPDATE_PROFILE: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Update user profile",
    routes: ["PUT /user/profile"]
  },
  
  // ============================================
  // STUDENT MANAGEMENT
  // ============================================
  
  VIEW_ALL_STUDENTS: {
    allowedRoles: ["admin", "hod", "dean"],
    description: "View all students in the system",
    routes: ["GET /students"]
  },
  
  CREATE_STUDENT: {
    allowedRoles: ["admin", "hod", "dean"],
    description: "Create new student records",
    routes: ["POST /students"]
  },
  
  UPDATE_STUDENT: {
    allowedRoles: ["admin", "hod", "dean"],
    description: "Update student information",
    routes: ["PATCH /students/:id"]
  },
  
  DELETE_STUDENT: {
    allowedRoles: ["admin"],
    description: "Delete student records",
    routes: ["DELETE /students/:id"]
  },
  
  RESTORE_STUDENT: {
    allowedRoles: ["admin"],
    description: "Restore deleted student records",
    routes: ["PATCH /students/restore/:id"]
  },
  
  VIEW_STUDENT_PROFILE: {
    allowedRoles: ["student", "admin", "hod", "dean"],
    description: "View student profile",
    routes: ["GET /students/me", "GET /students/:id", "GET /students/profile"]
  },
  
  VIEW_STUDENT_QUICK_STATS: {
    allowedRoles: ["student"],
    description: "View student quick statistics",
    routes: ["GET /students/quick-stats"]
  },
  
  STUDENT_COURSE_REGISTRATION: {
    allowedRoles: ["student"],
    description: "Register for courses",
    routes: ["POST /students/register-courses"]
  },
  
  VIEW_STUDENT_COURSES: {
    allowedRoles: ["student"],
    description: "View registered courses",
    routes: ["GET /students/my-courses"]
  },
  
  VIEW_STUDENT_RESULTS: {
    allowedRoles: ["student", "admin", "lecturer"],
    description: "View student results",
    routes: ["GET /students/results", "GET /students/result/:semesterId"]
  },
  
  PRINT_STUDENT_TRANSCRIPT: {
    allowedRoles: ["student"],
    description: "Print academic transcript",
    routes: ["GET /students/transcript"]
  },
  
  // ============================================
  // LECTURER MANAGEMENT
  // ============================================
  
  VIEW_ALL_LECTURERS: {
    allowedRoles: ["admin", "hod", "dean"],
    description: "View all lecturers",
    routes: ["GET /lecturers"]
  },
  
  CREATE_LECTURER: {
    allowedRoles: ["admin", "hod", "dean"],
    description: "Create new lecturer records",
    routes: ["POST /lecturers"]
  },
  
  UPDATE_LECTURER: {
    allowedRoles: ["admin", "hod"],
    description: "Update lecturer information",
    routes: ["PATCH /lecturers/:id", "PUT /lecturers/:id"]
  },
  
  UPDATE_LECTURER_RANK: {
    allowedRoles: ["admin"],
    description: "Update lecturer academic rank",
    routes: ["PATCH /lecturers/:id/rank"]
  },
  
  DELETE_LECTURER: {
    allowedRoles: ["admin"],
    description: "Delete lecturer records",
    routes: ["DELETE /lecturers/:id"]
  },
  
  VIEW_ALL_HODS: {
    allowedRoles: ["admin", "dean"],
    description: "View all Heads of Department",
    routes: ["GET /lecturers/hods"]
  },
  
  VIEW_ALL_DEANS: {
    allowedRoles: ["admin"],
    description: "View all Deans",
    routes: ["GET /lecturers/deans"]
  },
  
  // ============================================
  // STAFF MANAGEMENT
  // ============================================
  
  VIEW_ALL_STAFF: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff"],
    description: "View all staff members",
    routes: ["GET /staffs", "POST /staffs"]
  },
  
  CREATE_STAFF: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff"],
    description: "Create new staff records",
    routes: ["POST /staffs"]
  },
  
  BULK_CREATE_STAFF: {
    allowedRoles: ["admin", "super_admin"],
    description: "Bulk create staff records",
    routes: ["POST /staffs/bulk"]
  },
  
  UPDATE_STAFF: {
    allowedRoles: ["admin", "super_admin"],
    description: "Update staff information",
    routes: ["PUT /staffs/:id"]
  },
  
  DEACTIVATE_STAFF: {
    allowedRoles: ["admin", "super_admin"],
    description: "Deactivate staff account",
    routes: ["DELETE /staffs/:id"]
  },
  
  ACTIVATE_STAFF: {
    allowedRoles: ["admin", "super_admin"],
    description: "Activate staff account",
    routes: ["PATCH /staffs/:id/activate"]
  },
  
  SEARCH_STAFF: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff"],
    description: "Search staff members",
    routes: ["GET /staffs/search"]
  },
  
  VIEW_STAFF_STATISTICS: {
    allowedRoles: ["admin", "super_admin", "registrar"],
    description: "View staff statistics",
    routes: ["GET /staffs/statistics"]
  },
  
  VIEW_STAFF_BY_ID: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff"],
    description: "View staff by custom ID",
    routes: ["GET /staffs/staff-id/:staffId", "GET /staffs/:id"]
  },
  
  // ============================================
  // ADMIN UNIT MANAGEMENT
  // ============================================
  
  VIEW_MY_ADMIN_UNITS: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff", "lecturer", "student"],
    description: "View current user's administrative units",
    routes: ["GET /admin-units/my/units"]
  },
  
  VIEW_USER_ADMIN_UNITS: {
    allowedRoles: ["admin", "super_admin"],
    description: "View administrative units for any user",
    routes: ["GET /admin-units/user/:userId/units"]
  },
  
  VIEW_ADMIN_UNIT_TREE: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff"],
    description: "View administrative unit hierarchy",
    routes: ["GET /admin-units/tree/:id"]
  },
  
  CREATE_ADMIN_UNIT: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff", "head"],
    description: "Create administrative unit",
    routes: ["POST /admin-units"]
  },
  
  VIEW_ALL_ADMIN_UNITS: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff", "head"],
    description: "View all administrative units",
    routes: ["GET /admin-units"]
  },
  
  VIEW_ADMIN_UNIT_BY_ID: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff", "head"],
    description: "View administrative unit by ID",
    routes: ["GET /admin-units/:id"]
  },
  
  UPDATE_ADMIN_UNIT: {
    allowedRoles: ["admin", "super_admin", "head"],
    description: "Update administrative unit",
    routes: ["PUT /admin-units/:id"]
  },
  
  DEACTIVATE_ADMIN_UNIT: {
    allowedRoles: ["admin", "super_admin"],
    description: "Deactivate administrative unit",
    routes: ["DELETE /admin-units/:id"]
  },
  
  VIEW_ADMIN_UNIT_HIERARCHY: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff", "head"],
    description: "View unit hierarchy",
    routes: ["GET /admin-units/:id/hierarchy"]
  },
  
  ADD_ADMIN_UNIT_MEMBER: {
    allowedRoles: ["admin", "super_admin", "head"],
    description: "Add member to administrative unit",
    routes: ["POST /admin-units/:unitId/members"]
  },
  
  VIEW_ADMIN_UNIT_MEMBERS: {
    allowedRoles: ["admin", "super_admin", "registrar", "staff", "head"],
    description: "View members of administrative unit",
    routes: ["GET /admin-units/:unitId/members"]
  },
  
  UPDATE_ADMIN_UNIT_MEMBER: {
    allowedRoles: ["admin", "super_admin", "head"],
    description: "Update unit member details",
    routes: ["PUT /admin-units/members/:memberId"]
  },
  
  REMOVE_ADMIN_UNIT_MEMBER: {
    allowedRoles: ["admin", "super_admin", "head"],
    description: "Remove member from unit",
    routes: ["DELETE /admin-units/members/:memberId"]
  },
  
  // ============================================
  // DEPARTMENT MANAGEMENT
  // ============================================
  
  CREATE_DEPARTMENT: {
    allowedRoles: ["admin", "dean", "hod", "vc"],
    description: "Create new department",
    routes: ["POST /department"]
  },
  
  VIEW_ALL_DEPARTMENTS: {
    allowedRoles: ["admin", "dean", "hod", "vc"],
    description: "View all departments",
    routes: ["GET /department"]
  },
  
  VIEW_DEPARTMENT_STATS: {
    allowedRoles: ["admin", "dean"],
    description: "View department statistics",
    routes: ["GET /department/stats"]
  },
  
  VIEW_DEPARTMENT_BY_ID: {
    allowedRoles: ["admin", "dean"],
    description: "View department by ID",
    routes: ["GET /department/:departmentId"]
  },
  
  UPDATE_DEPARTMENT: {
    allowedRoles: ["admin"],
    description: "Update department",
    routes: ["PATCH /department/:departmentId"]
  },
  
  DELETE_DEPARTMENT: {
    allowedRoles: ["admin"],
    description: "Delete department",
    routes: ["DELETE /department/:departmentId"]
  },
  
  ASSIGN_HOD: {
    allowedRoles: ["admin", "dean"],
    description: "Assign Head of Department",
    routes: ["PATCH /department/:departmentId/assign-hod"]
  },
  
  REMOVE_HOD: {
    allowedRoles: ["admin", "dean"],
    description: "Remove Head of Department",
    routes: ["PATCH /department/:departmentId/remove-hod"]
  },
  
  // ============================================
  // FACULTY MANAGEMENT
  // ============================================
  
  CREATE_FACULTY: {
    allowedRoles: ["admin"],
    description: "Create new faculty",
    routes: ["POST /faculty"]
  },
  
  VIEW_ALL_FACULTIES: {
    allowedRoles: ["admin"],
    description: "View all faculties",
    routes: ["GET /faculty"]
  },
  
  VIEW_MY_FACULTY: {
    allowedRoles: ["dean"],
    description: "View my faculty",
    routes: ["GET /faculty/my-faculty"]
  },
  
  VIEW_FACULTY_BY_ID: {
    allowedRoles: ["admin", "dean"],
    description: "View faculty by ID",
    routes: ["GET /faculty/:facultyId"]
  },
  
  UPDATE_FACULTY: {
    allowedRoles: ["admin"],
    description: "Update faculty",
    routes: ["PATCH /faculty/:facultyId"]
  },
  
  DELETE_FACULTY: {
    allowedRoles: ["admin"],
    description: "Delete faculty",
    routes: ["DELETE /faculty/:facultyId"]
  },
  
  ASSIGN_DEAN: {
    allowedRoles: ["admin"],
    description: "Assign Dean to faculty",
    routes: ["PATCH /faculty/:facultyId/assign-dean"]
  },
  
  REMOVE_DEAN: {
    allowedRoles: ["admin"],
    description: "Remove Dean from faculty",
    routes: ["PATCH /faculty/:facultyId/remove-dean"]
  },
  
  // ============================================
  // COURSE MANAGEMENT
  // ============================================
  
  VIEW_ALL_COURSES: {
    allowedRoles: ["hod", "admin"],
    description: "View all courses",
    routes: ["GET /course"]
  },
  
  CREATE_COURSE: {
    allowedRoles: ["hod", "admin"],
    description: "Create new course",
    routes: ["POST /course"]
  },
  
  VIEW_COURSE_BY_ID: {
    allowedRoles: ["student", "admin", "lecturer", "hod"],
    description: "View course by ID",
    routes: ["GET /course/:courseId"]
  },
  
  UPDATE_COURSE: {
    allowedRoles: ["hod", "admin"],
    description: "Update course",
    routes: ["PATCH /course/:id"]
  },
  
  DELETE_COURSE: {
    allowedRoles: ["hod", "admin"],
    description: "Delete course",
    routes: ["DELETE /course/:id"]
  },
  
  ASSIGN_COURSE_TO_LECTURER: {
    allowedRoles: ["hod", "admin"],
    description: "Assign course to lecturer",
    routes: ["POST /course/:id/assign"]
  },
  
  UNASSIGN_COURSE: {
    allowedRoles: ["hod", "admin"],
    description: "Unassign course from lecturer",
    routes: ["POST /course/:id/unassign"]
  },
  
  VIEW_LECTURER_COURSES: {
    allowedRoles: ["hod", "admin", "lecturer"],
    description: "View lecturer's courses",
    routes: ["GET /course/lecturer"]
  },
  
  VIEW_REGISTERABLE_COURSES: {
    allowedRoles: ["student"],
    description: "View registerable courses",
    routes: ["GET /course/available"]
  },
  
  VIEW_BORROWED_COURSES: {
    allowedRoles: ["hod"],
    description: "View borrowed courses from department",
    routes: ["GET /course/borrowed"]
  },
  
  VIEW_STUDENT_COURSE_REGISTRATIONS: {
    allowedRoles: ["student", "hod"],
    description: "View student course registrations",
    routes: ["GET /course/check-registration", "GET /course/check-registration/:studentId"]
  },
  
  VIEW_COURSE_STUDENTS: {
    allowedRoles: ["hod", "admin", "lecturer", "student"],
    description: "View students in a course",
    routes: ["GET /course/:courseId/students"]
  },
  
  VIEW_COURSE_RESULTS: {
    allowedRoles: ["student", "hod", "admin", "lecturer"],
    description: "View course results",
    routes: ["GET /course/:courseId/results"]
  },
  
  VIEW_COURSE_REGISTRATION_REPORT: {
    allowedRoles: ["hod", "admin"],
    description: "View course registration report",
    routes: ["GET /course/stats"]
  },
  
  // ============================================
  // COURSE MATERIALS
  // ============================================
  
  UPLOAD_COURSE_MATERIAL: {
    allowedRoles: ["instructor", "admin", "lecturer"],
    description: "Upload course materials",
    routes: ["POST /course/assignments/:courseId/materials"]
  },
  
  REORDER_COURSE_MATERIALS: {
    allowedRoles: ["instructor", "admin", "lecturer", "hod"],
    description: "Reorder course materials",
    routes: ["PUT /course/assignments/:courseAssignmentId/materials/reorder"]
  },
  
  UPDATE_COURSE_MATERIAL: {
    allowedRoles: ["instructor", "admin", "lecturer", "hod", "ta"],
    description: "Update course material",
    routes: ["PUT /course/assignments/materials/:materialId"]
  },
  
  DELETE_COURSE_MATERIAL: {
    allowedRoles: ["lecturer", "hod", "admin"],
    description: "Delete course material",
    routes: ["DELETE /course/assignments/materials/:materialId"]
  },
  
  VIEW_COURSE_MATERIALS: {
    allowedRoles: ["student", "instructor", "admin", "lecturer", "hod", "ta"],
    description: "View course materials",
    routes: ["GET /course/assignments/:courseId/materials", "GET /course/assignments/materials/:materialId"]
  },
  
  VIEW_COURSE_MATERIALS_BY_WEEK: {
    allowedRoles: ["student", "instructor", "admin", "lecturer", "hod", "ta"],
    description: "View course materials by week",
    routes: ["GET /course/assignments/:courseAssignmentId/materials/week"]
  },
  
  // ============================================
  // RESULT MANAGEMENT
  // ============================================
  
  UPLOAD_RESULT: {
    allowedRoles: ["lecturer", "hod", "admin"],
    description: "Upload student result",
    routes: ["POST /results/upload/:courseId", "POST /results/upload-student/:studentId"]
  },
  
  BULK_UPLOAD_RESULTS: {
    allowedRoles: ["lecturer", "hod", "admin"],
    description: "Bulk upload results",
    routes: ["POST /results/bulk"]
  },
  
  UPDATE_RESULT: {
    allowedRoles: ["lecturer", "hod"],
    description: "Update existing result",
    routes: ["PATCH /results/edit/:id"]
  },
  
  APPROVE_RESULT: {
    allowedRoles: ["hod"],
    description: "Approve result",
    routes: ["PATCH /results/:id/approve"]
  },
  
  LOCK_RESULT: {
    allowedRoles: ["hod", "admin"],
    description: "Lock result",
    routes: ["PATCH /results/:id/lock"]
  },
  
  VIEW_ALL_RESULTS: {
    allowedRoles: ["admin", "hod"],
    description: "View all results",
    routes: ["GET /results/all"]
  },
  
  VIEW_RESULT_ANALYTICS: {
    allowedRoles: ["admin", "hod"],
    description: "View result analytics",
    routes: ["GET /results/analytics"]
  },
  
  VIEW_RESULT_BY_ID: {
    allowedRoles: ["admin", "hod", "lecturer"],
    description: "View result by ID",
    routes: ["GET /results/:id"]
  },
  
  DELETE_RESULT: {
    allowedRoles: ["admin"],
    description: "Delete result",
    routes: ["DELETE /results/:id"]
  },
  
  VIEW_RESULTS_FOR_STUDENT: {
    allowedRoles: ["hod", "admin"],
    description: "View results for a student",
    routes: ["GET /results/student/:studentId"]
  },
  
  VIEW_RESULT_STATS: {
    allowedRoles: ["hod", "admin"],
    description: "View result statistics",
    routes: ["GET /results/stats"]
  },
  
  VIEW_LECTURER_RESULT_STATS: {
    allowedRoles: ["hod", "admin"],
    description: "View lecturer result statistics",
    routes: ["GET /results/stats/lecturers"]
  },
  
  VIEW_COURSE_RESULT_STATS: {
    allowedRoles: ["hod", "admin"],
    description: "View course result statistics",
    routes: ["GET /results/stats/:courseId"]
  },
  
  DOWNLOAD_STUDENT_RESULT: {
    allowedRoles: ["student", "lecturer", "staff", "admin", "hod"],
    description: "Download student result as PDF",
    routes: ["GET /results/download/:studentId"]
  },
  
  DOWNLOAD_TRANSCRIPT: {
    allowedRoles: ["student", "admin", "registrar", "hod"],
    description: "Download transcript as PDF",
    routes: ["GET /results/transcript/:studentId"]
  },
  
  PREVIEW_STUDENT_RESULT: {
    allowedRoles: ["student", "lecturer", "staff", "admin", "hod"],
    description: "Preview student result as HTML",
    routes: ["GET /results/preview/:studentId"]
  },
  
  PREVIEW_TRANSCRIPT: {
    allowedRoles: ["student", "lecturer", "staff", "admin", "hod"],
    description: "Preview transcript as HTML",
    routes: ["GET /results/transcript/preview/:studentId"]
  },
  
  // ============================================
  // COMPUTATION & GPA
  // ============================================
  
  COMPUTE_ALL_RESULTS: {
    allowedRoles: ["admin"],
    description: "Compute all results",
    routes: ["POST /computation/compute-all", "POST /computation/workers/compute-all"]
  },
  
  VIEW_COMPUTATION_STATUS: {
    allowedRoles: ["admin", "hod", "lecturer"],
    description: "View computation status",
    routes: ["GET /computation/status/:masterComputationId"]
  },
  
  CANCEL_COMPUTATION: {
    allowedRoles: ["admin"],
    description: "Cancel computation",
    routes: ["POST /computation/cancel/:masterComputationId"]
  },
  
  RETRY_COMPUTATION: {
    allowedRoles: ["admin"],
    description: "Retry failed computation",
    routes: ["POST /computation/retry/:masterComputationId"]
  },
  
  VIEW_COMPUTATION_HISTORY: {
    allowedRoles: ["admin", "hod"],
    description: "View computation history",
    routes: ["GET /computation/history"]
  },
  
  VIEW_ALL_COMPUTATIONS: {
    allowedRoles: ["hod", "admin"],
    description: "View all computations",
    routes: ["GET /computation/"]
  },
  
  CALCULATE_SEMESTER_GPA: {
    allowedRoles: ["student", "admin", "lecturer"],
    description: "Calculate semester GPA",
    routes: ["GET /computation/gpa/student/:studentId/semester/:semesterId"]
  },
  
  DOWNLOAD_MASTER_SHEET: {
    allowedRoles: ["admin", "hod"],
    description: "Download master sheet",
    routes: ["GET /computation/summary/:summaryId/:level/:type"]
  },
  
  PREVIEW_MASTER_SHEET: {
    allowedRoles: ["admin", "hod"],
    description: "Preview master sheet",
    routes: ["GET /computation/summary/:summaryId/:level/preview"]
  },
  
  CLEAR_MASTER_SHEET_CACHE: {
    allowedRoles: ["admin", "hod"],
    description: "Clear master sheet cache",
    routes: ["DELETE /computation/summary/:summaryId/cache"]
  },
  
  VIEW_HOD_COMPUTATION_SUMMARY: {
    allowedRoles: ["hod", "admin"],
    description: "View HOD computation summary",
    routes: ["GET /computation/hod/summary"]
  },
  
  VIEW_HOD_COMPUTATION_HISTORY: {
    allowedRoles: ["hod", "admin"],
    description: "View HOD computation history",
    routes: ["GET /computation/hod/history"]
  },
  
  VIEW_HOD_COMPUTATION_DETAILS: {
    allowedRoles: ["hod", "admin"],
    description: "View HOD computation details",
    routes: ["GET /computation/hod/summary/:summaryId"]
  },
  
  VIEW_HOD_COMPUTATION_SEMESTERS: {
    allowedRoles: ["hod", "admin"],
    description: "View HOD computation semesters",
    routes: ["GET /computation/hod/semesters"]
  },
  
  // ============================================
  // CARRYOVER MANAGEMENT
  // ============================================
  
  VIEW_STUDENT_CARRYOVERS: {
    allowedRoles: ["student", "admin", "lecturer"],
    description: "View student carryovers",
    routes: ["GET /carryover/student", "GET /carryover/student/stats", "GET /carryover/:id"]
  },
  
  CREATE_CARRYOVER: {
    allowedRoles: ["admin", "lecturer", "hod"],
    description: "Create carryover",
    routes: ["POST /carryover"]
  },
  
  GENERATE_CARRYOVERS_FROM_RESULTS: {
    allowedRoles: ["admin", "lecturer", "hod"],
    description: "Generate carryovers from results",
    routes: ["POST /carryover/generate-from-results"]
  },
  
  VIEW_CARRYOVERS_BY_DEPARTMENT: {
    allowedRoles: ["admin", "lecturer", "hod"],
    description: "View carryovers by department",
    routes: ["GET /carryover/department/:departmentId"]
  },
  
  UPDATE_CARRYOVER_CLEARANCE: {
    allowedRoles: ["admin", "lecturer", "hod"],
    description: "Update carryover clearance",
    routes: ["PUT /carryover/:id/clear"]
  },
  
  DELETE_CARRYOVER: {
    allowedRoles: ["admin", "lecturer", "hod"],
    description: "Delete carryover",
    routes: ["DELETE /carryover/:id"]
  },
  
  // ============================================
  // SEMESTER MANAGEMENT
  // ============================================
  
  START_NEW_SEMESTER: {
    allowedRoles: ["admin"],
    description: "Start new semester",
    routes: ["POST /semester/start"]
  },
  
  ROLLBACK_SEMESTER: {
    allowedRoles: ["admin"],
    description: "Rollback semester",
    routes: ["POST /semester/rollback"]
  },
  
  CHECK_ROLLBACK_AVAILABLE: {
    allowedRoles: ["admin"],
    description: "Check if rollback is available",
    routes: ["GET /semester/can-rollback"]
  },
  
  VIEW_SEMESTERS_BY_DEPARTMENT: {
    allowedRoles: ["admin", "hod", "dean"],
    description: "View semesters by department",
    routes: ["GET /semester/all/:departmentId"]
  },
  
  TOGGLE_COURSE_REGISTRATION: {
    allowedRoles: ["admin", "hod"],
    description: "Toggle course registration",
    routes: ["PATCH /semester/registration", "PATCH /semester/toggle-registration"]
  },
  
  TOGGLE_RESULT_PUBLICATION: {
    allowedRoles: ["admin"],
    description: "Toggle result publication",
    routes: ["PATCH /semester/results"]
  },
  
  VIEW_ACTIVE_SEMESTER: {
    allowedRoles: ["admin", "hod", "dean", "student"],
    description: "View active semester",
    routes: ["GET /semester/active"]
  },
  
  DEACTIVATE_SEMESTER: {
    allowedRoles: ["admin"],
    description: "Deactivate semester",
    routes: ["PATCH /semester/deactivate"]
  },
  
  UPDATE_LEVEL_SETTINGS: {
    allowedRoles: ["hod", "admin"],
    description: "Update level settings",
    routes: ["PATCH /semester/settings"]
  },
  
  // ============================================
  // PROGRAMME MANAGEMENT
  // ============================================
  
  CREATE_PROGRAMME: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "Create new programme",
    routes: ["POST /programme"]
  },
  
  VIEW_ALL_PROGRAMMES: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "View all programmes",
    routes: ["GET /programme"]
  },
  
  VIEW_PROGRAMME_STATS: {
    allowedRoles: ["admin", "dean"],
    description: "View programme statistics",
    routes: ["GET /programme/stats"]
  },
  
  VIEW_PROGRAMME_BY_ID: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "View programme by ID",
    routes: ["GET /programme/:programmeId"]
  },
  
  UPDATE_PROGRAMME: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "Update programme",
    routes: ["PATCH /programme/:programmeId"]
  },
  
  DELETE_PROGRAMME: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "Delete programme",
    routes: ["DELETE /programme/:programmeId"]
  },
  
  TOGGLE_PROGRAMME_STATUS: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "Toggle programme status",
    routes: ["PATCH /programme/:programmeId/toggle-status"]
  },
  
  VIEW_PROGRAMMES_BY_DEPARTMENT: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "View programmes by department",
    routes: ["GET /programme/department/:departmentId"]
  },
  
  VIEW_PROGRAMMES_BY_DEGREE_TYPE: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "View programmes by degree type",
    routes: ["GET /programme/degree-type/:degreeType"]
  },
  
  // ============================================
  // ATTENDANCE MANAGEMENT
  // ============================================
  
  CREATE_ATTENDANCE_SESSION: {
    allowedRoles: ["lecturer", "course_rep"],
    description: "Create attendance session",
    routes: ["POST /attendance/sessions"]
  },
  
  TOGGLE_ATTENDANCE_SESSION_STATUS: {
    allowedRoles: ["lecturer"],
    description: "Toggle attendance session status",
    routes: ["PUT /attendance/sessions/:id/status"]
  },
  
  MARK_ATTENDANCE: {
    allowedRoles: ["lecturer", "course_rep"],
    description: "Mark attendance",
    routes: ["POST /attendance/mark"]
  },
  
  BULK_MARK_ATTENDANCE: {
    allowedRoles: ["lecturer"],
    description: "Bulk mark attendance",
    routes: ["POST /attendance/mark/bulk"]
  },
  
  VIEW_ATTENDANCE_REPORT: {
    allowedRoles: ["student", "lecturer", "admin", "hod"],
    description: "View attendance report",
    routes: ["GET /attendance/report/assignment/:assignment_id"]
  },
  
  VIEW_STUDENT_ATTENDANCE_ANALYTICS: {
    allowedRoles: ["student", "lecturer", "admin", "hod"],
    description: "View student attendance analytics",
    routes: ["GET /attendance/analytics/student"]
  },
  
  VIEW_COURSE_ATTENDANCE_ANALYTICS: {
    allowedRoles: ["lecturer", "admin", "hod"],
    description: "View course attendance analytics",
    routes: ["GET /attendance/analytics/course"]
  },
  
  // ============================================
  // PAYMENT MANAGEMENT
  // ============================================
  
  VIEW_EXPECTED_PAYMENT_AMOUNT: {
    allowedRoles: ["student"],
    description: "View expected payment amount",
    routes: ["GET /payments/expected-amount"]
  },
  
  INITIALIZE_PAYMENT: {
    allowedRoles: ["student"],
    description: "Initialize payment",
    routes: ["POST /payments/initialize"]
  },
  
  CHECK_PAYMENT_STATUS: {
    allowedRoles: ["student"],
    description: "Check payment status",
    routes: ["GET /payments/status/:transactionRef"]
  },
  
  CANCEL_PAYMENT: {
    allowedRoles: ["student"],
    description: "Cancel pending payment",
    routes: ["DELETE /payments/cancel/:transactionRef"]
  },
  
  VIEW_PAYMENT_HISTORY: {
    allowedRoles: ["student"],
    description: "View payment history",
    routes: ["GET /payments/history"]
  },
  
  VIEW_PAYMENT_PROVIDERS: {
    allowedRoles: ["student"],
    description: "View available payment providers",
    routes: ["GET /payments/providers"]
  },
  
  VERIFY_PAYMENT: {
    allowedRoles: ["student"],
    description: "Verify payment",
    routes: ["GET /payments/verify/:transactionRef"]
  },
  
  // ============================================
  // NOTIFICATION MANAGEMENT
  // ============================================
  
  VIEW_NOTIFICATIONS: {
    allowedRoles: ["admin", "hod", "lecturer", "student", "dean"],
    description: "View notifications",
    routes: ["GET /notifications"]
  },
  
  VIEW_UNREAD_NOTIFICATION_COUNT: {
    allowedRoles: ["admin", "hod", "lecturer", "student", "dean"],
    description: "View unread notification count",
    routes: ["GET /notifications/unread-count"]
  },
  
  VIEW_TOP_UNREAD_NOTIFICATIONS: {
    allowedRoles: ["admin", "hod", "lecturer", "student", "dean"],
    description: "View top unread notifications",
    routes: ["GET /notifications/top-unread"]
  },
  
  VIEW_NOTIFICATION_TEMPLATES: {
    allowedRoles: ["admin", "hod", "lecturer", "student", "dean"],
    description: "View notification templates",
    routes: ["GET /notifications/templates"]
  },
  
  CREATE_NOTIFICATION_TEMPLATE: {
    allowedRoles: ["admin"],
    description: "Create notification template",
    routes: ["POST /notifications/templates"]
  },
  
  UPDATE_NOTIFICATION_TEMPLATE: {
    allowedRoles: ["admin"],
    description: "Update notification template",
    routes: ["PUT /notifications/templates/:id"]
  },
  
  DELETE_NOTIFICATION_TEMPLATE: {
    allowedRoles: ["admin"],
    description: "Delete notification template",
    routes: ["DELETE /notifications/templates/:id"]
  },
  
  SEND_NOTIFICATION: {
    allowedRoles: ["admin"],
    description: "Send notification",
    routes: ["POST /notifications/send"]
  },
  
  // ============================================
  // ANNOUNCEMENT MANAGEMENT
  // ============================================
  
  VIEW_ANNOUNCEMENTS: {
    allowedRoles: ["student", "lecturer", "staff", "admin", "hod", "dean"],
    description: "View announcements",
    routes: ["GET /announcements", "GET /announcements/categories", "GET /announcements/:id"]
  },
  
  CREATE_ANNOUNCEMENT: {
    allowedRoles: ["admin", "instructor"],
    description: "Create announcement",
    routes: ["POST /announcements"]
  },
  
  UPDATE_ANNOUNCEMENT: {
    allowedRoles: ["admin", "instructor"],
    description: "Update announcement",
    routes: ["PUT /announcements/:id"]
  },
  
  DELETE_ANNOUNCEMENT: {
    allowedRoles: ["admin"],
    description: "Delete announcement",
    routes: ["DELETE /announcements/:id"]
  },
  
  // ============================================
  // RANKING MANAGEMENT
  // ============================================
  
  VIEW_RANKING_HEALTH: {
    allowedRoles: ["admin"],
    description: "View ranking system health",
    routes: ["GET /ranking/health"]
  },
  
  VIEW_CURRENT_DEPARTMENT_RANKING: {
    allowedRoles: ["student"],
    description: "View current department ranking",
    routes: ["GET /ranking/current"]
  },
  
  VIEW_GLOBAL_TOP_RANKING: {
    allowedRoles: ["student", "lecturer", "admin", "dean", "hod"],
    description: "View global top ranking",
    routes: ["GET /ranking/global-top"]
  },
  
  VIEW_STUDENT_RANKING_HISTORY: {
    allowedRoles: ["student"],
    description: "View student ranking history",
    routes: ["GET /ranking/student/history"]
  },
  
  VIEW_WEEKLY_RANKING: {
    allowedRoles: ["student", "lecturer", "admin", "dean", "hod"],
    description: "View weekly ranking",
    routes: ["GET /ranking/week/:year/:week"]
  },
  
  VIEW_DEPARTMENT_RANKING_HISTORY: {
    allowedRoles: ["student", "lecturer", "admin", "dean", "hod"],
    description: "View department ranking history",
    routes: ["GET /ranking/department/:departmentId/history"]
  },
  
  VIEW_DEPARTMENT_RANKING_TRENDS: {
    allowedRoles: ["lecturer", "admin", "dean", "hod"],
    description: "View department ranking trends",
    routes: ["GET /ranking/department/:departmentId/trends"]
  },
  
  VIEW_RANKING_STATS: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "View ranking statistics",
    routes: ["GET /ranking/stats"]
  },
  
  TRIGGER_RANKING_GENERATION: {
    allowedRoles: ["admin"],
    description: "Trigger ranking generation",
    routes: ["POST /ranking/generate"]
  },
  
  VIEW_RANKING_GENERATION_STATUS: {
    allowedRoles: ["admin"],
    description: "View ranking generation status",
    routes: ["GET /ranking/generation-status"]
  },
  
  CONTROL_RANKING_SCHEDULER: {
    allowedRoles: ["admin"],
    description: "Control ranking scheduler",
    routes: ["POST /ranking/scheduler/start", "POST /ranking/scheduler/stop", "GET /ranking/scheduler/status"]
  },
  
  // ============================================
  // FEEDBACK MANAGEMENT
  // ============================================
  
  SUBMIT_FEEDBACK: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Submit feedback",
    routes: ["POST /feedback/submit"]
  },
  
  VIEW_MY_FEEDBACK: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View my feedback",
    routes: ["GET /feedback/my-feedback", "GET /feedback/user/my-feedback"]
  },
  
  VIEW_FEEDBACK: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View feedback",
    routes: ["GET /feedback/:id"]
  },
  
  VIEW_ALL_FEEDBACK: {
    allowedRoles: ["admin", "customer_service"],
    description: "View all feedback",
    routes: ["GET /feedback/admin/all"]
  },
  
  ADD_FEEDBACK_RESPONSE: {
    allowedRoles: ["admin", "customer_service"],
    description: "Add feedback response",
    routes: ["POST /feedback/:id/responses"]
  },
  
  UPDATE_FEEDBACK_STATUS: {
    allowedRoles: ["admin", "customer_service"],
    description: "Update feedback status",
    routes: ["PATCH /feedback/:id/status"]
  },
  
  VIEW_FEEDBACK_STATS: {
    allowedRoles: ["admin", "customer_service"],
    description: "View feedback statistics",
    routes: ["GET /feedback/admin/stats/overview"]
  },
  
  VIEW_DAILY_FEEDBACK_ANALYTICS: {
    allowedRoles: ["admin"],
    description: "View daily feedback analytics",
    routes: ["GET /feedback/admin/analytics/daily"]
  },
  
  VIEW_AVAILABLE_STAFF: {
    allowedRoles: ["admin"],
    description: "View available staff for assignment",
    routes: ["GET /feedback/admin/staff/available"]
  },
  
  ASSIGN_FEEDBACK: {
    allowedRoles: ["admin"],
    description: "Assign feedback to staff",
    routes: ["POST /feedback/admin/:id/assign"]
  },
  
  EXPORT_FEEDBACK: {
    allowedRoles: ["admin"],
    description: "Export feedback data",
    routes: ["GET /feedback/admin/export"]
  },
  
  DELETE_FEEDBACK: {
    allowedRoles: ["admin"],
    description: "Delete feedback",
    routes: ["DELETE /feedback/admin/:id"]
  },
  
  UPLOAD_FEEDBACK_FILE: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Upload feedback file",
    routes: ["POST /feedback/upload"]
  },
  
  // ============================================
  // ADMISSION MANAGEMENT
  // ============================================
  
  VIEW_APPLICANT_DASHBOARD: {
    allowedRoles: ["applicant"],
    description: "View applicant dashboard",
    routes: ["GET /admission/applicant/dashboard"]
  },
  
  VIEW_APPLICATION_DETAILS: {
    allowedRoles: ["applicant"],
    description: "View application details",
    routes: ["GET /admission/applicant/applications/:applicationId"]
  },
  
  VIEW_APPLICATION_DOCUMENTS: {
    allowedRoles: ["applicant"],
    description: "View application documents",
    routes: ["GET /admission/applicant/applications/:applicationId/documents"]
  },
  
  DOWNLOAD_DOCUMENT: {
    allowedRoles: ["applicant"],
    description: "Download document",
    routes: ["GET /admission/applicant/documents/:documentId/download"]
  },
  
  CHECK_VERIFICATION_STATUS: {
    allowedRoles: ["applicant"],
    description: "Check verification status",
    routes: ["GET /admission/applicant/applications/:applicationId/verification-status"]
  },
  
  RECORD_ACCEPTANCE: {
    allowedRoles: ["applicant"],
    description: "Record admission acceptance",
    routes: ["POST /admission/applicant/acceptance"]
  },
  
  GET_ACCEPTANCE_STATUS: {
    allowedRoles: ["applicant"],
    description: "Get acceptance status",
    routes: ["GET /admission/applicant/applications/:applicationId/acceptance-status"]
  },
  
  DOWNLOAD_ADMISSION_LETTER: {
    allowedRoles: ["applicant"],
    description: "Download admission letter",
    routes: ["GET /admission/applicant/applications/:applicationId/admission-letter"]
  },
  
  VIEW_ADMIN_REVIEW_QUEUE: {
    allowedRoles: ["admin", "admissionOfficer", "reviewer"],
    description: "View admin review queue",
    routes: ["GET /admission/admin/review-queue"]
  },
  
  SUBMIT_APPLICATION: {
    allowedRoles: ["admin", "admissionOfficer", "reviewer"],
    description: "Submit application",
    routes: ["POST /admission/admin/applications/:applicationId/submit"]
  },
  
  SCHEDULE_POST_UTME: {
    allowedRoles: ["admin", "admissionOfficer", "reviewer"],
    description: "Schedule post-UTME",
    routes: ["POST /admission/admin/applications/:applicationId/schedule-post-utme"]
  },
  
  RECORD_POST_UTME_SCORE: {
    allowedRoles: ["admin", "admissionOfficer", "reviewer"],
    description: "Record post-UTME score",
    routes: ["POST /admission/admin/applications/:applicationId/record-post-utme-score"]
  },
  
  MAKE_ADMISSION_DECISION: {
    allowedRoles: ["admin", "admissionOfficer", "reviewer"],
    description: "Make admission decision",
    routes: ["POST /admission/admin/applications/decide"]
  },
  
  VIEW_DOCUMENTS_FOR_REVIEW: {
    allowedRoles: ["admin", "admissionOfficer", "reviewer"],
    description: "View documents for review",
    routes: ["GET /admission/admin/documents/review"]
  },
  
  VERIFY_DOCUMENT: {
    allowedRoles: ["admin", "admissionOfficer", "reviewer"],
    description: "Verify document",
    routes: ["POST /admission/admin/documents/:documentId/verify"]
  },
  
  VERIFY_ACCEPTANCE_FEE: {
    allowedRoles: ["admin", "admissionOfficer", "reviewer"],
    description: "Verify acceptance fee",
    routes: ["POST /admission/admin/applications/:applicationId/verify-fee"]
  },
  
  REGENERATE_ADMISSION_LETTER: {
    allowedRoles: ["admin", "admissionOfficer", "reviewer"],
    description: "Regenerate admission letter",
    routes: ["POST /admission/admin/applications/:applicationId/regenerate-letter"]
  },
  
  VIEW_APPLICATION_STATISTICS: {
    allowedRoles: ["admin", "admissionOfficer", "reviewer"],
    description: "View application statistics",
    routes: ["GET /admission/admin/statistics/:admissionCycleId"]
  },
  
  // ============================================
  // AI & CHAT
  // ============================================
  
  AI_CHAT: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "AI chat",
    routes: ["POST /ai/chat/stream", "POST /ai/chat"]
  },
  
  VIEW_AI_CONVERSATIONS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View AI conversations",
    routes: ["GET /ai/conversations"]
  },
  
  VIEW_AI_CONVERSATION: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View AI conversation",
    routes: ["GET /ai/conversations/:id"]
  },
  
  DELETE_AI_CONVERSATION: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Delete AI conversation",
    routes: ["DELETE /ai/conversations/:id"]
  },
  
  VIEW_AI_PREFERENCES: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View AI preferences",
    routes: ["GET /ai/preferences"]
  },
  
  UPDATE_AI_PREFERENCES: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Update AI preferences",
    routes: ["PUT /ai/preferences", "PUT /ai/preferences/display", "PUT /ai/preferences/export"]
  },
  
  MANAGE_AI_SAVED_QUERIES: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Manage AI saved queries",
    routes: ["GET /ai/preferences/queries", "POST /ai/preferences/queries", "DELETE /ai/preferences/queries/:name"]
  },
  
  VIEW_AI_EFFECTIVE_FORMAT: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View AI effective format",
    routes: ["POST /ai/preferences/format"]
  },
  
  VIEW_MY_CHATS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View my chats",
    routes: ["GET /chat/my-chats"]
  },
  
  VIEW_CHAT_HISTORY: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View chat history",
    routes: ["GET /chat/history/:session_id"]
  },
  
  VIEW_ALL_ACTIVE_CHATS: {
    allowedRoles: ["admin"],
    description: "View all active chats",
    routes: ["GET /chat/admin/active-chats"]
  },
  
  VIEW_AVAILABLE_ATTENDANTS: {
    allowedRoles: ["admin"],
    description: "View available attendants",
    routes: ["GET /chat/admin/attendants"]
  },
  
  ASSIGN_CHAT: {
    allowedRoles: ["admin"],
    description: "Assign chat",
    routes: ["POST /chat/admin/assign"]
  },
  
  UPLOAD_CHAT_FILE: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Upload chat file",
    routes: ["POST /chat/upload"]
  },
  
  // ============================================
  // AUTHENTICATION & SECURITY
  // ============================================
  
  SHADOW_LOGIN: {
    allowedRoles: ["admin"],
    description: "Shadow login as another user",
    routes: ["POST /auth/shadow-login"]
  },
  
  SIGNIN: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Sign in",
    routes: ["POST /auth/signin/:role"]
  },
  
  VIEW_PASSWORD_STATUS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View password status",
    routes: ["GET /auth/:userId/password-status"]
  },
  
  CHANGE_PASSWORD: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Change password",
    routes: ["PUT /auth/password"]
  },
  
  FORCE_PASSWORD_RESET: {
    allowedRoles: ["admin"],
    description: "Force password reset",
    routes: ["POST /auth/:userId/force-password-reset"]
  },
  
  CHECK_PASSWORD_STRENGTH: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Check password strength",
    routes: ["POST /auth/security/password/strength"]
  },
  
  VIEW_PASSWORD_AGE: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View password age",
    routes: ["GET /auth/security/password/age"]
  },
  
  INITIATE_PASSWORD_RESET: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Initiate password reset",
    routes: ["POST /auth/auth/password/reset"]
  },
  
  VIEW_MFA_SETTINGS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View MFA settings",
    routes: ["GET /auth/security/mfa"]
  },
  
  SETUP_MFA: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Setup MFA",
    routes: ["POST /auth/security/mfa/setup"]
  },
  
  VERIFY_MFA: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Verify MFA",
    routes: ["POST /auth/security/mfa/verify"]
  },
  
  DISABLE_MFA: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Disable MFA",
    routes: ["POST /auth/security/mfa/disable"]
  },
  
  REGENERATE_BACKUP_CODES: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Regenerate backup codes",
    routes: ["POST /auth/security/mfa/backup-codes"]
  },
  
  VIEW_ACTIVE_SESSIONS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View active sessions",
    routes: ["GET /auth/security/sessions"]
  },
  
  REVOKE_SESSION: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Revoke session",
    routes: ["POST /auth/security/sessions/revoke"]
  },
  
  REVOKE_ALL_SESSIONS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Revoke all sessions",
    routes: ["POST /auth/security/sessions/revoke-all"]
  },
  
  ADD_TRUSTED_DEVICE: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Add trusted device",
    routes: ["POST /auth/security/trusted-devices"]
  },
  
  REMOVE_TRUSTED_DEVICE: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Remove trusted device",
    routes: ["POST /auth/security/trusted-devices/remove"]
  },
  
  VIEW_CONNECTED_APPS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View connected apps",
    routes: ["GET /auth/security/connected-apps"]
  },
  
  REVOKE_APP_ACCESS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Revoke app access",
    routes: ["POST /auth/security/connected-apps/revoke"]
  },
  
  VIEW_LOGIN_HISTORY: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View login history",
    routes: ["GET /auth/security/login-history"]
  },
  
  VIEW_SECURITY_ALERTS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View security alerts",
    routes: ["GET /auth/security/alerts"]
  },
  
  MARK_ALERT_AS_READ: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Mark alert as read",
    routes: ["POST /auth/security/alerts/read"]
  },
  
  REPORT_PHISHING: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Report phishing",
    routes: ["POST /auth/security/report/phishing"]
  },
  
  REPORT_SECURITY_INCIDENT: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Report security incident",
    routes: ["POST /auth/security/report/incident"]
  },
  
  VIEW_PRIVACY_SETTINGS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View privacy settings",
    routes: ["GET /auth/security/privacy"]
  },
  
  UPDATE_PRIVACY_SETTINGS: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Update privacy settings",
    routes: ["PUT /auth/security/privacy"]
  },
  
  VIEW_SECURITY_HEALTH: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View security health",
    routes: ["GET /auth/security/health"]
  },
  
  INITIATE_ACCOUNT_RECOVERY: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Initiate account recovery",
    routes: ["POST /auth/security/account/recovery"]
  },
  
  VERIFY_RECOVERY_TOKEN: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Verify recovery token",
    routes: ["POST /auth/security/account/recovery/verify"]
  },
  
  COMPLETE_ACCOUNT_RECOVERY: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Complete account recovery",
    routes: ["POST /auth/security/account/recovery/complete"]
  },
  
  // ============================================
  // AUDIT LOGS
  // ============================================
  
  VIEW_MY_ACTIVITY: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View my activity",
    routes: ["GET /audit/my-activity"]
  },
  
  VIEW_AUDIT_LOGS: {
    allowedRoles: ["admin"],
    description: "View audit logs",
    routes: ["GET /audit/logs"]
  },
  
  VIEW_AUDIT_STATISTICS: {
    allowedRoles: ["admin"],
    description: "View audit statistics",
    routes: ["GET /audit/statistics"]
  },
  
  VIEW_ENTITY_HISTORY: {
    allowedRoles: ["admin"],
    description: "View entity history",
    routes: ["GET /audit/entity/:entity/:entityId"]
  },
  
  VIEW_USER_ACTIVITY: {
    allowedRoles: ["admin"],
    description: "View user activity",
    routes: ["GET /audit/user/:userId/activity"]
  },
  
  EXPORT_AUDIT_LOGS: {
    allowedRoles: ["admin"],
    description: "Export audit logs",
    routes: ["GET /audit/export"]
  },
  
  VIEW_SUSPICIOUS_ACTIVITIES: {
    allowedRoles: ["admin"],
    description: "View suspicious activities",
    routes: ["GET /audit/suspicious"]
  },
  
  MARK_AUDIT_LOG_AS_REVIEWED: {
    allowedRoles: ["admin"],
    description: "Mark audit log as reviewed",
    routes: ["PATCH /audit/:logId/review"]
  },
  
  // ============================================
  // SYSTEM & ADMIN
  // ============================================
  
  VIEW_ADMIN_OVERVIEW: {
    allowedRoles: ["admin"],
    description: "View admin overview",
    routes: ["GET /admin/overview"]
  },
  
  VIEW_SYSTEM_SETTINGS: {
    allowedRoles: ["admin"],
    description: "View system settings",
    routes: ["GET /settings"]
  },
  
  UPDATE_SYSTEM_SETTINGS: {
    allowedRoles: ["admin"],
    description: "Update system settings",
    routes: ["PATCH /settings"]
  },
  
  RESET_SYSTEM_SETTINGS: {
    allowedRoles: ["admin"],
    description: "Reset system settings",
    routes: ["POST /settings/reset"]
  },
  
  LIST_SYSTEM_SCRIPTS: {
    allowedRoles: ["admin"],
    description: "List system scripts",
    routes: ["GET /admin/scripts"]
  },
  
  RUN_SYSTEM_SCRIPT: {
    allowedRoles: ["admin"],
    description: "Run system script",
    routes: ["POST /admin/scripts/run"]
  },
  
  CREATE_DATABASE_BACKUP: {
    allowedRoles: ["admin"],
    description: "Create database backup",
    routes: ["POST /database/create"]
  },
  
  LIST_DATABASE_BACKUPS: {
    allowedRoles: ["admin"],
    description: "List database backups",
    routes: ["GET /database/list"]
  },
  
  RESTORE_DATABASE_BACKUP: {
    allowedRoles: ["admin"],
    description: "Restore database backup",
    routes: ["POST /database/restore"]
  },
  
  DELETE_DATABASE_BACKUP: {
    allowedRoles: ["admin"],
    description: "Delete database backup",
    routes: ["DELETE /database/:backupId"]
  },
  
  VIEW_ERROR_LOGS: {
    allowedRoles: ["admin"],
    description: "View error logs",
    routes: ["GET /errors"]
  },
  
  VIEW_ERROR_LOGS_BY_TYPE: {
    allowedRoles: ["admin"],
    description: "View error logs by type",
    routes: ["GET /errors/type/:type"]
  },
  
  DELETE_ERROR_LOG: {
    allowedRoles: ["admin"],
    description: "Delete error log",
    routes: ["DELETE /errors/:id"]
  },
  
  CREATE_ERROR_LOG: {
    allowedRoles: ["admin"],
    description: "Create error log",
    routes: ["POST /errors"]
  },
  
  VIEW_WHATSAPP_SERVICE_INFO: {
    allowedRoles: ["admin"],
    description: "View WhatsApp service info",
    routes: ["GET /whatsapp/info"]
  },
  
  VIEW_WHATSAPP_WORKERS: {
    allowedRoles: ["admin"],
    description: "View WhatsApp workers",
    routes: ["GET /whatsapp/workers"]
  },
  
  CONTROL_WHATSAPP_WORKER: {
    allowedRoles: ["admin"],
    description: "Control WhatsApp worker",
    routes: ["POST /whatsapp/worker/pause", "POST /whatsapp/worker/resume", "POST /whatsapp/worker/restart"]
  },
  
  INITIALIZE_WHATSAPP_SESSION: {
    allowedRoles: ["admin"],
    description: "Initialize WhatsApp session",
    routes: ["POST /whatsapp/session/init"]
  },
  
  LOGOUT_WHATSAPP: {
    allowedRoles: ["admin"],
    description: "Logout WhatsApp",
    routes: ["POST /whatsapp/session/logout"]
  },
  
  VIEW_WHATSAPP_SESSION_STATUS: {
    allowedRoles: ["admin"],
    description: "View WhatsApp session status",
    routes: ["GET /whatsapp/session/status"]
  },
  
  VIEW_ALL_WHATSAPP_SESSIONS: {
    allowedRoles: ["admin"],
    description: "View all WhatsApp sessions",
    routes: ["GET /whatsapp/sessions"]
  },
  
  GET_WHATSAPP_QR: {
    allowedRoles: ["admin"],
    description: "Get WhatsApp QR code",
    routes: ["GET /whatsapp/qr"]
  },
  
  SEND_WHATSAPP_MESSAGE: {
    allowedRoles: ["admin"],
    description: "Send WhatsApp message",
    routes: ["POST /whatsapp/send"]
  },
  
  VIEW_WHATSAPP_HISTORY: {
    allowedRoles: ["admin"],
    description: "View WhatsApp history",
    routes: ["GET /whatsapp/history"]
  },
  
  CHECK_WHATSAPP_HEALTH: {
    allowedRoles: ["admin"],
    description: "Check WhatsApp health",
    routes: ["GET /whatsapp/health"]
  },
  
  // ============================================
  // FILES
  // ============================================
  
  UPLOAD_FILE: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Upload file",
    routes: ["POST /files/upload", "POST /files/upload/multiple"]
  },
  
  VIEW_FILES: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View files",
    routes: ["GET /files"]
  },
  
  VIEW_FILE: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "View file",
    routes: ["GET /files/:fileId"]
  },
  
  DELETE_FILE: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Delete file",
    routes: ["DELETE /files/:fileId"]
  },
  
  DOWNLOAD_FILE: {
    allowedRoles: ["student", "lecturer", "staff", "admin"],
    description: "Download file",
    routes: ["GET /files/download/:fileId"]
  },
  
  // ============================================
  // STUDENT SUSPENSION
  // ============================================
  
  CREATE_SUSPENSION: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "Create student suspension",
    routes: ["POST /student-suspensions/:student_id"]
  },
  
  VIEW_ACTIVE_SUSPENSION: {
    allowedRoles: ["admin", "dean", "hod", "student"],
    description: "View active suspension",
    routes: ["GET /student-suspensions/:student_id/active"]
  },
  
  VIEW_STUDENT_SUSPENSIONS: {
    allowedRoles: ["admin", "dean", "hod", "student"],
    description: "View student suspensions",
    routes: ["GET /student-suspensions/:student_id"]
  },
  
  LIFT_SUSPENSION: {
    allowedRoles: ["admin", "dean", "hod"],
    description: "Lift student suspension",
    routes: ["PATCH /student-suspensions/:student_id/:suspension_id/lift"]
  }
};

// Helper function to get permission by route
export const getPermissionByRoute = (method, path) => {
  for (const [permissionKey, permission] of Object.entries(PERMISSIONS)) {
    for (const route of permission.routes) {
      const [routeMethod, routePath] = route.split(' ');
      if (routeMethod === method && routePath === path) {
        return permissionKey;
      }
    }
  }
  return null;
};

// Helper to check if role has permission
export const roleHasPermission = (role, permissionKey) => {
  const permission = PERMISSIONS[permissionKey];
  if (!permission) return false;
  return permission.allowedRoles.includes(role);
};

// Helper to get all permissions for a role
export const getPermissionsForRole = (role) => {
  const permissions = [];
  for (const [key, value] of Object.entries(PERMISSIONS)) {
    if (value.allowedRoles.includes(role)) {
      permissions.push(key);
    }
  }
  return permissions;
};