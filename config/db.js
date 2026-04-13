import mongoose from "mongoose";
import { Perf } from "../utils/performanceMonitor.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
let MONGODB_URI2 = process.env.MONGODB_URI2;
if (!MONGODB_URI2) {
  console.warn("⚠️ MONGODB_URI2 is not set in environment variables. Please set it to connect to the database.");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  dotenv.config({
    path: path.resolve(__dirname, "../.env")
  });
  MONGODB_URI2 = process.env.MONGODB_URI2;
  if (!MONGODB_URI2) {
    throw new Error("MONGODB_URI2 is still not set after loading .env. Please check your configuration.");
  }
}
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
