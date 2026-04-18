import doc from "pdfkit";
import { buildProgrammeFullName, toProfessionalAbbreviation } from "../utils/helpers.js";
import { resolveUserName } from "../utils/resolveUserName.js";
import SemesterService from "../domain/semester/semester.service.js";

export const dataMaps = {
  Faculty: {
    _id: "this._id",
    name: (user) => {
      return user ? resolveUserName(user, "Faculty.dean_name") : null;
    },
    code: "this.code",
    dep_count: async (doc, models) =>
      await models.Department.countDocuments({ faculty: doc._id }),
    // student_count: async (doc, models) =>
    //   await models.Student.countDocuments({ faculty: doc._id }),
    dean_name: async (doc, models) => {
      const lecturer = await models.Lecturer.findById(doc.dean);
      if (lecturer) {
        const user = await models.User.findById(lecturer._id);
        return user ? user.name : null;
      }
      return null;
    },
    dean_id: "this.dean",
    created_at: "this.createdAt",
    updated_at: "this.updatedAt",
    created_by: "this.createdBy",
    created_by_name: async (doc, models) => {
      const user = await models.User.findById(doc.createdBy);
      return user ? resolveUserName(user, "Faculty.created_by_name") : null;
    },
    departments: async (doc, models) => {
      const departments = await models.Department.find({ faculty: doc._id }).lean();
      for (const dept of departments) {
        if (dept.hod) {
          const user = await models.User.findById(dept.hod);
          dept.hod_name = user ? resolveUserName(user, "Faculty.Departments.hod_name") : null;
        } else {
          dept.hod_name = null;
        }
      }
      return departments;
    },
    total_lecturers: async (doc, models) =>
      await models.Lecturer.countDocuments({ departmentId: { $in: await models.Department.find({ faculty: doc._id }).distinct("_id") } }),
    total_students: async (doc, models) =>
      await models.Student.countDocuments({ departmentId: { $in: await models.Department.find({ faculty: doc._id }).distinct("_id") } }),
  },
  FacultyById: {
    _id: "this._id",
    name: "this.name",
    code: "this.code",
    dep_count: async (doc, models) =>
      await models.Department.countDocuments({ faculty: doc._id }),
    created_at: "this.createdAt",
    updated_at: "this.updatedAt",
    created_by: "this.createdBy",
    created_by_name: async (doc, models) => {
      const user = await models.User.findById(doc.createdBy);
      return user ? resolveUserName(user, "FacultyById.created_by_name") : null;
    },
    recent_departments: async (doc, models) => {
      return await models.Department.find({ faculty: doc._id })
        .sort({ createdAt: -1 })
        .limit(5);
    }

  },

  DepartmentById: {
    _id: "this._id",
    name: "this.name",
    code: "this.code",
    faculty_id: "this.faculty._id",
    faculty_name: "this.faculty.name",
    created_at: "this.createdAt",
    updated_at: "this.updatedAt",
    created_by: "this.createdBy",
    created_by_name: async (doc, models) => {
      const user = await models.User.findById(doc.createdBy);
      return user ? resolveUserName(user, "DepartmentById.created_by_name") : null;
    },
    hod_name: async (doc, models) => {
      const lecturer = await models.Lecturer.findById(doc.hod);
      if (lecturer) {
        const user = await models.User.findById(lecturer.user);
        return user ? resolveUserName(user, "DepartmentById.hod_name") : null;
      }
      return null;
    },
    hod_id: "this.hod",

  },

  Department: {
    _id: "this._id",
    name: "this.name",
    code: "this.code",
    faculty_id: "this.faculty._id",
    faculty_name: "this.faculty.name",
    hod_name: async (doc, models) => {
      const lecturer = await models.Lecturer.findById(doc.hod);
      if (lecturer) {
        const user = await models.User.findById(lecturer._id);
        return user ? resolveUserName(user, "Department.hod_name") : null;
      }
      return null;
    },
  },

  DepartmentStats: {
    _id: "this._id",
    name: "this.name",
    code: "this.code",
    faculty_id: "this.faculty._id",
    faculty_name: "this.faculty.name",
    hod_name: async (doc, models) => {
      const lecturer = await models.Lecturer.findById(doc.hod);
      if (lecturer) {
        const user = await models.User.findById(lecturer._id);
        return user ? resolveUserName(user, "DepartmentStatus.hod_name") : null;
      }
      return null;
    },
    total_courses: async (doc, models) =>
      await models.Course.countDocuments({ department: doc._id }),
    total_lecturers: async (doc, models) =>
      await models.Lecturer.countDocuments({ departmentId: doc._id }),
    total_students: async (doc, models) =>
      await models.Student.countDocuments({ departmentId: doc._id }),
    active_semester: async (doc, models) => {
      const activeSemester = await SemesterService.getActiveAcademicSemester();
      return activeSemester ? activeSemester.name : "N/A";
    }
  },

  Course: {
    _id: "this._id",
    code: 'this.courseCode || this.borrowedId.courseCode',
    faculty_id: "this.faculty._id",
    faculty_name: "this.faculty.name",
    unit: "this.unit || this.borrowedId.unit",
    level: "this.level || this.borrowedId.level",
    semester: "this.semester || this.borrowedId.semester",
    type: "this.type",
    name: "this.title || this.borrowedId.title",
    hod_name: "this.hod.name",
    department_id: "this.department._id",
    department: "this.department.name",
    description: "this.description || this.borrowedId.description",
    outline: "this.outline",
    borrowed_department: async (doc, models) => {
      if (doc.borrowedId != null) {
        const dep = await models.Department.findOne({ _id: doc.borrowedId.department })
        if (dep) return dep.name

      }
    },
    borrowed: (doc) => {
      if (doc.borrowedId != null) return true
    },
    lecturer: async (doc, models) => {


      // 2. Get active semester for the lecturer’s department
      const activeSemester = await SemesterService.getActiveAcademicSemester()

      if (!activeSemester) {
        return null
      };

      // 3. Fetch the most recent CourseAssignment using course + active semester
      const finalAssignment = await models.CourseAssignment
        .findOne({
          course: doc._id,
          semester: activeSemester._id
        })
        .sort({ createdAt: -1 }) // most recent
        .populate("lecturer", "first_name middle_name last_name title email")
        .lean();

      if (!finalAssignment || !finalAssignment.lecturer) return null;

      return {
        _id: finalAssignment.lecturer._id,
        name: resolveUserName(finalAssignment.lecturer, "Course.lecturer"),
        email: finalAssignment.lecturer.email || null
      };
    },
    createdAt: "this.createdAt",
    updatedAt: "this.updatedAt"
  },
  CourseById: {
    _id: "this._id",
    name: "this.title",
    code: "this.code",
    code: "this.courseCode",
    faculty_id: "this.faculty?._id",
    faculty_name: "this.faculty?._name || this.faculty?.name",
    unit: "this.unit",
    level: "this.level",
    semester: "this.semester",
    type: "this.type",
    hod_name: "this.hod?.name || null",
    department_id: "this.department?._id",
    department: "this.department?._name || this.department?.name",
    description: "this.description",
    outline: "this.outline",
    lecturer: async (doc, models) => {
      const assignment = await models.CourseAssignment.findOne({ course: doc._id })
        .populate("lecturer", "name email")
        .lean();

      if (!assignment || !assignment.lecturer) return null;

      return {
        _id: assignment.lecturer._id,
        name: resolveUserName(assignment.lecturer, "CourseById.lecturer"),
        email: assignment.lecturer.email || null,
      };

    },
    created_at: "this.createdAt",
    updated_at: "this.updatedAt",
    created_by: "this.createdBy",
    created_by_name: async (doc, models) => {
      if (!doc.createdBy) return null;
      const user = await models.User.findById(doc.createdBy).select("name").lean();
      return user ? user.name : null;
    }
  },

  RegisteredCourses: {
    student_id: "this.student._id",
    name: (doc) =>
      resolveUserName(doc.student, "RegisteredCourses.student"),
    matric_no: "this.student.matricNumber",
    department: "this.student.departmentId.name",
    department_id: "this.student.departmentId._id",
    faculty_name: "Faculty.name",
  },


  Student: {
    _id: "this._id._id",
    name: (user) => {
      return user ? resolveUserName(user._id, "Student.name") : null;
    },
    first_name: "this._id.first_name",
    middle_name:"this._id.middle_name",
    last_name: "this._id.last_name",
    matric_no: "this.matricNumber",
    department: "this.programmeId.department.name",
    programme: async (doc) => {
      if (!doc.programmeId?._id) return "N/A";
      return toProfessionalAbbreviation(doc?.programmeId?.programmeType);
    },
    programme_id: "this.programmeId._id",
    department_id: "this.programmeId.department._id",
    faculty_name: "Faculty.name",
    level: 'this.level',
    cgpa: "this.cgpa",
    gpa: "this.gpa",
    avatar: "this._id.avatar",
    probationStatus: "this.probationStatus",
    terminationStatus: "this.terminationStatus",
    semester: async (doc, models) => {
      if (!doc.departmentId?._id) return "N/A";
      const activeSemester = await SemesterService.getActiveAcademicSemester();
      return activeSemester ? activeSemester.name : "N/A";
    },
    status: (doc) => {
      if (doc.terminationStatus && doc.terminationStatus !== "none") {
        return "terminated";
      }
      if (Array.isArray(doc.suspension) && doc.suspension.some(s => s.is_active)) {
        return "suspended";
      }
      if (doc.probationStatus && doc.probationStatus === "probation") {
        return "probation";
      }
      return "normal";
    },
    suspensionStatus: (doc) => {
      if (!Array.isArray(doc.suspension)) return null;
      const active = doc.suspension.find(s => s.is_active);
      if (!active) return null;
      return {
        type: active.type,
        reason: active.reason,
        start_date: active.start_date,
        end_date: active.end_date,
        is_active: active.is_active,
      };
    },

    deletedAt: "this.deletedAt" || null,
    email: "this._id.email"
  },
  StudentById: {
    // Core Identity
    _id: "this._id._id",
    name: (user) => resolveUserName(user._id, "Student.name"),
    matric_no: "this.matricNumber",
    email: "this._id.email",
    phone_number: "this._id.phoneNumber" || "N/A",
    alternative_phone: "this._id.alternativePhone" || "N/A",
    gender: "this._id.gender" || "N/A",
    date_of_birth: "this._id.dateOfBirth" || "N/A",
    age: "this._id.age" || "N/A",
    nationality: "this._id.nationality" || "N/A",
    home_address: "this._id.address" || "N/A",
    state_of_origin: "this._id.stateOfOrigin" || "N/A",
    lga: "this._id.lga" || "N/A",
    passport_photo_url: "this._id.profileImage" || "N/A",

    // Academic Programme
    department: "this.programmeId.department.name" || "N/A",
    department_id: "this.programmeId.department._id" || null,
    faculty_name: "this.programmeId.department.faculty.name" || "N/A",
    programme: async (doc) => {
      if (!doc.programmeId?._id) return "N/A";
      return buildProgrammeFullName(
        doc.programmeId.programmeType,
        doc.programmeId.name
      );
    },
    status: (doc) => {
      if (doc.terminationStatus && doc.terminationStatus !== "none") {
        return "terminated";
      }
      if (Array.isArray(doc.suspension) && doc.suspension.some(s => s.is_active)) {
        return "suspended";
      }
      if (doc.probationStatus && doc.probationStatus === "probation") {
        return "probation";
      }
      return "normal";
    },
    level: "this.level" || "N/A",
    session: "this.session" || "N/A",
    entry_mode: "this.entryMode" || "N/A",
    mode_of_study: "this.modeOfStudy" || "N/A",
    expected_graduation_year: "this.expectedGraduationYear" || "N/A",

    // Academic Standing
    cgpa: "this.cgpa" || 0.0,
    gpa: "this.gpa" || 0.0,
    totalCarryovers: "this.totalCarryovers" || 0,
    probationStatus: "this.probationStatus" || "none",
    terminationStatus: "this.terminationStatus" || "none",
    suspension: "this.suspension" || { status: false, reason: "N/A", sinceSemesterId: null },
    status: (doc) => {
      if (doc.terminationStatus !== "none") return "Terminated";
      if (doc.probationStatus === "probation") return "Probation";
      if (doc.suspension?.status) return "Suspended";
      return "Normal";
    },

    // Enrollment / Registration
    courses: "this.courses" || [],
    registered_courses: "this.registeredCourses" || [],
    semesters: async (doc, models) => {
      try {
        const studentId = doc._id;
        if (!studentId) return [];

        const results = await models.StudentSemesterResult.find({ studentId })
          .populate("semesterId")
          .lean();

        return results.length
          ? results.map((r) => ({
            _id: r.semesterId?._id || null,
            name: r.semesterId?.name || null,
            session: r.semesterId?.session || null,
            level: r.semesterId?.level || null,
            gpa: r.gpa,
            cgpa: r.cgpa,
            remark: r.remark || "N/A",
            createdAt: r.createdAt,
          }))
          : [];
      } catch (err) {
        console.error("Error fetching student semesters:", err);
        return [];
      }
    },

    // Financial / Scholarship
    fees_status: "this.feesStatus" || "N/A",
    outstanding_balance: "this.outstandingBalance" || 0,
    scholarship_status: "this.scholarshipStatus" || "N/A",
    sponsorship_type: "this.sponsorshipType" || "N/A",
    last_payment_date: "this.lastPaymentDate" || "N/A",

    // Audit / System
    createdAt: "this.createdAt",
    updatedAt: "this.updatedAt",
    createdBy: (doc, models) => {
      return models.User.findById(doc._id.createdBy).then(user => user ? resolveUserName(user, "StudentById.createdBy") : "System User");
    },
    isActive: "this.isActive",
    deletedAt: "this.deletedAt" || null,
    lastGPAUpdate: "this.lastGPAUpdate" || "N/A",
  },

  Lecturer: {
    _id: "this._id._id",
    rank: "this.rank",
    name: (doc) =>
      resolveUserName(doc._id, "Lecturer.name"),
    first_name: "this._id.first_name",
    middle_name: "this._id.middle_name",
    last_name: "this._id.last_name",
    title: "this._id.title",
    staff_id: "this.staffId",
    department_id: "this.departmentId._id",
    department: "this.departmentId.name",
    faculty_id: "this.facultyId._id",
    faculty: "this.facultyId.name",
    email: "this.user?.email || this._id?.email",
    is_hod: "this.isHOD",
    n: (doc, models) => {
    }
  },

  LecturerCourses: {
    lecturer_id: "this._id._id",
    name: (doc) =>
      resolveUserName(doc._id, "LecturerCourses.name"),
    staff_id: "this.staffId",
    courses: async (doc, models) => {
      const assignments = await models.CourseAssignment.find({ lecturer: doc._id._id })
        .populate("course", "title courseCode unit level semester type")
        .lean();

      return assignments.map(a => ({
        _id: a.course._id,
        title: a.course.title,
        courseCode: a.course.courseCode,
        unit: a.course.unit,
        level: a.course.level,
        semester: a.course.semester,
        type: a.course.type,
      }));
    }
  },
  CourseAssignment: {
    _id: "this._id",
    course_id: "this.course._id",

    name: (doc) => {
      if (doc.course?.borrowedId) return doc.course.borrowedId.title;
      return doc.course?.title ?? null;
    },

    code: (doc) => {
      if (doc.course?.borrowedId) return doc.course.borrowedId.courseCode;
      return doc.course?.courseCode ?? null;
    },

    unit: (doc) => {
      if (doc.course?.borrowedId) return doc.course.borrowedId.unit;
      return doc.course?.unit ?? null;
    },

    level: (doc) => {
      if (doc.course?.borrowedId) return doc.course.borrowedId.level;
      return doc.course?.level ?? null;
    },

    semester: "this.semester.name",
    session: "this.session",

    department_id: (doc) => {
      // borrowing department (context)
      return doc.course?.department?._id ?? null;
    },

    department: (doc) => {
      return doc.course?.department?.name ?? null;
    },

    is_borrowed: (doc) => Boolean(doc.course?.borrowedId),

    owning_department_id: (doc) => {
      if (doc.course?.borrowedId) {
        return doc.course.borrowedId.department?._id ?? null;
      }
      return doc.course?.department?._id ?? null;
    },

    status: "this.status",

    students: async (doc, models) => {
      const courseId = doc.course?._id || doc.course;
      const semesterId = doc.semester?._id || doc.semester;
      const session = doc.session;

      if (!courseId || !semesterId) return 0;

      const filter = {
        courses: courseId,
        semester: semesterId,
      };

      if (session) filter.session = session;

      return await models.CourseRegistration.countDocuments(filter);
    },
    pending_result_uploads: async (doc, models) => {
      const courseId = doc.course?._id || doc.course;
      const semesterId = doc.semester?._id || doc.semester;

      if (!courseId || !semesterId) return 0;

      // Count how many students are registered for this course in this semester
      const registeredCount = await models.CourseRegistration.countDocuments({
        courses: courseId,
        semester: semesterId,
      });

      // Count how many of those students have not uploaded their results
      const pendingCount = await models.Result.countDocuments({
        courseId: courseId,
        semester: semesterId,
      });

      return registeredCount - pendingCount;
    },
  }

  ,
  Applicant: {
    id: "this._id",
    name: (doc) =>
      resolveUserName(doc.User, "Applicant.name"),
    jamb_reg_number: "this.jambRegNumber",
    score: "this.score",
    program_name: "Department.name",
    faculty_name: "Faculty.name",
    admission_status: "this.admissionStatus",

  },
  Template: {
    _id: "this._id",
    name: "this.name",
    channel: "this.channel",
    email_template: "this.email_template",
    whatsapp_template: "this.whatsapp_template",
    variables: "this.variables",
    // created_by: async (doc, models) => {
    //   if (!doc.created_by) return null;
    //   const user = await models.User.findById(doc.created_by).select("name").lean();
    //   return user ? user.name : null;
    // },
    created_at: "this.createdAt",
    updated_at: "this.updatedAt",
  },

  Notifications: {
    title: "this.title",
    message: "this.message",
    type: "this.type",
    is_read: "this.is_read",
    created_at: "this.created_at"
  },
  Announcement: {
    _id: "this._id",
    title: "this.title",
    description: "this.description",
    content: "this.content",
    category: "this.category",
    priority: "this.priority",
    image: "this.image",
    date: "this.date",
    expiresAt: "this.expiresAt",
    isActive: "this.isActive"

  },
  Programme: {
    _id: "this._id",
    name: "this.name",
    code: "this.code",
    faculty_id: "this.faculty._id",
    faculty_name: "this.faculty.name",
    department_id: "this.department._id",
    department_name: "this.department.name",
    duration: "this.duration",
    degree_type: "this.degreeType",
    programme_type: "this.programmeType",
    level: async (doc) => {
      const levelMap = {
        'BACHELOR': 'Undergraduate',
        'MASTER': 'Postgraduate',
        'PHD': 'Doctoral',
        'DIPLOMA': 'Diploma',
        'CERTIFICATE': 'Certificate'
      };
      return levelMap[doc.degreeType] || doc.degreeType;
    },
    is_active: "this.isActive",
    intake_capacity: "this.intakeCapacity",
    accreditation_status: "this.accreditationStatus",
    accreditation_expiry: "this.accreditationExpiry",
    created_at: "this.createdAt",
    updated_at: "this.updatedAt"
  },

  ProgrammeById: {
    _id: "this._id",
    name: "this.name",
    code: "this.code",
    full_name: async (doc) => {
      return buildProgrammeFullName(doc.programmeType, doc.name);
    },
    faculty_id: "this.faculty._id",
    faculty_name: "this.faculty.name",
    department_id: "this.department._id",
    department_name: "this.department.name",
    duration: "this.duration",
    degree_type: "this.degreeType",
    programme_type: "this.programmeType",
    level: async (doc) => {
      const levelMap = {
        'BACHELOR': 'Undergraduate',
        'MASTER': 'Postgraduate',
        'PHD': 'Doctoral',
        'DIPLOMA': 'Diploma',
        'CERTIFICATE': 'Certificate'
      };
      return levelMap[doc.degreeType] || doc.degreeType;
    },
    description: "this.description",
    is_active: "this.isActive",
    intake_capacity: "this.intakeCapacity",
    accreditation_status: "this.accreditationStatus",
    accreditation_expiry: "this.accreditationExpiry",
    is_accredited: async (doc) => {
      if (doc.accreditationStatus !== 'ACCREDITED') return false;
      if (doc.accreditationExpiry) {
        return doc.accreditationExpiry > new Date();
      }
      return true;
    },
    created_at: "this.createdAt",
    updated_at: "this.updatedAt",
    created_by: "this.createdBy",
    created_by_name: async (doc, models) => {
      if (!doc.createdBy) return null;
      const user = await models.User.findById(doc.createdBy);
      return user ? resolveUserName(user, "ProgrammeById.created_by_name") : null;
    },
    last_updated_by: "this.lastUpdatedBy",
    last_updated_by_name: async (doc, models) => {
      if (!doc.lastUpdatedBy) return null;
      const user = await models.User.findById(doc.lastUpdatedBy);
      return user ? resolveUserName(user, "ProgrammeById.last_updated_by_name") : null;
    }
  },

  ProgrammeStats: {
    _id: "this._id",
    name: "this.name",
    code: "this.code",
    department_name: "this.department.name",
    faculty_name: "this.faculty.name",
    degree_type: "this.degreeType",
    programme_type: "this.programmeType",
    is_active: "this.isActive",
    accreditation_status: "this.accreditationStatus",
    intake_capacity: "this.intakeCapacity",
    current_students: async (doc, models) => {
      return await models.Student.countDocuments({
        programmeId: doc._id,
        status: { $in: ['active', 'registered'] }
      });
    },
    total_courses: async (doc, models) => {
      return await models.Course.countDocuments({
        department: doc.department._id,
        level: { $in: [100, 200, 300, 400, 500] } // Adjust based on your programme levels
      });
    },
    active_semester: async (doc, models) => {
      const activeSemester = await SemesterService.getActiveAcademicSemester();
      return activeSemester ? activeSemester.name : "N/A";
    },
    graduation_rate: async (doc, models) => {
      const totalStudents = await models.Student.countDocuments({ programmeId: doc._id });
      const graduatedStudents = await models.Student.countDocuments({
        programmeId: doc._id,
        status: 'graduated'
      });

      if (totalStudents === 0) return 0;
      return Math.round((graduatedStudents / totalStudents) * 100);
    }
  },

  ProgrammeList: {
    _id: "this._id",
    name: "this.name",
    code: "this.code",
    full_name: async (doc) => {
      return buildProgrammeFullName(doc.programmeType, doc.name);
    },
    department_id: "this.department._id",
    department_name: "this.department.name",
    faculty_id: "this.faculty._id",
    faculty_name: "this.faculty.name",
    duration: "this.duration",
    degree_type: "this.degreeType",
    programme_type: "this.programmeType",
    is_active: "this.isActive",
    accreditation_status: "this.accreditationStatus",
    created_at: "this.createdAt",
    total_students: async (doc, models) =>
      await models.Student.countDocuments({ programmeId: doc._id }),
  }
  // CourseRegistration: {
  //   buffer_courses: async (doc, models) => {
  //     const buffer = await models.carryOverSchema.findMany({ student: doc.student });
  //     return buffer;
  //   },
  //   semseter_courses: async (doc, models) => {
  //     const student = await models.Student.findById(doc._id);
  //     const courses = await models.Courses.findMany({ semester: doc.name, level: doc.level });
  //     return courses;
  //   },
  //   level_settings: async (doc, models) => {
  //     const settings = doc.levelSettings
  // }
};