import Student from "./student.model.js";
import buildResponse from "#utils/responseBuilder.js";
import fetchDataHelper from "#utils/fetchDataHelper.js";
import User from "#domain/user/user.model.js";
import departmentModel from "#domain/organization/department/department.model.js";
import { hashData } from "#utils/hashData.js";
import { dataMaps } from "#config/dataMap.js";
import studentModel from "./student.model.js";
import mongoose from "mongoose";
import studentSemseterResultModel from "./student.semseterResult.model.js";
import courseService from "#domain/course/course.service.js";
import departmentService from "#domain/organization/department/department.service.js";
import facultyService from "#domain/organization/faculty/faculty.service.js";
import Result from "#domain/result/result.model.js";
import programmeService from "#domain/programme/programme.service.js";
import AppError from "#shared/errors/AppError.js";
import programmeModel from "#domain/programme/programme.model.js";
import { AcademicSemester } from "#domain/semester/semester.academicModel.js";
import SemesterService from "#domain/semester/semester.service.js";
import studentService from "./student.service.js";
import courseRegistrationModel from "#domain/course/courseRegistration.model.js";


/**
 * 🧍‍♂️ Get Logged-in Student Profile
 * ---------------------------------
 * Fetch profile details for the logged-in student.
 */
export const getMyProfile = async (req, res) => {
  try {
    // Set audit context for profile view
    req.auditContext = {
      action: "VIEW_MY_PROFILE",
      resource: "Student",
      severity: "LOW",
      status: "SUCCESS",
      reason: "Student viewed their own profile",
      metadata: {
        studentId: req.user._id,
        role: req.user.role
      }
    };

    return fetchDataHelper(req, res, studentModel, {
      configMap: dataMaps.Student,
      autoPopulate: true,
      models: { programmeModel, User, AcademicSemester, departmentModel },
      populate: [
        {
          path: "programmeId",
          populate: [
            {
              path: "department",
              select: "name code"
            }
          ]
        }, {
          path: "_id",
        },
      ],
      additionalFilters: { "_id._id": mongoose.Types.ObjectId(req.user._id) },
    });

  } catch (error) {
    // Set audit context for error
    req.auditContext = {
      action: "VIEW_MY_PROFILE",
      resource: "Student",
      severity: "MEDIUM",
      status: "ERROR",
      reason: "Error viewing student profile",
      metadata: {
        studentId: req.user._id,
        role: req.user.role,
        error: error.message
      }
    };
    throw error
    // Let the middleware catch the error except you want to define a custom error for the frontend user
  }
};

/**
 * 🧾 Register Courses
 * -------------------
 * Students register their semester courses.
 */
