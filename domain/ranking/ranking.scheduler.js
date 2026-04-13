/**
 * RANKING SCHEDULER
 * Cron jobs for automated ranking generation
 */

import cron from 'node-cron';
import rankingService from './ranking.service.js';
import { RANKING_CONSTANTS } from './ranking.constants.js';
import AppError from '../errors/AppError.js';

class RankingScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    if (this.isRunning) {
      console.log('Ranking scheduler already running');
      return;
    }

    console.log('Starting ranking scheduler...');

    // Weekly ranking generation (Sunday at 23:59)
    const weeklyJob = cron.schedule(
      `${RANKING_CONSTANTS.SNAPSHOT.GENERATION_MINUTE} ${RANKING_CONSTANTS.SNAPSHOT.GENERATION_HOUR} * * ${RANKING_CONSTANTS.SNAPSHOT.GENERATION_DAY}`,
      this.generateWeeklyRanking.bind(this),
      {
        scheduled: true,
        timezone: "Africa/Lagos"
      }
    );

    // Daily health check (6 AM)
    const healthJob = cron.schedule(
      '0 6 * * *',
      this.performHealthCheck.bind(this),
      {
        scheduled: true,
        timezone: "Africa/Lagos"
      }
    );

    // Monthly archive (1st of month at 2 AM)
    const archiveJob = cron.schedule(
      '0 2 1 * *',
      this.archiveOldSnapshots.bind(this),
      {
        scheduled: true,
        timezone: "Africa/Lagos"
      }
    );

    this.jobs.set('weekly_generation', weeklyJob);
    this.jobs.set('daily_health_check', healthJob);
    this.jobs.set('monthly_archive', archiveJob);

    this.isRunning = true;
    console.log('Ranking scheduler started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) return;

    console.log('Stopping ranking scheduler...');

    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`Stopped job: ${name}`);
    }

    this.jobs.clear();
    this.isRunning = false;
    console.log('Ranking scheduler stopped');
  }

  /**
   * Generate weekly ranking snapshot
   */
  async generateWeeklyRanking() {
    const jobId = `weekly_${Date.now()}`;
    
    console.log(`[${jobId}] Starting weekly ranking generation...`);
    
    try {
      // Check if generation is already in progress
      const status = rankingService.generator.getStatus();
      if (status.isLocked) {
        console.log(`[${jobId}] Generation already in progress, skipping...`);
        return;
      }

      const snapshot = await rankingService.generateRankingSnapshot({
        source: 'cron',
        notes: 'Weekly automated generation'
      });

      console.log(`[${jobId}] Weekly ranking generation completed`);
      console.log(`[${jobId}] Snapshot ID: ${snapshot.snapshotId}`);
      console.log(`[${jobId}] Students ranked: ${snapshot.totalStudents}`);
      console.log(`[${jobId}] Departments: ${snapshot.totalDepartments}`);
      console.log(`[${jobId}] Average score: ${snapshot.averageScore}`);

      // Log success to monitoring system
      this.logGenerationSuccess(snapshot);

    } catch (error) {
      console.error(`[${jobId}] Weekly ranking generation failed:`, error);
      
      // Log failure to monitoring system
      this.logGenerationFailure(error, jobId);
      
      // Don't throw - allow scheduler to continue
      // The error will be caught by the cron job handler
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    console.log('Performing ranking system health check...');
    
    try {
      const health = await rankingService.getHealthStatus();
      
      if (health.status === 'healthy') {
        console.log('Ranking system health check: HEALTHY');
      } else {
        console.warn('Ranking system health check: REQUIRES ATTENTION');
        console.warn('Details:', health);
        
        // Send alert if system is unhealthy
        if (health.status === 'unhealthy') {
          await this.sendHealthAlert(health);
        }
      }
      
      // Log health status for monitoring
      this.logHealthStatus(health);
      
    } catch (error) {
      console.error('Health check failed:', error);
      await this.sendHealthAlert({ error: error.message, status: 'check_failed' });
    }
  }

  /**
   * Archive old snapshots
   */
  async archiveOldSnapshots() {
    console.log('Starting snapshot archival process...');
    
    try {
      const ArchiveDate = new Date();
      ArchiveDate.setDate(ArchiveDate.getDate() - RANKING_CONSTANTS.SNAPSHOT.RETENTION_DAYS);
      
      const result = await rankingService.generator.snapshotModel.updateMany(
        {
          generatedAt: { $lt: ArchiveDate },
          status: RANKING_CONSTANTS.STATUS.ACTIVE
        },
        {
          $set: { status: RANKING_CONSTANTS.STATUS.ARCHIVED }
        }
      );
      
      console.log(`Archived ${result.modifiedCount} old snapshots`);
      
      if (result.modifiedCount > 0) {
        this.logArchival(result.modifiedCount);
      }
      
    } catch (error) {
      console.error('Snapshot archival failed:', error);
    }
  }

  /**
   * Log generation success
   */
  logGenerationSuccess(snapshot) {
    // In production, this would log to your monitoring system
    const logEntry = {
      event: 'ranking_generation_success',
      timestamp: new Date(),
      snapshotId: snapshot.snapshotId,
      metrics: {
        students: snapshot.totalStudents,
        departments: snapshot.totalDepartments,
        averageScore: snapshot.averageScore,
        generationTime: snapshot.generatedAt
      }
    };
    
    console.log('GENERATION_SUCCESS:', logEntry);
  }

  /**
   * Log generation failure
   */
  logGenerationFailure(error, jobId) {
    const logEntry = {
      event: 'ranking_generation_failure',
      timestamp: new Date(),
      jobId,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    };
    
    console.error('GENERATION_FAILURE:', logEntry);
  }

  /**
   * Log health status
   */
  logHealthStatus(health) {
    const logEntry = {
      event: 'ranking_health_check',
      timestamp: new Date(),
      status: health.status,
      details: health
    };
    
    console.log('HEALTH_CHECK:', logEntry);
  }

  /**
   * Log archival
   */
  logArchival(count) {
    const logEntry = {
      event: 'snapshot_archival',
      timestamp: new Date(),
      count,
      retentionDays: RANKING_CONSTANTS.SNAPSHOT.RETENTION_DAYS
    };
    
    console.log('ARCHIVAL:', logEntry);
  }

  /**
   * Send health alert (placeholder for actual alerting system)
   */
  async sendHealthAlert(health) {
    // In production, integrate with your alerting system
    // (Email, Slack, PagerDuty, etc.)
    
    console.error('HEALTH ALERT - Ranking system requires attention:', health);
    
    // Example: Send to logging service
    // await loggingService.critical('ranking_health_alert', health);
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    const jobs = Array.from(this.jobs.entries()).map(([name, job]) => ({
      name,
      running: job.task?.running || false,
      nextRun: job.nextDate()?.toISOString()
    }));
    
    return {
      isRunning: this.isRunning,
      jobs,
      totalJobs: jobs.length
    };
  }

  /**
   * Manually trigger a job (for testing/admin)
   */
  triggerJob(jobName) {
    if (!this.jobs.has(jobName)) {
      throw new AppError(`Job ${jobName} not found`, 404, 'JOB_NOT_FOUND');
    }
    
    const job = this.jobs.get(jobName);
    
    // Get the task function and execute it
    if (jobName === 'weekly_generation') {
      this.generateWeeklyRanking();
    } else if (jobName === 'daily_health_check') {
      this.performHealthCheck();
    } else if (jobName === 'monthly_archive') {
      this.archiveOldSnapshots();
    }
    
    return { success: true, job: jobName, triggeredAt: new Date() };
  }
}

// Create singleton instance
const rankingScheduler = new RankingScheduler();

export default rankingScheduler;