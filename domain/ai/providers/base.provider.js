// src/modules/ai/providers/base.provider.js

/**
 * Abstract base class for AI providers
 * All providers must implement these methods
 */
class AIProviderBase {
  constructor(config = {}) {
    this.config = config;
    this.providerName = 'base';
  }
  
  /**
   * Generate a response from AI
   */
  async generateResponse(prompt, context = {}) {
    throw new Error(`generateResponse not implemented by ${this.providerName}`);
  }
  
  /**
   * Stream a response from AI
   */
  async streamResponse(prompt, onChunk, context = {}) {
    throw new Error(`streamResponse not implemented by ${this.providerName}`);
  }
  
  /**
   * Classify user intent
   */
  async classifyIntent(message, context = {}) {
    const prompt = this.buildIntentPrompt(message, context);
    const response = await this.generateResponse(prompt);
    return this.parseJSON(response);
  }
  
  /**
   * Generate MongoDB query from natural language
   */
  async generateQuery(message, schema, context = {}) {
    const prompt = this.buildQueryPrompt(message, schema, context);
    const response = await this.generateResponse(prompt);
    return this.parseJSON(response);
  }
  
  /**
   * Analyze data and extract insights
   */
  async analyzeData(data, question, context = {}) {
    const prompt = this.buildAnalysisPrompt(data, question, context);
    const response = await this.generateResponse(prompt);
    return this.parseJSON(response);
  }
  
  /**
   * Generate action from intent
   */
  async generateAction(intent, entities, context = {}) {
    const prompt = this.buildActionPrompt(intent, entities, context);
    const response = await this.generateResponse(prompt);
    return this.parseJSON(response);
  }
  
  // Prompt builders (to be overridden)
  buildIntentPrompt(message, context) {
    return `Classify the intent of this message: "${message}"\nReturn JSON: { type: "read|write|analysis", confidence: 0-1, entities: {} }`;
  }
  
  buildQueryPrompt(message, schema, context) {
    return `Generate MongoDB query for: "${message}"\nSchema: ${JSON.stringify(schema)}\nReturn JSON query object.`;
  }
  
  buildAnalysisPrompt(data, question, context) {
    return `Analyze this data for: "${question}"\nData sample: ${JSON.stringify(data.slice(0, 10))}\nReturn JSON with insights, patterns, recommendations.`;
  }
  
  buildActionPrompt(intent, entities, context) {
    return `Generate action for intent: ${JSON.stringify(intent)}\nEntities: ${JSON.stringify(entities)}\nReturn action object with endpoint, method, payload.`;
  }
  
  // Helper
  parseJSON(response) {
    try {
      // Extract JSON from response (handles markdown code blocks)
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return { error: 'Failed to parse response', raw: response };
    }
  }
}

export default AIProviderBase;