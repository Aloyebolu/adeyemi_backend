// src/modules/ai/engines/analysis.engine.js

import markdownFormatter from '#domain/ai/formatters/markdown.formatter.js';

class AnalysisEngine {
  constructor() {
    this.analysisCache = new Map();
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes
  }
  
  /**
   * Analyze data and extract insights
   */
  async analyzeData(data, question, context = {}) {
    const startTime = Date.now();
    
    try {
      // Check cache for similar analysis
      const cacheKey = this.getCacheKey(data, question);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
      
      // Perform different types of analysis based on data and question
      const analysis = {
        insights: [],
        patterns: [],
        recommendations: [],
        statistics: {},
        correlations: [],
        outliers: [],
        needsMoreData: false,
        nextQuery: null,
      };
      
      // 1. Basic statistics
      analysis.statistics = this.calculateStatistics(data);
      
      // 2. Detect patterns
      analysis.patterns = this.detectPatterns(data);
      
      // 3. Find outliers
      analysis.outliers = this.findOutliers(data);
      
      // 4. Generate insights
      analysis.insights = this.generateInsights(data, analysis, question);
      
      // 5. Check if more data is needed
      const moreDataNeeded = this.needsMoreData(data, analysis, question);
      if (moreDataNeeded) {
        analysis.needsMoreData = true;
        analysis.nextQuery = this.suggestNextQuery(data, question);
      }
      
      // 6. Generate recommendations
      analysis.recommendations = this.generateRecommendations(data, analysis, question);
      
      // 7. Calculate correlations (for numeric data)
      analysis.correlations = this.calculateCorrelations(data);
      
      // Cache results
      this.cacheResult(cacheKey, analysis);
      
      // Log performance
      const duration = Date.now() - startTime;
      console.log(`Analysis completed in ${duration}ms`, {
        dataSize: data.length,
        insightsCount: analysis.insights.length,
      });
      
      return analysis;
      
    } catch (error) {
      console.error('Analysis error:', error);
      return {
        insights: ['Unable to perform deep analysis on this data.'],
        patterns: [],
        recommendations: ['Try a more specific query for better insights.'],
        error: error.message,
      };
    }
  }
  
  /**
   * Calculate basic statistics for numeric fields
   */
  calculateStatistics(data) {
    if (!data || data.length === 0) return {};
    
    const stats = {};
    const numericFields = this.findNumericFields(data);
    
    for (const field of numericFields) {
      const values = data
        .map(row => this.getNestedValue(row, field))
        .filter(v => typeof v === 'number' && !isNaN(v));
      
      if (values.length > 0) {
        const sorted = values.sort((a, b) => a - b);
        stats[field] = {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          sum: values.reduce((a, b) => a + b, 0),
          median: this.calculateMedian(sorted),
          stdDev: this.calculateStdDev(values),
          percentiles: {
            p25: this.calculatePercentile(sorted, 25),
            p50: this.calculatePercentile(sorted, 50),
            p75: this.calculatePercentile(sorted, 75),
            p90: this.calculatePercentile(sorted, 90),
            p95: this.calculatePercentile(sorted, 95),
          },
        };
      }
    }
    
    return stats;
  }
  
