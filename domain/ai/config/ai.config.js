// src/modules/ai/config/ai.config.js

export const AI_CONFIG = {
  // Current provider: 'mock' for testing, 'openai' for production
  provider: process.env.AI_PROVIDER || 'mock',
  
  // Mock provider settings
  mock: {
    delayMs: parseInt(process.env.MOCK_AI_DELAY_MS) || 500,
    enableStreaming: process.env.MOCK_AI_ENABLE_STREAMING !== 'false',
    randomErrors: false,
    errorRate: 0.05,
  },
  
  // OpenAI settings (for future)
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    temperature: 0.7,
    maxTokens: 2000,
  },
  
  // Global limits
  limits: {
    defaultRows: 1000,
    maxRows: 10000,
    tableThreshold: 20,      // Show as table if <= 20 rows
    summaryThreshold: 50,    // Show summary if <= 50 rows
    exportThreshold: 100,    // Auto-export if > 100 rows
    queryTimeoutMs: 30000,
    maxAnalysisDepth: 2,
  },
  
  // Export settings
  export: {
    formats: ['excel', 'csv', 'json'],
    defaultFormat: 'excel',
    maxRows: 50000,
    tempFileRetentionHours: 24,
  },
  
  // Audit
  enableAudit: process.env.AI_ENABLE_AUDIT !== 'false',
};

export default AI_CONFIG;