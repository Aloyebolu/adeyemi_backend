import { exec } from "child_process";
import path from "path";
import fs from "fs";
import DatabaseBackup from "./database.model.js";
import AppError from "../errors/AppError.js";

const BACKUP_DIR = path.resolve("./backups");

const databases = {
  main: process.env.MONGODB_URI_MAIN,
  test: process.env.MONGODB_URI_TEST,
  test2: process.env.MONGODB_URI_TEST2
};

class DatabaseService {
  // Create a backup
  async createBackup(dbName) {
    if (!databases[dbName]) throw new AppError(`Database ${dbName} not configured`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `${dbName}-${timestamp}`);

    await fs.promises.mkdir(backupPath, { recursive: true });

    const backupRecord = await DatabaseBackup.create({
      database: dbName,
      backupPath,
      status: "pending",
    });

    // Run mongodump
    const command = `mongodump --uri="${databases[dbName]}" --out="${backupPath}"`;
    return new Promise((resolve, reject) => {
      exec(command, async (error) => {
        if (error) {
          backupRecord.status = "failed";
          await backupRecord.save();
          return reject(error);
        }
        const size = await this.getFolderSize(backupPath);
        backupRecord.status = "completed";
        backupRecord.size = size;
        await backupRecord.save();
        resolve(backupRecord);
      });
    });
  }

  // List all backups
  async listBackups(filter = {}) {
    return DatabaseBackup.find(filter).sort({ timestamp: -1 });
  }

  // Restore a backup
  async restoreBackup(backupId, targetDb) {
    const record = await DatabaseBackup.findById(backupId);
    if (!record) throw new Error("Backup not found");
    if (!databases[targetDb]) throw new Error(`Target DB ${targetDb} not configured`);

    const command = `mongorestore --uri="${databases[targetDb]}" "${record.backupPath}" --drop`;
    return new Promise((resolve, reject) => {
      exec(command, async (error) => {
        if (error) {
          reject(error);
          throw new AppError(error)
        };
        resolve({ message: `Database restored to ${targetDb} from backup ${record._id}` });
      });
    });
  }

  // Delete a backup
  async deleteBackup(backupId) {
    const record = await DatabaseBackup.findById(backupId);
    if (!record) throw new Error("Backup not found");

    await fs.promises.rm(record.backupPath, { recursive: true, force: true });
    await record.remove();
    return { message: "Backup deleted successfully" };
  }

  // Get folder size (human-readable)
  async getFolderSize(folderPath) {
    const { size } = await fs.promises.stat(folderPath).catch(() => ({ size: 0 }));
    const kb = Math.round(size / 1024);
    return `${kb} KB`;
  }
}

export default new DatabaseService();