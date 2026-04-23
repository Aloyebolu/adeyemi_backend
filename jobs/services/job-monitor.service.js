import { getAgenda } from "../agenda.config.js";

class JobMonitorService {
  constructor() {
    this.monitoringInterval = null;
  }

  /**
   * Get all job statistics
   */
  async getStats() {
    const agenda = await getAgenda();

    const [waiting, active, completed, failed] = await Promise.all([
      this.getWaitingCount(),
      this.getActiveCount(),
      this.getCompletedCount(),
      this.getFailedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get count of waiting jobs
   */
  async getWaitingCount() {
    const agenda = await getAgenda();
    const jobs = await agenda.jobs({
      nextRunAt: { $ne: null },
      lockedAt: null,
      disabled: { $ne: true }
    });
    return jobs.length;
  }

  /**
   * Get count of active jobs
   */
  async getActiveCount() {
    const agenda = await getAgenda();
    const jobs = await agenda.jobs({
      lockedAt: { $ne: null },
      disabled: { $ne: true }
    });
    return jobs.length;
  }

  /**
   * Get count of completed jobs
   */
  async getCompletedCount() {
    const agenda = await getAgenda();
    const jobs = await agenda.jobs({
      nextRunAt: null,
      $or: [
        { lastFinishedAt: { $ne: null } },
        { lastRunAt: { $ne: null } }
      ]
    });
    return jobs.length;
  }

  /**
   * Get count of failed jobs
   */
  async getFailedCount() {
    const agenda = await getAgenda();
    const jobs = await agenda.jobs({
      $or: [
        { failedAt: { $ne: null } },
        { failCount: { $gt: 0 } }
      ]
    });
    return jobs.length;
  }

  /**
   * Get waiting jobs details
   */
  async getWaitingJobs(limit = 50) {
    const agenda = await getAgenda();
    return agenda.jobs({
      nextRunAt: { $ne: null },
      lockedAt: null,
      disabled: { $ne: true }
    }, {}, limit);
  }

  /**
   * Get active jobs details
   */
  async getActiveJobs(limit = 50) {
    const agenda = await getAgenda();
    return agenda.jobs({
      lockedAt: { $ne: null },
      disabled: { $ne: true }
    }, {}, limit);
  }

  /**
   * Get failed jobs details
   */
  async getFailedJobs(limit = 50) {
    const agenda = await getAgenda();
    return agenda.jobs({
      $or: [
        { failedAt: { $ne: null } },
        { failCount: { $gt: 0 } }
      ]
    }, { failedAt: -1 }, limit);
  }

  /**
   * Start periodic monitoring
   */
  startMonitoring(intervalMs = 30000) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const stats = await this.getStats();
        console.log(`[Monitor] Jobs - Waiting: ${stats.waiting}, Active: ${stats.active}, Completed: ${stats.completed}, Failed: ${stats.failed}`);
        
        if (stats.failed > 0) {
          console.warn(`[Monitor] ⚠️ ${stats.failed} failed jobs detected`);
        }
      } catch (error) {
        console.error("[Monitor] Error getting stats:", error);
      }
    }, intervalMs);

    console.log(`[Monitor] Started monitoring (every ${intervalMs}ms)`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log("[Monitor] Stopped monitoring");
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(daysOld = 7) {
    const agenda = await getAgenda();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      const result = await agenda.cancel({
        nextRunAt: null,
        lastFinishedAt: { $lt: cutoffDate }
      });
      
      console.log(`[Monitor] Cleaned up ${result} old jobs`);
      return result;
    } catch (error) {
      console.error("[Monitor] Error cleaning up old jobs:", error);
      return 0;
    }
  }
}

// Export singleton instance
export const jobMonitor = new JobMonitorService();