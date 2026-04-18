import courseModel from "#domain/course/course.model.js";
import courseRegistrationModel from "#domain/course/courseRegistration.model.js";
import studentModel from "#domain/user/student/student.model.js";
import Result from "#domain/result/result.model.js";

export const rebuildStudentRegistrations = async ({ semesterId, session }) => {
    console.log(semesterId)
    if(!semesterId){return}
  console.log("Starting rebuild of student registrations...");
  const students = await studentModel.find({});
  console.log(`Found ${students.length} students to process.`);

  let created = 0;
  let skipped = 0;
  let errors = [];

  for (const student of students) {
    try {
      console.log(`\nProcessing student: ${student._id} (${student.firstName || ''} ${student.lastName || ''})`);

      // Get all results for this student in the semester
      const results = await Result.find({
        studentId: student._id,
        semester: semesterId,
        // session
      }).populate("courseId");

      if (!results.length) {
        console.log(`  No results found for this student. Skipping...`);
        skipped++;
        continue;
      }

      console.log(`  Found ${results.length} results for this student.`);

      // Extract unique courses from results
      const courseIds = results.map(r => r.courseId._id);
      const uniqueCourseIds = [...new Set(courseIds.map(c => c.toString()))];

      console.log(`  Unique course IDs to register: ${uniqueCourseIds.join(", ")}`);

      // Calculate total units
      const courses = await courseModel.find({ _id: { $in: uniqueCourseIds } });
      const totalUnits = courses.reduce((sum, c) => sum + (c.unit || 0), 0);
      console.log(`  Total units calculated: ${totalUnits}`);

      // Create new course registration
      await courseRegistrationModel.create({
        student: student._id,
        courses: uniqueCourseIds,
        semester: semesterId,
        session,
        level: student.level,
        totalUnits,
        department: student.departmentId,
        status: "Approved",
        notes: "Auto-generated from student results normalization"
      });

      console.log(`  Registration created successfully for student.`);
      created++;

    } catch (err) {
      console.error(`  Error processing student ${student._id}: ${err.message}`);
      errors.push({
        studentId: student._id,
        error: err.message
      });
    }
  }

  console.log("\n===== Rebuild Summary =====");
  console.log(`Registrations created: ${created}`);
  console.log(`Students skipped (no results): ${skipped}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length) {
    console.log("Errors details:", errors);
  }

  return {
    created,
    skipped,
    errors
  };
};