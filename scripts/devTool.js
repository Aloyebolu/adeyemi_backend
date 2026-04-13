/**
 * 🛠️ Developer Tool Script with Detailed Logs
 *
 * Usage:
 *   node devTool.js create-admin --id=ADM-001 --name="John Doe" --email="admin@school.edu"
 *   node devTool.js list-admins
 *   node devTool.js delete-admin --email="admin@school.edu"
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "../domain/admin/admin.model.js";
import User from "../domain/user/user.model.js";
import { hashData } from "../utils/hashData.js";

dotenv.config();
const { MONGODB_URI, MONGODB_URI2 } = process.env;

// ========== 🧩 DATABASE CONNECTION ==========
const connectDB = async () => {
  console.log("⚙️ Connecting to database...");
  try {

    await mongoose.connect(MONGODB_URI2);
    console.log("✅ Database connected successfully!");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
};

// ========== ⚙️ ARGUMENT PARSER ==========
const parseArgs = () => {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    const [key, value] = arg.split("=");
    if (key.startsWith("--")) args[key.replace("--", "")] = value || true;
    else if (!args._) args._ = [key];
    else args._.push(key);
  });
  return args;
};

// ========== 📘 HELP ==========
const showHelp = () => {
  console.log(`
📘 Usage:
  node devTool.js create-admin --id=ADM-001 --name="John Doe" --email="admin@school.edu"
  node devTool.js list-admins
  node devTool.js delete-admin --email="admin@school.edu"

🧩 Notes:
  - Password defaults to admin_id (hashed)
  - Requires .env with MONGODB_URI2
`);
};

// ========== 🧑‍💼 CREATE ADMIN ==========
const createAdmin = async (args) => {
  console.log("🚀 Starting create-admin process...");

  // Start a database session
  const session = await mongoose.startSession();

  try {
    const { name, email, id: adminId, department_id: departmentId, password } = args;

    if (!name || !email || !adminId) {
      console.error("❌ Missing required fields: name, email, or --id.");
      return;
    }

    console.log(`🔍 Checking existing admin for ID: ${adminId}...`);
    const existingAdmin = await Admin.findOne({ admin_id: adminId });
    if (existingAdmin) {
      console.warn(`⚠️ Admin with ID "${adminId}" already exists.`);
      return;
    }

    console.log(`🔍 Checking existing user for email: ${email}...`);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn(`⚠️ User with email "${email}" already exists.`);
      return;
    }

    // ✅ Start transaction
    session.startTransaction();

    console.log(password ? "🔑 Using provided password..." : "🔑 Using default password (admin ID)...");
    const hashedPassword = await hashData(password || adminId);

    console.log("🧱 Creating user record...");
    const user = await User.create(
      [
        {
          name,
          email,
          password: hashedPassword,
          role: "admin",
          department: departmentId || null,
          staffId: adminId,
        },
      ],
      { session }
    );

    console.log("🏗️ Creating admin record...");
    const admin = await Admin.create(
      [
        {
          _id: user[0]._id,
          admin_id: adminId,
          name,
          email,
          department: departmentId || "",
        },
      ],
      { session }
    );

    // ✅ Commit transaction
    await session.commitTransaction();
    console.log("✅ Admin created successfully!");
    console.table({
      AdminID: admin[0].admin_id,
      Name: admin[0].name,
      Email: admin[0].email,
      Department: admin[0].department || "N/A",
      Password: password ? "(custom provided)" : "(default: admin ID)",
    });
  } catch (error) {
    // ❌ Rollback all changes if something fails
    await session.abortTransaction();
    console.error("❌ Transaction failed, rolled back changes:", error.message);
  } finally {
    // End session in all cases
    session.endSession();
  }
};



// ========== 📋 LIST ADMINS ==========
const listAdmins = async () => {
  console.log("📜 Fetching all admins...");
  try {
    const admins = await Admin.find().select("-password -token");
    if (!admins.length) {
      console.log("⚠️ No admins found.");
    } else {
      console.log(`✅ Found ${admins.length} admin(s):`);
      console.table(
        admins.map((a) => ({
          ID: a.admin_id,
          Name: a.name,
          Email: a.email,
          Department: a.department || "N/A",
          Created: a.createdAt?.toLocaleString?.() || "Unknown",
        }))
      );
    }
  } catch (err) {
    console.error("❌ Error listing admins:", err.message);
  }
};

// ========== 🗑️ DELETE ADMIN ==========
const deleteAdmin = async (args) => {
  console.log("🗑️ Attempting to delete admin...");
  try {
    const { email } = args;
    if (!email) {
      console.error("❌ Missing required field: --email");
      return;
    }

    console.log(`🔍 Searching for admin with email: ${email}...`);
    const deleted = await Admin.findOneAndDelete({ email });
    if (deleted) {
      console.log(`✅ Admin deleted: ${deleted.name} (${email})`);
      await User.findOneAndDelete({ email });
      console.log("🧹 Associated user deleted too.");
    } else {
      console.warn("⚠️ No admin found with that email.");
    }
  } catch (err) {
    console.error("❌ deleteAdmin Error:", err.message);
  }
};

// ========== 🚀 RUNNER ==========
const run = async () => {
  const args = parseArgs();
  const command = args._?.[0];

  if (!command) {
    showHelp();
    process.exit(0);
  }

  await connectDB();

  console.log(`🎯 Executing command: ${command}\n with args: ${JSON.stringify(args)}`);

  switch (command) {
    case "create-admin":
      await createAdmin(args);
      break;
    case "list-admins":
      await listAdmins();
      break;
    case "delete-admin":
      await deleteAdmin(args);
      break;
    default:
      console.log(`⚠️ Unknown command: ${command}`);
      showHelp();
      break;
  }

  console.log("\n🔌 Closing database connection...");
  await mongoose.disconnect();
  console.log("👋 Done. Exiting now.\n");

  process.exit(0);
};

run();
