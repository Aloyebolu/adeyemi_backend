import mongoose from "mongoose";

const backupSchema = new mongoose.Schema({
  database: { type: String, required: true },
  backupPath: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
  size: { type: String }, // human-readable, optional
});

export default mongoose.model("DatabaseBackup", backupSchema);