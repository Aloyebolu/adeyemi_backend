// src/modules/ai/providers/mock.provider.js

import AIProviderBase from './base.provider.js';
import { getMockResponse, MOCK_QUERIES, MOCK_ACTIONS } from '../utils/mock.responses.js';

class MockAIProvider extends AIProviderBase {
  constructor(config = {}) {
    super(config);
    this.providerName = 'mock';
    this.delayMs = config.delayMs || 500;
    this.enableStreaming = config.enableStreaming !== false;
  }
  
  async generateResponse(prompt, context = {}) {
    // Simulate network delay
    await this.delay(this.delayMs);
    
    // Determine response type from prompt
    const responseType = this.detectResponseType(prompt);
    
    // Return appropriate mock response
    return this.getMockResponseByType(responseType, prompt);
  }
  
  async streamResponse(prompt, onChunk, context = {}) {
    const fullResponse = await this.generateResponse(prompt, context);
    
    if (!this.enableStreaming) {
      onChunk(fullResponse);
      return;
    }
    
    // Stream in chunks (simulate token-by-token)
    const chunks = this.chunkText(fullResponse, 30);
    
    for (const chunk of chunks) {
      onChunk(chunk);
      await this.delay(20);
    }
  }
  
  async classifyIntent(message, context = {}) {
    await this.delay(this.delayMs);
    
    const lowerMsg = message.toLowerCase();
    
    // Simple keyword-based classification (mock)
    if (lowerMsg.includes('terminate') || lowerMsg.includes('delete') || lowerMsg.includes('remove')) {
      return {
        type: 'write',
        action: 'terminate',
        confidence: 0.9,
        entities: this.extractEntities(message),
      };
    }
    
    if (lowerMsg.includes('analyze') || lowerMsg.includes('trend') || lowerMsg.includes('pattern')) {
      return {
        type: 'analysis',
        confidence: 0.85,
        entities: this.extractEntities(message),
      };
    }
    
    if (lowerMsg.includes('export') || lowerMsg.includes('download')) {
      return {
        type: 'export',
        confidence: 0.9,
        entities: this.extractEntities(message),
      };
    }
    
    return {
      type: 'read',
      confidence: 0.8,
      entities: this.extractEntities(message),
    };
  }
  
  async generateQuery(message, schema, context = {}) {
    await this.delay(this.delayMs);
    
    const lowerMsg = message.toLowerCase();
    
    // Return mock queries based on message content
    if (lowerMsg.includes('student') && lowerMsg.includes('damilola')) {
      return MOCK_QUERIES.searchStudentsByName;
    }
    
    if (lowerMsg.includes('student') && lowerMsg.includes('computer science')) {
      return MOCK_QUERIES.studentsByDepartment;
    }
    
    if (lowerMsg.includes('lecturer')) {
      return MOCK_QUERIES.listLecturers;
    }
    
    return MOCK_QUERIES.default;
  }
  
  async analyzeData(data, question, context = {}) {
    await this.delay(this.delayMs);
    
    return {
      insights: [
        `Found ${data.length} records matching your query.`,
        data.length > 0 ? 'Data shows expected patterns.' : 'No significant patterns detected.',
      ],
      needsMoreData: false,
      recommendations: [
        'Consider filtering by specific criteria for more targeted results.',
        'Export to Excel for deeper analysis.',
      ],
    };
  }
  
  async generateAction(intent, entities, context = {}) {
    await this.delay(this.delayMs);
    
    if (intent.action === 'terminate') {
      return {
        ...MOCK_ACTIONS.terminateStudent,
        payload: {
          ...MOCK_ACTIONS.terminateStudent.payload,
          ...entities,
        },
        description: `Terminate student ${entities.name || 'selected student'}`,
      };
    }
    
    return MOCK_ACTIONS.default;
  }
  
  // Helper methods
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  chunkText(text, chunkSize) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  detectResponseType(prompt) {
    const lower = prompt.toLowerCase();
    if (lower.includes('intent') || lower.includes('classify')) return 'intent';
    if (lower.includes('query') || lower.includes('mongodb')) return 'query';
    if (lower.includes('analyze')) return 'analysis';
    if (lower.includes('action')) return 'action';
    return 'general';
  }
  
  getMockResponseByType(type, prompt) {
    switch (type) {
      case 'intent':
        return JSON.stringify({ type: 'read', confidence: 0.85, entities: {} });
      case 'query':
        return JSON.stringify(MOCK_QUERIES.default);
      case 'analysis':
        return JSON.stringify({ insights: ['Analysis complete'], needsMoreData: false });
      case 'action':
        return JSON.stringify(MOCK_ACTIONS.default);
      default:
        return getMockResponse('general');
    }
  }
  
  extractEntities(message) {
    const entities = {};
    
    // Extract name (simple pattern)
    const nameMatch = message.match(/(?:student|user)\s+(\w+(?:\s+\w+)?)/i);
    if (nameMatch) entities.name = nameMatch[1];
    
    // Extract matric number pattern
    const matricMatch = message.match(/[A-Z]{2,3}\/\d{2}\/\d{3}/i);
    if (matricMatch) entities.matric = matricMatch[0];
    
    return entities;
  }
}

export default MockAIProvider;