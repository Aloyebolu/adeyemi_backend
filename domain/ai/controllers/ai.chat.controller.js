// src/modules/ai/controllers/ai.chat.controller.js

import { v4 as uuidv4 } from 'uuid';
import orchestrator from '#domain/ai/services/ai.orchestrator.service.js';
import catchAsync from '#utils/catchAsync.js';

/**
 * Stream chat response via Server-Sent Events
 * POST /api/ai/chat/stream
 */
export const streamChat = catchAsync(async (req, res) => {
  const { message, conversation_id } = req.body;
  const userId = req.user._id;
  
  // Validate input
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message is required',
    });
  }
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Generate conversation ID if not provided
  const conversationId = conversation_id ;
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`Client disconnected from conversation ${conversationId}`);
    // Note: Session cleanup will happen via timeout
  });
  
  try {
    // Process message with orchestrator
    await orchestrator.processMessage(
      userId,
      message.trim(),
      conversationId,
      res
    );
  } catch (error) {
    console.error('Stream chat error:', error);
    
    // Send error via SSE
    res.write(`data: ${JSON.stringify({
      type: 'error',
      text: `❌ ${error.message || 'An unexpected error occurred'}`,
      timestamp: new Date().toISOString(),
    })}\n\n`);
    
    res.write('event: end\ndata: [DONE]\n\n');
    res.end();
  }
});

/**
 * Non-streaming chat endpoint (for simple requests)
 * POST /api/ai/chat
 */
export const chat = catchAsync(async (req, res) => {
  const { message, conversation_id } = req.body;
  const userId = req.user._id;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'Message is required',
    });
  }
  
  // For non-streaming, we'll collect all chunks and return at once
  const chunks = [];
  
  const mockStream = {
    write: (data) => {
      const parsed = JSON.parse(data.replace('data: ', '').trim());
      if (parsed.type === 'content') {
        chunks.push(parsed.text);
      }
    },
    end: () => {},
  };
  
  await orchestrator.processMessage(
    userId,
    message,
    conversation_id ,
    mockStream
  );
  
  const fullResponse = chunks.join('');
  
  res.json({
    success: true,
    data: {
      message: fullResponse,
      conversation_id: conversation_id,
    },
  });
});

/**
 * Get conversation history
 * GET /api/ai/conversations
 */
export const getConversations = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { limit = 20, offset = 0 } = req.query;
  
  const Conversation = (await import('../models/conversation.model.js')).default;
  
  const conversations = await Conversation.find({ user_id: userId })
    .sort({ updated_at: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .select('_id title message_count last_activity created_at');
  
  const total = await Conversation.countDocuments({ user_id: userId });
  
  res.json({
    success: true,
    data: {
      conversations,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total,
        has_more: offset + limit < total,
      },
    },
  });
});

/**
 * Get single conversation
 * GET /api/ai/conversations/:id
 */
export const getConversation = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;
  
  const Conversation = (await import('../models/conversation.model.js')).default;
  
  const conversation = await Conversation.findOne({
    _id: id,
    user_id: userId,
  });
  
  if (!conversation) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found',
    });
  }
  
  res.json({
    success: true,
    data: { conversation },
  });
});

/**
 * Delete conversation
 * DELETE /api/ai/conversations/:id
 */
export const deleteConversation = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;
  
  const Conversation = (await import('../models/conversation.model.js')).default;
  
  const result = await Conversation.deleteOne({
    _id: id,
    user_id: userId,
  });
  
  if (result.deletedCount === 0) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found',
    });
  }
  
  res.json({
    success: true,
    message: 'Conversation deleted successfully',
  });
});