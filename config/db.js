import mongoose from "mongoose";
import { Perf } from "../utils/performanceMonitor.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Resolve paths properly (ESM safe)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Only load .env in non-production
if (process.env.NODE_ENV !== "production") {
  dotenv.config({
    path: path.resolve(__dirname, "../.env"),
  });
}

// Try multiple env keys (fallback strategy)
const MONGODB_URI2 =
  process.env.MONGODB_URI2 ||
  process.env.MONGODB_URI ||
  null;

// Final validation
if (!MONGODB_URI2) {
  console.error("❌ MongoDB connection string is missing.");
  console.error("👉 Checked: MONGODB_URI2, MONGODB_URI");

  throw new Error(
    "No MongoDB URI found. Set it in environment variables or .env file."
  );
}

// Optional: log safe info (no secrets)
console.log("✅ MongoDB URI loaded successfully");
export const TEST_DB = "mongodb://localhost:27017/test3_db";
let isConnected = false;

const connectToDB = async () => {
  try {

    const per = Perf.start("Start")
    if (isConnected) {
      return mongoose.connection;
    }


    await mongoose.connect(MONGODB_URI2, {
      maxPoolSize: 20,
    });

    isConnected = true;


    // await mongoose.connect(MONGODB_UR2);

    console.log("✅ Connected to MongoDB");

    Perf.end(per)
    return mongoose.connection;
  } catch (error) {
    console.error("❌ Error connecting to MongoDB:", error);
    throw error;
  } finally {
  }
};


export default connectToDB;