  /**
   * Detect patterns in data
   */
  detectPatterns(data) {
    const patterns = [];
    
    if (data.length === 0) return patterns;
    
    // Pattern 1: Distribution patterns
    const categoricalFields = this.findCategoricalFields(data);
    for (const field of categoricalFields) {
      const distribution = this.calculateDistribution(data, field);
      const topValues = Object.entries(distribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      if (topValues.length > 0 && topValues[0][1] > data.length * 0.5) {
        patterns.push(`${this.formatFieldName(field)} is dominated by "${topValues[0][0]}" (${Math.round(topValues[0][1] / data.length * 100)}%)`);
      }
    }
    
    // Pattern 2: Temporal patterns (if date fields exist)
    const dateFields = this.findDateFields(data);
    if (dateFields.length > 0) {
      patterns.push(`Data spans ${this.getDateRange(data, dateFields[0])}`);
    }
    
    // Pattern 3: Missing data patterns
    const missingFields = this.findMissingDataPatterns(data);
    if (missingFields.length > 0) {
      patterns.push(`${missingFields.length} field(s) have significant missing data: ${missingFields.slice(0, 3).join(', ')}`);
    }
    
    return patterns;
  }
  
  /**
   * Find outliers in numeric data
   */
  findOutliers(data) {
    const outliers = [];
    const numericFields = this.findNumericFields(data);
    
    for (const field of numericFields) {
      const values = data
        .map((row, index) => ({ value: this.getNestedValue(row, field), index }))
        .filter(v => typeof v.value === 'number' && !isNaN(v.value));
      
      if (values.length > 0) {
        const sorted = values.map(v => v.value).sort((a, b) => a - b);
        const q1 = this.calculatePercentile(sorted, 25);
        const q3 = this.calculatePercentile(sorted, 75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        const fieldOutliers = values.filter(v => v.value < lowerBound || v.value > upperBound);
        
        if (fieldOutliers.length > 0) {
          outliers.push({
            field,
            count: fieldOutliers.length,
            examples: fieldOutliers.slice(0, 3).map(v => ({
              value: v.value,
              record: data[v.index],
            })),
          });
        }
      }
    }
    
    return outliers;
  }
  
  /**
   * Generate insights from analysis
   */
  generateInsights(data, analysis, question) {
    const insights = [];
    
    // Insight 1: Data size
    insights.push(`Found ${data.length} records matching your criteria.`);
    
    // Insight 2: Statistical insights
    for (const [field, stats] of Object.entries(analysis.statistics)) {
      if (stats.count > 0) {
        insights.push(`${this.formatFieldName(field)} ranges from ${stats.min} to ${stats.max}, with an average of ${stats.avg.toFixed(2)}`);
      }
    }
    
    // Insight 3: Distribution insights
    const categoricalFields = this.findCategoricalFields(data);
    for (const field of categoricalFields.slice(0, 2)) {
      const distribution = this.calculateDistribution(data, field);
      const uniqueValues = Object.keys(distribution).length;
      if (uniqueValues <= 5 && uniqueValues > 0) {
        insights.push(`${this.formatFieldName(field)} has ${uniqueValues} distinct values`);
      }
    }
    
    // Insight 4: Outlier insights
    if (analysis.outliers.length > 0) {
      const totalOutliers = analysis.outliers.reduce((sum, o) => sum + o.count, 0);
      insights.push(`Detected ${totalOutliers} potential outlier(s) in ${analysis.outliers.length} field(s)`);
    }
    
    return insights;
  }
  
  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(data, analysis, question) {
    const recommendations = [];
    
    // Recommendation 1: Data quality
    const missingFields = this.findMissingDataPatterns(data);
    if (missingFields.length > 0) {
      recommendations.push(`Consider cleaning missing data in: ${missingFields.join(', ')}`);
    }
    
    // Recommendation 2: Deeper analysis
    if (analysis.outliers.length > 0) {
      recommendations.push('Investigate outliers to understand unusual patterns');
    }
    
    // Recommendation 3: Export suggestion
    if (data.length > 100) {
      recommendations.push(`Export this data to Excel for deeper analysis (${data.length} records)`);
    }
    
    // Recommendation 4: Filter suggestion
    if (data.length > 500) {
      recommendations.push('Consider adding more filters to narrow down results');
    }
    
    // Recommendation 5: Specific to question
    if (question.toLowerCase().includes('performance')) {
      recommendations.push('Compare performance across different time periods for trends');
    }
    
    if (question.toLowerCase().includes('student')) {
      recommendations.push('Look at attendance patterns alongside performance for correlation');
    }
    
    return recommendations;
  }
  
  /**
   * Calculate correlations between numeric fields
   */
  calculateCorrelations(data) {
    const correlations = [];
    const numericFields = this.findNumericFields(data);
    
    for (let i = 0; i < numericFields.length; i++) {
      for (let j = i + 1; j < numericFields.length; j++) {
        const field1 = numericFields[i];
        const field2 = numericFields[j];
        
        const values = data
          .map(row => ({
            x: this.getNestedValue(row, field1),
            y: this.getNestedValue(row, field2),
          }))
          .filter(v => typeof v.x === 'number' && typeof v.y === 'number' && !isNaN(v.x) && !isNaN(v.y));
        
        if (values.length > 10) {
          const correlation = this.calculatePearsonCorrelation(values);
          
          if (Math.abs(correlation) > 0.3) {
            correlations.push({
              field1,
              field2,
              correlation,
              strength: Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.5 ? 'moderate' : 'weak',
              direction: correlation > 0 ? 'positive' : 'negative',
            });
          }
        }
      }
    }
    
    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }
  
  /**
   * Determine if more data is needed
   */
  needsMoreData(data, analysis, question) {
    // If data is too small, need more
    if (data.length < 10) {
      return true;
    }
    
    // If analysis found interesting patterns but needs verification
    if (analysis.outliers.length > 0 && data.length < 50) {
      return true;
    }
    
    // If question suggests time-based analysis but data lacks temporal range
    if (question.toLowerCase().includes('trend') && !this.hasTemporalData(data)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Suggest next query based on analysis
   */
  suggestNextQuery(data, question) {
    // Simple suggestion logic
    if (data.length < 10) {
      return {
        suggestion: 'Try broadening your search criteria',
        expandedQuery: null,
      };
    }
    
    return null;
  }
  
  // Helper statistical methods
  calculateMedian(sorted) {
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
  
  calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }
  
  calculatePercentile(sorted, percentile) {
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) return sorted[lower];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
  
  calculatePearsonCorrelation(values) {
    const n = values.length;
    const sumX = values.reduce((sum, v) => sum + v.x, 0);
    const sumY = values.reduce((sum, v) => sum + v.y, 0);
    const sumXY = values.reduce((sum, v) => sum + v.x * v.y, 0);
    const sumX2 = values.reduce((sum, v) => sum + v.x * v.x, 0);
    const sumY2 = values.reduce((sum, v) => sum + v.y * v.y, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }
  
  calculateDistribution(data, field) {
    const distribution = {};
    for (const row of data) {
      const value = this.getNestedValue(row, field);
      const key = value === null || value === undefined ? 'null' : String(value);
      distribution[key] = (distribution[key] || 0) + 1;
    }
    return distribution;
  }
  
  findNumericFields(data) {
    if (data.length === 0) return [];
    const sample = data[0];
    return Object.keys(sample).filter(key => {
      const value = sample[key];
      return typeof value === 'number' && !isNaN(value);
    });
  }
  
  findCategoricalFields(data) {
    if (data.length === 0) return [];
    const sample = data[0];
    return Object.keys(sample).filter(key => {
      const value = sample[key];
      return typeof value === 'string' || (typeof value === 'object' && value !== null && !(value instanceof Date));
    }).slice(0, 10);
  }
  
  findDateFields(data) {
    if (data.length === 0) return [];
    const sample = data[0];
    return Object.keys(sample).filter(key => {
      const value = sample[key];
      return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
    });
  }
  
  findMissingDataPatterns(data) {
    const missingCount = {};
    for (const row of data) {
      for (const [key, value] of Object.entries(row)) {
        if (value === null || value === undefined || value === '') {
          missingCount[key] = (missingCount[key] || 0) + 1;
        }
      }
    }
    
    return Object.entries(missingCount)
      .filter(([_, count]) => count > data.length * 0.3)
      .map(([field]) => field);
  }
  
  hasTemporalData(data) {
    return this.findDateFields(data).length > 0;
  }
  
  getDateRange(data, dateField) {
    const dates = data
      .map(row => this.getNestedValue(row, dateField))
      .filter(d => d instanceof Date || typeof d === 'string')
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()));
    
    if (dates.length === 0) return 'unknown range';
    
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    
    return `${min.toLocaleDateString()} to ${max.toLocaleDateString()}`;
  }
  
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  formatFieldName(field) {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  getCacheKey(data, question) {
    const dataHash = JSON.stringify(data.slice(0, 10)); // Sample for cache key
    return `${dataHash}_${question}`;
  }
  
  getFromCache(key) {
    const cached = this.analysisCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    return null;
  }
  
  cacheResult(key, data) {
    this.analysisCache.set(key, {
      data,
      expires: Date.now() + this.cacheTTL,
    });
  }
}

export default new AnalysisEngine();