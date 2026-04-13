// src/modules/ai/services/ai.orchestrator.service.js

import sessionService from './ai.session.service.js';
import { ai } from '../index.js';
import AI_CONFIG from '../config/ai.config.js';
import queryEngine from '../engines/query.engine.js';
import queryValidator from '../validators/query.validator.js';
import markdownFormatter from '../formatters/markdown.formatter.js';
import preferencesService from './ai.preferences.service.js';
// Add to imports
import analysisEngine from '../engines/analysis.engine.js';
import actionEngine from '../engines/action.engine.js';
import exportFormatter from '../formatters/export.formatter.js';
import auditService from '../services/ai.audit.service.js';
import safetyFilter from '../utils/safety.filter.js';

/**
 * Main orchestration logic - the brain of the AI system
 */
class AIOrchestrator {
    constructor() {
        this.maxAnalysisDepth = AI_CONFIG.limits.maxAnalysisDepth;
    }

    /**
     * Process user message and orchestrate the response
     */
    async processMessage(userId, message, conversationId, sseStream) {
        let session = null;

        try {
            // Get or create session
            session = await sessionService.getOrCreateSession(conversationId, userId, sseStream);

            // Add user message to conversation
            session.conversation.addMessage('user', message);
            await session.conversation.save();

            // Send initial status
            session.sendStatus('🔍 Understanding your request...');
            sessionService.updateStatus(session.id, 'thinking');

            // Step 1: Classify intent
            const intent = await ai.classifyIntent(message, {
                userId,
                conversationHistory: session.conversation.getRecentMessages(5),
            });

            session.sendStatus(`📌 Intent detected: ${intent.type.toUpperCase()}`);

            // Step 2: Route based on intent type
            let result;
            switch (intent.type) {
                case 'write':
                    result = await this.handleWriteOperation(session, message, intent);
                    break;
                case 'analysis':
                    result = await this.handleAnalysisOperation(session, message, intent);
                    break;
                case 'export':
                    result = await this.handleExportOperation(session, message, intent);
                    break;
                case 'read':
                default:
                    result = await this.handleReadOperation(session, message, intent);
                    break;
            }

            // Step 3: Finalize session
            session.sendStatus('✅ Response complete');
            await session.flushToDatabase();
            session.endStream();

            return result;

        } catch (error) {
            console.error('Orchestrator error:', error);

            if (session) {
                session.sendError(error.message || 'An unexpected error occurred');
                await session.flushToDatabase();
                session.endStream();
            }

            throw error;
        } finally {
            if (session) {
                sessionService.updateStatus(session.id, 'idle');
            }
        }
    }

    /**
     * Handle READ operations - search, list, view
     */
    async handleWriteOperation(session, message, intent) {
        session.sendStatus('⚙️ Preparing action...');

        // Extract entities
        const entities = await this.extractEntities(message);

        // Generate action
        const action = await actionEngine.generateAction(intent, entities, {
            userId: session.userId,
            userPreferences: session.preferences,
        });

        // Validate action
        const validation = actionEngine.validateAction(action);
        if (!validation.valid) {
            session.sendError(`Missing required fields: ${validation.missing.join(', ')}`);
            return { type: 'write', error: 'Invalid action' };
        }

        // Send action with confirmation
        session.sendAction(action, markdownFormatter.formatActionConfirmation(action, action.preview));

        // Audit
        await auditService.logAction(session.userId, action, action.payload, null, true);

        return { type: 'write', action };
    }


    /**
     * Handle ANALYSIS operations - insights, patterns, recommendations
     */
    async handleAnalysisOperation(session, message, intent) {
        const startTime = Date.now();

        session.sendStatus('📊 Fetching data for analysis...');

        // Get data
        const query = await ai.generateQuery(message, null, {
            userId: session.userId,
            intent: intent,
        });

        const data = await this.executeQuery(query);

        // Audit query
        await auditService.logQuery(session.userId, query, data, Date.now() - startTime);

        session.sendStatus(`🧠 Analyzing ${data.length} records...`);

        // Perform analysis
        const analysis = await analysisEngine.analyzeData(data, message, {
            depth: 1,
            maxDepth: session.preferences?.analysis?.max_depth || 2,
        });

        // Format results
        const formatted = markdownFormatter.formatAnalysis(analysis, data.slice(0, 10));

        // Stream content
        for (const chunk of this.chunkMarkdown(formatted, 100)) {
            session.sendContent(chunk);
            await this.delay(10);
        }

        // Add export option if data is large
        if (data.length > 50) {
            const exportAction = await actionEngine.generateAction(
                { type: 'export', action: 'bulk_export' },
                { count: data.length, format: 'excel' },
                { userId: session.userId }
            );

            session.sendAction(exportAction, `📁 Export these ${data.length} records for deeper analysis`);
        }

        return { type: 'analysis', analysis, dataCount: data.length };
    }


