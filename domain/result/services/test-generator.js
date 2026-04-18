import mongoose from "mongoose";
import Result from "#domain/result/result.model.js";
import Course from "#domain/course/course.model.js";
import connectToDB from "#config/db.js";
import { analyzeWrongCourseDepartments } from "./normalizeWrongDepartmentResults.js";
await connectToDB();
const semester = "692857cfc3c2904e51b75554";
/**
 * Test Data Generator - Creates intentional wrong-department results for testing
 * This creates duplicate results in wrong departments based on the borrowed course system
 * Do not run this on a production database! Use a test database and clean up after testing.
 */
export async function generateTestWrongDepartmentResults(
    ourDepartmentId = "692857cfc3c2904e51b75554",
    options = {
        numberOfStudents: 5,           // Number of students to affect
        resultsPerStudent: 3,          // How many wrong results per student
        createConflicts: true,         // Create intentional duplicate conflicts
        createMultiConflicts: true,    // Create cases where multiple wrong results map to same correct course
        semester,           // Semester for test results
        dryRun: false                  // Actually create the records
    }
) {
    console.log("🎯 Generating test data with intentional wrong-department results...");
    console.log("Options:", options);

    // Step 1: Get our department's courses
    const ourDepartmentCourses = await Course.find({
        department: ourDepartmentId
    }).lean();

    if (ourDepartmentCourses.length === 0) {
        throw new Error("No courses found in target department");
    }

    console.log(`Found ${ourDepartmentCourses.length} courses in our department`);

    // Step 2: Find courses that have borrowed versions in other departments
    const coursesWithBorrowed = await Course.find({
        department: ourDepartmentId,
        borrowedId: { $exists: true, $ne: null }
    }).lean();

    console.log(`Found ${coursesWithBorrowed.length} courses with borrowed relationships`);

    if (coursesWithBorrowed.length === 0) {
        console.log("⚠️  No borrowed courses found. Looking for alternative courses...");
    }

    // Step 3: Get courses from other departments that are borrowed versions of our courses
    const otherDeptCourses = await Course.find({
        department: { $ne: ourDepartmentId },
        $or: [
            { borrowedId: { $in: ourDepartmentCourses.map(c => c._id) } },
            { _id: { $in: coursesWithBorrowed.map(c => c.borrowedId) } }
        ]
    }).populate('department').lean();

    console.log(`Found ${otherDeptCourses.length} courses in other departments that relate to our courses`);

    // Step 4: Get some real students from the database
    const existingResults = await Result.find()
        .limit(50)
        .select('studentId')
        .distinct('studentId')
        .lean();

    let studentIds = existingResults;

    // If not enough real students, create mock ones
    while (studentIds.length < options.numberOfStudents) {
        studentIds.push(new mongoose.Types.ObjectId());
    }

    // Select random students
    const selectedStudents = studentIds
        .sort(() => Math.random() - 0.5)
        .slice(0, options.numberOfStudents);

    console.log(`Selected ${selectedStudents.length} students for test data`);

    // Step 5: Create test results
    const testResults = [];
    const conflictScenarios = [];

    for (const studentId of selectedStudents) {
        console.log(`\n📝 Creating test data for student ${studentId}...`);

        // Select random courses from other departments
        const selectedWrongCourses = otherDeptCourses
            .sort(() => Math.random() - 0.5)
            .slice(0, options.resultsPerStudent);

        for (let i = 0; i < selectedWrongCourses.length; i++) {
            const wrongCourse = selectedWrongCourses[i];

            // Find the corresponding correct course in our department
            let correctCourse;

            if (wrongCourse.borrowedId) {
                // This course is borrowed from somewhere - find our department's version
                correctCourse = ourDepartmentCourses.find(c =>
                    String(c._id) === String(wrongCourse.borrowedId)
                );
            } else {
                // This might be the original - find borrowed versions in our department
                correctCourse = ourDepartmentCourses.find(c =>
                    String(c.borrowedId) === String(wrongCourse._id)
                );
            }

            const testResult = {
                studentId: studentId,
                courseId: wrongCourse._id,
                semester: options.semester,
                score: Math.floor(Math.random() * 40) + 60, // Random score 60-100
                grade: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
                // Add any other required fields for your Result model
                createdAt: new Date(),
                updatedAt: new Date()
            };

            testResults.push(testResult);

            console.log(`  Created: ${wrongCourse.courseCode} (${wrongCourse.department?.name || 'Other Dept'})`);
            if (correctCourse) {
                console.log(`    → Maps to: ${correctCourse.courseCode} (Our Department)`);
            }
        }

        // Create intentional duplicate conflicts if requested
        if (options.createConflicts && options.createMultiConflicts) {
            // Find a course in another department that multiple students will take
            const conflictCourse = otherDeptCourses.find(c =>
                c.department && String(c.department._id) !== ourDepartmentId
            );

            if (conflictCourse) {
                // Find the correct course in our department
                const correctConflictCourse = ourDepartmentCourses.find(c =>
                    String(c.borrowedId) === String(conflictCourse._id) ||
                    String(c._id) === String(conflictCourse.borrowedId)
                );

                if (correctConflictCourse) {
                    // Create multiple results for the SAME student with different wrong courses
                    // that all map to the SAME correct course
                    const conflictScenario = {
                        studentId: studentId,
                        correctCourse: correctConflictCourse,
                        wrongCourses: [],
                        results: []
                    };

                    // Find other courses in other departments that also map to the same correct course
                    const relatedWrongCourses = otherDeptCourses.filter(c => {
                        const mapsToSame =
                            String(c.borrowedId) === String(correctConflictCourse._id) ||
                            String(c._id) === String(correctConflictCourse.borrowedId) ||
                            String(c.borrowedId) === String(correctConflictCourse.borrowedId);

                        return mapsToSame && String(c._id) !== String(conflictCourse._id);
                    }).slice(0, 2); // Get up to 2 more related courses

                    const allConflictCourses = [conflictCourse, ...relatedWrongCourses];

                    allConflictCourses.forEach((wrongCourse, index) => {
                        const conflictResult = {
                            studentId: studentId,
                            courseId: wrongCourse._id,
                            semester: options.semester,
                            score: Math.floor(Math.random() * 40) + 60,
                            grade: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };

                        testResults.push(conflictResult);
                        conflictScenario.wrongCourses.push(wrongCourse);
                        conflictScenario.results.push(conflictResult);

                        console.log(`  🔥 CONFLICT TEST: Created duplicate mapping`);
                        console.log(`    Wrong course ${index + 1}: ${wrongCourse.courseCode} (${wrongCourse.department?.name})`);
                    });

                    console.log(`    ⚠️  ALL map to: ${correctConflictCourse.courseCode} (Our Department)`);
                    console.log(`    This will create ${allConflictCourses.length} results that conflict!`);

                    conflictScenarios.push(conflictScenario);
                }
            }
        }
    }

    // Step 6: Insert test results if not dry run
    if (!options.dryRun && testResults.length > 0) {
        console.log(`\n💾 Inserting ${testResults.length} test results...`);

        try {
            const inserted = await Result.insertMany(testResults);
            console.log(`✅ Successfully created ${inserted.length} test results`);

            // Return summary
            return {
                success: true,
                totalCreated: inserted.length,
                studentsAffected: selectedStudents.length,
                conflictScenarios: conflictScenarios.length,
                testResultIds: inserted.map(r => r._id),
                summary: {
                    totalWrongDepartmentResults: inserted.length,
                    conflictScenarios: conflictScenarios.map(s => ({
                        studentId: s.studentId,
                        correctCourseCode: s.correctCourse.courseCode,
                        wrongCourseCount: s.wrongCourses.length,
                        wrongCourseCodes: s.wrongCourses.map(c => c.courseCode)
                    }))
                }
            };
        } catch (error) {
            console.error("❌ Error inserting test results:", error.message);

            // Check for duplicate key errors
            if (error.code === 11000) {
                console.log("⚠️  Duplicate key error detected - some results already exist");
                console.log("This is actually good for testing duplicate detection!");
            }

            throw error;
        }
    } else {
        console.log(`\n🔍 DRY RUN: Would create ${testResults.length} test results`);

        return {
            success: true,
            dryRun: true,
            wouldCreate: testResults.length,
            studentsAffected: selectedStudents.length,
            conflictScenarios: conflictScenarios.length,
            preview: {
                totalWrongDepartmentResults: testResults.length,
                conflictScenarios: conflictScenarios.map(s => ({
                    studentId: s.studentId,
                    correctCourseCode: s.correctCourse.courseCode,
                    wrongCourseCount: s.wrongCourses.length,
                    wrongCourseCodes: s.wrongCourses.map(c => c.courseCode)
                }))
            }
        };
    }
}

