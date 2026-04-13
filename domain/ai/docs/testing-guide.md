# AI Module Testing Guide

## Overview

This guide covers testing strategies for the AI module, including unit tests, integration tests, and end-to-end testing with the mock provider.

## Test Structure

```
__tests__/
├── unit/
│   ├── engines/
│   │   ├── query.engine.test.js
│   │   ├── analysis.engine.test.js
│   │   └── action.engine.test.js
│   ├── formatters/
│   │   ├── markdown.formatter.test.js
│   │   └── export.formatter.test.js
│   ├── validators/
│   │   ├── query.validator.test.js
│   │   └── intent.validator.test.js
│   └── utils/
│       ├── safety.filter.test.js
│       └── data.chunker.test.js
├── integration/
│   ├── orchestrator.test.js
│   ├── providers.test.js
│   └── api.test.js
├── fixtures/
│   ├── mock.data.js
│   └── mock.responses.js
└── e2e/
    └── chat.flow.test.js
```

## Unit Tests

### Testing Query Engine

```javascript
// __tests__/unit/engines/query.engine.test.js

import { expect } from 'chai';
import queryEngine from '../../../src/modules/ai/engines/query.engine.js';
import { mockUsers } from '../../fixtures/mock.data.js';

describe('Query Engine', () => {
  beforeEach(() => {
    queryEngine.clearCache();
  });
  
  describe('executeQuery', () => {
    it('should execute find query', async () => {
      const query = {
        collection: 'users',
        operation: 'find',
        query: { role: 'student' },
        limit: 10,
      };
      
      const result = await queryEngine.executeQuery(query);
      
      expect(result).to.be.an('array');
      expect(result.length).to.be.at.most(10);
    });
    
    it('should apply projection', async () => {
      const query = {
        collection: 'users',
        operation: 'find',
        query: { role: 'student' },
        projection: { name: 1, email: 1 },
        limit: 1,
      };
      
      const result = await queryEngine.executeQuery(query);
      
      if (result.length > 0) {
        expect(result[0]).to.have.property('name');
        expect(result[0]).to.have.property('email');
        expect(result[0]).to.not.have.property('password');
      }
    });
    
    it('should enforce max limit', async () => {
      const query = {
        collection: 'users',
        operation: 'find',
        query: {},
        limit: 20000, // Above max
      };
      
      const result = await queryEngine.executeQuery(query);
      expect(result.length).to.be.at.most(10000);
    });
    
    it('should handle aggregation pipeline', async () => {
      const query = {
        collection: 'users',
        operation: 'aggregate',
        pipeline: [
          { $match: { role: 'student' } },
          { $group: { _id: '$department', count: { $sum: 1 } } },
        ],
      };
      
      const result = await queryEngine.executeQuery(query);
      expect(result).to.be.an('array');
    });
    
    it('should throw on dangerous operators', async () => {
      const query = {
        collection: 'users',
        operation: 'find',
        query: { $where: 'function() { return true; }' },
      };
      
      try {
        await queryEngine.executeQuery(query);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.message).to.include('Dangerous operation');
      }
    });
  });
  
  describe('cache', () => {
    it('should cache identical queries', async () => {
      const query = {
        collection: 'users',
        operation: 'find',
        query: { role: 'student' },
        limit: 10,
      };
      
      const startTime = Date.now();
      await queryEngine.executeQuery(query);
      const firstDuration = Date.now() - startTime;
      
      const cachedStart = Date.now();
      await queryEngine.executeQuery(query);
      const cachedDuration = Date.now() - cachedStart;
      
      expect(cachedDuration).to.be.lessThan(firstDuration);
    });
  });
});
```

### Testing Analysis Engine

