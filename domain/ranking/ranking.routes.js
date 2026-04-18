/**
 * RANKING ROUTES
 * Express router for ranking domain
 */

import express from 'express';
import {
  getCurrentDepartmentRanking,
  getGlobalTop,
  getDepartmentHistory,
  getStudentHistory,
  getWeeklyRanking,
  getDepartmentTrends,
  triggerGeneration,
  getGenerationStatus,
  getRankingStats
} from './ranking.controller.js';
import authenticate from '#middlewares/authenticate.js';

const router = express.Router();

// All routes require authentication
// router.use(authenticate);

/**
 * @route   GET /api/v1/ranking/health
 * @desc    Get ranking system health status
 * @access  Private (Admin)
 */
router.get('/health', authenticate(['admin']), async (req, res) => {
  // This would typically check service health
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    service: 'ranking',
    version: '1.0.0'
  });
});

// Student accessible routes
router.get('/current', authenticate(['student']), getCurrentDepartmentRanking);
router.get('/global-top', authenticate(['student', 'lecturer', 'admin', 'dean', 'hod']), getGlobalTop);
router.get('/student/history', authenticate(['student']), getStudentHistory);
router.get('/week/:year/:week', authenticate(['student', 'lecturer', 'admin', 'dean', 'hod']), getWeeklyRanking);

// Department-focused routes
router.get('/department/:departmentId/history', 
  authenticate(['student', 'lecturer', 'admin', 'dean', 'hod']), 
  getDepartmentHistory
);

// Admin and department leadership routes
router.get('/department/:departmentId/trends',
  authenticate(['lecturer', 'admin', 'dean', 'hod']),
  getDepartmentTrends
);

// Admin-only routes
router.get('/stats',
  authenticate(['admin', 'dean', 'hod']),
  getRankingStats
);

router.post('/generate',
  authenticate(['admin']),
  triggerGeneration
);

router.get('/generation-status',
  authenticate(['admin']),
  getGenerationStatus
);

// Scheduler control routes (admin only)
router.post('/scheduler/start',
  authenticate(['admin']),
  async (req, res) => {
    try {
      // Import here to avoid circular dependencies
      const rankingScheduler = (await import('./ranking.scheduler.js')).default;
      rankingScheduler.start();
      
      res.status(200).json({
        success: true,
        message: 'Ranking scheduler started',
        status: rankingScheduler.getStatus()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

router.post('/scheduler/stop',
  authenticate(['admin']),
  async (req, res) => {
    try {
      const rankingScheduler = (await import('./ranking.scheduler.js')).default;
      rankingScheduler.stop();
      
      res.status(200).json({
        success: true,
        message: 'Ranking scheduler stopped',
        status: rankingScheduler.getStatus()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

router.get('/scheduler/status',
  authenticate(['admin']),
  async (req, res) => {
    try {
      const rankingScheduler = (await import('./ranking.scheduler.js')).default;
      
      res.status(200).json({
        success: true,
        data: rankingScheduler.getStatus()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;