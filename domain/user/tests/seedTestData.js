import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import userModel from "../user.model.js";
import Admin from "../../admin/admin.model.js";
import lecturerModel from "../../lecturer/lecturer.model.js";
import studentModel from "../../student/student.model.js";
import { TEST_DB } from "../../../config/db.js";

// ==================== CONFIGURATION ====================
// Connect to your database (set MONGODB_URI in .env or replace directly)
const MONGODB_URI = TEST_DB
const BATCH_SIZE = 1000;        // Number of documents per insert batch
const PASSWORD = "test";    // Default password for all test users

// Hardcoded IDs from the user request
const DEPARTMENT_ID = new mongoose.Types.ObjectId("692857cfc3c2904e51b75554");
const FACULTY_ID = new mongoose.Types.ObjectId("68f9ecc1f6606ce32d8ddfb7");
const PROGRAMME_ID = new mongoose.Types.ObjectId("696a4c15adc5386e4c70fe5b");

// ==================== HELPER FUNCTIONS ====================
// Hash password using bcrypt
const hashPassword = async (password) => {
    const saltRounds = 10;
    //   return await bcrypt.hash(password, saltRounds);
    return password;
};

// Generate a unique admin_id: ADMIN00001, ADMIN00002, ...
const generateAdminId = (index) => `ADMIN${String(index).padStart(5, "0")}`;

// Generate a unique staffId: STAFF00001, STAFF00002, ...
const generateStaffId = (index) => `STAFF3${String(index).padStart(5, "0")}`;

// Generate a unique matricNumber: e.g., 2024/00001
const generateMatricNumber = (index) => `2024/${String(index).padStart(5, "0")}`;

// Generate a single user document
const createUser = async (role, index, extraData = {}) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const middleName = faker.person.middleName();
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example3.com`.replace(/\s/g, "");

    const user = {
        _id: new mongoose.Types.ObjectId(),
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        email: email,
        password: await hashPassword(PASSWORD),
        role: role,
        phone: faker.phone.number(),
        // No need to set created_by – the model’s default SYSTEM_USER_ID will be used
    };

    // Additional fields for specific roles
    if (role === "lecturer") {
        user.staffId = extraData.staffId;
    }
    if (role === "student") {
        user.matricNo = extraData.matricNumber;
    }

    return user;
};

// ==================== MAIN SEED FUNCTION ====================
const seedTestData = async () => {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected.");

        // Arrays to hold documents
        const users = [];
        const students = [];
        const lecturers = [];
        const admins = [];

        // ========== 1. Generate Admins (100) ==========
        console.log("Generating 100 admins...");
        // for (let i = 1; i <= 100; i++) {

        //     const adminId = generateAdminId(i);
        //     const user = await createUser("admin", i);
        //     users.push(user);

        //     admins.push({
        //         _id: user._id,
        //         admin_id: adminId,
        //         name: `${user.first_name} ${user.last_name}`,
        //         email: user.email,
        //         role: "admin",
        //         phone: user.phone,
        //         department: "",      // default empty
        //         token: "",
        //         last_login: null,
        //     });
        // }

        // ========== 2. Generate Lecturers (1000) ==========
        console.log("Generating 100000 lecturers...");
        for (let i = 1; i <= 1000000; i++) {
            const staffId = generateStaffId(i);
            const user = await createUser("lecturer", i, { staffId });
            users.push(user);

            // Choose random rank from enum
            const ranks = [
                "assistant_lecturer", "lecturer_ii", "lecturer_i",
                "senior_lecturer", "associate_professor", "professor"
            ];
            const rank = ranks[Math.floor(Math.random() * ranks.length)];

            lecturers.push({
                _id: user._id,
                staffId: staffId,
                departmentId: DEPARTMENT_ID,
                facultyId: FACULTY_ID,
                rank: rank,
                isHOD: Math.random() < 0.05,      // 5% chance
                isDean: Math.random() < 0.02,     // 2% chance
                active: true,
                deletedAt: null,
            });
        }

        // ========== 3. Generate Students (10000) ==========
        console.log("Generating 10000 students...");
        const levels = [100, 200, 300, 400, 500, 600];
        // for (let i = 1; i <= 10000; i++) {
        //     const matricNumber = generateMatricNumber(i);
        //     const user = await createUser("student", i, { matricNumber });
        //     users.push(user);

        //     students.push({
        //         _id: user._id,
        //         matricNumber: matricNumber,
        //         departmentId: DEPARTMENT_ID,
        //         facultyId: FACULTY_ID,
        //         programmeId: PROGRAMME_ID,
        //         level: levels[Math.floor(Math.random() * levels.length)],
        //         session: "2024/2025",
        //         courses: [],                     // empty array
        //         gpa: +(Math.random() * 4.0).toFixed(2),
        //         cgpa: +(Math.random() * 4.0).toFixed(2),
        //         isActive: true,
        //         deletedAt: null,
        //         totalCarryovers: Math.floor(Math.random() * 5),
        //         lastGPAUpdate: new Date(),
        //         probationStatus: "none",
        //         terminationStatus: "none",
        //         suspension: [],
        //         payment_completed: Math.random() < 0.8, // 80% have completed payment
        //     });
        // }

        // ========== 4. Insert Data in Batches ==========
        const insertBatch = async (model, documents, name) => {
            if (!documents.length) return;
            let inserted = 0;
            for (let i = 0; i < documents.length; i += BATCH_SIZE) {
                const batch = documents.slice(i, i + BATCH_SIZE);
                await model.insertMany(batch);
                inserted += batch.length;
                console.log(`  ${name}: inserted ${inserted}/${documents.length}`);
            }
        };

        console.log("\nInserting users...");
        await insertBatch(userModel, users, "Users");

        console.log("\nInserting admins...");
        await insertBatch(Admin, admins, "Admins");

        console.log("\nInserting lecturers...");
        await insertBatch(lecturerModel, lecturers, "Lecturers");

        console.log("\nInserting students...");
        await insertBatch(studentModel, students, "Students");

        console.log("\n✅ Seeding completed successfully!");
        console.log(`Total inserted: ${users.length} users, ${admins.length} admins, ${lecturers.length} lecturers, ${students.length} students`);

    } catch (error) {
        console.error("❌ Seeding failed:", error);
    } finally {
        await mongoose.disconnect();
        console.log("Database connection closed.");
    }
};

// Run the script
seedTestData();