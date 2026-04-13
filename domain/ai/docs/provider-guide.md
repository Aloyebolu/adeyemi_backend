# AI Provider Integration Guide

## Overview

The AI module uses a pluggable provider architecture, allowing you to switch between different AI providers without changing the core logic. This guide explains how to create and integrate new providers.

## Provider Interface

All providers must extend the `AIProviderBase` class:

```javascript
import AIProviderBase from './base.provider.js';

class CustomProvider extends AIProviderBase {
  constructor(config = {}) {
    super(config);
    this.providerName = 'custom';
  }
  
  // Implement required methods
}
```

## Required Methods

### 1. `generateResponse(prompt, context)`
Generate a text response from AI.

```javascript
async generateResponse(prompt, context = {}) {
  // Call your AI API
  const response = await this.api.complete({
    prompt,
    temperature: context.temperature || 0.7,
    max_tokens: context.maxTokens || 2000,
  });
  
  return response.text;
}
```

### 2. `streamResponse(prompt, onChunk, context)`
Stream responses in real-time.

```javascript
async streamResponse(prompt, onChunk, context = {}) {
  const stream = await this.api.stream({
    prompt,
    temperature: context.temperature || 0.7,
  });
  
  for await (const chunk of stream) {
    onChunk(chunk.text);
  }
}
```

### 3. `classifyIntent(message, context)`
Classify user intent from natural language.

```javascript
async classifyIntent(message, context = {}) {
  const prompt = this.buildIntentPrompt(message, context);
  const response = await this.generateResponse(prompt);
  
  return this.parseJSON(response);
}
```

### 4. `generateQuery(message, schema, context)`
Generate MongoDB query from natural language.

```javascript
async generateQuery(message, schema, context = {}) {
  const prompt = this.buildQueryPrompt(message, schema, context);
  const response = await this.generateResponse(prompt);
  
  return this.parseJSON(response);
}
```

### 5. `analyzeData(data, question, context)`
Analyze data and extract insights.

```javascript
async analyzeData(data, question, context = {}) {
  const prompt = this.buildAnalysisPrompt(data, question, context);
  const response = await this.generateResponse(prompt);
  
  return this.parseJSON(response);
}
```

### 6. `generateAction(intent, entities, context)`
Generate action from intent.

```javascript
async generateAction(intent, entities, context = {}) {
  const prompt = this.buildActionPrompt(intent, entities, context);
  const response = await this.generateResponse(prompt);
  
  return this.parseJSON(response);
}
```

## Creating a New Provider

### Step 1: Create Provider Class

```javascript
// src/modules/ai/providers/openai.provider.js

import OpenAI from 'openai';
import AIProviderBase from './base.provider.js';

class OpenAIProvider extends AIProviderBase {
  constructor(config = {}) {
    super(config);
    this.providerName = 'openai';
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = config.model || 'gpt-4-turbo-preview';
  }
  
  async generateResponse(prompt, context = {}) {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: context.temperature || 0.7,
      max_tokens: context.maxTokens || 2000,
    });
    
    return completion.choices[0].message.content;
  }
  
  async streamResponse(prompt, onChunk, context = {}) {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
      temperature: context.temperature || 0.7,
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        onChunk(content);
      }
    }
  }
  
  // Override prompt builders for better results
  buildIntentPrompt(message, context) {
    return `Classify the intent of this message: "${message}"
    
Context: ${JSON.stringify(context)}

Return JSON with: type, confidence, action, entities

Types: read, write, analysis, export

Examples:
- "Show students" -> {"type":"read","confidence":0.95}
- "Delete student" -> {"type":"write","confidence":0.9,"action":"terminate_student"}

Respond with valid JSON only.`;
  }
  
  // Override other prompt builders...
}

export default OpenAIProvider;
```

### Step 2: Register Provider

```javascript
// src/modules/ai/providers/index.js

import OpenAIProvider from './openai.provider.js';

class AIProviderFactory {
  static createProvider(providerType, config = {}) {
    switch (providerType) {
      case 'mock':
        return new MockAIProvider(config.mock);
      
      case 'openai':
        return new OpenAIProvider(config.openai);
      
      default:
        return new MockAIProvider(config.mock);
    }
  }
}
```

### Step 3: Configure

```javascript
// .env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
```

## Testing Your Provider

Create a test file:

