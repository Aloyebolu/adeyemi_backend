import XLSX from "xlsx";
import fs from "fs";
import readline from "readline";
import Result from "#domain/result/result.model.js";
import Student from "#domain/user/student/student.model.js";
import Course from "#domain/course/course.model.js";
import CourseRegistration from "#domain/course/courseRegistration.model.js";
import SemesterService from "#domain/semester/semester.service.js";
import mongoose from "mongoose";
import connectToDB, { TEST_DB } from "#config/db.js";
import { SYSTEM_USER_ID } from "#config/system.js";
import AppError from "#shared/errors/AppError.js";
import departmentModel from "#domain/organization/department/department.model.js";

connectToDB()

// Set this to true for automated mode (no questions asked)
const autoMode = true;

// Create readline interface for user interaction (only used when autoMode is false)
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promise-based question function - maintained as is
function question(query) {
    if (autoMode) {
        return ''; // Return empty string in auto mode
    }
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

// Function to get course by department and course code
async function getCourseByDepartmentAndCode(departmentId, courseCode) {
    // Step 1: Look for the course without including the departmentId
    const baseCourse = await Course.findOne({
        courseCode: courseCode?.toUpperCase(),
    }).populate('borrowedId');

    if (baseCourse) {
        console.log(`Found course for code ${courseCode}: ${baseCourse.title} (Dept: ${baseCourse.department})`);
    } else {
        console.log(`No course found for code ${courseCode}`);
    }
    if (!baseCourse) {
        return null;
    }

    // Step 2: Check if the base course belongs to the requested department
    if (baseCourse.department?.toString() === departmentId?.toString()) {
        // If it's a borrowed course, return the borrowed course content
        if (baseCourse.borrowedId) {
            return baseCourse.borrowedId;
        }
        return baseCourse;
    }

    // Step 3: If department doesn't match, search for a borrowed instance of this course
    const borrowedCourse = await Course.findOne({
        borrowedId: baseCourse._id,
        department: departmentId,
        deletedAt: null
    }).populate('borrowedId');

    if (borrowedCourse) {
        // Return the borrowed course's content (which points to the base course)
        if (borrowedCourse.borrowedId) {
            return borrowedCourse.borrowedId;
        }
        return borrowedCourse;
    }

    // Step 4: No matching course found for this department
    return null;
}

// Function to display Excel preview
async function displayExcelPreview(rows, headerRow, selectedColumns) {
    console.log("\n" + "=".repeat(80));
    console.log("📊 EXCEL FILE PREVIEW & MAPPING OVERVIEW");
    console.log("=".repeat(80));

    console.log("\n📋 Column Mapping:");
    console.log("-".repeat(80));
    console.log(`Column ${selectedColumns.matricCol}: Matric Number (Student identifier)`);
    console.log(`Column ${selectedColumns.nameCol}: Student Name (for reference only)`);
    console.log("\n📚 Course Columns:");

    for (const [col, courseCode] of Object.entries(selectedColumns.courseCols)) {
        console.log(`  Column ${col}: ${courseCode}`);
    }

    console.log("\n📝 Data Preview (first 5 rows):");
    console.log("-".repeat(80));

    // Display header row
    let previewRows = [];
    for (let i = 0; i < Math.min(5, rows.length - 2); i++) {
        const row = rows[i + 2]; // Start from data rows
        if (row && row[selectedColumns.matricCol]) {
            previewRows.push({
                "Matric": row[selectedColumns.matricCol],
                "Name": row[selectedColumns.nameCol] || "",
                ...Object.fromEntries(
                    Object.entries(selectedColumns.courseCols).map(([col, code]) => [
                        code,
                        row[parseInt(col)] || "-"
                    ])
                )
            });
        }
    }

    console.table(previewRows);

    console.log("\n✅ Validation Summary:");
    console.log("-".repeat(80));
    console.log(`✓ Total students found: Will be validated during import`);
    console.log(`✓ Total courses: ${Object.keys(selectedColumns.courseCols).length}`);
    console.log(`✓ Total records to process: ~${previewRows.length * Object.keys(selectedColumns.courseCols).length}`);

    console.log("\n" + "=".repeat(80));
}

// Function to validate and get course IDs
async function validateCourses(departmentId, courseCodes) {
    const courseMap = {};
    const invalidCourses = [];

    console.log("\n🔍 Validating courses...");

    for (const [col, courseCode] of Object.entries(courseCodes)) {
        const course = await getCourseByDepartmentAndCode(departmentId, courseCode);

        if (course) {
            courseMap[col] = {
                courseId: course._id,
                courseCode: course.courseCode,
                title: course.title
            };
            console.log(`  ✓ Column ${col}: ${courseCode} -> ${course.title}`);
        } else {
            invalidCourses.push({ column: col, code: courseCode });
            console.log(`  ✗ Column ${col}: ${courseCode} -> NOT FOUND in department`);
        }
    }

    if (invalidCourses.length > 0) {
        console.log("\n⚠️ Warning: The following courses were not found:");
        invalidCourses.forEach(c => {
            console.log(`  - Column ${c.column}: ${c.code}`);
        });

        if (!autoMode) {
            const answer = await question("\nDo you want to continue without these courses? (yes/no): ");
            if (answer?.toLowerCase() !== 'yes') {
                throw new Error("Import cancelled by user due to invalid courses");
            }
        } else {
            console.log("⚠️ Auto mode: Continuing despite invalid courses");
        }
    }

    return courseMap;
}

// Function to automatically register students for courses
async function autoRegisterStudentForCourses(studentId, departmentId, semesterId, session, level, courseIds) {
    try {
        // Check if registration already exists
        const existingRegistration = await CourseRegistration.findOne({
            student: studentId,
            semester: semesterId,
            session: session
        });

        if (existingRegistration) {
            console.log(`  ℹ️ Student already registered for this semester/session`);
            return existingRegistration;
        }

        // Calculate total units
        const courses = await Course.find({ _id: { $in: courseIds } });
        const totalUnits = courses.reduce((sum, course) => sum + (course.units || 0), 0);

        // Create new registration
        const registration = new CourseRegistration({
            student: studentId,
            courses: courseIds,
            semester: semesterId,
            session: session,
            level: level,
            totalUnits: totalUnits,
            status: 'Approved',
            department: departmentId,
            registeredBy: SYSTEM_USER_ID,
            notes: 'Auto-registered during result import'
        });

        await registration.save();
        console.log(`  ✓ Auto-registered student for ${courseIds.length} courses`);
        return registration;
    } catch (error) {
        console.log(`  ✗ Failed to auto-register student: ${error.message}`);
        throw error;
    }
}

// Main import function with bulk operations
export async function importResultsFromExcel(filePath, semesterId = null, departmentId = null, session = null) {
    // Connect to MongoDB
    semesterId = (await SemesterService.getAcademicSemesterById(semesterId))._id
    
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    if (!departmentId) {
        if (!autoMode) {
            departmentId = await question("Please enter the Department ID: ");
        } else {
            throw new Error("Department ID is required in auto mode");
        }
        if (!departmentId) {
            throw new Error("Department ID is required");
        }
    }

    // Get semester and session info if not provided
    let semesterInfo = null;
    if (semesterId) {
        semesterInfo = await SemesterService.getAcademicSemesterById(semesterId);
    } else {
        throw new AppError("Unable to resolve semester")
    }

    if (!session && semesterInfo) {
        session = semesterInfo.session;
    }

    if (!session) {
        if (!autoMode) {
            session = await question("Please enter the academic session (e.g., 2023/2024): ");
        } else {
            throw new Error("Academic session is required in auto mode");
        }
        if (!session) {
            throw new Error("Academic session is required");
        }
    }

    console.log("\n📂 Reading Excel file...");
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (rows.length < 3) {
        throw new Error("No data found in Excel. File must have at least 3 rows (headers + data).");
    }

    // Get header row (first row)
    const headerRow = rows[0];

    console.log("\n📋 Excel Columns Found:");
    headerRow.forEach((col, idx) => {
        if (col) console.log(`  Column ${idx}: ${col}`);
    });
    console.log("\n📋 Excel Columns In a single line:");
    let buf = "";
    headerRow.forEach((col, idx) => {
        if (col) buf += `${idx}:${col},`;
    });
    console.log(buf);

    // Interactive or automatic column selection
    let matricCol, nameCol, courseCols;
    
    if (autoMode) {
        // Auto mode: Matric from first column, Name from second column, all others as courses
        console.log("\n🤖 Auto mode enabled - automatically detecting columns...");
        matricCol = 0; // First column for matric number
        nameCol = 1;   // Second column for student name
        
        courseCols = {};
        // All subsequent columns (from index 2 onwards) are treated as courses
        for (let i = 2; i < headerRow.length; i++) {
            const courseCode = headerRow[i] ? String(headerRow[i]).trim().toUpperCase() : `COURSE_${i}`;
            if (courseCode && courseCode !== "UNDEFINED" && courseCode !== "") {
                courseCols[i] = courseCode;
                console.log(`  📚 Auto-mapped Column ${i}: ${courseCode} (as course)`);
            } else if (courseCode === "UNDEFINED" || courseCode === "") {
                console.log(`  ⚠️ Skipping Column ${i}: No valid course code found`);
            }
        }
        
        console.log(`\n✅ Auto-mapping complete: Matric(Col ${matricCol}), Name(Col ${nameCol}), ${Object.keys(courseCols).length} courses detected`);
    } else {
        console.log("\n" + "=".repeat(50));
        console.log("🔧 COLUMN MAPPING SETUP");
        console.log("=".repeat(50));

        matricCol = parseInt(await question("\nEnter the column number for Matric Number: ")) || 0;
        nameCol = parseInt(await question("Enter the column number for Student Name: ")) || 1;

        console.log("\n📚 Now identify course columns (format: columnNumber:CourseCode)");
        console.log("Example: 2:CSC101, 3:MTH102, 4:PHY103");
        console.log("Press Enter if no more courses to add");

        const courseInput = await question("\nEnter course columns (comma-separated): ") || '';

        courseCols = {};
        if (courseInput) {
            const entries = courseInput.split(",");
            for (const entry of entries) {
                const [col, code] = entry.trim().split(":");
                if (col && code) {
                    courseCols[parseInt(col)] = code?.trim().toUpperCase();
                } else {
                    courseCols[parseInt(entry)] = headerRow[parseInt(entry)];
                }
            }
        }
    }

    if (Object.keys(courseCols).length === 0) {
        throw new Error("No course columns specified");
    }

    // Validate that columns exist
    for (const col of [matricCol, nameCol, ...Object.keys(courseCols).map(Number)]) {
        if (col >= headerRow.length) {
            throw new Error(`Column ${col} does not exist in the Excel file`);
        }
    }

    const selectedColumns = {
        matricCol,
        nameCol,
        courseCols
    };

    // Display preview and get confirmation
    await displayExcelPreview(rows, headerRow, selectedColumns);

    if (!autoMode) {
        const confirm = await question("\n✅ Does this look correct? (yes/no): ");
        if (confirm?.toLowerCase() !== 'yes') {
            console.log("❌ Import cancelled by user");
            rl.close();
            return;
        }
    } else {
        console.log("\n🤖 Auto mode: Proceeding with import automatically...");
    }

    // Validate all courses against the department
    const courseMap = await validateCourses(departmentId, courseCols);

    console.log("\n📊 Starting import process...");
    console.log("🔧 Preparing bulk operations...");

    // Prepare bulk operations array
    const bulkOps = [];
    const registrationsToCreate = new Map(); // Map to track unique student registrations
    const studentMatricMap = new Map();
    const errors = [];
    let processedCount = 0;
    let skippedCount = 0;

    // First pass: collect all student data and prepare operations
    for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[matricCol]) continue;

        const matricNumber = String(row[matricCol]).trim();
        studentMatricMap.set(matricNumber, { row, index: r });
    }

    // Get all students in bulk
    const matricNumbers = Array.from(studentMatricMap.keys());
    const students = await Student.find({ 
        matricNumber: { $in: matricNumbers },
        departmentId: departmentId
    }).lean();

    const studentMap = new Map(students.map(s => [s.matricNumber, s]));

    console.log(`\n📝 Found ${students.length} students out of ${matricNumbers.length} in Excel`);

    // Process each student
    for (const [matricNumber, student] of studentMap) {
        const { row } = studentMatricMap.get(matricNumber);
        const studentName = row[nameCol] || "N/A";

        console.log(`\n📝 Processing student: ${matricNumber} (${studentName})`);

        // Prepare course registration if needed
        const courseIdsForStudent = [];
        
        // Process each course for this student
        for (const [col, courseInfo] of Object.entries(courseMap)) {
            const score = row[parseInt(col)];

            if (score === undefined || score === null || score === "") {
                continue;
            }

            // Validate score is a number
            const numericScore = parseFloat(score);
            if (isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
                errors.push(`Invalid score for ${matricNumber}, ${courseInfo.courseCode}: ${score}`);
                continue;
            }

            // Add course to student's registration list
            courseIdsForStudent.push(courseInfo.courseId);

            // Prepare result bulk operation
            const query = {
                studentId: student._id,
                courseId: courseInfo.courseId,
            };

            if (semesterId) {
                query.semester = semesterId;
            }

            bulkOps.push({
                updateOne: {
                    filter: query,
                    update: {
                        $set: {
                            score: numericScore,
                            ...(semesterId ? { semester: semesterId } : {})
                        }
                    },
                    upsert: true
                }
            });

            processedCount++;
        }

        // Queue registration for this student if they have courses to register
        if (courseIdsForStudent.length > 0) {
            const key = `${student._id}_${semesterId}_${session}`;
            if (!registrationsToCreate.has(key)) {
                registrationsToCreate.set(key, {
                    studentId: student._id,
                    courseIds: courseIdsForStudent,
                    level: student.level
                });
            }
        }
    }

    // Check for students not found
    for (const matricNumber of matricNumbers) {
        if (!studentMap.has(matricNumber)) {
            console.log(`  ⚠️ Student not found: ${matricNumber}`);
            skippedCount++;
            errors.push(`Student not found: ${matricNumber}`);
        }
    }

    // Execute bulk result operations
    if (bulkOps.length > 0) {
        console.log(`\n💾 Saving ${bulkOps.length} results in bulk...`);
        try {
            const result = await Result.bulkWrite(bulkOps, { ordered: false });
            console.log(`  ✓ Bulk write completed: ${result.upsertedCount + result.modifiedCount} results saved`);
        } catch (error) {
            console.log(`  ✗ Bulk write error: ${error.message}`);
            errors.push(`Bulk write error: ${error.message}`);
        }
    }

    // Process auto-registrations
    console.log(`\n📋 Processing ${registrationsToCreate.size} course registrations...`);
    let registrationSuccessCount = 0;
    let registrationErrorCount = 0;

    for (const [key, regInfo] of registrationsToCreate) {
        try {
            await autoRegisterStudentForCourses(
                regInfo.studentId,
                departmentId,
                semesterId,
                session,
                regInfo.level,
                regInfo.courseIds
            );
            registrationSuccessCount++;
        } catch (error) {
            console.log(`  ✗ Registration failed: ${error.message}`);
            registrationErrorCount++;
            errors.push(`Registration failed for student ${regInfo.studentId}: ${error.message}`);
            throw error
        }
    }

    // Final summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 IMPORT SUMMARY");
    console.log("=".repeat(80));
    console.log(`✅ Results processed: ${processedCount}`);
    console.log(`✅ Auto-registrations created: ${registrationSuccessCount}`);
    console.log(`❌ Registration errors: ${registrationErrorCount}`);
    console.log(`❌ Result errors: ${errors.length - registrationErrorCount}`);
    console.log(`⚠️ Skipped (student not found): ${skippedCount}`);
    console.log(`📁 File: ${filePath}`);
    console.log(`🏢 Department ID: ${departmentId}`);
    console.log(`📅 Semester ID: ${semesterId || 'Not specified'}`);
    console.log(`📚 Session: ${session}`);

    if (errors.length > 0 && errors.length <= 10) {
        console.log("\n📝 Error Details:");
        errors.forEach(err => console.log(`  - ${err}`));
    } else if (errors.length > 10) {
        console.log(`\n📝 First 10 of ${errors.length} errors:`);
        errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    }

    console.log("\n" + "=".repeat(80));
    console.log(`✨ Import completed successfully!`);

    if (!autoMode) {
        rl.close();
    }
    
    return { 
        successCount: processedCount, 
        registrationCount: registrationSuccessCount,
        errorCount: errors.length, 
        skippedCount, 
        errors 
    };
}

