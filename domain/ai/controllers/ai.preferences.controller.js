// src/modules/ai/controllers/ai.preferences.controller.js

import preferencesService from '../services/ai.preferences.service.js';
import catchAsync from '../../../utils/catchAsync.js';

/**
 * Get user preferences
 * GET /api/ai/preferences
 */
export const getPreferences = catchAsync(async (req, res) => {
  const userId = req.user._id;
  
  const preferences = await preferencesService.getPreferences(userId);
  
  res.json({
    success: true,
    data: preferences,
  });
});

/**
 * Update user preferences
 * PUT /api/ai/preferences
 */
export const updatePreferences = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const updates = req.body;
  
  const preferences = await preferencesService.updatePreferences(userId, updates);
  
  res.json({
    success: true,
    message: 'Preferences updated successfully',
    data: preferences,
  });
});

/**
 * Update display preferences
 * PUT /api/ai/preferences/display
 */
export const updateDisplayPreferences = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const displaySettings = req.body;
  
  const display = await preferencesService.updateDisplayPreferences(userId, displaySettings);
  
  res.json({
    success: true,
    message: 'Display preferences updated',
    data: { display },
  });
});

/**
 * Update export preferences
 * PUT /api/ai/preferences/export
 */
export const updateExportPreferences = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const exportSettings = req.body;
  
  const exportPrefs = await preferencesService.updateExportPreferences(userId, exportSettings);
  
  res.json({
    success: true,
    message: 'Export preferences updated',
    data: { export: exportPrefs },
  });
});

/**
 * Save a query template
 * POST /api/ai/preferences/queries
 */
export const saveQuery = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { name, query, description } = req.body;
  
  if (!name || !query) {
    return res.status(400).json({
      success: false,
      message: 'Name and query are required',
    });
  }
  
  const savedQuery = await preferencesService.saveQuery(userId, name, query, description);
  
  res.json({
    success: true,
    message: 'Query saved successfully',
    data: savedQuery,
  });
});

/**
 * Get saved queries
 * GET /api/ai/preferences/queries
 */
export const getSavedQueries = catchAsync(async (req, res) => {
  const userId = req.user._id;
  
  const queries = await preferencesService.getSavedQueries(userId);
  
  res.json({
    success: true,
    data: queries,
  });
});

/**
 * Delete saved query
 * DELETE /api/ai/preferences/queries/:name
 */
export const deleteSavedQuery = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { name } = req.params;
  
  await preferencesService.deleteSavedQuery(userId, name);
  
  res.json({
    success: true,
    message: 'Query deleted successfully',
  });
});

/**
 * Get effective format for current data
 * POST /api/ai/preferences/format
 */
export const getEffectiveFormat = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { dataSize } = req.body;
  
  const format = await preferencesService.getEffectiveFormat(userId, dataSize);
  
  res.json({
    success: true,
    data: { format, dataSize },
  });
});