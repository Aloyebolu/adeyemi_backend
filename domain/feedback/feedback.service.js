import crypto from "crypto";
import Feedback from "./feedback.model.js";
import FeedbackResponse from "./feedback.response.model.js";
import FeedbackAnalytics from "./feedback.analytics.model.js";
import User from "../user/user.model.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import AppError from "../errors/AppError.js";
import natural from 'natural'; // For sentiment analysis (optional)
import FileUtils from "../files/file.utils.js";
import FileService from "../files/files.service.js";
import { resolveUserName } from "../../utils/resolveUserName.js";

const AUTO_REVIEW_INTERVAL = 5 * 60 * 1000; // 5 minutes
const ESCALATION_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
const FILE_UPLOAD_PATH = process.env.FEEDBACK_UPLOAD_PATH || 'uploads/feedback';
const SENTIMENT_ANALYSIS_ENABLED = process.env.SENTIMENT_ANALYSIS === 'true';

class FeedbackService {
    constructor() {
        this.reviewInterval = null;
        this.analyticsInterval = null;
        this.startAutoReview();
        this.startAnalyticsUpdate();

        // Ensure upload directory exists
        this.ensureUploadDirectory();

        // Initialize sentiment analyzer if enabled
        if (SENTIMENT_ANALYSIS_ENABLED) {
            this.sentimentAnalyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
            this.tokenizer = new natural.WordTokenizer();
        }
    }

    // Ensure upload directory exists
    ensureUploadDirectory() {
        const uploadDir = path.join(process.cwd(), FILE_UPLOAD_PATH);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
    }

    // Generate unique feedback ID
    generateFeedbackId() {
        return `fb_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    }

    // Generate unique response ID
    generateResponseId() {
        return `resp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    // Start auto-review process
    startAutoReview() {
        if (this.reviewInterval) {
            clearInterval(this.reviewInterval);
        }

        this.reviewInterval = setInterval(async () => {
            try {
                await this.autoReviewFeedback();
                await this.escalateStaleFeedback();
            } catch (error) {
                console.error("Auto-review error:", error);
            }
        }, AUTO_REVIEW_INTERVAL);

        console.log("Feedback auto-review started (5s interval)");
    }

    // Start analytics update
    startAnalyticsUpdate() {
        if (this.analyticsInterval) {
            clearInterval(this.analyticsInterval);
        }

        this.analyticsInterval = setInterval(async () => {
            try {
                await this.updateDailyAnalytics();
            } catch (error) {
                console.error("Analytics update error:", error);
            }
        }, 60 * 60 * 1000); // Every hour

        console.log("Feedback analytics update started (1 hour interval)");
    }

    // Stop all intervals
    stopAllIntervals() {
        if (this.reviewInterval) {
            clearInterval(this.reviewInterval);
            this.reviewInterval = null;
        }
        if (this.analyticsInterval) {
            clearInterval(this.analyticsInterval);
            this.analyticsInterval = null;
        }
        console.log("Feedback service intervals stopped");
    }

    // Create new feedback
    async createFeedback(feedbackData) {
        console.log(feedbackData)
        try {
            // Check for duplicate submissions (last 5 minutes)
            const duplicateCheck = await this.checkDuplicate(feedbackData);
            if (duplicateCheck) {
                return duplicateCheck;
            }

            const feedbackId = this.generateFeedbackId();

            const feedback = new Feedback({
                feedback_id: feedbackId,
                type: feedbackData.type,
                category: feedbackData.category || 'other',
                subject: feedbackData.subject,
                message: feedbackData.message,
                rating: feedbackData.rating,
                severity: feedbackData.severity,
                attachments: feedbackData.attachments,
                metadata: {
                    page_url: feedbackData.page_url,
                    browser: feedbackData.browser,
                    browser_version: feedbackData.browser_version,
                    os: feedbackData.os,
                    os_version: feedbackData.os_version,
                    device: feedbackData.device,
                    screen_resolution: feedbackData.screen_resolution,
                    app_version: feedbackData.app_version,
                    timestamp: new Date()
                }
            });

            // Set user if authenticated
            if (feedbackData.user_id) {
                feedback.user_id = feedbackData.user_id;
            } else {
                // Guest user
                feedback.guest_info = {
                    email: feedbackData.email,
                    name: feedbackData.name || 'Guest',
                    phone: feedbackData.phone,
                    ip_address: feedbackData.ip_address,
                    user_agent: feedbackData.user_agent
                };
            }

            // Link to chat session if provided
            if (feedbackData.chat_session_id) {
                feedback.related_chat_session = feedbackData.chat_session_id;
            }

            // Handle attachments
            if (feedbackData.attachments && feedbackData.attachments.length > 0) {
                feedback.attachments = feedbackData.attachments;
            }

            await feedback.save();

            // Perform sentiment analysis if enabled
            if (SENTIMENT_ANALYSIS_ENABLED) {
                this.analyzeSentiment(feedback._id).catch(err =>
                    console.error("Sentiment analysis error:", err)
                );
            }

            // Auto-assign based on type/category if configured
            await this.autoAssignFeedback(feedback._id);


            return feedback;
        } catch (error) {
            throw error;
        }
    }

    // Check for duplicate submissions
    async checkDuplicate(feedbackData) {
        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

            const query = {
                subject: feedbackData.subject,
                message: feedbackData.message,
                submitted_at: { $gte: fiveMinutesAgo }
            };

            if (feedbackData.user_id) {
                query.user_id = feedbackData.user_id;
            } else if (feedbackData.email) {
                query['guest_info.email'] = feedbackData.email;
            }

            const existing = await Feedback.findOne(query);
            return existing;
        } catch (error) {
            return null;
        }
    }

