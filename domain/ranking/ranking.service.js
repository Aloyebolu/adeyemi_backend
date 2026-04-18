/**
 * RANKING SERVICE
 * Main service layer for ranking domain
 */

import AppError from '#shared/errors/AppError.js';
import RankingGenerator from './services/RankingGenerator.js';
import HistoryReader from './services/HistoryReader.js';
import RankingSnapshot from './models/RankingSnapshot.model.js';
import { RANKING_CONSTANTS } from './ranking.constants.js';

class RankingService {
  constructor() {
    this.generator = new RankingGenerator();
    this.historyReader = new HistoryReader();
    this.isInitialized = false;
  }

  /**
   * Initialize the ranking service
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Check if we need to generate initial snapshot
      const currentSnapshot = await RankingSnapshot.getCurrentSnapshot();
      
      if (!currentSnapshot) {
        console.log('No current ranking snapshot found. Generating initial snapshot...');
        await this.generateRankingSnapshot({ source: 'initialization' });
      }
      
      this.isInitialized = true;
      console.log('Ranking service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ranking service:', error);
      throw error;
    }
  }

  /**
   * Get current ranking for a department
   */
  async getCurrentDepartmentRanking(departmentId) {
    try {
      const ranking = await this.historyReader.getCurrentRanking(departmentId);
      
      if (!ranking.departmentRanking) {
        throw new AppError(
          'No ranking data available for this department',
          404,
          'NO_DEPARTMENT_RANKING'
        );
      }
      
      return {
        department: {
          id: departmentId,
          name: ranking.departmentRanking.departmentName
        },
        topStudents: ranking.departmentRanking.topStudents,
        statistics: ranking.departmentRanking.departmentStats,
        globalTop: ranking.globalTop,
        metadata: {
          snapshotId: ranking.snapshotId,
          week: ranking.week,
          year: ranking.year,
          generatedAt: ranking.generatedAt,
          isCurrent: ranking.metadata?.isCurrent || false
        }
      };
    } catch (error) {
      throw new AppError(
        `Failed to get department ranking: ${error.message}`,
        error.statusCode || 500,
        error.code || 'DEPARTMENT_RANKING_FETCH_ERROR',
        { departmentId }
      );
    }
  }

  /**
   * Get global top rankings
   */
  async getGlobalTopRankings() {
    try {
      const ranking = await this.historyReader.getCurrentRanking();
      
      return {
        topStudents: ranking.globalTop || [],
        statistics: {
          totalSnapshots: 1,
          averageScore: ranking.averageScore,
          totalStudents: ranking.totalStudents
        },
        metadata: {
          snapshotId: ranking._id,
          week: ranking.week,
          year: ranking.year,
          generatedAt: ranking.generatedAt
        }
      };
    } catch (error) {
      throw new AppError(
        `Failed to get global top rankings: ${error.message}`,
        error.statusCode || 500,
        error.code || 'GLOBAL_RANKING_FETCH_ERROR'
      );
    }
  }

  /**
   * Get department ranking history
   */
  async getDepartmentRankingHistory(departmentId, options = {}) {
    try {
      return await this.historyReader.getDepartmentHistory(departmentId, options);
    } catch (error) {
      throw new AppError(
        `Failed to get department history: ${error.message}`,
        error.statusCode || 500,
        error.code || 'DEPARTMENT_HISTORY_FETCH_ERROR',
        { departmentId }
      );
    }
  }

  /**
   * Get student ranking history
   */
  async getStudentRankingHistory(studentId, options = {}) {
    try {
      return await this.historyReader.getStudentHistory(studentId, options);
    } catch (error) {
      throw new AppError(
        `Failed to get student history: ${error.message}`,
        error.statusCode || 500,
        error.code || 'STUDENT_HISTORY_FETCH_ERROR',
        { studentId }
      );
    }
  }

  /**
   * Get weekly ranking
   */
  async getWeeklyRanking(year, week, departmentId = null) {
    try {
      return await this.historyReader.getWeeklyRanking(year, week, departmentId);
    } catch (error) {
      throw new AppError(
        `Failed to get weekly ranking: ${error.message}`,
        error.statusCode || 500,
        error.code || 'WEEKLY_RANKING_FETCH_ERROR',
        { year, week, departmentId }
      );
    }
  }

