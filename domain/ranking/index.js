/**
 * RANKING DOMAIN ENTRY POINT
 * Exports and initializes the ranking domain
 */

import rankingRoutes from './ranking.routes.js';
import rankingService from './ranking.service.js';
import rankingScheduler from './ranking.scheduler.js';
import { createRankingIndexes } from './models/indexes.js';
import { RANKING_CONSTANTS } from './ranking.constants.js';

/**
 * Initialize the ranking domain
 * @param {Object} app - Express application
 * @param {Object} options - Initialization options
 */
export const initializeRankingDomain = async (app, options = {}) => {
  try {
    console.log('Initializing ranking domain...');
    
    // 1. Create database indexes
    await createRankingIndexes();
    
    // 2. Initialize ranking service
    await rankingService.initialize();
    
    // 3. Start scheduler if enabled
    if (options.enableScheduler !== false && RANKING_CONSTANTS.SNAPSHOT.AUTO_GENERATE) {
      rankingScheduler.start();
    }
    
    // 4. Register routes
    app.use('/ranking', rankingRoutes);
    
    console.log('Ranking domain initialized successfully');
    
    return {
      service: rankingService,
      scheduler: rankingScheduler,
      constants: RANKING_CONSTANTS
    };
  } catch (error) {
    console.error('Failed to initialize ranking domain:', error);
    throw error;
  }
};

/**
 * Get ranking domain exports
 */
export {
  rankingRoutes,
  rankingService,
  rankingScheduler,
  RANKING_CONSTANTS
};

export default {
  initialize: initializeRankingDomain,
  routes: rankingRoutes,
  service: rankingService,
  scheduler: rankingScheduler,
  constants: RANKING_CONSTANTS
};