    // Auto-assign feedback to appropriate team member
    async autoAssignFeedback(feedbackId) {
        try {
            const feedback = await Feedback.findById(feedbackId);
            if (!feedback) return;

            // Determine assignment based on type/category
            let assignmentCriteria = {};

            switch (feedback.type) {
                case 'bug_report':
                    assignmentCriteria = { 'extra_roles': 'developer' };
                    break;
                case 'feature_request':
                    assignmentCriteria = { 'extra_roles': 'product_manager' };
                    break;
                case 'complaint':
                case 'praise':
                case 'question':
                    assignmentCriteria = { 'extra_roles': 'customer_service' };
                    break;
                default:
                    return; // No auto-assignment
            }

            // Find available team member with least assignments
            const availableStaff = await User.find(assignmentCriteria)
                .where('chat_availability').equals(true)
                .sort({ last_seen: -1 })
                .limit(5);

            if (availableStaff.length === 0) return;

            // Get current assignment counts
            const staffWithCounts = await Promise.all(
                availableStaff.map(async (staff) => {
                    const activeCount = await Feedback.countDocuments({
                        assigned_to: staff._id,
                        status: { $in: ['pending', 'reviewed', 'in_progress'] }
                    });

                    return {
                        staff,
                        activeCount
                    };
                })
            );

            // Assign to staff with least active items
            staffWithCounts.sort((a, b) => a.activeCount - b.activeCount);
            const assignTo = staffWithCounts[0].staff;

            feedback.assigned_to = assignTo._id;
            feedback.assigned_at = new Date();
            await feedback.save();


            return assignTo;
        } catch (error) {
            console.error("Auto-assign error:", error);
        }
    }

    // Auto-review feedback (mark as reviewed if pending for too long)
    async autoReviewFeedback() {
        try {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

            const pendingFeedback = await Feedback.find({
                status: 'pending',
                submitted_at: { $lt: twoHoursAgo }
            });

            for (const feedback of pendingFeedback) {
                feedback.status = 'reviewed';
                await feedback.save();

                console.log(`Feedback ${feedback.feedback_id} auto-reviewed after 2 hours`);
            }
        } catch (error) {
            console.error("Auto-review error:", error);
        }
    }

    // Escalate stale feedback
    async escalateStaleFeedback() {
        try {
            const escalationTime = new Date(Date.now() - ESCALATION_THRESHOLD);

            const staleFeedback = await Feedback.find({
                status: { $in: ['reviewed', 'in_progress'] },
                last_updated: { $lt: escalationTime },
                priority: { $ne: 'urgent' } // Don't escalate already urgent items
            });

            for (const feedback of staleFeedback) {
                // Increase priority
                const priorityOrder = ['low', 'medium', 'high', 'urgent'];
                const currentIndex = priorityOrder.indexOf(feedback.priority);

                if (currentIndex < priorityOrder.length - 1) {
                    feedback.priority = priorityOrder[currentIndex + 1];
                    await feedback.save();

                    // Add system note about escalation
                    await this.addResponse(feedback._id, {
                        user_id: null, // system
                        message: `Priority automatically escalated to ${feedback.priority} due to inactivity.`,
                        is_system_generated: true,
                        is_internal: true
                    });

                    console.log(`Feedback ${feedback.feedback_id} escalated to ${feedback.priority}`);
                }
            }
        } catch (error) {
            console.error("Escalation error:", error);
        }
    }