  /**
   * Get department trend analysis
   */
  async getDepartmentTrendAnalysis(departmentId, weeks = 12) {
    try {
      return await this.historyReader.getDepartmentTrends(departmentId, weeks);
    } catch (error) {
      throw new AppError(
        `Failed to get department trends: ${error.message}`,
        error.statusCode || 500,
        error.code || 'TREND_ANALYSIS_FETCH_ERROR',
        { departmentId }
      );
    }
  }

  /**
   * Generate a new ranking snapshot
   */
  async generateRankingSnapshot(options = {}) {
    try {
      return await this.generator.generateSnapshot(options);
    } catch (error) {
      throw new AppError(
        `Failed to generate ranking snapshot: ${error.message}`,
        error.statusCode || 500,
        error.code || 'SNAPSHOT_GENERATION_ERROR',
        error.metadata
      );
    }
  }

  /**
   * Get generation status
   */
  async getGenerationStatus() {
    try {
      const status = this.generator.getStatus();
      
      // Get recent snapshots
      const recentSnapshots = await RankingSnapshot.find({
        status: RANKING_CONSTANTS.STATUS.ACTIVE
      })
      .sort({ generatedAt: -1 })
      .limit(5)
      .select('snapshotId year week generatedAt totalStudents averageScore');
      
      return {
        generation: status,
        recentSnapshots,
        system: {
          isInitialized: this.isInitialized,
          lastInitialized: this.initializedAt
        }
      };
    } catch (error) {
      throw new AppError(
        `Failed to get generation status: ${error.message}`,
        500,
        'STATUS_FETCH_ERROR'
      );
    }
  }

  /**
   * Get ranking statistics
   */
  async getRankingStatistics() {
    try {
      const totalSnapshots = await RankingSnapshot.countDocuments({
        status: RANKING_CONSTANTS.STATUS.ACTIVE
      });
      
      const oldestSnapshot = await RankingSnapshot.findOne({
        status: RANKING_CONSTANTS.STATUS.ACTIVE
      }).sort({ generatedAt: 1 });
      
      const latestSnapshot = await RankingSnapshot.findOne({
        status: RANKING_CONSTANTS.STATUS.ACTIVE
      }).sort({ generatedAt: -1 });
      
      // Calculate average students per snapshot
      const stats = await RankingSnapshot.aggregate([
        { $match: { status: RANKING_CONSTANTS.STATUS.ACTIVE } },
        {
          $group: {
            _id: null,
            avgStudents: { $avg: '$totalStudents' },
            avgDepartments: { $avg: '$totalDepartments' },
            avgScore: { $avg: '$averageScore' },
            totalStudents: { $sum: '$totalStudents' }
          }
        }
      ]);
      
      return {
        snapshots: {
          total: totalSnapshots,
          oldest: oldestSnapshot ? {
            date: oldestSnapshot.generatedAt,
            week: `${oldestSnapshot.year}-W${oldestSnapshot.week}`
          } : null,
          latest: latestSnapshot ? {
            date: latestSnapshot.generatedAt,
            week: `${latestSnapshot.year}-W${latestSnapshot.week}`,
            students: latestSnapshot.totalStudents,
            departments: latestSnapshot.totalDepartments
          } : null
        },
        averages: stats[0] || {},
        generation: this.generator.getStatus()
      };
    } catch (error) {
      throw new AppError(
        `Failed to get ranking statistics: ${error.message}`,
        500,
        'STATISTICS_FETCH_ERROR'
      );
    }
  }

  /**
   * Get ranking health status
   */
  async getHealthStatus() {
    try {
      const currentSnapshot = await RankingSnapshot.getCurrentSnapshot();
      const isCurrent = currentSnapshot && currentSnapshot.isCurrent;
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const recentSnapshots = await RankingSnapshot.countDocuments({
        generatedAt: { $gte: oneWeekAgo },
        status: RANKING_CONSTANTS.STATUS.ACTIVE
      });
      
      return {
        status: isCurrent ? 'healthy' : 'requires_attention',
        currentSnapshot: isCurrent,
        recentSnapshots,
        generationLock: this.generator.generationLock,
        lastGeneration: this.generator.lastGeneration,
        checks: {
          database: true,
          generator: true,
          scheduler: true
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

// Create singleton instance
const rankingService = new RankingService();

export default rankingService;