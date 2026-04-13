// src/modules/ai/services/ai.preferences.service.js

import UserPreferences from '../models/user.preferences.model.js';

class AIPreferencesService {
  /**
   * Get user preferences, create if not exists
   */
  async getPreferences(userId) {
    let preferences = await UserPreferences.findOne({ user_id: userId });
    
    if (!preferences) {
      preferences = new UserPreferences({ user_id: userId });
      await preferences.save();
    }
    
    return preferences;
  }
  
  /**
   * Update user preferences
   */
  async updatePreferences(userId, updates) {
    const preferences = await this.getPreferences(userId);
    
    // Deep merge updates
    this.deepMerge(preferences, updates);
    preferences.updated_at = new Date();
    
    await preferences.save();
    return preferences;
  }
  
  /**
   * Update display preferences
   */
  async updateDisplayPreferences(userId, displaySettings) {
    const preferences = await this.getPreferences(userId);
    
    Object.assign(preferences.display, displaySettings);
    await preferences.save();
    
    return preferences.display;
  }
  
  /**
   * Update export preferences
   */
  async updateExportPreferences(userId, exportSettings) {
    const preferences = await this.getPreferences(userId);
    
    Object.assign(preferences.export, exportSettings);
    await preferences.save();
    
    return preferences.export;
  }
  
  /**
   * Save a query template
   */
  async saveQuery(userId, name, query, description = '') {
    const preferences = await this.getPreferences(userId);
    
    // Check if query with same name exists
    const existingIndex = preferences.saved_queries.findIndex(q => q.name === name);
    
    const savedQuery = {
      name,
      description,
      query,
      last_used: new Date(),
      usage_count: 0,
    };
    
    if (existingIndex >= 0) {
      preferences.saved_queries[existingIndex] = savedQuery;
    } else {
      preferences.saved_queries.push(savedQuery);
    }
    
    await preferences.save();
    return savedQuery;
  }
  
  /**
   * Get saved queries
   */
  async getSavedQueries(userId) {
    const preferences = await this.getPreferences(userId);
    return preferences.saved_queries.sort((a, b) => b.usage_count - a.usage_count);
  }
  
  /**
   * Delete saved query
   */
  async deleteSavedQuery(userId, queryName) {
    const preferences = await this.getPreferences(userId);
    preferences.saved_queries = preferences.saved_queries.filter(q => q.name !== queryName);
    await preferences.save();
  }
  
  /**
   * Record query usage
   */
  async recordQueryUsage(userId, queryName) {
    const preferences = await this.getPreferences(userId);
    const query = preferences.saved_queries.find(q => q.name === queryName);
    
    if (query) {
      query.last_used = new Date();
      query.usage_count++;
      await preferences.save();
    }
  }
  
  /**
   * Get effective format for data display
   */
  async getEffectiveFormat(userId, dataSize) {
    const preferences = await this.getPreferences(userId);
    const { display } = preferences;
    
    if (display.default_format !== 'auto') {
      return display.default_format;
    }
    
    if (dataSize <= display.table_threshold) {
      return 'table';
    } else if (dataSize <= display.summary_threshold) {
      return 'summary';
    } else if (dataSize <= display.auto_export_threshold) {
      return 'table_with_export_option';
    } else {
      return 'export';
    }
  }
  
  /**
   * Deep merge helper
   */
  deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
}

export default new AIPreferencesService();