import mongoose from "mongoose";
import { faker } from "@faker-js/faker";

// Models
import { TEST_DB } from "#config/db.js";
import departmentModel from "#domain/department/department.model.js";
import courseModel from "#domain/course/course.model.js";
import facultyModel from "#domain/faculty/faculty.model.js";

// Configuration
const MONGODB_URI = TEST_DB
const COURSES_PER_DEPARTMENT = 50; // Adjust as needed
const BATCH_SIZE = 200;            // Insert batch size

// Helper: Generate a random level
const getRandomLevel = () => {
  const levels = [100, 200, 300, 400, 500, 600];
  return levels[Math.floor(Math.random() * levels.length)];
};

// Helper: Generate a random semester
const getRandomSemester = () => {
  return Math.random() < 0.5 ? "first" : "second";
};

// Helper: Generate a random course type (core/elective)
const getRandomType = () => {
  return Math.random() < 0.7 ? "core" : "elective";
};

// Helper: Generate a random scope
const getRandomScope = () => {
  const scopes = ["department", "faculty", "programme", "general"];
  // Weight: mostly department, sometimes faculty/programme, rarely general
  const r = Math.random();
  if (r < 0.7) return "department";
  if (r < 0.85) return "faculty";
  if (r < 0.95) return "programme";
  return "general";
};

// Helper: Generate a unique course code based on department code, level, and a sequential counter
// Format: DEPTCODE + LEVEL + 2-digit counter (e.g., CSC10101)
const generateCourseCode = (deptCode, level, counter) => {
  return `${deptCode}${level}${counter.toString().padStart(2, "0")}`;
};

// Main seed function
const seedCourses = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.");

    // mongoose.model("Faculty", facultyModel)
    // Fetch all departments
    const departments = await departmentModel.find().populate("faculty").lean();
    if (!departments.length) {
      throw new Error("No departments found in the database. Please seed departments first.");
    }
    console.log(`Found ${departments.length} departments.`);

    let totalCoursesCreated = 0;
    let totalSkipped = 0;

    // Process each department
    for (const dept of departments) {
      const deptId = dept._id;
      const deptCode = dept.code;
      const facultyId = dept.faculty?._id || dept.faculty; // could be ObjectId or populated object

      if (!deptCode) {
        console.warn(`Department ${dept.name} has no code. Skipping.`);
        totalSkipped++;
        continue;
      }

      console.log(`\nProcessing department: ${dept.name} (${deptCode})`);

      // Generate courses for this department
      const coursesToInsert = [];

      // We'll maintain a counter per level to generate unique course codes
      const levelCounters = { 100: 1, 200: 1, 300: 1, 400: 1, 500: 1, 600: 1 };

      for (let i = 0; i < COURSES_PER_DEPARTMENT; i++) {
        const level = getRandomLevel();
        const semester = getRandomSemester();
        const type = getRandomType();
        const scope = getRandomScope();

        // Get counter for this level and increment
        let counter = levelCounters[level]++;
        // Ensure we don't exceed 99 (two-digit format)
        if (counter > 99) {
          console.warn(`  Warning: Counter for level ${level} exceeded 99 in ${dept.name}. Skipping additional courses for this level.`);
          continue;
        }

        const courseCode = generateCourseCode(deptCode, level, counter);
        const title = faker.lorem.words(3); // e.g., "Introduction to Programming"
        const description = faker.lorem.sentence();
        const unit = faker.number.int({ min: 1, max: 4 });
        const lecture_hours = faker.number.int({ min: 1, max: 4 });
        const practical_hours = faker.number.int({ min: 0, max: 3 });

        // Build overrides object (sometimes empty)
        const overrides = {};
        if (Math.random() < 0.3) {
          // For some courses, add allowed_levels
          overrides.allowed_levels = [level];
          if (Math.random() < 0.5) {
            overrides.allowed_levels = [level, level + 100];
          }
        }
        // allowed_programmes, excluded_programmes, allowed_departments, excluded_departments
        // We'll leave them empty for simplicity; you can add logic if you have programmes

        // Elective category only for elective courses
        let elective_category = undefined;
        if (type === "elective") {
          elective_category = Math.random() < 0.8 ? "optional" : "required";
        }

        const course = {
          courseCode,
          title,
          description,
          unit,
          level,
          semester,
          type,
          elective_category,
          overrides,
          faculty: facultyId,
          department: deptId,
          programme: null, // can be set later if needed
          scope,
          status: "active",
          borrowedId: null,
          replacement_course_id: null,
          prerequisites: [],
          createdBy: null, // will default to SYSTEM_USER_ID if needed
          lecture_hours,
          practical_hours,
          deletedAt: null,
          deletedBy: null,
        };

        coursesToInsert.push(course);
      }

      if (coursesToInsert.length) {
        // Insert in batches to avoid memory issues
        for (let i = 0; i < coursesToInsert.length; i += BATCH_SIZE) {
          const batch = coursesToInsert.slice(i, i + BATCH_SIZE);
          await courseModel.insertMany(batch, { ordered: false });
          totalCoursesCreated += batch.length;
        }
        console.log(`  Created ${coursesToInsert.length} courses for ${dept.name}.`);
      } else {
        console.log(`  No courses created for ${dept.name}.`);
      }
    }

    console.log(`\n✅ Seeding completed!`);
    console.log(`  Total courses created: ${totalCoursesCreated}`);
    console.log(`  Departments skipped (no code): ${totalSkipped}`);

  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Database connection closed.");
  }
};

seedCourses();