/**
 * Clean up test data after testing
 */
export async function cleanupTestResults(testResultIds) {
    if (!testResultIds || testResultIds.length === 0) {
        console.log("No test results to clean up");
        return;
    }

    console.log(`🧹 Cleaning up ${testResultIds.length} test results...`);

    const result = await Result.deleteMany({
        _id: { $in: testResultIds }
    });

    console.log(`✅ Deleted ${result.deletedCount} test results`);

    return result;
}

/**
 * Complete test workflow
 */
export async function runFullTest(ourDepartmentId = "692857cfc3c2904e51b75554") {
    console.log("🧪 Starting full test workflow...\n");

    // Step 1: Generate test data
    console.log("Step 1: Generating test data with conflicts...");
    const testData = await generateTestWrongDepartmentResults(ourDepartmentId, {
        numberOfStudents: 3,
        resultsPerStudent: 2,
        createConflicts: true,
        createMultiConflicts: true,
        semester,
        dryRun: false
    });

    if (!testData.success) {
        console.error("Failed to generate test data");
        return;
    }

    console.log("\n" + "=".repeat(50));
    console.log("Test data created successfully!");
    console.log("Summary:", testData.summary);
    console.log("=".repeat(50) + "\n");

    // Step 2: Run the analyzer in dry run mode first
    console.log("Step 2: Running analyzer in DRY RUN mode...");

    const dryRunAnalysis = await analyzeWrongCourseDepartments(ourDepartmentId, 100, true);

    console.log("\n" + "=".repeat(50));
    console.log("DRY RUN Analysis Complete!");
    console.log(`Found ${dryRunAnalysis.stats.wrongDepartment} wrong department results`);
    console.log(`Detected ${dryRunAnalysis.stats.duplicateConflicts} duplicate conflicts`);
    console.log(`Safe to update: ${dryRunAnalysis.stats.safeToUpdate}`);
    console.log("=".repeat(50) + "\n");

    // Step 3: Ask user if they want to proceed with actual fixes
    console.log("Step 3: Would you like to apply the safe fixes?");
    console.log("Note: This will ONLY apply updates that don't cause conflicts");
    console.log("Run with dryRun=false to apply changes\n");

    // Step 4: Offer to clean up test data
    console.log("Step 4: Clean up test data?");
    console.log("Run: cleanupTestResults(testData.testResultIds)\n");

    return {
        testData,
        dryRunAnalysis,
        testResultIds: testData.testResultIds
    };
}