    // Add response to feedback
    async addResponse(feedbackId, responseData) {
        try {
            const responseId = this.generateResponseId();

            const response = new FeedbackResponse({
                response_id: responseId,
                feedback_id: feedbackId,
                user_id: responseData.user_id,
                message: responseData.message,
                is_internal: responseData.is_internal || false,
                is_system_generated: responseData.is_system_generated || false,
                attachments: responseData.attachments || [],
                metadata: {
                    ip_address: responseData.ip_address,
                    user_agent: responseData.user_agent
                }
            });

            await response.save();

            // Update feedback status if it's a staff response
            if (responseData.user_id && !responseData.is_internal) {
                await Feedback.findByIdAndUpdate(feedbackId, {
                    status: 'in_progress',
                    last_updated: new Date()
                });
            }

            return response;
        } catch (error) {
            throw new AppError(`Failed to add response: ${error.message}`);
        }
    }

    // Get feedback with responses
    async getFeedbackWithResponses(feedbackId) {
        try {
            const feedback = await Feedback.findById(feedbackId)
                .populate('user_id', 'first_name last_name middle_name email role')
                .populate('assigned_to', 'first_name last_name middle_name email')
                .populate('resolved_by', 'first_name last_name middle_name email')
                .populate('related_chat_session');

            if (!feedback) {
                throw new AppError('Feedback not found');
            }

            const responses = await FeedbackResponse.find({ feedback_id: feedbackId })
                .populate('user_id', 'namfirst_name last_name middle_name email role')
                .sort({ created_at: 1 });

            return {
                feedback:  {...feedback, user_id: {...feedback.user_id, name: resolveUserName(feedback.user_id)}},
                responses
            };
        } catch (error) {
            throw new AppError(`Failed to get feedback: ${error.message}`);
        }
    }

    // Update feedback status
    async updateStatus(feedbackId, status, userId, resolutionNotes = null) {
        try {
            const updateData = { status };

            if (status === 'resolved') {
                updateData.resolved_at = new Date();
                updateData.resolved_by = userId;
                updateData.resolution_notes = resolutionNotes;
            }

            const feedback = await Feedback.findByIdAndUpdate(
                feedbackId,
                updateData,
                { new: true }
            );

            // Add system response for resolution
            if (status === 'resolved') {
                await this.addResponse(feedbackId, {
                    user_id: userId,
                    message: resolutionNotes || 'Feedback marked as resolved.',
                    is_system_generated: true
                });
            }

            return feedback;
        } catch (error) {
            throw new AppError(`Failed to update status: ${error.message}`);
        }
    }

    // Analyze sentiment of feedback
    async analyzeSentiment(feedbackId) {
        try {
            const feedback = await Feedback.findById(feedbackId);
            if (!feedback) return;

            const text = `${feedback.subject} ${feedback.message}`.toLowerCase();
            const tokens = this.tokenizer.tokenize(text);

            // Simple sentiment scoring
            const score = this.sentimentAnalyzer.getSentiment(tokens);

            let sentiment = 'neutral';
            if (score > 0.2) sentiment = 'positive';
            else if (score < -0.2) sentiment = 'negative';

            feedback.analytics = {
                sentiment,
                sentiment_score: score,
                ai_processed: true,
                ai_processed_at: new Date()
            };

            await feedback.save();

            console.log(`Sentiment analysis for ${feedback.feedback_id}: ${sentiment} (${score})`);

            return sentiment;
        } catch (error) {
            console.error("Sentiment analysis error:", error);
        }
    }

    // Upload file handler
    // In feedback.service.js - replace the uploadFile method

