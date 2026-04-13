// src/modules/ai/index.js

import AIProviderFactory from './providers/index.js';
import AI_CONFIG from './config/ai.config.js';

// Export core components
export { default as AIProviderFactory } from './providers/index.js';
export { default as AI_CONFIG } from './config/ai.config.js';

// Create singleton provider instance
const aiProvider = AIProviderFactory.createProvider();

// Export the provider instance
export const ai = aiProvider;

// Module exports
export default {
  ai,
  AIProviderFactory,
  AI_CONFIG,
};