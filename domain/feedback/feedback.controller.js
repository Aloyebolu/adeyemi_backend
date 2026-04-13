import buildResponse from "../../utils/responseBuilder.js";
import Feedback from "./feedback.model.js";
import FeedbackResponse from "./feedback.response.model.js";
import feedbackService from "./feedback.service.js";
import User from "../user/user.model.js";
import AppError from "../errors/AppError.js";
import { resolveUserName } from "../../utils/resolveUserName.js";

export const feedbackController = {

    // Submit new feedback
    submitFeedback: async (req, res, next) => {
        try {
            const feedbackData = {
                ...req.body,
                user_id: req.user?._id,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Handle attachments if any
            if (req.files && req.files.attachments) {
                const files = Array.isArray(req.files.attachments)
                    ? req.files.attachments
                    : [req.files.attachments];

                const attachments = [];
                for (const file of files) {
                    const fileInfo = await feedbackService.uploadFile(file, req.user?._id);
                    attachments.push(fileInfo);
                }
                feedbackData.attachments = attachments;
            }

            const feedback = await feedbackService.createFeedback(feedbackData);

            buildResponse.success(res, "Feedback submitted successfully", feedback, 201);
        } catch (error) {
            next(error)
        }
    },

    // Get user's own feedback
    getMyFeedback: async (req, res) => {
        try {
            const { page = 1, limit = 20, status, type } = req.query;

            const query = {};

            if (req.user) {
                query.user_id = req.user._id;
            } else if (req.query.email) {
                query['guest_info.email'] = req.query.email;
            } else {
                return buildResponse.error(res, "User identification required", 400);
            }

            if (status) query.status = status;
            if (type) query.type = type;

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [feedbacks, total] = await Promise.all([
                Feedback.find(query)
                    .populate('assigned_to', 'name email')
                    .populate('resolved_by', 'name email')
                    .sort({ submitted_at: -1 })
                    .skip(skip)
                    .limit(parseInt(limit)),
                Feedback.countDocuments(query)
            ]);

            buildResponse.success(res, "Feedback retrieved successfully", {
                feedbacks,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            }, 200);
        } catch (error) {
            throw error
        }
    },

    // Get single feedback with responses
    getFeedback: async (req, res) => {
        try {
            const { id } = req.params;

            const result = await feedbackService.getFeedbackWithResponses(id);

            // Check permissions
            if (!req.user?.extra_roles?.includes('admin') &&
                !req.user?.extra_roles?.includes('customer_service') &&
                result.feedback.user_id?.toString() !== req.user?._id?.toString() &&
                result.feedback.guest_info?.email !== req.query.email) {
                return buildResponse.error(res, "Unauthorized to view this feedback", 403);
            }

            buildResponse.success(res, "Feedback retrieved successfully", result, 200);
        } catch (error) {
            throw error;
        }
    },

    // Add response to feedback
    // In feedback.service.js - update addResponse method

    async addResponse(feedbackId, responseData) {
        try {
            const responseId = this.generateResponseId();

            // Handle file attachments if they exist
            let attachments = responseData.attachments || [];

            // If there are new files uploaded with this response
            if (responseData.files && responseData.files.length > 0) {
                const uploadedFiles = await Promise.all(
                    responseData.files.map(async (file) => {
                        const uploadedFile = await this.uploadFile(
                            file,
                            responseData.user_id,
                            feedbackId
                        );
                        return {
                            filename: uploadedFile.original_name,
                            url: null, // Don't store direct URL for private files
                            file_id: uploadedFile.file_id,
                            size: uploadedFile.size,
                            mime_type: uploadedFile.mime_type
                        };
                    })
                );
                attachments = [...attachments, ...uploadedFiles];
            }

            const response = new FeedbackResponse({
                response_id: responseId,
                feedback_id: feedbackId,
                user_id: responseData.user_id,
                message: responseData.message,
                is_internal: responseData.is_internal || false,
                is_system_generated: responseData.is_system_generated || false,
                attachments,
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
            throw error
        }
    },

    // Update feedback status (staff only)
    updateStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, resolution_notes } = req.body;

            if (!status) {
                return buildResponse.error(res, "Status is required", 400);
            }

            const feedback = await feedbackService.updateStatus(
                id,
                status,
                req.user._id,
                resolution_notes
            );

            buildResponse.success(res, "Status updated successfully", feedback, 200);
        } catch (error) {
            throw error
        }
    },

    // Assign feedback to staff (admin only)
    assignFeedback: async (req, res) => {
        try {
            const { id } = req.params;
            const { user_id } = req.body;

            if (!user_id) {
                return buildResponse.error(res, "User ID is required", 400);
            }

            const feedback = await Feedback.findByIdAndUpdate(
                id,
                {
                    assigned_to: user_id,
                    assigned_at: new Date(),
                    status: 'reviewed'
                },
                { new: true }
            ).populate('assigned_to', 'name email');

            // Add system response
            await feedbackService.addResponse(id, {
                user_id: req.user._id,
                message: `Assigned to ${feedback.assigned_to.name}`,
                is_internal: true,
                is_system_generated: true
            });

            buildResponse.success(res, "Feedback assigned successfully", feedback, 200);
        } catch (error) {
            throw error
        }
    },

    // Staff: Get all feedback with filters
    getAllFeedback: async (req, res, next) => {
        try {
            const {
                page = 1,
                limit = 20,
                status,
                type,
                priority,
                category,
                severity,
                assigned_to,
                startDate,
                endDate,
                search
            } = req.query;

            let result;

            if (search) {
                // Use search endpoint for text search
                result = await feedbackService.searchFeedback(
                    search,
                    { status, type, priority, category, severity, assigned_to, startDate, endDate },
                    parseInt(page),
                    parseInt(limit)
                );
            } else {
                // Regular filtered query
                const query = {};

                if (status) query.status = status;
                if (type) query.type = type;
                if (priority) query.priority = priority;
                if (category) query.category = category;
                if (severity) query.severity = severity;
                if (assigned_to) query.assigned_to = assigned_to;

                if (startDate || endDate) {
                    query.submitted_at = {};
                    if (startDate) query.submitted_at.$gte = new Date(startDate);
                    if (endDate) query.submitted_at.$lte = new Date(endDate);
                }

                const skip = (parseInt(page) - 1) * parseInt(limit);

                const [feedbacks, total] = await Promise.all([
                    Feedback.find(query)
                        .populate('user_id', 'first_name last_name middle_name email')
                        .populate('assigned_to', 'first_name last_name middle_name email')
                        .populate('resolved_by', 'first_name last_name middle_name email')
                        .sort({ priority: -1, submitted_at: -1 })
                        .skip(skip)
                        .limit(parseInt(limit)).lean(),
                    Feedback.countDocuments(query)
                ]);
                const feedbacksWithNames = feedbacks.map(feedback => {
                    const userName = `${feedback.user_id.first_name} ${feedback.user_id.last_name}`;
                    return { ...feedback, user_id: { ...feedback.user_id, name: userName } };
                });

                result = {
                    feedbacks:feedbacksWithNames,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / parseInt(limit))
                    }
                };
            }

            buildResponse.success(res, "Feedback retrieved successfully", result, 200);
        } catch (error) {
            next(error)
        }
    },

    // Get feedback statistics
    getStats: async (req, res) => {
        try {
            const { startDate, endDate, type, status, category } = req.query;

            const stats = await feedbackService.getFeedbackStats({
                startDate,
                endDate,
                type,
                status,
                category
            });

            buildResponse.success(res, "Statistics retrieved successfully", stats, 200);
        } catch (error) {
            throw error
        }
    },

    // Get daily analytics
    getDailyAnalytics: async (req, res) => {
        try {
            const { days = 30 } = req.query;

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(days));

            const analytics = await FeedbackAnalytics.find({
                date: { $gte: startDate }
            }).sort({ date: 1 });

            buildResponse.success(res, "Analytics retrieved successfully", analytics, 200);
        } catch (error) {
            throw error
        }
    },

    // Export feedback data
    exportFeedback: async (req, res) => {
        try {
            const { format = 'json', startDate, endDate, type, status } = req.query;

            const result = await feedbackService.exportFeedback(
                { startDate, endDate, type, status },
                format
            );

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=feedback-export.csv');
                return res.send(result.data);
            }

            buildResponse.success(res, "Export data retrieved successfully", result.data, 200);
        } catch (error) {
            throw error
        }
    },

    // Upload file (standalone)
    uploadFile: async (req, res) => {
        try {
            if (!req.files || !req.files.file) {
                return buildResponse.error(res, "No file uploadedd", 400);
            }

            const fileInfo = await feedbackService.uploadFile(
                req.files.file,
                req.user?._id,
                req.body.feedbackId // Optional: link to specific feedback
            );

            buildResponse.success(res, "File uploaded successfully", fileInfo, 200);
        } catch (error) {
            throw error
        }
    },

    // Get available staff for assignment (admin only)
    getAvailableStaff: async (req, res) => {
        try {
            const staff = await User.find({
                $or: [
                    { extra_roles: 'customer_service' },
                    { extra_roles: 'admin' },
                    { extra_roles: 'developer' },
                    { extra_roles: 'product_manager' }
                ]
            })
                .select('name email role extra_roles last_seen')
                .sort({ last_seen: -1 });

            // Get current assignment counts
            const staffWithCounts = await Promise.all(
                staff.map(async (user) => {
                    const activeCount = await Feedback.countDocuments({
                        assigned_to: user._id,
                        status: { $in: ['pending', 'reviewed', 'in_progress'] }
                    });

                    return {
                        ...user.toObject(),
                        active_feedback_count: activeCount
                    };
                })
            );

            buildResponse.success(res, "Staff retrieved successfully", staffWithCounts, 200);
        } catch (error) {
            throw error
        }
    },

    // Delete feedback (admin only)
    deleteFeedback: async (req, res) => {
        try {
            const { id } = req.params;

            // Delete all responses first
            await FeedbackResponse.deleteMany({ feedback_id: id });

            // Delete feedback
            await Feedback.findByIdAndDelete(id);

            buildResponse.success(res, "Feedback deleted successfully", null, 200);
        } catch (error) {
            throw error
        }
    },

    getFeedback: async (req, res) => {
        try {
            const { id } = req.params;

            const result = await feedbackService.getFeedbackWithResponses(id);

            // Check permissions
            if (!req.user?.extra_roles?.includes('admin') &&
                !req.user?.extra_roles?.includes('customer_service') &&
                !req.user?.extra_roles?.includes('feedback_manager') &&
                result.feedback.user_id?.toString() !== req.user?._id?.toString() &&
                result.feedback.guest_info?.email !== req.query.email) {
                return buildResponse.error(res, "Unauthorized to view this feedback", 403);
            }

            // Get accessible URLs for feedback attachments
            if (result.feedback.attachments?.length > 0) {
                const filesWithUrls = await Promise.all(
                    result.feedback.attachments.map(async (att) => {
                        if (att.file_id) {
                            try {
                                const url = await feedbackService.getFileUrl(att.file_id, req.user);
                                return { ...att, accessUrl: url };
                            } catch (error) {
                                return att; // Return original if can't get signed URL
                            }
                        }
                        return att;
                    })
                );
                result.feedback.attachments = filesWithUrls;
            }

            // Get URLs for response attachments
            if (result.responses) {
                for (const response of result.responses) {
                    if (response.attachments?.length > 0) {
                        const filesWithUrls = await Promise.all(
                            response.attachments.map(async (att) => {
                                if (att.file_id) {
                                    try {
                                        const url = await feedbackService.getFileUrl(att.file_id, req.user);
                                        return { ...att, accessUrl: url };
                                    } catch (error) {
                                        return att;
                                    }
                                }
                                return att;
                            })
                        );
                        response.attachments = filesWithUrls;
                    }
                }
            }

            buildResponse.success(res, "Feedback retrieved successfully", result, 200);
        } catch (error) {
            throw error
        }
    },
};