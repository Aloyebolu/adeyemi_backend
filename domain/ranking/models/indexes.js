/**
 * INDEX MANAGEMENT FOR RANKING MODELS
 * Ensures optimal query performance
 */

import mongoose from 'mongoose';

/**
 * Create all necessary indexes for ranking domain
 * Should be called during application startup
 */
export const createRankingIndexes = async () => {
  try {
    const RankingSnapshot = mongoose.model('RankingSnapshot');
    const RankingScore = mongoose.model('RankingScore');

    console.log('Creating ranking indexes...');
    
    // Wait for all indexes to be created
    await Promise.all([
      RankingSnapshot.createIndexes(),
      RankingScore.createIndexes()
    ]);
    
    console.log('Ranking indexes created successfully');
  } catch (error) {
    console.error('Failed to create ranking indexes:', error);
    throw error;
  }
};

/**
 * Get index statistics for monitoring
 */
export const getIndexStats = async () => {
  const db = mongoose.connection.db;
  
  const snapshotStats = await db.collection('rankingsnapshots').indexes();
  const scoreStats = await db.collection('rankingscores').indexes();
  
  return {
    snapshots: snapshotStats.length,
    scores: scoreStats.length,
    details: {
      snapshots: snapshotStats.map(idx => idx.name),
      scores: scoreStats.map(idx => idx.name)
    }
  };
};