    async uploadFile(file, userId, feedbackId = null) {
        try {
            // const FileUtils = new FileUtils();
            // const FileService = new FileService();
            if (!file) {
                throw new AppError("No file provided");
            }

            // Get upload options for feedback domain
            const uploadOptions = FileUtils.getUploadOptions('feedback');

            // Validate file using the file module's built-in validation
            // (this already checks size, mime type, etc.)
            FileUtils.validateFile(file, uploadOptions);

            // Upload using the centralized file service
            const uploadedFile = await FileService.uploadFile(
                file,                      // The file object
                userId,                   // Uploader ID
                'feedback',              // Domain
                feedbackId,             // Domain ID (can be null)
                {
                    category: 'feedback_attachment',
                    // isPublic: false,      // Keep feedback files private
                    accessRoles: ['admin', 'customer_service', 'feedback_manager'],
                    accessUsers: feedbackId ? [] : [], // Will be populated after feedback creation
                    tags: ['feedback', 'attachment'],
                    customMetadata: {
                        feedback_id: feedbackId,
                        originalName: file.name,
                        uploadedAt: new Date().toISOString()
                    }
                }
            );

            // Return in the format expected by your feedback service
            return {
                filename: uploadedFile.originalName,
                original_name: uploadedFile.originalName,
                url: uploadedFile.isPublic ? uploadedFile.url : null, // Don't expose private URL directly
                file_id: uploadedFile._id, // Store the file ID for later signed URL generation
                size: uploadedFile.size,
                mime_type: uploadedFile.type,
                uploaded_at: uploadedFile.createdAt,
                uploaded_by: uploadedFile.uploadedBy
            };

        } catch (error) {
            throw new AppError(`File upload failed: ${error.message}`);
        }
    }

    // Add a helper method to get accessible file URLs
    async getFileUrl(fileId, userId) {
        try {
            const file = await FileService.getFile(fileId);

            // Check if user has access
            const hasAccess =
                file.isPublic ||
                file.accessRoles.includes(userId.role) ||
                file.accessUsers.includes(userId) ||
                file.uploadedBy.toString() === userId.toString();

            if (!hasAccess) {
                throw new AppError('Access denied', 403);
            }

            // Return signed URL for private files
            if (!file.isPublic) {
                return await FileService.getSignedUrl(fileId, 3600); // 1 hour expiry
            }

            return file.url;
        } catch (error) {
            throw new AppError(`Failed to get file URL: ${error.message}`);
        }
    }

    // Add a method to get multiple file URLs for a feedback
    async getFeedbackFileUrls(feedbackId, userId) {
        try {
            const files = await FileService.getFiles({
                domain: 'feedback',
                domainId: feedbackId
            });

            const filesWithUrls = await Promise.all(
                files.data.map(async (file) => ({
                    ...file.toObject(),
                    accessUrl: await this.getFileUrl(file._id, userId)
                }))
            );

            return filesWithUrls;
        } catch (error) {
            throw new AppError(`Failed to get feedback files: ${error.message}`);
        }
    }

    // Add file cleanup when feedback is deleted
    async deleteFeedbackFiles(feedbackId) {
        try {
            const files = await FileService.getFiles({
                domain: 'feedback',
                domainId: feedbackId
            });

            await Promise.all(
                files.data.map(file => FileService.deleteFile(file._id))
            );

            return true;
        } catch (error) {
            throw new AppError(`Failed to delete feedback files`);
        }
    }