// Execute the import
await importResultsFromExcel(
    '/home/breakthrough/Documents/afued/documents/Podcasts/Bsc 100l first semester result.xlsx', 
    '2024/2025-first', 
    '692857cfc3c2904e51b75554',
);
await importResultsFromExcel(
    '/home/breakthrough/Documents/afued/documents/Podcasts/Bsc 100l second semester result.xlsx', 
    '2024/2025-second', 
    '692857cfc3c2904e51b75554',
);
await importResultsFromExcel(
    '/home/breakthrough/Documents/afued/documents/Podcasts/BscEd 100l first semester result1.xlsx', 
    '2024/2025-first', 
    '692857cfc3c2904e51b75554',
);
await importResultsFromExcel(
    '/home/breakthrough/Documents/afued/documents/Podcasts/BscEd 100l second semester result1.xlsx', 
    '2024/2025-second', 
    '692857cfc3c2904e51b75554',
);
await importResultsFromExcel(
    '/home/breakthrough/Documents/afued/documents/Podcasts/BscEd 200l first semester result.xlsx', 
    '2024/2025-first', 
    '692857cfc3c2904e51b75554',
);
await importResultsFromExcel(
    '/home/breakthrough/Documents/afued/documents/Podcasts/BscEd 200l second semester result-1.xlsx', 
    '2024/2025-second', 
    '692857cfc3c2904e51b75554',
);