    /**
     * Handle EXPORT operations
     */
    async handleExportOperation(session, message, intent) {
        session.sendStatus('📁 Preparing export...');
        sessionService.updateStatus(session.id, 'exporting');

        // Generate query for export
        const query = await ai.generateQuery(message, null, {
            userId: session.userId,
            exportMode: true,
        });

        // Execute query
        const data = await this.executeQuery(query);

        if (data.length > AI_CONFIG.limits.exportThreshold) {
            session.sendContent(`📊 **Dataset contains ${data.length} records**\n\n`);
            session.sendContent(`This dataset is too large to display. I've prepared an export file:\n\n`);

            // Mock export URL
            const exportUrl = `/api/ai/exports/mock_${Date.now()}.${AI_CONFIG.export.defaultFormat}`;

            session.sendAction({
                endpoint: exportUrl,
                method: 'GET',
                label: `📥 Download ${AI_CONFIG.export.defaultFormat.toUpperCase()}`,
                description: `Export ${data.length} records as ${AI_CONFIG.export.defaultFormat.toUpperCase()}`,
            }, `Click to download your export file with ${data.length} records.`);

            // Show preview
            session.sendContent(`\n\n**Preview (first 5 rows):**\n\n`);
            await this.formatAsTable(session, data.slice(0, 5));
        } else {
            // Small dataset, show directly
            await this.formatAsTable(session, data);
        }

        return { type: 'export', dataCount: data.length };
    }

    /**
     * Handle READ operations - search, list, view
     */
    async handleReadOperation(session, message, intent) {
        session.sendStatus('📊 Generating database query...');
        sessionService.updateStatus(session.id, 'querying');

        // Generate query from natural language
        const query = await ai.generateQuery(message, null, {
            userId: session.userId,
            intent: intent,
        });

        session.sendStatus(`⚡ Executing query...`);

        // Execute the query
        const data = await this.executeQuery(query);

        // Format based on data size
        if (data.length === 0) {
            session.sendContent('No results found matching your criteria.');
            return { type: 'read', dataCount: 0 };
        }

        session.sendStatus(`📄 Found ${data.length} record(s)`);

        // Determine format based on size
        if (data.length <= AI_CONFIG.limits.tableThreshold) {
            // Small dataset: show table
            await this.formatAsTable(session, data);
        } else if (data.length <= AI_CONFIG.limits.summaryThreshold) {
            // Medium dataset: show summary
            session.sendContent(this.formatAsSummary(data));
            session.sendContent(`\n\n**Showing ${data.length} records. Would you like to see them in a table or export?**`);
        } else {
            // Large dataset: suggest export
            session.sendContent(`📊 **Found ${data.length} records**\n\n`);
            session.sendContent(`This dataset is quite large. Would you like to:\n`);
            session.sendContent(`- Export to ${AI_CONFIG.export.defaultFormat.toUpperCase()}\n`);
            session.sendContent(`- See a summary\n`);
            session.sendContent(`- Narrow down your search\n\n`);

            // Show preview
            session.sendContent(`**Preview (first 10 records):**\n\n`);
            await this.formatAsTable(session, data.slice(0, 1000));
        }

        // Store search results for potential follow-up
        session.conversation.context.last_search_results = {
            count: data.length,
            sample: data.slice(0, 5),
            timestamp: new Date(),
        };
        await session.conversation.save();

        console.log(322)
        return { type: 'read', dataCount: data.length };
    }

    /**
     * Execute MongoDB query (mock implementation for now)
     */
    async executeQuery(querySpec) {
        // Validate query safety
        const safetyCheck = safetyFilter.validateQuery(querySpec);
        if (!safetyCheck.valid) {
            throw new Error(`Unsafe query: ${safetyCheck.issues.join(', ')}`);
        }

        // Execute
        return await queryEngine.executeQuery(querySpec, this.userPermissions);
    }

