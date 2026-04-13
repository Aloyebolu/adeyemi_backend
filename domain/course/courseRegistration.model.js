import mongoose from "mongoose";
import { SYSTEM_USER_ID } from "../../config/system.js";
import AppError from "../errors/AppError.js";
import studentModel from "../student/student.model.js";
import courseModel from "./course.model.js";

const courseRegistrationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true }],
    semester: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSemester", required: true },
    session: { type: String, required: true },
    level: { type: Number, required: true },
    totalUnits: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Approved",
    },
    attamptNumber: { type: Number, default: 1 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    carryOverId: { type: mongoose.Schema.Types.ObjectId, ref: "CarryoverCourse", default: null },  // This would be linked to a carryover document in case they are carrying the coursse over

    // Details in case it was registered or re-registerd by an hod
    notes: { type: String, default: null },
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: SYSTEM_USER_ID },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    exceededMaxUnits: {
      type: Boolean,
      default: false
    },
    belowMinUnits: {
      type: Boolean,
      default: false
    },

  },
  { timestamps: true }
);

courseRegistrationSchema.pre('save', function (next) {
  // Check for duplicates in courses array
  const courseStrings = this.courses.map(c => c.toString());
  const uniqueCourses = new Set(courseStrings);

  if (uniqueCourses.size !== courseStrings.length) {
    next(new Error('Cannot register for the same course twice in one semester'));
  }

  // Validate totalUnits against courses (if you have course details)
  // This would require populating courses or storing unit info
  next();
});

// ✅ Prevent a student from registering twice for same semester/session
courseRegistrationSchema.index(
  { student: 1, semester: 1, session: 1 },
  { unique: true }
);

courseRegistrationSchema.pre('validate', async function (next) {
  try {
    // Get student's department
    const student = await studentModel.findById(this.student)
      .populate('departmentId');

    if (!student) {
      return next(new AppError(`Student with ID ${this.student} not found`, 404, null, { studentId: this.student, ctx: 'CourseRegistration.pre.validate' }));
    }

    const studentDepartmentId = student.departmentId._id.toString();

    // Check each course belongs to student's department
    const courses = await courseModel.find({
      _id: { $in: this.courses }
    }).populate('department');

    const invalidCourses = courses.filter(
      course => course.department._id.toString() !== studentDepartmentId
    );

    if (invalidCourses.length > 0) {
      const invalidCodes = invalidCourses.map(c => c.courseCode).join(', ');
      return next(new Error(
        `Cannot register for courses from other departments: ${invalidCodes}`
      ));
    }

    next();
  } catch (error) {
    next(error);
  }
});
export default mongoose.model("CourseRegistration", courseRegistrationSchema);
