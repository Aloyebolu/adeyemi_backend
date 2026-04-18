/**
 * DEPARTMENT RANKER SERVICE
 * Handles department-specific ranking logic
 */

import AppError from '#shared/errors/AppError.js';
import { RANKING_CONSTANTS } from '#domain/ranking/ranking.constants.js';

class DepartmentRanker {
  constructor() {
    this.limits = RANKING_CONSTANTS.LIMITS;
  }

  /**
   * Rank students within a department
   * @param {Array} scores - Array of student scores for the department
   * @param {Object} department - Department information
   * @returns {Object} - Department ranking results
   */
  rankDepartment(scores, department) {
    try {
      if (!Array.isArray(scores) || scores.length === 0) {
        return this.createEmptyDepartmentRanking(department);
      }

      // Sort by total score descending
      const sortedScores = [...scores].sort((a, b) => b.totalScore - a.totalScore);

      // Apply ranking with tie handling
      const rankedStudents = this.applyRanking(sortedScores);

      // Calculate department statistics
      const stats = this.calculateDepartmentStats(rankedStudents);

      // Take top N students
      const topStudents = rankedStudents.slice(0, this.limits.DEPARTMENT_TOP);

      return {
        departmentId: department._id,
        departmentName: department.name,
        topStudents,
        departmentStats: stats,
        totalRankedStudents: rankedStudents.length,
        generatedAt: new Date()
      };
    } catch (error) {
      throw new AppError(
        `Failed to rank department ${department._id}: ${error.message}`,
        500,
        'DEPARTMENT_RANKING_ERROR',
        { departmentId: department._id }
      );
    }
  }

  /**
   * Apply ranking with proper tie handling
   */
  applyRanking(scores) {
    const ranked = [];
    let currentRank = 1;
    let previousScore = null;
    let skipCount = 0;

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];

      if (previousScore !== null && score.totalScore === previousScore) {
        // Same score as previous student (tie)
        skipCount++;
      } else {
        // Different score, advance rank
        currentRank += skipCount;
        skipCount = 1;
      }

      ranked.push({
        ...score,
        rank: currentRank,
        isTie: skipCount > 1
      });

      previousScore = score.totalScore;
    }

    return ranked;
  }

  /**
   * Calculate department statistics
   */
  calculateDepartmentStats(rankedStudents) {
    if (rankedStudents.length === 0) {
      return {
        averageScore: 0,
        totalStudents: 0,
        highestScore: 0,
        lowestScore: 0,
        medianScore: 0,
        standardDeviation: 0
      };
    }

    const scores = rankedStudents.map(s => s.totalScore);
    const total = scores.reduce((sum, score) => sum + score, 0);
    const averageScore = total / scores.length;
    
    // Sort for median calculation
    const sortedScores = [...scores].sort((a, b) => a - b);
    const middle = Math.floor(sortedScores.length / 2);
    const medianScore = sortedScores.length % 2 === 0
      ? (sortedScores[middle - 1] + sortedScores[middle]) / 2
      : sortedScores[middle];

    // Calculate standard deviation
    const squareDiffs = scores.map(score => {
      const diff = score - averageScore;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / scores.length;
    const standardDeviation = Math.sqrt(avgSquareDiff);

    return {
      averageScore: Number(averageScore.toFixed(2)),
      totalStudents: rankedStudents.length,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      medianScore: Number(medianScore.toFixed(2)),
      standardDeviation: Number(standardDeviation.toFixed(2))
    };
  }

  /**
   * Create empty ranking for departments with no students
   */
  createEmptyDepartmentRanking(department) {
    return {
      departmentId: department._id,
      departmentName: department.name,
      topStudents: [],
      departmentStats: {
        averageScore: 0,
        totalStudents: 0,
        highestScore: 0,
        lowestScore: 0,
        medianScore: 0,
        standardDeviation: 0
      },
      totalRankedStudents: 0,
      generatedAt: new Date()
    };
  }

  /**
   * Compare current ranking with previous ranking
   * @returns {Object} - Comparison results
   */
  compareWithPrevious(currentRanking, previousRanking) {
    if (!previousRanking) {
      return {
        newEntries: currentRanking.topStudents,
        improved: [],
        declined: [],
        unchanged: []
      };
    }

    const currentMap = new Map(
      currentRanking.topStudents.map(student => [student.studentId.toString(), student])
    );
    const previousMap = new Map(
      previousRanking.topStudents.map(student => [student.studentId.toString(), student])
    );

    const results = {
      newEntries: [],
      improved: [],
      declined: [],
      unchanged: []
    };

    // Analyze each student in current ranking
    for (const currentStudent of currentRanking.topStudents) {
      const studentId = currentStudent.studentId.toString();
      const previousStudent = previousMap.get(studentId);

      if (!previousStudent) {
        // New entry
        results.newEntries.push({
          ...currentStudent,
          previousRank: null,
          rankChange: null
        });
      } else {
        // Compare ranks
        const rankChange = previousStudent.rank - currentStudent.rank;
        
        if (rankChange > 0) {
          // Improved rank
          results.improved.push({
            ...currentStudent,
            previousRank: previousStudent.rank,
            rankChange
          });
        } else if (rankChange < 0) {
          // Declined rank
          results.declined.push({
            ...currentStudent,
            previousRank: previousStudent.rank,
            rankChange
          });
        } else {
          // Unchanged rank
          results.unchanged.push({
            ...currentStudent,
            previousRank: previousStudent.rank,
            rankChange: 0
          });
        }
      }
    }

    return results;
  }

  /**
   * Get ranking trend for a student within their department
   */
  getStudentTrend(studentId, departmentRankingsHistory) {
    const trends = [];
    
    departmentRankingsHistory.forEach((ranking, index) => {
      const studentRanking = ranking.topStudents.find(
        s => s.studentId.toString() === studentId.toString()
      );
      
      if (studentRanking) {
        trends.push({
          week: ranking.week,
          year: ranking.year,
          rank: studentRanking.rank,
          score: studentRanking.totalScore,
          date: ranking.generatedAt
        });
      }
    });

    return trends.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

export default DepartmentRanker;