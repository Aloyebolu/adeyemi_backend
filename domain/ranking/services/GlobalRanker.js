/**
 * GLOBAL RANKER SERVICE
 * Handles university-wide ranking logic
 */

import AppError from '../../errors/AppError.js';
import { RANKING_CONSTANTS } from '../ranking.constants.js';

class GlobalRanker {
  constructor() {
    this.limits = RANKING_CONSTANTS.LIMITS;
  }

  /**
   * Determine global top students from all departments
   * @param {Array} allScores - Array of all student scores across departments
   * @returns {Array} - Global top students with rankings
   */
  rankGlobal(allScores) {
    try {
      if (!Array.isArray(allScores) || allScores.length === 0) {
        return [];
      }

      // Flatten all scores and sort by total score descending
      const flatScores = allScores.flat();
      const sortedScores = flatScores.sort((a, b) => b.totalScore - a.totalScore);

      // Apply ranking with tie handling
      const ranked = this.applyGlobalRanking(sortedScores);

      // Take top N globally
      const topGlobal = ranked.slice(0, this.limits.GLOBAL_TOP);

      // Enrich with additional information
      return this.enrichGlobalRankings(topGlobal);
    } catch (error) {
      throw new AppError(
        `Failed to generate global rankings: ${error.message}`,
        500,
        'GLOBAL_RANKING_ERROR'
      );
    }
  }

  /**
   * Apply ranking to global scores with tie handling
   */
  applyGlobalRanking(scores) {
    const ranked = [];
    let currentRank = 1;
    let previousScore = null;
    let skipCount = 0;

    for (let i = 0; i < scores.length; i++) {
      const score = scores[i];

      if (previousScore !== null && Math.abs(score.totalScore - previousScore) < 0.01) {
        // Tie (within tolerance for floating point)
        skipCount++;
      } else {
        // Different score, advance rank
        currentRank += skipCount;
        skipCount = 1;
      }

      ranked.push({
        ...score,
        rank: currentRank,
        isTie: skipCount > 1,
        isGlobalTop: currentRank <= this.limits.GLOBAL_TOP
      });

      previousScore = score.totalScore;
    }

    return ranked;
  }

  /**
   * Enrich global rankings with additional data
   */
  enrichGlobalRankings(rankings) {
    return rankings.map(ranking => ({
      rank: ranking.rank,
      studentId: ranking.studentId,
      studentName: ranking.studentName || `Student ${ranking.studentId}`,
      matricNo: ranking.matricNo,
      departmentId: ranking.departmentId,
      departmentName: ranking.departmentName,
      totalScore: Number(ranking.totalScore.toFixed(2)),
      gpa: ranking.gpa ? Number(ranking.gpa.toFixed(2)) : null,
      breakdown: ranking.breakdown || {},
      badge: this.getRankBadge(ranking.rank),
      achievement: this.getAchievementDescription(ranking.rank, ranking.totalScore)
    }));
  }

  /**
   * Get badge/icon for ranking position
   */
  getRankBadge(rank) {
    switch (rank) {
      case 1:
        return { type: 'gold', icon: '🥇', label: 'Top Performer' };
      case 2:
        return { type: 'silver', icon: '🥈', label: 'Excellent' };
      case 3:
        return { type: 'bronze', icon: '🥉', label: 'Outstanding' };
      default:
        return { type: 'honor', icon: '⭐', label: 'Honor Roll' };
    }
  }

  /**
   * Get achievement description
   */
  getAchievementDescription(rank, score) {
    if (score >= 95) {
      return 'Academic Excellence Award';
    } else if (score >= 90) {
      return 'Distinguished Performance';
    } else if (score >= 85) {
      return 'Outstanding Achievement';
    } else if (score >= 80) {
      return 'Honor Roll Achievement';
    }
    return 'Ranked Performance';
  }

  /**
   * Calculate global statistics
   */
  calculateGlobalStats(allScores) {
    if (!Array.isArray(allScores) || allScores.length === 0) {
      return {
        totalStudents: 0,
        averageScore: 0,
        highestScore: 0,
        departmentsParticipating: 0,
        scoreDistribution: {}
      };
    }

    const flatScores = allScores.flat();
    const scores = flatScores.map(s => s.totalScore);
    const total = scores.reduce((sum, score) => sum + score, 0);
    const averageScore = total / scores.length;

    // Get unique departments
    const departments = new Set(flatScores.map(s => s.departmentId?.toString()).filter(Boolean));

    // Score distribution
    const distribution = {
      excellent: scores.filter(s => s >= 90).length,
      good: scores.filter(s => s >= 80 && s < 90).length,
      average: scores.filter(s => s >= 70 && s < 80).length,
      belowAverage: scores.filter(s => s < 70).length
    };

    return {
      totalStudents: flatScores.length,
      averageScore: Number(averageScore.toFixed(2)),
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      departmentsParticipating: departments.size,
      scoreDistribution: distribution,
      generatedAt: new Date()
    };
  }

  /**
   * Compare current global ranking with previous
   */
  compareGlobalRankings(currentRankings, previousRankings) {
    const currentMap = new Map(
      currentRankings.map(r => [r.studentId.toString(), r])
    );
    const previousMap = new Map(
      (previousRankings || []).map(r => [r.studentId.toString(), r])
    );

    const changes = {
      newInTop: [],
      droppedOut: [],
      positionChanges: []
    };

    // Check for new entries
    currentRankings.forEach(current => {
      const previous = previousMap.get(current.studentId.toString());
      
      if (!previous) {
        changes.newInTop.push({
          student: current,
          previousRank: null
        });
      } else if (current.rank !== previous.rank) {
        changes.positionChanges.push({
          student: current,
          previousRank: previous.rank,
          change: previous.rank - current.rank // positive = improved
        });
      }
    });

    // Check for dropped out
    if (previousRankings) {
      previousRankings.forEach(previous => {
        if (!currentMap.has(previous.studentId.toString())) {
          changes.droppedOut.push({
            student: previous,
            currentRank: null
          });
        }
      });
    }

    return changes;
  }
}

export default GlobalRanker;