```javascript
// __tests__/unit/engines/analysis.engine.test.js

import { expect } from 'chai';
import analysisEngine from '../../../src/modules/ai/engines/analysis.engine.js';

describe('Analysis Engine', () => {
  const mockData = [
    { name: 'John', score: 85, department: 'CS' },
    { name: 'Jane', score: 92, department: 'CS' },
    { name: 'Bob', score: 78, department: 'CS' },
    { name: 'Alice', score: 95, department: 'ENG' },
    { name: 'Charlie', score: 88, department: 'ENG' },
  ];
  
  describe('calculateStatistics', () => {
    it('should calculate basic statistics', () => {
      const stats = analysisEngine.calculateStatistics(mockData);
      
      expect(stats.score).to.exist;
      expect(stats.score.min).to.equal(78);
      expect(stats.score.max).to.equal(95);
      expect(stats.score.avg).to.be.closeTo(87.6, 0.1);
      expect(stats.score.median).to.equal(88);
    });
    
    it('should calculate percentiles', () => {
      const stats = analysisEngine.calculateStatistics(mockData);
      
      expect(stats.score.percentiles.p25).to.be.a('number');
      expect(stats.score.percentiles.p75).to.be.a('number');
      expect(stats.score.percentiles.p90).to.be.a('number');
    });
  });
  
  describe('detectPatterns', () => {
    it('should detect distribution patterns', () => {
      const patterns = analysisEngine.detectPatterns(mockData);
      
      expect(patterns).to.be.an('array');
      // CS department has 60% of data
      expect(patterns.some(p => p.includes('department'))).to.be.true;
    });
  });
  
  describe('findOutliers', () => {
    const outlierData = [
      { value: 10 },
      { value: 12 },
      { value: 11 },
      { value: 100 }, // Outlier
      { value: 13 },
    ];
    
    it('should detect outliers', () => {
      const outliers = analysisEngine.findOutliers(outlierData);
      
      expect(outliers).to.have.length(1);
      expect(outliers[0].field).to.equal('value');
      expect(outliers[0].count).to.equal(1);
    });
  });
  
  describe('calculateCorrelations', () => {
    const correlationData = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
      { x: 4, y: 8 },
      { x: 5, y: 10 },
    ];
    
    it('should calculate correlation coefficient', () => {
      const correlations = analysisEngine.calculateCorrelations(correlationData);
      
      expect(correlations).to.have.length(1);
      expect(correlations[0].correlation).to.be.closeTo(1, 0.01);
      expect(correlations[0].strength).to.equal('strong');
      expect(correlations[0].direction).to.equal('positive');
    });
  });
});
```

### Testing Action Engine

```javascript
// __tests__/unit/engines/action.engine.test.js

import { expect } from 'chai';
import actionEngine from '../../../src/modules/ai/engines/action.engine.js';

describe('Action Engine', () => {
  describe('generateAction', () => {
    it('should generate terminate student action', async () => {
      const intent = { type: 'write', action: 'terminate' };
      const entities = { name: 'John Doe', student_id: '123' };
      
      const action = await actionEngine.generateAction(intent, entities);
      
      expect(action.endpoint).to.equal('/api/students/terminate');
      expect(action.method).to.equal('POST');
      expect(action.payload).to.have.property('student_id');
      expect(action.confirmation.required).to.be.true;
    });
    
    it('should require confirmation for destructive actions', async () => {
      const action = await actionEngine.generateAction(
        { type: 'write', action: 'terminate' },
        { student_id: '123' }
      );
      
      expect(action.confirmation.required).to.be.true;
      expect(action.confirmation.message).to.include('permanently remove');
    });
    
    it('should build payload preview', async () => {
      const action = await actionEngine.generateAction(
        { type: 'write', action: 'terminate' },
        { student_id: '123', name: 'John Doe', reason: 'Academic' }
      );
      
      const preview = actionEngine.buildPayloadPreview(action.payload);
      
      expect(preview).to.have.property('student_id');
      expect(preview).to.have.property('reason');
      expect(preview).to.not.have.property('password');
    });
  });
  
  describe('validateAction', () => {
    it('should validate required fields', () => {
      const action = {
        endpoint: '/api/students/terminate',
        method: 'POST',
        payload: { student_id: '123' },
      };
      
      const validation = actionEngine.validateAction(action, ['student_id', 'reason']);
      
      expect(validation.valid).to.be.false;
      expect(validation.missing).to.include('reason');
    });
  });
});
```

## Integration Tests

### Testing Orchestrator

```javascript
// __tests__/integration/orchestrator.test.js

import { expect } from 'chai';
import sinon from 'sinon';
import orchestrator from '../../../src/modules/ai/services/ai.orchestrator.service.js';
import { mockAIProvider } from '../../fixtures/mock.provider.js';

describe('AI Orchestrator Integration', () => {
  let streamChunks = [];
  
  const mockStream = {
    write: (data) => {
      const parsed = JSON.parse(data.replace('data: ', '').trim());
      streamChunks.push(parsed);
    },
    end: () => {},
  };
  
  beforeEach(() => {
    streamChunks = [];
    sinon.stub(orchestrator.aiProvider, 'classifyIntent');
    sinon.stub(orchestrator.aiProvider, 'generateQuery');
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('processMessage - Read Operation', () => {
    it('should handle simple read request', async () => {
      orchestrator.aiProvider.classifyIntent.resolves({
        type: 'read',
        confidence: 0.95,
      });
      
      orchestrator.aiProvider.generateQuery.resolves({
        collection: 'users',
        operation: 'find',
        query: { role: 'student' },
        limit: 10,
      });
      
      await orchestrator.processMessage(
        'user123',
        'Show me all students',
        'conv123',
        mockStream
      );
      
      expect(streamChunks.some(c => c.type === 'content')).to.be.true;
      expect(streamChunks.some(c => c.text && c.text.includes('students'))).to.be.true;
    });
    
    it('should handle write request with action', async () => {
      orchestrator.aiProvider.classifyIntent.resolves({
        type: 'write',
        action: 'terminate_student',
        confidence: 0.9,
      });
      
      await orchestrator.processMessage(
        'user123',
        'Terminate student John Doe',
        'conv123',
        mockStream
      );
      
      const actionChunks = streamChunks.filter(c => c.type === 'action');
      expect(actionChunks).to.have.length.at.least(1);
      expect(actionChunks[0].action.endpoint).to.include('terminate');
    });
  });
});
```