export const registerCourses = async (req, res, next) => {
  try {
    const { courseIds = [] } = req.body;
    const student = await Student.findOne({ userId: req.user.id });

    if (!student) {
      req.auditContext = {
        action: "REGISTER_COURSES",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Student not found for course registration",
        metadata: {
          studentUserId: req.user.id,
          courseCount: courseIds.length
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    // Ensure all course IDs are valid
    const validCourses = await courseService.findByIds(courseIds);
    if (validCourses.length !== courseIds.length) {
      req.auditContext = {
        action: "REGISTER_COURSES",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "One or more courses are invalid for registration",
        metadata: {
          studentId: student._id,
          requestedCourses: courseIds.length,
          validCourses: validCourses.length
        }
      };
      return buildResponse(res, 400, "One or more courses are invalid");
    }

    const oldCourseCount = student.courses.length;
    student.courses = [...new Set([...student.courses, ...courseIds])]; // Avoid duplicates
    const newCourseCount = student.courses.length;
    await student.save();

    // Set audit context for successful course registration
    req.auditContext = {
      action: "REGISTER_COURSES",
      resource: "Student",
      severity: "MEDIUM",
      entityId: student._id,
      status: "SUCCESS",
      reason: `Student registered ${newCourseCount - oldCourseCount} new courses`,
      changes: {
        before: { courseCount: oldCourseCount },
        after: { courseCount: newCourseCount },
        changedFields: ["courses"]
      },
      metadata: {
        studentId: student._id,
        studentUserId: req.user.id,
        oldCourseCount,
        newCourseCount,
        coursesAdded: newCourseCount - oldCourseCount,
        totalCourses: newCourseCount
      }
    };

    return buildResponse(res, 200, "Courses registered successfully", student);
  } catch (error) {
    req.auditContext = {
      action: "REGISTER_COURSES",
      resource: "Student",
      severity: "HIGH",
      status: "ERROR",
      reason: "Error registering courses",
      metadata: {
        studentUserId: req.user.id,
        courseCount: req.body.courseIds?.length || 0,
        error: error.message
      }
    };
    next(error)
  }
};

/**
 * 📚 View Registered Courses
 * --------------------------
 */
export const getMyCourses = async (req, res, next) => {
  try {
    const student = await Student.findOne({ userId: req.user.id })
      .populate("courses", "title code unit semester");

    if (!student) {
      req.auditContext = {
        action: "VIEW_MY_COURSES",
        resource: "Student",
        severity: "LOW",
        status: "FAILURE",
        reason: "Student not found when viewing registered courses",
        metadata: {
          studentUserId: req.user.id
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    // Set audit context for viewing courses
    req.auditContext = {
      action: "VIEW_MY_COURSES",
      resource: "Student",
      severity: "LOW",
      status: "SUCCESS",
      reason: "Student viewed their registered courses",
      metadata: {
        studentId: student._id,
        courseCount: student.courses.length
      }
    };

    return buildResponse(res, 200, "Registered courses fetched successfully", student.courses);
  } catch (error) {
    req.auditContext = {
      action: "VIEW_MY_COURSES",
      resource: "Student",
      severity: "MEDIUM",
      status: "ERROR",
      reason: "Error viewing registered courses",
      metadata: {
        studentUserId: req.user.id,
        error: error.message
      }
    };
    next(error)
  }
};

/**
 * 📊 View Semester Results
 * -------------------------
 * Fetch student's results for a specific session and semester.
 */
export const viewResults = async (req, res, next) => {
  try {
    const { session, semester } = req.query;

    const student = await Student.findOne({ userId: req.user.id });
    if (!student) {
      req.auditContext = {
        action: "VIEW_RESULTS",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Student not found when viewing results",
        metadata: {
          studentUserId: req.user.id,
          session,
          semester
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    const results = await Result.find({
      studentId: student._id,
      session,
      semester,
    })
      .populate("courseId", "title code unit")
      .sort({ createdAt: -1 });

    // Set audit context for viewing results
    req.auditContext = {
      action: "VIEW_RESULTS",
      resource: "Student",
      severity: "LOW",
      status: "SUCCESS",
      reason: "Student viewed their semester results",
      metadata: {
        studentId: student._id,
        session,
        semester,
        resultCount: results.length
      }
    };

    return buildResponse(res, 200, "Results fetched successfully", results);
  } catch (error) {
    req.auditContext = {
      action: "VIEW_RESULTS",
      resource: "Student",
      severity: "MEDIUM",
      status: "ERROR",
      reason: "Error viewing semester results",
      metadata: {
        studentUserId: req.user.id,
        session: req.query.session,
        semester: req.query.semester,
        error: error.message
      }
    };
    next(error)
  }
};

/**
 * 🧾 Print Transcript
 * -------------------
 * Generate full academic transcript or session-based result.
 */
export const printTranscript = async (req, res, next) => {
  try {
    const { session } = req.query;
    const student = await Student.findOne({ userId: req.user.id });
    if (!student) {
      req.auditContext = {
        action: "PRINT_TRANSCRIPT",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Student not found when printing transcript",
        metadata: {
          studentUserId: req.user.id,
          session
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    const query = { studentId: student._id };
    if (session) query.session = session;

    const results = await Result.find(query)
      .populate("courseId", "title code unit semester")
      .sort({ session: 1, semester: 1 });

    // Optional: compute GPA/CGPA
    const transcript = {
      student: {
        name: req.user.name,
        matricNumber: student.matricNumber,
        department: student.departmentId,
        faculty: student.facultyId,
      },
      results,
      computedAt: new Date().toISOString(),
    };

    // Set audit context for transcript printing
    req.auditContext = {
      action: "PRINT_TRANSCRIPT",
      resource: "Student",
      severity: "LOW",
      status: "SUCCESS",
      reason: "Student printed their academic transcript",
      metadata: {
        studentId: student._id,
        matricNumber: student.matricNumber,
        session: session || "all",
        resultCount: results.length
      }
    };

    return buildResponse(res, 200, "Transcript generated successfully", transcript);
  } catch (error) {
    req.auditContext = {
      action: "PRINT_TRANSCRIPT",
      resource: "Student",
      severity: "MEDIUM",
      status: "ERROR",
      reason: "Error printing transcript",
      metadata: {
        studentUserId: req.user.id,
        session: req.query.session,
        error: error.message
      }
    };
    next(error)
  }
}

//admin functionalities on students

// 🧾 Get all students (Admin only)
export const getAllStudents = async (req, res) => {
  let additionalFilters = {};
  if (req.user.role === "hod") {
    const department = await departmentService.getDepartmentByHod(req.user._id);
    if (department) {
      additionalFilters.departmentId = department._id;
    } else {
      req.auditContext = {
        action: "VIEW_ALL_STUDENTS",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "HOD department not found",
        metadata: {
          hodId: req.user._id,
          role: "hod"
        }
      };
      throw new AppError("Hod department not found", 404)
    }
  }

  if (req.user.role === "dean") {
    const faculty = await facultyService.getFacultyByDean(req.user._id);
    if (faculty) {
      additionalFilters.facultyId = faculty._id;
    }
  }


  return await fetchDataHelper(req, res, Student, {
    configMap: dataMaps.Student,
    autoPopulate: true,
    forceFind: true,
    explain: true,
    models: { departmentModel, User, programmeModel },
    populate: [
      {
        path: "programmeId",
        populate: [
          {
            path: "department",
            select: "name code"
          }
        ]
      }, {
        path: "_id",
      },
    ],
    custom_fields: {
      first_name: 'queryKey.full_name',
      middle_name: '_id.middle_name',
      last_name: '_id.last_name',
    },
    additionalFilters
  });
};

// 📋 Get a single student
export const getStudentById = async (req, res, next) => {
  try {
    // Set audit context for viewing single student
    req.auditContext = {
      action: "VIEW_STUDENT",
      resource: "Student",
      severity: "MEDIUM",
      status: "SUCCESS",
      reason: `${req.user.role} viewed student details`,
      metadata: {
        viewerRole: req.user.role,
        viewerId: req.user._id,
        studentId: req.params.id
      }
    };

    return fetchDataHelper(req, res, studentModel, {
      configMap: dataMaps.StudentById,
      autoPopulate: true,
      models: { departmentModel, User, programmeModel },
      populate: [
        {
          path: "programmeId",
          populate: [
            {
              path: "department",
              select: "name code faculty",
              populate: [{
                path: "faculty",
                select: "name code"
              }]
            }
          ]
        }, {
          path: "_id",
        },
      ],
      additionalFilters: { '_id._id': mongoose.Types.ObjectId(req.params.id) },
      singleResponse: true,
    });

  } catch (error) {
    req.auditContext = {
      action: "VIEW_STUDENT",
      resource: "Student",
      severity: "MEDIUM",
      status: "ERROR",
      reason: "Error viewing student details",
      metadata: {
        viewerRole: req.user.role,
        viewerId: req.user._id,
        studentId: req.params.id,
        error: error.message
      }
    };
    next(error)
  }
};


// 🧍 Create a new student (Admin only)
export const createStudent = async (req, res, next) => {
  try {
    const {
      name,
      email,
      matric_no: matricNumber,
      programme_id: programmeId,
      level,
      fields,
      search_term,
      filters,
      page,
    } = req.body;
    let departmentId

    // 🧮 If filtering/searching students
    if (fields || search_term || filters || page) {
      req.auditContext = {
        action: "SEARCH_STUDENTS",
        resource: "Student",
        severity: "LOW",
        status: "SUCCESS",
        reason: "Admin searched/filtered students",
        metadata: {
          adminId: req.user._id,
          adminRole: req.user.role,
          hasSearchTerm: !!search_term,
          hasFilters: !!filters,
          hasFields: !!fields
        }
      };
      return getAllStudents(req, res)
    }

    // 🔍 1. Duplicate matric number
    const existingStudent = await Student.findOne({ matricNumber });
    if (existingStudent) {
      req.auditContext = {
        action: "CREATE_STUDENT",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Student with this matric number already exists",
        metadata: {
          adminId: req.user._id,
          adminRole: req.user.role,
          matricNumber,
          existingStudentId: existingStudent._id
        }
      };
      return buildResponse(res, 400, "Student with this matric number already exists");
    }

    // 🔍 2. Duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.auditContext = {
        action: "CREATE_STUDENT",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "User with this email already exists",
        metadata: {
          adminId: req.user._id,
          adminRole: req.user.role,
          email,
          existingUserId: existingUser._id
        }
      };
      return buildResponse(res, 400, "User with this email already exists");
    }

    // Run a check to check if the programme exists and get its department
    const programme = await programmeService.getProgrammeById(programmeId);
    if (!programme) {
      req.auditContext = {
        action: "CREATE_STUDENT",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Programme not found for student creation",
        metadata: {
          adminId: req.user._id,
          adminRole: req.user.role,
          programmeId
        }
      };
      throw new AppError("Programme not foud", 404)
    }
    departmentId = programme.department

    // 🔐 3. Generate default password
    const defaultPassword = `${matricNumber}`;
    const hashedPassword = await hashData(defaultPassword);

    // 👤 4. Create User Account
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "student",
      must_change_password: true,
    });

    try {
      // 📌 5. Get active session
      const session = await SemesterService.getActiveAcademicSemester();

      const faculty = await facultyService.getFacultyByDepartment(departmentId);

      // 🎓 Create Student using same user._id
      const student = await Student.create({
        _id: user._id,
        matricNumber,
        departmentId,
        facultyId: faculty?._id || null,
        level,
        session: session?._id || null,
        programmeId,
        query: {
          full_name: name
        }
      });

      // Set audit context for successful student creation
      req.auditContext = {
        action: "CREATE_STUDENT",
        resource: "Student",
        severity: "HIGH",
        entityId: student._id,
        status: "SUCCESS",
        reason: `Student ${name} (${matricNumber}) created successfully`,
        changes: {
          before: null,
          after: {
            user: {
              name,
              email,
              role: "student"
            },
            student: {
              matricNumber,
              departmentId,
              facultyId: faculty?._id,
              level,
              programmeId,
              sessionId: session?._id
            }
          },
          changedFields: ["user", "student"]
        },
        metadata: {
          adminId: req.user._id,
          adminRole: req.user.role,
          studentId: student._id,
          userId: user._id,
          matricNumber,
          studentName: name,
          studentEmail: email,
          departmentId,
          facultyId: faculty?._id,
          programmeId,
          level,
          sessionId: session?._id,
          defaultPasswordSet: true,
          passwordChangeRequired: true
        }
      };

      // Response
      await getStudentById({ params: { id: student._id } }, res)

    } catch (studentError) {
      // 🧹 Rollback user if student fails
      await User.findByIdAndDelete(user._id);

      // Set audit context for rollback
      req.auditContext = {
        action: "CREATE_STUDENT",
        resource: "Student",
        severity: "HIGH",
        status: "ERROR_ROLLBACK",
        reason: "Student creation failed — user has been removed (rollback)",
        metadata: {
          adminId: req.user._id,
          adminRole: req.user.role,
          rolledBackUserId: user._id,
          studentData: {
            name,
            email,
            matricNumber,
            programmeId,
            level
          },
          error: studentError.message
        }
      };
      throw (studentError)
    }
  } catch (error) {
    // Set audit context for error (if not already set by validation failures)
    if (!req.auditContext) {
      req.auditContext = {
        action: "CREATE_STUDENT",
        resource: "Student",
        severity: "CRITICAL",
        status: "ERROR",
        reason: "Internal server error during student creation",
        metadata: {
          adminId: req.user._id,
          adminRole: req.user.role,
          error: error.message
        }
      };
    }
    next(error)
  }
};



// export const myProfile = async (req, res, next) => {
//   try {
//     const student = await Student.findOne({ userId: req.user._id })
//       .populate("userId", "name email role avatar")
//       .populate("departmentId", "name code")
//       .populate("facultyId", "name code")
//       .populate("courses", "title code unit");

//     if (!student) {
//       req.auditContext = {
//         action: "VIEW_MY_PROFILE_DETAILED",
//         resource: "Student",
//         severity: "MEDIUM",
//         status: "FAILURE",
//         reason: "Student profile not found",
//         metadata: {
//           studentUserId: req.user._id
//         }
//       };
//       return buildResponse(res, 404, "Student profile not found");
//     }

//     // Set audit context for detailed profile view
//     req.auditContext = {
//       action: "VIEW_MY_PROFILE_DETAILED",
//       resource: "Student",
//       severity: "LOW",
//       status: "SUCCESS",
//       reason: "Student viewed detailed profile information",
//       metadata: {
//         studentId: student._id,
//         departmentId: student.departmentId?._id,
//         facultyId: student.facultyId?._id,
//         courseCount: student.courses.length
//       }
//     };

//     return buildResponse(res, 200, "Student profile fetched successfully", student);
//   } catch (error) {
//     req.auditContext = {
//       action: "VIEW_MY_PROFILE_DETAILED",
//       resource: "Student",
//       severity: "MEDIUM",
//       status: "ERROR",
//       reason: "Error viewing detailed student profile",
//       metadata: {
//         studentUserId: req.user._id,
//         error: error.message
//       }
//     };
//     next(error)
//   }
// };

// 🧰 Update student
export const updateStudent = async (req, res, next) => {
  try {
    const studentId = req.params.id || req.user._id;

    // Get existing student data for audit
    const existingStudent = await Student.findById(studentId)
      .populate("departmentId", "name")
      .lean();

    if (!existingStudent) {
      req.auditContext = {
        action: "UPDATE_STUDENT",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Student not found for update",
        metadata: {
          updaterId: req.user._id,
          updaterRole: req.user.role,
          studentId
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    // Frontend to backend field mapping
    const fieldMapping = {
      "matric_no": "matricNumber",
      "dept_id": "departmentId",
      "phone_number": "phoneNumber",
      "profile_image": "profileImage",
      "programme_id": 'programmeId'
    };

    // Fields that belong to User (using mapped backend names)
    const userFields = [
      "first_name",
      "middle_name",
      "last_name",
      "email",
      "phoneNumber",  // Backend field name
      "profileImage"  // Backend field name
    ];

    // Fields that belong to Student (using mapped backend names)
    const studentFields = [
      "matricNumber",  // Backend field name
      "departmentId",  // Backend field name
      "programmeId",
      "level",
      "faculty"
    ];

    const userUpdate = {};
    const studentUpdate = {};
    const changedFields = [];

    // Map incoming frontend fields to backend fields
    Object.keys(req.body || {}).forEach((frontendKey) => {
      // Get the backend field name (use mapping if exists, otherwise same as frontend)
      const backendKey = fieldMapping[frontendKey] || frontendKey;
      const value = req.body[frontendKey];

      // Check if value is different from existing
      if (backendKey === "departmentId") {
        const oldValue = existingStudent[backendKey]?._id?.toString();
        const newValue = value;
        if (oldValue !== newValue) {
          changedFields.push(backendKey);
        }
      } else if (existingStudent[backendKey] !== value) {
        changedFields.push(backendKey);
      }

      // Assign to correct model based on backend field name
      if (userFields.includes(backendKey)) {
        userUpdate[backendKey] = value;
      }

      if (studentFields.includes(backendKey)) {
        studentUpdate[backendKey] = value;
      }
    });

    // If no changes, return early
    if (changedFields.length === 0) {
      req.auditContext = {
        action: "UPDATE_STUDENT",
        resource: "Student",
        severity: "LOW",
        status: "NO_CHANGE",
        reason: "No changes detected in student update",
        metadata: {
          updaterId: req.user._id,
          updaterRole: req.user.role,
          studentId
        }
      };
      return buildResponse(res, 200, "No changes made", { student: existingStudent });
    }

    // Update User (shared _id)
    if (Object.keys(userUpdate).length > 0) {
      await User.findByIdAndUpdate(studentId, userUpdate, {
        new: true,
        runValidators: true
      });
    }

    // Update Student
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      studentUpdate,
      {
        new: true,
        runValidators: true
      }
    ).populate("departmentId", "name");

    if (!updatedStudent) {
      req.auditContext = {
        action: "UPDATE_STUDENT",
        resource: "Student",
        severity: "HIGH",
        status: "FAILURE",
        reason: "Student update failed after user update",
        metadata: {
          updaterId: req.user._id,
          updaterRole: req.user.role,
          studentId,
          userUpdate,
          studentUpdate
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    // Set audit context for successful update
    req.auditContext = {
      action: "UPDATE_STUDENT",
      resource: "Student",
      severity: "MEDIUM",
      entityId: studentId,
      status: "SUCCESS",
      reason: "Student updated successfully",
      changes: {
        before: {
          user: {
            name: existingStudent.userId?.name,
            email: existingStudent.userId?.email,
            phoneNumber: existingStudent.userId?.phoneNumber
          },
          student: {
            matricNumber: existingStudent.matricNumber,
            departmentId: existingStudent.departmentId?._id,
            level: existingStudent.level
          }
        },
        after: {
          user: userUpdate,
          student: studentUpdate
        },
        changedFields
      },
      metadata: {
        updaterId: req.user._id,
        updaterRole: req.user.role,
        studentId,
        changedFields,
        departmentName: updatedStudent.departmentId?.name
      }
    };

    return buildResponse(
      res,
      200,
      "Student updated successfully",
      {
        student: updatedStudent,
        department: updatedStudent.departmentId?.name || null
      }
    );
  } catch (error) {
    req.auditContext = {
      action: "UPDATE_STUDENT",
      resource: "Student",
      severity: "HIGH",
      status: "ERROR",
      reason: "Error updating student",
      metadata: {
        updaterId: req.user._id,
        updaterRole: req.user.role,
        studentId: req.params.id,
        error: error.message
      }
    };
    next(error)
  }
};


// 🗑️ Soft delete student
export const deleteStudent = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Get student before deletion for audit
    const student = await Student.findById(studentId);
    if (!student) {
      req.auditContext = {
        action: "DELETE_STUDENT",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Student not found for deletion",
        metadata: {
          deleterId: req.user._id,
          deleterRole: req.user.role,
          studentId
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    const deleted = await Student.findByIdAndUpdate(
      studentId,
      { deletedAt: new Date() },
      { new: true }
    );

    if (!deleted) {
      req.auditContext = {
        action: "DELETE_STUDENT",
        resource: "Student",
        severity: "HIGH",
        status: "FAILURE",
        reason: "Student deletion failed",
        metadata: {
          deleterId: req.user._id,
          deleterRole: req.user.role,
          studentId
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    // Set audit context for successful deletion
    req.auditContext = {
      action: "DELETE_STUDENT",
      resource: "Student",
      severity: "HIGH",
      entityId: studentId,
      status: "SUCCESS",
      reason: "Student soft deleted successfully",
      changes: {
        before: { deletedAt: null },
        after: { deletedAt: new Date() },
        changedFields: ["deletedAt"]
      },
      metadata: {
        deleterId: req.user._id,
        deleterRole: req.user.role,
        studentId,
        matricNumber: student.matricNumber,
        deletionTime: new Date().toISOString(),
        softDelete: true
      }
    };

    return buildResponse(res, 200, "Student deleted successfully");
  } catch (error) {
    req.auditContext = {
      action: "DELETE_STUDENT",
      resource: "Student",
      severity: "CRITICAL",
      status: "ERROR",
      reason: "Error deleting student",
      metadata: {
        deleterId: req.user._id,
        deleterRole: req.user.role,
        studentId: req.params.id,
        error: error.message
      }
    };
    next(error)
  }
};

// Restore soft-deleted student
export const restoreStudent = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    // Get student before restoration for audit
    const student = await Student.findById(studentId).setOptions({ archiveMode: 'all' });
    if (!student) {
      req.auditContext = {
        action: "RESTORE_STUDENT",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Student not found for restoration",
        metadata: {
          restorerId: req.user._id,
          restorerRole: req.user.role,
          studentId
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    const restored = await Student.findByIdAndUpdate(
      req.params.id,
      { deletedAt: null },
      { new: true }
    ).setOptions({ archiveMode: 'all' });

    if (!restored) {
      req.auditContext = {
        action: "RESTORE_STUDENT",
        resource: "Student",
        severity: "HIGH",
        status: "FAILURE",
        reason: "Student restoration failed",
        metadata: {
          restorerId: req.user._id,
          restorerRole: req.user.role,
          studentId
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    // Set audit context for successful restoration
    req.auditContext = {
      action: "RESTORE_STUDENT",
      resource: "Student",
      severity: "MEDIUM",
      entityId: studentId,
      status: "SUCCESS",
      reason: "Student restored successfully",
      changes: {
        before: { deletedAt: student.deletedAt },
        after: { deletedAt: null },
        changedFields: ["deletedAt"]
      },
      metadata: {
        restorerId: req.user._id,
        restorerRole: req.user.role,
        studentId,
        matricNumber: student.matricNumber,
        restorationTime: new Date().toISOString()
      }
    };

    return buildResponse(res, 200, "Student restored successfully");
  } catch (error) {
    req.auditContext = {
      action: "RESTORE_STUDENT",
      resource: "Student",
      severity: "HIGH",
      status: "ERROR",
      reason: "Error restoring student",
      metadata: {
        restorerId: req.user._id,
        restorerRole: req.user.role,
        studentId: req.params.id,
        error: error.message
      }
    };
    next(error)
  }
}


export const getStudentSemesterResult = async (req, res, next) => {
  try {
    const { semesterId } = req.params;
    const studentId = req.user._id;

    if (!studentId) {
      req.auditContext = {
        action: "VIEW_SEMESTER_RESULT",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Student ID is required for semester result",
        metadata: {
          studentUserId: req.user._id,
          semesterId
        }
      };
      return buildResponse(res, 400, "Student ID is required");
    }

    // Validate Student
    const student = await Student.findById(studentId).lean();
    if (!student) {
      req.auditContext = {
        action: "VIEW_SEMESTER_RESULT",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Student not found for semester result",
        metadata: {
          studentId,
          semesterId
        }
      };
      return buildResponse(res, 404, "Student not found");
    }

    let resolvedSemesterId = semesterId;

    // If semesterId is missing or invalid ObjectId
    if (!semesterId || !mongoose.Types.ObjectId.isValid(semesterId)) {
      // Find the active semester for the student's department
      const activeSemester = await SemesterService.getActiveAcademicSemester();

      if (!activeSemester) {
        req.auditContext = {
          action: "VIEW_SEMESTER_RESULT",
          resource: "Student",
          severity: "MEDIUM",
          status: "FAILURE",
          reason: "Active semester not found for department",
          metadata: {
            studentId,
            departmentId: student.departmentId
          }
        };
        return buildResponse(res, 404, "Active semester not found for department");
      }

      resolvedSemesterId = activeSemester._id;
    }

    // Fetch the student's semester result with proper population for borrowed courses
    const result = await studentSemseterResultModel.findOne({
      studentId,
      semesterId: resolvedSemesterId,
    })
      .populate({
        path: "courses.courseId",
        populate: {
          path: "borrowedId",
          model: "Course",
        }
      })
      .populate("semesterId")
      .populate("departmentId")
      .lean();

    if (!result) {
      req.auditContext = {
        action: "VIEW_SEMESTER_RESULT",
        resource: "Student",
        severity: "MEDIUM",
        status: "FAILURE",
        reason: "Semester result not found",
        metadata: {
          studentId,
          semesterId: resolvedSemesterId,
          resolvedFrom: semesterId !== resolvedSemesterId
        }
      };
      return buildResponse(res, 404, "Semester result not found", { studentId, resolvedSemesterId, semesterId });
    }

    // Process courses to handle borrowed courses
    if (result.courses && result.courses.length > 0) {
      result.courses = result.courses.map(courseEntry => {
        if (!courseEntry.courseId) return courseEntry;

        const course = courseEntry.courseId;

        // If this course borrows from another course, merge the data
        if (course.borrowedId && typeof course.borrowedId === 'object') {
          const borrowedCourse = course.borrowedId;

          // Create a merged course object with borrowed data
          const effectiveCourse = {
            // Keep original course metadata
            _id: course._id,
            borrowedId: borrowedCourse._id,
            department: course.department,
            status: course.status,
            createdBy: course.createdBy,
            prerequisites: course.prerequisites,
            replacement_course_id: course.replacement_course_id,
            type: course.type,
            elective_category: course.elective_category,
            scope: course.scope,
            faculty: course.faculty,

            // Use borrowed course's academic data
            courseCode: borrowedCourse.courseCode || course.courseCode,
            title: borrowedCourse.title || course.title,
            description: borrowedCourse.description || course.description,
            unit: borrowedCourse.unit || course.unit,
            level: borrowedCourse.level || course.level,
            semester: borrowedCourse.semester || course.semester,
            lecture_hours: borrowedCourse.lecture_hours || course.lecture_hours,
            practical_hours: borrowedCourse.practical_hours || course.practical_hours,

            // Flag to indicate this is a borrowed course
            isBorrowed: true,
            borrowedFromCourseCode: borrowedCourse.courseCode,
            borrowedFromTitle: borrowedCourse.title,
          };

          return {
            ...courseEntry,
            courseId: effectiveCourse
          };
        }

        // If not borrowed, mark it as such for clarity
        if (course.borrowedId === null) {
          course.isBorrowed = false;
        }

        return courseEntry;
      });
    }

    // Set audit context for successful result view
    req.auditContext = {
      action: "VIEW_SEMESTER_RESULT",
      resource: "Student",
      severity: "LOW",
      status: "SUCCESS",
      reason: "Student viewed semester result",
      metadata: {
        studentId,
        semesterId: resolvedSemesterId,
        courseCount: result.courses?.length || 0,
        semesterName: result.semesterId?.name,
        resolvedFrom: semesterId !== resolvedSemesterId
      }
    };

    return buildResponse(res, 200, "Result fetched successfully", result);
  } catch (error) {
    req.auditContext = {
      action: "VIEW_SEMESTER_RESULT",
      resource: "Student",
      severity: "MEDIUM",
      status: "ERROR",
      reason: "Error viewing semester result",
      metadata: {
        studentId: req.user._id,
        semesterId: req.params.semesterId,
        error: error.message
      }
    };
    next(error)
  }
};

/**
 * GET /student/quick-stats
 */
export const getStudentQuickStats = async (req, res, next) => {
  try {
    const studentId = req.user._id; // assuming auth middleware attaches user

    const student = await studentService.getStudentById(studentId);
    const semester = await SemesterService.getActiveAcademicSemester();
    /* ---------------- CGPA ---------------- */
    const cgpa = student.cgpa

    /* -------- Registered Courses -------- */
    const registeredCourse = await courseRegistrationModel.findOne({
      student: studentId,
      semester: semester._id
    });

    const registeredCoursesCount = registeredCourse?.courses.length || 0
    /* -------- Fees Status -------- */
    // const feePayment = await Payment.findOne({
    //   student: studentId,
    //   type: "school-fees",
    //   session: req.currentSession
    // });

    // const feeStatus = feePayment ? "Paid" : "Unpaid";
    const feeStatus = student.feeStatus || "N/A";

    /* -------- Attendance Rate -------- */
    // const attendanceRecords = await Attendance.find({ student: studentId });

    // let attended = 0;
    // let totalClasses = attendanceRecords.length;

    // attendanceRecords.forEach(a => {
    //   if (a.present) attended++;
    // });

    // const attendanceRate =
    //   totalClasses > 0
    //     ? `${Math.round((attended / totalClasses) * 100)}%`
    //     : "0%";
    let attendanceRate = "0%"

    /* -------- Response -------- */
    const stats = [
      { label: "CGPA", value: cgpa, change: "" },
      { label: "Registered Courses", value: String(registeredCoursesCount) },
      { label: "Fees Status", value: feeStatus },
      { label: "Attendance Rate", value: attendanceRate }
    ];

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
};