// src/modules/ai/providers/index.js

import MockAIProvider from './mock.provider.js';
import AI_CONFIG from '#domain/ai/config/ai.config.js';

// Import OpenAI provider when ready
// import OpenAIProvider from './openai.provider.js';

class AIProviderFactory {
  static createProvider(providerType = null, config = null) {
    const type = providerType || AI_CONFIG.provider;
    const providerConfig = config || AI_CONFIG[type] || {};
    
    switch (type) {
      case 'mock':
        console.log('🔧 Using Mock AI Provider for testing');
        return new MockAIProvider(providerConfig);
      
      // case 'openai':
      //   console.log('🤖 Using OpenAI Provider');
      //   return new OpenAIProvider(providerConfig);
      
      default:
        console.warn(`⚠️ Unknown provider type: ${type}, falling back to mock`);
        return new MockAIProvider(AI_CONFIG.mock);
    }
  }
}

export default AIProviderFactory;