## End-to-End Tests

```javascript
// __tests__/e2e/chat.flow.test.js

import { expect } from 'chai';
import request from 'supertest';
import app from '../../../src/app.js';

describe('Chat Flow E2E', () => {
  let authToken;
  let conversationId;
  
  before(async () => {
    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'password' });
    
    authToken = loginRes.body.data.token;
  });
  
  describe('Student Search Flow', () => {
    it('should search for students', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Find students named Damilola' });
      
      expect(response.body.success).to.be.true;
      expect(response.body.data.message).to.include('found');
      expect(response.body.data.conversation_id).to.exist;
      
      conversationId = response.body.data.conversation_id;
    });
    
    it('should handle follow-up', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          message: 'Show me the third one',
          conversation_id: conversationId,
        });
      
      expect(response.body.success).to.be.true;
      expect(response.body.data.message).to.include('Daniel Damilola');
    });
  });
  
  describe('Export Flow', () => {
    it('should export large dataset', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ message: 'Export all students' });
      
      expect(response.body.success).to.be.true;
      expect(response.body.data.message).to.include('export');
    });
  });
  
  describe('Conversation Management', () => {
    it('should list conversations', async () => {
      const response = await request(app)
        .get('/api/ai/conversations')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.body.success).to.be.true;
      expect(response.body.data.conversations).to.be.an('array');
    });
    
    it('should get specific conversation', async () => {
      const response = await request(app)
        .get(`/api/ai/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.body.success).to.be.true;
      expect(response.body.data.conversation._id).to.equal(conversationId);
    });
    
    it('should delete conversation', async () => {
      const response = await request(app)
        .delete(`/api/ai/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.body.success).to.be.true;
    });
  });
});
```

## Mock Data Fixtures

```javascript
// __tests__/fixtures/mock.data.js

export const mockUsers = [
  {
    _id: '507f1f77bcf86cd799439011',
    first_name: 'Damilola',
    last_name: 'Michael',
    email: 'damilola.m@example.com',
    role: 'student',
    department: 'Computer Science',
    matricNo: 'CS2023/001',
  },
  {
    _id: '507f1f77bcf86cd799439012',
    first_name: 'Brandon',
    last_name: 'Damilola',
    email: 'brandon.d@example.com',
    role: 'student',
    department: 'Engineering',
    matricNo: 'ENG2023/045',
  },
  {
    _id: '507f1f77bcf86cd799439013',
    first_name: 'Daniel',
    last_name: 'Damilola',
    email: 'daniel.d@example.com',
    role: 'student',
    department: 'Business',
    matricNo: 'BUS2023/023',
  },
  {
    _id: '507f1f77bcf86cd799439014',
    first_name: 'John',
    last_name: 'Smith',
    email: 'john.s@example.com',
    role: 'lecturer',
    department: 'Computer Science',
    staffId: 'LEC2023/001',
  },
];

export const mockDepartments = [
  { _id: '507f1f77bcf86cd799439021', name: 'Computer Science', faculty: 'Engineering' },
  { _id: '507f1f77bcf86cd799439022', name: 'Engineering', faculty: 'Engineering' },
  { _id: '507f1f77bcf86cd799439023', name: 'Business', faculty: 'Business School' },
];

export const mockPerformanceData = Array.from({ length: 100 }, (_, i) => ({
  student_id: `student_${i}`,
  score: 50 + Math.random() * 50,
  attendance: 50 + Math.random() * 50,
  department: ['CS', 'ENG', 'BUS'][Math.floor(Math.random() * 3)],
  semester: ['Fall', 'Spring'][Math.floor(Math.random() * 2)],
}));
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "Query Engine"

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run E2E tests
npm run test:e2e

# Run integration tests
npm run test:integration
```

## Continuous Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
        env:
          NODE_ENV: test
          MONGODB_URI: mongodb://localhost:27017/test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## Test Coverage Targets

| Component | Target Coverage |
|-----------|-----------------|
| Engines   | 90%             |
| Formatters| 85%             |
| Validators| 95%             |
| Providers | 80%             |
| Services  | 85%             |
| Controllers| 80%            |
| Utils     | 90%             |
| **Overall** | **85%**       |

This comprehensive testing strategy ensures reliability and maintainability of the AI module.
```