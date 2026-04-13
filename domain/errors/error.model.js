import mongoose from "mongoose";

const errorLogSchema = new mongoose.Schema({
  type: { type: String, enum: ["operational", "unexpected"], required: true },
  statusCode: Number,
  message: String,
  stack: String,
  extra: String,
  method: String,
  url: String,
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("ErrorLog", errorLogSchema);