// Quick test functions for different scenarios

/**
 * Test 1: Simple wrong department results (no conflicts)
 */
export async function testSimpleWrongDepartment(ourDepartmentId) {
    return generateTestWrongDepartmentResults(ourDepartmentId, {
        numberOfStudents: 2,
        resultsPerStudent: 1,
        createConflicts: false,
        createMultiConflicts: false,
        dryRun: false
    });
}

/**
 * Test 2: Create intentional duplicate conflicts
 */
export async function testDuplicateConflicts(ourDepartmentId) {
    return generateTestWrongDepartmentResults(ourDepartmentId, {
        numberOfStudents: 2,
        resultsPerStudent: 1,
        createConflicts: true,
        createMultiConflicts: true,
        dryRun: false
    });
}

/**
 * Test 3: Mass test with many conflicts
 */
export async function testMassConflicts(ourDepartmentId) {
    return generateTestWrongDepartmentResults(ourDepartmentId, {
        numberOfStudents: 5,
        resultsPerStudent: 3,
        createConflicts: true,
        createMultiConflicts: true,
        dryRun: false
    });
}

// Usage example
if (import.meta.url === `file://${process.argv[1]}`) {
    const ourDepartmentId = "692857cfc3c2904e51b75554";

    // Choose which test to run:
    const testType = process.argv[2] || "full";

    switch (testType) {
        case "simple":
            console.log("Running simple wrong department test...");
            testSimpleWrongDepartment(ourDepartmentId).then(() => {
                console.log("\n✅ Simple test complete!");
            });
            break;

        case "conflicts":
            console.log("Running duplicate conflicts test...");
            testDuplicateConflicts(ourDepartmentId).then(() => {
                console.log("\n✅ Conflicts test complete!");
            });
            break;

        case "mass":
            console.log("Running mass conflicts test...");
            testMassConflicts(ourDepartmentId).then(() => {
                console.log("\n✅ Mass test complete!");
            });
            break;

        case "full":
        default:
            runFullTest(ourDepartmentId).then(() => {
                console.log("\n✅ Full test workflow complete!");
                console.log("\n💡 Next steps:");
                console.log("1. Review the dry run analysis above");
                console.log("2. Run the analyzer with dryRun=false to apply safe fixes");
                console.log("3. Run generateConflictResolutionReport() to see conflict resolution suggestions");
                console.log("4. Clean up test data with cleanupTestResults()");
            });
            break;
    }
}