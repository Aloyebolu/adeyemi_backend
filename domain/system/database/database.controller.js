import buildResponse from "#utils/responseBuilder.js";
import DatabaseService from "./database.service.js";

class DatabaseController {
  async createBackup(req, res, next) {
    try {
      const { database } = req.body;
      const backup = await DatabaseService.createBackup(database);
      buildResponse.success(res, "Success", backup)
    } catch (error) {
      next(error)
    }
  }

  async listBackups(req, res, next) {
    try {
      const { database } = req.query;
      const filter = database ? { database } : {};
      const backups = await DatabaseService.listBackups(filter);
      buildResponse.success(res, "Success", backups)
    } catch (error) {
      next(error)
    }
  }

  async restoreBackup(req, res, next) {
    try {
      const { backupId, targetDb } = req.body;
      const result = await DatabaseService.restoreBackup(backupId, targetDb);
      buildResponse.success(res, "Success", result)
    } catch (error) {
      next(error)
    }
  }

  async deleteBackup(req, res, next) {
    try {
      const { backupId } = req.params;
      const result = await DatabaseService.deleteBackup(backupId);
      buildResponse.success(res, "Success", result)
    } catch (error) {
      next(error)
    }
  }
}

export default new DatabaseController();