
// @desc    Create a new error log

import ErrorLog from "./error.model.js";

// @route   POST /api/error-logs
export const createErrorLog = async (req, res) => {
  try {
    const errorLog = new ErrorLog(req.body);
    await errorLog.save();
    res.status(201).json({ success: true, data: errorLog });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// @desc    Get all error logs
// @route   GET /api/error-logs
export const getAllErrorLogs = async (req, res) => {
  try {
    const errorLogs = await ErrorLog.find().sort({ timestamp: -1 });
    res.status(200).json({ success: true, data: errorLogs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get error logs by type
// @route   GET /api/error-logs/type/:type
export const getErrorLogsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const errorLogs = await ErrorLog.find({ type }).sort({ timestamp: -1 });
    res.status(200).json({ success: true, data: errorLogs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Delete error log by ID
// @route   DELETE /api/error-logs/:id
export const deleteErrorLog = async (req, res) => {
  try {
    const deleted = await ErrorLog.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Error log not found" });
    }
    res.status(200).json({ success: true, message: "Error log deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};