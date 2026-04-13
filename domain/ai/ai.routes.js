// src/modules/ai/ai.routes.js

import express from 'express';
import {
  streamChat,
  chat,
  getConversations,
  getConversation,
  deleteConversation,
} from './controllers/ai.chat.controller.js';
import authenticate from '../../middlewares/authenticate.js';
import { aiRateLimiter } from './middlewares/ai.rateLimiter.js';
import {
  getPreferences,
  updatePreferences,
  updateDisplayPreferences,
  updateExportPreferences,
  saveQuery,
  getSavedQueries,
  deleteSavedQuery,
  getEffectiveFormat,
} from './controllers/ai.preferences.controller.js';

const router = express.Router();

// All AI routes require authentication
router.use(authenticate());

// Chat endpoints
router.post('/chat/stream', aiRateLimiter, streamChat);
router.post('/chat', aiRateLimiter, chat);

// Conversation management
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversation);
router.delete('/conversations/:id', deleteConversation);

// Export endpoints (to be implemented)
router.get('/exports/:fileId', (req, res) => {
  res.json({ message: 'Export endpoint - coming soon' });
});


// Add these routes
// Preferences endpoints
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);
router.put('/preferences/display', updateDisplayPreferences);
router.put('/preferences/export', updateExportPreferences);

// Saved queries
router.get('/preferences/queries', getSavedQueries);
router.post('/preferences/queries', saveQuery);
router.delete('/preferences/queries/:name', deleteSavedQuery);

// Format helper
router.post('/preferences/format', getEffectiveFormat);

export default router;