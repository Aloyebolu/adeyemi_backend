import XLSX from "xlsx";
import fs from "fs";
import readline from "readline";
import Result from "../result.model.js";
import Student from "../../student/student.model.js";
import Course from "../../course/course.model.js";
import SemesterService from "../../semester/semester.service.js";
import mongoose from "mongoose";
import { TEST_DB } from "../../../config/db.js";


// Create readline interface for user interaction
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promise-based question function
function question(query) {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

// Function to get course by department and course code
async function getCourseByDepartmentAndCode(departmentId, courseCode) {
    // Step 1: Look for the course without including the departmentId
    const baseCourse = await Course.findOne({
        courseCode: courseCode.toUpperCase(),
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
    if (baseCourse.department.toString() === departmentId.toString()) {
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

        const answer = await question("\nDo you want to continue without these courses? (yes/no): ");
        if (answer.toLowerCase() !== 'yes') {
            throw new Error("Import cancelled by user due to invalid courses");
        }
    }

    return courseMap;
}

export async function importResultsFromExcel(filePath, semesterId = null, departmentId = null) {
    // Connect to MongoDB
    const MONGO_URI = TEST_DB;

    await mongoose.connect(MONGO_URI);
    console.log("✓ Connected to MongoDB");
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    if (!departmentId) {
        departmentId = await question("Please enter the Department ID: ");
        if (!departmentId) {
            throw new Error("Department ID is required");
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

    // Interactive column selection
    console.log("\n" + "=".repeat(50));
    console.log("🔧 COLUMN MAPPING SETUP");
    console.log("=".repeat(50));

    const matricCol = parseInt(await question("\nEnter the column number for Matric Number: ")) || 0;
    const nameCol = parseInt(await question("Enter the column number for Student Name: ")) || 1;

    console.log("\n📚 Now identify course columns (format: columnNumber:CourseCode)");
    console.log("Example: 2:CSC101, 3:MTH102, 4:PHY103");
    console.log("Press Enter if no more courses to add");

    const courseInput = await question("\nEnter course columns (comma-separated): ") || '2,3,4,5,6,7,8,9,10,11';

    const courseCols = {};
    console.log("HeaderRow", headerRow)
    if (courseInput) {
        const entries = courseInput.split(",");
        for (const entry of entries) {
            const [col, code] = entry.trim().split(":");
            if (col && code) {
                courseCols[parseInt(col)] = code.trim().toUpperCase();
            } else {
                courseCols[parseInt(entry)] = headerRow[parseInt(entry)]; //Leave empty so that it defaults to the header name of that column 
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

    const confirm = await question("\n✅ Does this look correct? (yes/no): ");
    if (confirm.toLowerCase() !== 'yes') {
        console.log("❌ Import cancelled by user");
        rl.close();
        return;
    }

    // Validate all courses against the department
    const courseMap = await validateCourses(departmentId, courseCols);

    console.log("\n📊 Starting import process...");

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process each student row
    for (let r = 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || !row[matricCol]) continue;

        const matricNumber = String(row[matricCol]).trim();
        const studentName = row[nameCol] || "N/A";

        console.log(`\n📝 Processing student: ${matricNumber} (${studentName})`);

        // Find student
        const student = await Student.findOne({ matricNumber }).lean();
        if (!student) {
            console.log(`  ⚠️ Student not found: ${matricNumber}`);
            skippedCount++;
            errors.push(`Student not found: ${matricNumber}`);
            continue;
        }

        console.log(`  ✓ Student found: ${student.firstName} ${student.lastName}`);

        // Process each course for this student
        for (const [col, courseInfo] of Object.entries(courseMap)) {
            const score = row[parseInt(col)];

            if (score === undefined || score === null || score === "") {
                console.log(`  ⚠️ No score for ${courseInfo.courseCode}, skipping`);
                continue;
            }

            // Validate score is a number
            const numericScore = parseFloat(score);
            if (isNaN(numericScore)) {
                console.log(`  ✗ Invalid score for ${courseInfo.courseCode}: ${score}`);
                errorCount++;
                errors.push(`Invalid score for ${matricNumber}, ${courseInfo.courseCode}: ${score}`);
                continue;
            }

            if (numericScore < 0 || numericScore > 100) {
                console.log(`  ✗ Score out of range for ${courseInfo.courseCode}: ${numericScore}`);
                errorCount++;
                errors.push(`Score out of range for ${matricNumber}, ${courseInfo.courseCode}: ${numericScore}`);
                continue;
            }

            try {
                const query = {
                    studentId: student._id,
                    courseId: courseInfo.courseId,
                };

                if (semesterId) {
                    query.semester = semesterId;
                } else {
                    // Try to get current semester if not provided
                    const currentSemester = await SemesterService.getCurrentSemester();
                    if (currentSemester) {
                        query.semester = currentSemester._id;
                    }
                }

                const result = await Result.updateOne(
                    query,
                    {
                        $set: {
                            score: numericScore,
                            ...(query.semester ? {} : { semester: null })
                        }
                    },
                    { upsert: true }
                );

                if (result.upsertedCount > 0) {
                    console.log(`  ✓ Created result for ${courseInfo.courseCode}: ${numericScore}`);
                } else if (result.modifiedCount > 0) {
                    console.log(`  ✓ Updated result for ${courseInfo.courseCode}: ${numericScore}`);
                }

                successCount++;
            } catch (error) {
                console.log(`  ✗ Failed to save result for ${courseInfo.courseCode}: ${error.message}`);
                errorCount++;
                errors.push(`Database error for ${matricNumber}, ${courseInfo.courseCode}: ${error.message}`);
            }
        }
    }

    // Final summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 IMPORT SUMMARY");
    console.log("=".repeat(80));
    console.log(`✅ Successful imports: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⚠️ Skipped (student not found): ${skippedCount}`);
    console.log(`📁 File: ${filePath}`);
    console.log(`🏢 Department ID: ${departmentId}`);
    if (semesterId) {
        console.log(`📅 Semester ID: ${semesterId}`);
    }

    if (errors.length > 0 && errors.length <= 10) {
        console.log("\n📝 Error Details:");
        errors.forEach(err => console.log(`  - ${err}`));
    } else if (errors.length > 10) {
        console.log(`\n📝 First 10 of ${errors.length} errors:`);
        errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
    }

    console.log("\n" + "=".repeat(80));
    console.log(`✨ Import completed successfully!`);

    rl.close();
    return { successCount, errorCount, skippedCount, errors };
}

await importResultsFromExcel('/home/breakthrough/Downloads/BscEd 100l first semester result1.xlsx', '699c3c2dc937438f1fa12782', '692857cfc3c2904e51b75554');