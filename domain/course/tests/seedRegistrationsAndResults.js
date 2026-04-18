import mongoose from "mongoose";
import { faker } from "@faker-js/faker";
import { TEST_DB } from "#config/db.js";
import lecturerModel from "#domain/user/lecturer/lecturer.model.js";
import studentModel from "#domain/user/student/student.model.js";
import courseModel from "#domain/course/course.model.js";
import courseRegistrationModel from "#domain/course/courseRegistration.model.js";
import Result from "#domain/result/result.model.js";

// Try to import AcademicSemester model – if not found, define a minimal schema
let AcademicSemester;
try {
  AcademicSemester = mongoose.model("AcademicSemester");
} catch (e) {
  const { Schema } = mongoose;
  const academicSemesterSchema = new Schema({
    name: String,
    session: String,
    semester: { type: String, enum: ["first", "second"] },
    startDate: Date,
    endDate: Date,
    status: { type: String, enum: ["active", "inactive"], default: "inactive" },
  });
  AcademicSemester = mongoose.model("AcademicSemester", academicSemesterSchema);
}

// ==================== CONFIGURATION ====================
const MONGODB_URI = TEST_DB;
const BATCH_SIZE = 500;  // Students processed per batch

// ==================== MAIN FUNCTION ====================
const seedRegistrationsAndResults = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.");

    // 1. Get the active academic semester
    const activeSemester = await AcademicSemester.findOne({ status: "active" });
    if (!activeSemester) {
      throw new Error("No active academic semester found. Please create one first.");
    }
    console.log(`Active semester: ${activeSemester.name} (${activeSemester.semester})`);

    // 2. Get all active lecturers (for random assignment)
    const lecturers = await lecturerModel.find({ active: true }).select("_id").lean();
    const lecturerIds = lecturers.map(l => l._id);
    if (lecturerIds.length === 0) {
      throw new Error("No active lecturers found – cannot assign results.");
    }
    console.log(`Found ${lecturerIds.length} active lecturers.`);

    // 3. Get all students count
    const totalStudents = await studentModel.countDocuments({ deletedAt: null });
    console.log(`Total students to process: ${totalStudents}`);

    // 4. Fetch all active courses and group by (department, level, semester)
    const allCourses = await courseModel.find({ deletedAt: null }).lean();
    if (allCourses.length === 0) {
      throw new Error("No courses found in the database.");
    }

    const courseMap = new Map();
    for (const course of allCourses) {
      const { department, level, semester } = course;
      if (!department || !level || !semester) continue; // skip incomplete courses
      const key = `${department.toString()}:${level}:${semester}`;
      if (!courseMap.has(key)) courseMap.set(key, []);
      courseMap.get(key).push(course);
    }
    console.log(`Loaded ${allCourses.length} courses, grouped into ${courseMap.size} (dept/level/semester) buckets.`);

    // 5. Process students in batches
    let registrationsCreated = 0;
    let resultsCreated = 0;
    let skippedStudents = 0;
    let skip = 0;

    while (skip < totalStudents) {
      const students = await studentModel.find({ deletedAt: null })
        .select("_id departmentId level")
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();

      if (students.length === 0) break;

      console.log(`\nProcessing batch of ${students.length} students (skip=${skip})...`);

      const registrationsToInsert = [];
      const resultsToInsert = [];

      for (const student of students) {
        const studentId = student._id;
        const deptId = student.departmentId;
        const level = student.level;

        const semesterType = activeSemester.name; // "first" or "second"
        const key = `${deptId.toString()}:${level}:${semesterType}`;
        const availableCourses = courseMap.get(key) || [];

        if (availableCourses.length === 0) {
          // No matching courses for this student
          skippedStudents++;
          continue;
        }

        // Check if a registration already exists for this student in the same semester
        const existingReg = await courseRegistrationModel.findOne({
          student: studentId,
          semester: activeSemester._id,
          session: activeSemester.session,
        });
        if (existingReg) {
          // Registration already exists – skip to avoid duplicate (idempotency)
          console.log(`  Student ${studentId} already has a registration. Skipping.`);
          continue;
        }

        // Extract all course IDs from available courses
        const allCourseIds = availableCourses.map(c => c._id);

        // Create registration document with all eligible courses
        const registration = {
          student: studentId,
          courses: allCourseIds,
          semester: activeSemester._id,
          session: activeSemester.session,
          level: level,
          totalUnits: 0, // optional; could compute later
          status: "Approved",
          attemptNumber: 1,
          approvedBy: null,
          carryOverId: null,
          notes: null,
          registeredBy: null, // defaults to SYSTEM_USER_ID
          department: deptId,
          exceededMaxUnits: false,
          belowMinUnits: false,
        };
        registrationsToInsert.push(registration);

        // For each course, create a result (if not already existing)
        for (const course of availableCourses) {
          const courseId = course._id;

          // Avoid duplicate result for same student+course+semester
          const existingResult = await Result.findOne({
            studentId: studentId,
            courseId: courseId,
            semester: activeSemester._id,
          });
          if (existingResult) continue;

          // Generate random marks
          let ca = Math.floor(Math.random() * 41);      // 0-40
          let exam = Math.floor(Math.random() * 61);    // 0-60
          if (ca + exam > 100) {
            exam = 100 - ca;
            if (exam < 0) {
              ca = 40;
              exam = 60;
            }
          }
          const score = ca + exam;

          const result = {
            studentId: studentId,
            courseId: courseId,
            lecturerId: lecturerIds[Math.floor(Math.random() * lecturerIds.length)],
            semester: activeSemester._id,
            ca: ca,
            exam: exam,
            score: score,
            approved: true,
            locked: false,
            deletedAt: null,
            createdBy: null,
            courseUnit: course.unit,
            courseCode: course.courseCode,
            courseTitle: course.title,
            courseDepartmentId: course.department,
          };
          resultsToInsert.push(result);
        }
      }

      // Insert registrations and results in batches
      if (registrationsToInsert.length) {
        await courseRegistrationModel.insertMany(registrationsToInsert, { ordered: false });
        registrationsCreated += registrationsToInsert.length;
        console.log(`  Created ${registrationsToInsert.length} registrations.`);
      }
      if (resultsToInsert.length) {
        await Result.insertMany(resultsToInsert, { ordered: false });
        resultsCreated += resultsToInsert.length;
        console.log(`  Created ${resultsToInsert.length} results.`);
      }

      skip += students.length;
    }

    console.log("\n✅ Seeding completed!");
    console.log(`  Registrations created: ${registrationsCreated}`);
    console.log(`  Results created: ${resultsCreated}`);
    console.log(`  Students skipped (no matching courses): ${skippedStudents}`);

  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed.");
  }
};

seedRegistrationsAndResults();