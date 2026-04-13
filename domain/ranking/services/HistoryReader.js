/**
 * HISTORY READER SERVICE
 * Handles retrieval of historical ranking data
 */

import AppError from '../../errors/AppError.js';
import RankingSnapshot from '../models/RankingSnapshot.model.js';
import { RANKING_CONSTANTS } from '../ranking.constants.js';

class HistoryReader {
  constructor() {
    this.limits = RANKING_CONSTANTS.LIMITS;
  }

  /**
   * Get current week's ranking
   * @param {string} departmentId - Optional department filter
   * @returns {Promise<Object>} - Current ranking data
   */
  async getCurrentRanking(departmentId = null) {
    try {
      const snapshot = await RankingSnapshot.getCurrentSnapshot();
      
      if (!snapshot) {
        throw new AppError(
          'No current ranking snapshot found',
          404,
          'NO_CURRENT_SNAPSHOT'
        );
      }

      return departmentId
        ? this.filterByDepartment(snapshot, departmentId)
        : snapshot;
    } catch (error) {
      throw new AppError(
        `Failed to get current ranking: ${error.message}`,
        error.statusCode || 500,
        error.code || 'HISTORY_READ_ERROR'
      );
    }
  }

  /**
   * Get ranking by specific week
   * @param {number} year - Year
   * @param {number} week - ISO week number
   * @param {string} departmentId - Optional department filter
   * @returns {Promise<Object>} - Weekly ranking data
   */
  async getWeeklyRanking(year, week, departmentId = null) {
    try {
      const snapshot = await RankingSnapshot.findByWeek(year, week);
      
      if (!snapshot) {
        throw new AppError(
          `No ranking snapshot found for year ${year}, week ${week}`,
          404,
          'SNAPSHOT_NOT_FOUND'
        );
      }

      return departmentId
        ? this.filterByDepartment(snapshot, departmentId)
        : snapshot;
    } catch (error) {
      throw new AppError(
        `Failed to get weekly ranking: ${error.message}`,
        error.statusCode || 500,
        error.code || 'WEEKLY_READ_ERROR',
        { year, week, departmentId }
      );
    }
  }

  /**
   * Get ranking history for a department
   * @param {string} departmentId - Department ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Department ranking history
   */
  async getDepartmentHistory(departmentId, options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        startDate,
        endDate,
        sort = 'desc'
      } = options;

      const query = {
        status: RANKING_CONSTANTS.STATUS.ACTIVE,
        'departmentRankings.departmentId': departmentId
      };

      // Add date range if provided
      if (startDate || endDate) {
        query.generatedAt = {};
        if (startDate) query.generatedAt.$gte = new Date(startDate);
        if (endDate) query.generatedAt.$lte = new Date(endDate);
      }

      const snapshots = await RankingSnapshot.find(query)
        .select({
          _id: 1,
          year: 1,
          week: 1,
          generatedAt: 1,
          departmentRankings: { $elemMatch: { departmentId } },
          globalTop: 1
        })
        .sort({ generatedAt: sort === 'asc' ? 1 : -1 })
        .skip(offset)
        .limit(Math.min(limit, this.limits.MAX_WEEKS_HISTORY))
        .lean();

