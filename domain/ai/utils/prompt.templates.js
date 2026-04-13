// src/modules/ai/utils/prompt.templates.js

export const PromptTemplates = {
  /**
   * System prompt for the AI assistant
   */
  system: `You are an AI assistant for a university management system. Your role is to help users manage student records, lecturer information, and administrative tasks.

## Your Capabilities
- Search and query data from the database
- Analyze trends and patterns
- Generate reports and exports
- Help users perform administrative actions (with confirmation)

## Important Rules
1. Always confirm before destructive actions (delete, terminate)
2. If multiple matches found, ask for clarification
3. Never expose sensitive information (passwords, tokens)
4. Respect role-based permissions
5. Be concise but informative
6. Use markdown formatting for responses
7. Suggest next actions when appropriate

## Response Format
- Use tables for listing multiple items
- Use key-value format for single items
- Include action suggestions when relevant
- Use emojis sparingly for visual cues`,
  
  /**
   * Intent classification prompt
   */
  classifyIntent: (message, context) => `Classify the intent of this user message.

Message: "${message}"

Context: ${JSON.stringify(context)}

Return JSON with:
- type: "read" | "write" | "analysis" | "export"
- confidence: number between 0-1
- action: specific action (e.g., "terminate_student", "update_profile")
- entities: extracted entities (names, IDs, etc.)

Examples:
- "Show me all students in Computer Science" -> {"type": "read", "confidence": 0.95, "action": "list_students", "entities": {"department": "Computer Science"}}
- "Terminate student Daniel Damilola" -> {"type": "write", "confidence": 0.9, "action": "terminate_student", "entities": {"name": "Daniel Damilola"}}
- "Analyze student performance trends" -> {"type": "analysis", "confidence": 0.85, "action": "analyze_performance", "entities": {}}`,

  /**
   * Query generation prompt
   */
  generateQuery: (message, schema, context) => `Generate a MongoDB query for this request.

Request: "${message}"

Database Schema:
${JSON.stringify(schema, null, 2)}

User Context:
${JSON.stringify(context, null, 2)}

Return JSON with:
- collection: the collection to query
- operation: "find" | "aggregate" | "count" | "distinct"
- query: the query object (for find/count)
- pipeline: the aggregation pipeline (for aggregate)
- projection: fields to return
- sort: sort order
- limit: max documents to return

Rules:
- Always add reasonable limits
- Use indexes where possible
- Never include sensitive fields in projection
- Respect user permissions`,

  /**
   * Data analysis prompt
   */
  analyzeData: (data, question, context) => `Analyze this data to answer the user's question.

Question: "${question}"

Data Sample (first 10 records):
${JSON.stringify(data.slice(0, 10), null, 2)}

Total Records: ${data.length}

Context: ${JSON.stringify(context)}

Return JSON with:
- insights: array of key findings
- patterns: array of detected patterns
- recommendations: array of suggested actions
- needsMoreData: boolean (true if more data needed)
- nextQuery: suggested next query if needed

Be insightful but concise. Focus on actionable insights.`,

  /**
   * Action generation prompt
   */
  generateAction: (intent, entities, context) => `Generate an action from the user's intent.

Intent: ${JSON.stringify(intent)}
Entities: ${JSON.stringify(entities)}
Context: ${JSON.stringify(context)}

Return JSON with:
- endpoint: API endpoint path
- method: HTTP method
- payload: data to send
- label: human-readable action label
- description: detailed description of what will happen
- confirmation: { required: true, message: "confirmation text" }

If this is a destructive action, always require confirmation.
Make labels and descriptions clear and user-friendly.`,

  /**
   * Response formatting prompt
   */
  formatResponse: (data, format, context) => `Format this data for the user.

Data: ${JSON.stringify(data, null, 2)}
Format: ${format}
Context: ${JSON.stringify(context)}

Return markdown formatted response that is:
- Clear and readable
- Well-structured with headings
- Tables for tabular data
- Lists for multiple items
- Highlight important information

Use appropriate emojis for visual cues:
- 📊 for data/statistics
- 📈 for trends/analysis
- ⚠️ for warnings
- ✅ for successes
- ❌ for errors`,
};

export default PromptTemplates;