    /**
     * Format data as summary
     */
    formatAsSummary(data) {
        if (!data || data.length === 0) return '_No data_';

        let summary = `**Summary (${data.length} records):**\n\n`;
        summary += `**Fields:** ${Object.keys(data[0]).join(', ')}\n\n`;
        summary += `**Sample:**\n\`\`\`json\n${JSON.stringify(data[0], null, 2)}\n\`\`\``;

        return summary;
    }

    /**
     * Format analysis results
     */
    formatAnalysisResults(analysis, data) {
        let result = `📈 **Analysis Results**\n\n`;

        if (analysis.insights && analysis.insights.length > 0) {
            result += `**Key Insights:**\n`;
            analysis.insights.forEach(insight => {
                result += `- ${insight}\n`;
            });
            result += `\n`;
        }

        if (analysis.recommendations && analysis.recommendations.length > 0) {
            result += `**Recommendations:**\n`;
            analysis.recommendations.forEach(rec => {
                result += `- ${rec}\n`;
            });
            result += `\n`;
        }

        if (analysis.patterns && analysis.patterns.length > 0) {
            result += `**Patterns Detected:**\n`;
            analysis.patterns.forEach(pattern => {
                result += `- ${pattern}\n`;
            });
        }

        return result;
    }

    /**
     * Build action description
     */
    buildActionDescription(action, intent) {
        if (intent.action === 'terminate') {
            return `⚠️ **Confirm Termination**\n\nThis action will permanently remove the student from the system. This cannot be undone.\n\n**Please review the details below before confirming.**`;
        }
        return action.description;
    }

    /**
     * Helper: Format header
     */
    formatHeader(header) {
        return header.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Helper: Format cell
     */
    formatCell(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).slice(0, 50);
        return String(value).slice(0, 100);
    }

    /**
     * Get mock users for testing
     */
    getMockUsers(query) {
        const users = [
            { _id: '1', first_name: 'Damilola', last_name: 'Michael', email: 'damilola.m@example.com', role: 'student', matricNo: 'CS2023/001', department: 'Computer Science' },
            { _id: '2', first_name: 'Brandon', last_name: 'Damilola', email: 'brandon.d@example.com', role: 'student', matricNo: 'ENG2023/045', department: 'Engineering' },
            { _id: '3', first_name: 'Daniel', last_name: 'Damilola', email: 'daniel.d@example.com', role: 'student', matricNo: 'BUS2023/023', department: 'Business Administration' },
            { _id: '4', first_name: 'John', last_name: 'Smith', email: 'john.s@example.com', role: 'lecturer', staffId: 'LEC2023/001', department: 'Computer Science' },
        ];

        // Apply mock filtering based on query
        let filtered = users;

        if (query.query?.role === 'student') {
            filtered = filtered.filter(u => u.role === 'student');
        }

        if (query.query?.department) {
            const deptRegex = new RegExp(query.query.department.$regex, 'i');
            filtered = filtered.filter(u => deptRegex.test(u.department));
        }

        return filtered.slice(0, query.limit || 100);
    }

    // Update executeQuery method
    async executeQuery2(querySpec) {
        // Validate query
        const validation = queryValidator.validate(querySpec);
        if (!validation.valid) {
            throw new Error(`Invalid query: ${validation.errors.join(', ')}`);
        }

        // Sanitize query
        const sanitized = queryValidator.sanitize(querySpec);

        // Apply user permissions
        // const userPermissions = await this.getUserPermissions(session.userId);
        const userPermissions = {}

        // Execute
        return await queryEngine.executeQuery(sanitized, userPermissions);
    }

    // Update formatting to use markdown formatter
    formatAsTable(session, data) {
        return markdownFormatter.streamTable(session, data);
    }

    formatAsSummary(data) {
        return markdownFormatter.formatAsSummary(data);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async extractEntities(message) {
        // Use AI to extract entities from message
        // For now, simple pattern matching
        const entities = {};

        // Extract name
        const nameMatch = message.match(/(?:student|user)\s+(\w+(?:\s+\w+)?)/i);
        if (nameMatch) entities.name = nameMatch[1];

        // Extract matric
        const matricMatch = message.match(/[A-Z]{2,3}\/\d{2}\/\d{3}/i);
        if (matricMatch) entities.matric = matricMatch[0];

        // Extract reason
        const reasonMatch = message.match(/reason:?\s*([^.!?]+)/i);
        if (reasonMatch) entities.reason = reasonMatch[1].trim();

        return entities;
    }
}

export default new AIOrchestrator();