```javascript
// test-provider.js
import { AIProviderFactory } from './src/modules/ai/providers/index.js';

const provider = AIProviderFactory.createProvider('openai', {
  apiKey: process.env.OPENAI_API_KEY,
});

async function test() {
  // Test intent classification
  const intent = await provider.classifyIntent('Show me all students');
  console.log('Intent:', intent);
  
  // Test streaming
  await provider.streamResponse('Tell me about students', (chunk) => {
    process.stdout.write(chunk);
  });
}

test();
```

## Provider Best Practices

### 1. Error Handling
```javascript
async generateResponse(prompt, context) {
  try {
    const response = await this.api.call(prompt);
    return response;
  } catch (error) {
    if (error.status === 429) {
      throw new Error('Rate limit exceeded');
    }
    throw new Error(`AI provider error: ${error.message}`);
  }
}
```

### 2. Timeouts
```javascript
async generateResponse(prompt, context) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await this.api.call(prompt, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}
```

### 3. Retry Logic
```javascript
async generateResponse(prompt, context, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await this.api.call(prompt);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 4. Prompt Caching
```javascript
constructor(config) {
  super(config);
  this.promptCache = new Map();
  this.cacheTTL = 5 * 60 * 1000; // 5 minutes
}

async generateResponse(prompt, context) {
  const cacheKey = this.getCacheKey(prompt, context);
  const cached = this.promptCache.get(cacheKey);
  
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  const response = await this.api.call(prompt);
  
  this.promptCache.set(cacheKey, {
    data: response,
    expires: Date.now() + this.cacheTTL,
  });
  
  return response;
}
```

## Performance Optimization

### 1. Batch Requests
```javascript
async batchGenerate(prompts) {
  // Some providers support batch endpoints
  return await this.api.batchComplete(prompts);
}
```

### 2. Response Compression
```javascript
async generateResponse(prompt, context) {
  const response = await this.api.call(prompt);
  
  // Compress if response is large
  if (response.length > 10000) {
    return this.summarize(response);
  }
  
  return response;
}
```

### 3. Parallel Processing
```javascript
async analyzeData(data, question, context) {
  const chunks = this.chunkData(data, 100);
  
  const analyses = await Promise.all(
    chunks.map(chunk => this.analyzeChunk(chunk, question))
  );
  
  return this.mergeAnalyses(analyses);
}
```

## Monitoring & Observability

### Add Metrics
```javascript
class OpenAIProvider extends AIProviderBase {
  async generateResponse(prompt, context) {
    const startTime = Date.now();
    
    try {
      const response = await this.api.call(prompt);
      
      const duration = Date.now() - startTime;
      console.log(`OpenAI request: ${duration}ms, tokens: ${response.usage.total_tokens}`);
      
      return response.text;
    } catch (error) {
      console.error('OpenAI error:', error);
      throw error;
    }
  }
}
```

### Add Tracing
```javascript
async generateResponse(prompt, context) {
  const traceId = context.traceId || crypto.randomUUID();
  
  console.log(`[${traceId}] Calling OpenAI with prompt length: ${prompt.length}`);
  
  const response = await this.api.call(prompt);
  
  console.log(`[${traceId}] Response received: ${response.text.length} chars`);
  
  return response.text;
}
```

## Deployment Considerations

### Environment Variables
```javascript
// config/ai.config.js
export const AI_CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000,
    timeout: parseInt(process.env.OPENAI_TIMEOUT) || 30000,
    retries: parseInt(process.env.OPENAI_RETRIES) || 3,
  },
};
```

### Fallback Strategy
```javascript
async generateResponse(prompt, context) {
  try {
    return await this.openai.generate(prompt);
  } catch (error) {
    console.error('OpenAI failed, falling back to mock');
    return this.mock.generateResponse(prompt);
  }
}
```

### Health Checks
```javascript
async healthCheck() {
  try {
    await this.api.call('ping');
    return { status: 'healthy', provider: 'openai' };
  } catch (error) {
    return { status: 'unhealthy', provider: 'openai', error: error.message };
  }
}
```

## Adding a New Provider: Checklist

- [ ] Create provider class extending `AIProviderBase`
- [ ] Implement all required methods
- [ ] Add configuration to `ai.config.js`
- [ ] Register in `providers/index.js`
- [ ] Add environment variables to `.env.example`
- [ ] Write tests in `__tests__/providers/`
- [ ] Update documentation
- [ ] Add health check endpoint
- [ ] Test with real API calls
- [ ] Add error handling and retries
- [ ] Implement rate limiting
- [ ] Add performance monitoring
```

---