    // Get feedback statistics
    async getFeedbackStats(filters = {}) {
        try {
            const matchStage = {};

            if (filters.startDate || filters.endDate) {
                matchStage.submitted_at = {};
                if (filters.startDate) matchStage.submitted_at.$gte = new Date(filters.startDate);
                if (filters.endDate) matchStage.submitted_at.$lte = new Date(filters.endDate);
            }

            if (filters.type) matchStage.type = filters.type;
            if (filters.status) matchStage.status = filters.status;
            if (filters.category) matchStage.category = filters.category;

            const stats = await Feedback.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        avgRating: { $avg: '$rating' },
                        byStatus: {
                            $push: '$status'
                        },
                        byType: {
                            $push: '$type'
                        },
                        byPriority: {
                            $push: '$priority'
                        }
                    }
                },
                {
                    $project: {
                        total: 1,
                        avgRating: { $round: ['$avgRating', 2] },
                        statusBreakdown: {
                            pending: { $size: { $filter: { input: '$byStatus', cond: { $eq: ['$$this', 'pending'] } } } },
                            reviewed: { $size: { $filter: { input: '$byStatus', cond: { $eq: ['$$this', 'reviewed'] } } } },
                            in_progress: { $size: { $filter: { input: '$byStatus', cond: { $eq: ['$$this', 'in_progress'] } } } },
                            resolved: { $size: { $filter: { input: '$byStatus', cond: { $eq: ['$$this', 'resolved'] } } } },
                            rejected: { $size: { $filter: { input: '$byStatus', cond: { $eq: ['$$this', 'rejected'] } } } }
                        },
                        typeBreakdown: {
                            bug_report: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'bug_report'] } } } },
                            feature_request: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'feature_request'] } } } },
                            complaint: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'complaint'] } } } },
                            praise: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'praise'] } } } },
                            question: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'question'] } } } },
                            suggestion: { $size: { $filter: { input: '$byType', cond: { $eq: ['$$this', 'suggestion'] } } } }
                        },
                        priorityBreakdown: {
                            urgent: { $size: { $filter: { input: '$byPriority', cond: { $eq: ['$$this', 'urgent'] } } } },
                            high: { $size: { $filter: { input: '$byPriority', cond: { $eq: ['$$this', 'high'] } } } },
                            medium: { $size: { $filter: { input: '$byPriority', cond: { $eq: ['$$this', 'medium'] } } } },
                            low: { $size: { $filter: { input: '$byPriority', cond: { $eq: ['$$this', 'low'] } } } },
                            backlog: { $size: { $filter: { input: '$byPriority', cond: { $eq: ['$$this', 'backlog'] } } } }
                        }
                    }
                }
            ]);

            return stats[0] || {
                total: 0,
                avgRating: 0,
                statusBreakdown: {},
                typeBreakdown: {},
                priorityBreakdown: {}
            };
        } catch (error) {
            throw error;
        }
    }

    // Update daily analytics
    async updateDailyAnalytics() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const startOfDay = today;
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            // Get all feedback for today
            const feedbacks = await Feedback.find({
                submitted_at: { $gte: startOfDay, $lte: endOfDay }
            });

            // Initialize analytics object
            const analytics = {
                date: today,
                summary: {
                    total: feedbacks.length,
                    pending: 0,
                    reviewed: 0,
                    in_progress: 0,
                    resolved: 0,
                    rejected: 0
                },
                by_type: {},
                by_category: {},
                by_priority: {},
                by_severity: {},
                ratings: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
                performance: {
                    avg_response_time: 0,
                    avg_resolution_time: 0
                },
                sentiment: {
                    positive: 0,
                    negative: 0,
                    neutral: 0
                },
                user_engagement: {
                    registered_users: 0,
                    guest_users: 0
                },
                by_platform: {
                    web: 0,
                    mobile_ios: 0,
                    mobile_android: 0,
                    api: 0
                }
            };

            // Process each feedback
            let totalResponseTime = 0;
            let totalResolutionTime = 0;
            let responseTimeCount = 0;
            let resolutionTimeCount = 0;

            for (const fb of feedbacks) {
                // Count by status
                analytics.summary[fb.status] = (analytics.summary[fb.status] || 0) + 1;

                // Count by type
                analytics.by_type[fb.type] = (analytics.by_type[fb.type] || 0) + 1;

                // Count by category
                analytics.by_category[fb.category] = (analytics.by_category[fb.category] || 0) + 1;

                // Count by priority
                analytics.by_priority[fb.priority] = (analytics.by_priority[fb.priority] || 0) + 1;

                // Count by severity (if exists)
                if (fb.severity) {
                    analytics.by_severity[fb.severity] = (analytics.by_severity[fb.severity] || 0) + 1;
                }

                // Count ratings
                if (fb.rating) {
                    analytics.ratings[fb.rating.toString()] = (analytics.ratings[fb.rating.toString()] || 0) + 1;
                }

                // Count sentiment
                if (fb.analytics && fb.analytics.sentiment) {
                    analytics.sentiment[fb.analytics.sentiment] = (analytics.sentiment[fb.analytics.sentiment] || 0) + 1;
                }

                // User engagement
                if (fb.user_id) {
                    analytics.user_engagement.registered_users++;
                } else {
                    analytics.user_engagement.guest_users++;
                }

                // Platform
                const ua = fb.metadata?.browser || '';
                if (ua.includes('Mobile')) {
                    if (ua.includes('iOS')) analytics.by_platform.mobile_ios++;
                    else if (ua.includes('Android')) analytics.by_platform.mobile_android++;
                } else if (fb.metadata?.page_url) {
                    analytics.by_platform.web++;
                }

                // Calculate response times
                const responses = await FeedbackResponse.find({
                    feedback_id: fb._id,
                    is_system_generated: false
                }).sort({ created_at: 1 });

                if (responses.length > 0) {
                    const firstResponse = responses[0];
                    const responseTime = firstResponse.created_at - fb.submitted_at;
                    totalResponseTime += responseTime;
                    responseTimeCount++;
                }

                // Calculate resolution time
                if (fb.resolved_at) {
                    const resolutionTime = fb.resolved_at - fb.submitted_at;
                    totalResolutionTime += resolutionTime;
                    resolutionTimeCount++;
                }
            }

            // Calculate averages
            if (responseTimeCount > 0) {
                analytics.performance.avg_response_time = totalResponseTime / responseTimeCount;
            }

            if (resolutionTimeCount > 0) {
                analytics.performance.avg_resolution_time = totalResolutionTime / resolutionTimeCount;
            }

            // Update or create analytics document
            await FeedbackAnalytics.findOneAndUpdate(
                { date: today },
                analytics,
                { upsert: true, new: true }
            );

            console.log(`Daily analytics updated for ${today.toDateString()}`);
        } catch (error) {
            console.error("Error updating daily analytics:", error);
        }
    }

    // Search feedback
    async searchFeedback(query, filters = {}, page = 1, limit = 20) {
        try {
            const searchQuery = {};

            // Text search
            if (query) {
                searchQuery.$or = [
                    { subject: { $regex: query, $options: 'i' } },
                    { message: { $regex: query, $options: 'i' } }
                ];
            }

            // Apply filters
            if (filters.type) searchQuery.type = filters.type;
            if (filters.status) searchQuery.status = filters.status;
            if (filters.priority) searchQuery.priority = filters.priority;
            if (filters.category) searchQuery.category = filters.category;
            if (filters.severity) searchQuery.severity = filters.severity;

            if (filters.startDate || filters.endDate) {
                searchQuery.submitted_at = {};
                if (filters.startDate) searchQuery.submitted_at.$gte = new Date(filters.startDate);
                if (filters.endDate) searchQuery.submitted_at.$lte = new Date(filters.endDate);
            }

            if (filters.assigned_to) {
                searchQuery.assigned_to = filters.assigned_to;
            }

            if (filters.user_id) {
                searchQuery.user_id = filters.user_id;
            }

            if (filters.email) {
                searchQuery['guest_info.email'] = filters.email;
            }

            // Execute search with pagination
            const skip = (page - 1) * limit;

            const [feedbacks, total] = await Promise.all([
                Feedback.find(searchQuery)
                    .populate('user_id', 'name email')
                    .populate('assigned_to', 'name email')
                    .sort({ priority: -1, submitted_at: -1 })
                    .skip(skip)
                    .limit(limit),
                Feedback.countDocuments(searchQuery)
            ]);

            return {
                feedbacks,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            throw new AppError(`Search failed: ${error.message}`);
        }
    }

    // Export feedback data
    async exportFeedback(filters = {}, format = 'json') {
        try {
            const query = {};

            if (filters.startDate || filters.endDate) {
                query.submitted_at = {};
                if (filters.startDate) query.submitted_at.$gte = new Date(filters.startDate);
                if (filters.endDate) query.submitted_at.$lte = new Date(filters.endDate);
            }

            if (filters.type) query.type = filters.type;
            if (filters.status) query.status = filters.status;

            const feedbacks = await Feedback.find(query)
                .populate('user_id', 'name email')
                .populate('assigned_to', 'name email')
                .lean();

            if (format === 'csv') {
                // Convert to CSV format
                const csv = this.convertToCSV(feedbacks);
                return { data: csv, format: 'csv' };
            }

            return { data: feedbacks, format: 'json' };
        } catch (error) {
            throw new AppError(`Export failed: ${error.message}`);
        }
    }

    // Convert to CSV helper
    convertToCSV(feedbacks) {
        if (feedbacks.length === 0) return '';

        const headers = [
            'ID', 'Type', 'Category', 'Subject', 'Message', 'Rating',
            'Status', 'Priority', 'Severity', 'Submitted At', 'User',
            'Email', 'Browser', 'OS', 'Device'
        ];

        const rows = feedbacks.map(fb => [
            fb.feedback_id,
            fb.type,
            fb.category,
            fb.subject,
            fb.message.replace(/,/g, ';'), // Remove commas for CSV
            fb.rating || '',
            fb.status,
            fb.priority,
            fb.severity || '',
            fb.submitted_at.toISOString(),
            fb.user_id?.name || fb.guest_info?.name || 'Guest',
            fb.user_id?.email || fb.guest_info?.email || '',
            fb.metadata?.browser || '',
            fb.metadata?.os || '',
            fb.metadata?.device || ''
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
}

// Export singleton instance
const feedbackService = new FeedbackService();
export default feedbackService;