      return snapshots.map(snapshot => ({
        snapshotId: snapshot._id,
        year: snapshot.year,
        week: snapshot.week,
        date: snapshot.generatedAt,
        departmentRanking: snapshot.departmentRankings[0] || null,
        globalTop: snapshot.globalTop
      }));
    } catch (error) {
      throw new AppError(
        `Failed to get department history: ${error.message}`,
        error.statusCode || 500,
        error.code || 'DEPARTMENT_HISTORY_ERROR',
        { departmentId }
      );
    }
  }

  /**
   * Get ranking history for a student
   * @param {string} studentId - Student ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Student ranking history
   */
  async getStudentHistory(studentId, options = {}) {
    try {
      const {
        limit = 20,
        offset = 0,
        startDate,
        endDate
      } = options;

      const query = {
        status: RANKING_CONSTANTS.STATUS.ACTIVE,
        $or: [
          { 'globalTop.studentId': studentId },
          { 'departmentRankings.topStudents.studentId': studentId }
        ]
      };

      if (startDate || endDate) {
        query.generatedAt = {};
        if (startDate) query.generatedAt.$gte = new Date(startDate);
        if (endDate) query.generatedAt.$lte = new Date(endDate);
      }

      const snapshots = await RankingSnapshot.find(query)
        .select({
          year: 1,
          week: 1,
          generatedAt: 1,
          globalTop: 1,
          departmentRankings: 1
        })
        .sort({ generatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      const history = snapshots.map(snapshot => {
        // Find student in global top
        const globalRanking = snapshot.globalTop.find(
          s => s.studentId.toString() === studentId.toString()
        );

        // Find student in department rankings
        let departmentRanking = null;
        for (const deptRanking of snapshot.departmentRankings) {
          const studentInDept = deptRanking.topStudents.find(
            s => s.studentId.toString() === studentId.toString()
          );
          if (studentInDept) {
            departmentRanking = {
              departmentId: deptRanking.departmentId,
              departmentName: deptRanking.departmentName,
              rank: studentInDept.rank,
              score: studentInDept.totalScore,
              departmentStats: deptRanking.departmentStats
            };
            break;
          }
        }

        return {
          snapshotId: snapshot._id,
          year: snapshot.year,
          week: snapshot.week,
          date: snapshot.generatedAt,
          globalRank: globalRanking ? {
            rank: globalRanking.rank,
            score: globalRanking.totalScore,
            isTop3: globalRanking.rank <= 3
          } : null,
          departmentRank: departmentRanking,
          snapshotStats: {
            totalStudents: snapshot.totalStudents,
            averageScore: snapshot.averageScore
          }
        };
      });

      return history;
    } catch (error) {
      throw new AppError(
        `Failed to get student history: ${error.message}`,
        error.statusCode || 500,
        error.code || 'STUDENT_HISTORY_ERROR',
        { studentId }
      );
    }
  }

  /**
   * Get trend analysis for a department
   */
  async getDepartmentTrends(departmentId, weeks = 12) {
    try {
      const history = await this.getDepartmentHistory(departmentId, {
        limit: weeks,
        sort: 'asc'
      });

      if (history.length === 0) {
        return { trends: [], analysis: {} };
      }

      const trends = history.map(record => ({
        week: record.week,
        year: record.year,
        date: record.date,
        topStudentScore: record.departmentRanking?.topStudents[0]?.totalScore || 0,
        averageScore: record.departmentRanking?.departmentStats?.averageScore || 0,
        totalStudents: record.departmentRanking?.departmentStats?.totalStudents || 0,
        inGlobalTop: record.globalTop?.some(g => 
          record.departmentRanking?.topStudents?.some(d => 
            d.studentId.toString() === g.studentId.toString()
          )
        ) || false
      }));

      // Calculate analysis
      const analysis = this.analyzeTrends(trends);

      return {
        trends,
        analysis,
        departmentId,
        period: `${weeks} weeks`
      };
    } catch (error) {
      throw new AppError(
        `Failed to get department trends: ${error.message}`,
        error.statusCode || 500,
        error.code || 'TREND_ANALYSIS_ERROR',
        { departmentId }
      );
    }
  }

  /**
   * Analyze trends from historical data
   */
  analyzeTrends(trends) {
    if (trends.length < 2) {
      return {
        message: 'Insufficient data for trend analysis',
        stability: 'unknown',
        direction: 'unknown'
      };
    }

    const scores = trends.map(t => t.averageScore);
    const latest = scores[scores.length - 1];
    const previous = scores[scores.length - 2];
    const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Calculate trend direction
    const direction = latest > previous ? 'upward' : latest < previous ? 'downward' : 'stable';
    
    // Calculate stability (standard deviation relative to mean)
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const stability = stdDev / average < 0.1 ? 'high' : stdDev / average < 0.2 ? 'medium' : 'low';

    return {
      latestScore: latest,
      previousScore: previous,
      averageScore: average,
      direction,
      stability,
      volatility: Number(stdDev.toFixed(2)),
      trendStrength: Math.abs(latest - average) / stdDev,
      recommendation: this.getRecommendation(direction, stability, latest)
    };
  }

  /**
   * Generate recommendations based on trends
   */
  getRecommendation(direction, stability, latestScore) {
    if (latestScore >= 85) {
      return 'Maintain current academic support programs';
    } else if (latestScore >= 70) {
      return 'Consider targeted academic interventions';
    } else {
      return 'Implement comprehensive academic support plan';
    }
  }

  /**
   * Filter snapshot by department
   */
  filterByDepartment(snapshot, departmentId) {
    const departmentRanking = snapshot.departmentRankings.find(
      dept => dept.departmentId.toString() === departmentId.toString()
    );

    return {
      snapshotId: snapshot._id,
      year: snapshot.year,
      week: snapshot.week,
      generatedAt: snapshot.generatedAt,
      globalTop: snapshot.globalTop,
      departmentRanking: departmentRanking || null,
      metadata: {
        isCurrent: snapshot.isCurrent,
        status: snapshot.status
      }
    };
  }
}

export default HistoryReader;