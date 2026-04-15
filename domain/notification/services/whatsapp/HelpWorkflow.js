import feedbackService from "../../../feedback/feedback.service.js";
import faqService from "../../../support/faq/faq.service.js";

class HelpWorkflow {
    constructor() {
        this.CATEGORIES = {
            ACADEMIC: 'academic',
            TECHNICAL: 'technical',
            BILLING: 'billing',
            REGISTRATION: 'registration',
            GENERAL: 'general'
        };

        this.FEEDBACK_TYPES = {
            BUG_REPORT: 'bug_report',
            FEATURE_REQUEST: 'feature_request',
            COMPLAINT: 'complaint',
            PRAISE: 'praise',
            QUESTION: 'question',
            SUGGESTION: 'suggestion'
        };

        this.URGENCY_LEVELS = {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical'
        };

        this.STATUS = {
            PENDING: 'pending',
            REVIEWED: 'reviewed',
            IN_PROGRESS: 'in_progress',
            RESOLVED: 'resolved',
            REJECTED: 'rejected'
        };
    }

    /**
     * Main entry point for the workflow
     */
    async execute(context) {
        try {
            // Check if user has open feedback feedbacks
            const openFeedback = await this.getUserOpenFeedback(context.userContext._id);

            if (!context.conversationState.helpSelection) {
                return this.initiateHelp(openFeedback);
            }

            const { category, type, message, urgency } = context.conversationState.helpSelection;

            // Create feedback feedback using the existing feedback service
            const feedback = await this.createFeedbackTicket(
                context.userContext,
                category,
                type,
                message,
                urgency
            );

            return this.completeHelpRequest(feedback);
        } catch (error) {
            return this.handleError(error);
        }
    }

    /**
     * Process each step of the workflow
     */
    async processStep(context) {
        const { step, userResponse, collectedData, userContext } = context;

        switch (step) {
            case 'select_category':
                return await this.processCategorySelection(userResponse, collectedData, userContext);

            case 'select_type':
                return await this.processTypeSelection(userResponse, collectedData, userContext);

            case 'describe_issue':
                return await this.processIssueDescription(userResponse, collectedData, userContext);

            case 'set_urgency':
                return this.processUrgencySelection(userResponse, collectedData, userContext);

            case 'search_faq':
                return await this.processFAQSearch(userResponse, collectedData, userContext);

            case 'select_faq':
                return await this.processFAQSelection(userResponse, collectedData, userContext);

            case 'faq_resolution':  // NEW CASE
                return await this.processFAQResolution(userResponse, collectedData, userContext);

            case 'confirm_ticket':
                return this.processConfirmation(userResponse, collectedData, userContext);

            default:
                return this.unknownStepResponse();
        }
    }
    /**
     * Initialize help process
     */
    initiateHelp(openFeedback) {
        // If user has open feedback, notify them
        if (openFeedback && openFeedback.length > 0) {
            return {
                requiresMoreInfo: true,
                nextStep: 'select_category',
                collectedData: { openFeedback },
                prompt: this.buildExistingFeedbackPrompt(openFeedback)
            };
        }

        return {
            requiresMoreInfo: true,
            nextStep: 'select_category',
            collectedData: {},
            prompt: this.buildCategoryPrompt()
        };
    }

    /**
 * Process FAQ resolution feedback
 */
    async processFAQResolution(userResponse, collectedData, userContext) {
        const answer = userResponse.toLowerCase().trim();

        // Handle YES response - FAQ resolved the issue
        if (answer === 'yes' || answer === 'y') {
            try {
                // Update FAQ with helpful count
                await faqService.updateHelpfulCount(collectedData.selectedFaq._id, true);

                // Record resolution in analytics (optional)
                await this.recordFAQResolution(collectedData.selectedFaq, userContext, true);

                return {
                    completed: true,
                    message: this.buildFAQResolutionSuccess(collectedData.selectedFaq)
                };
            } catch (error) {
                console.error('Failed to update FAQ stats:', error);
                return {
                    completed: true,
                    message: this.buildFAQResolutionSuccess(collectedData.selectedFaq) // Still show success even if stats update fails
                };
            }
        }

        // Handle NO response - FAQ didn't resolve, proceed to feedback creation
        if (answer === 'no' || answer === 'n') {
            return {
                completed: false,
                message: this.buildTypePrompt(collectedData.category),
                nextStep: 'select_type',
                collectedData: {
                    ...collectedData,
                    faq_not_helpful: true,
                    attempted_faq_id: collectedData.selectedFaq._id
                }
            };
        }

        // Handle invalid response
        return {
            completed: false,
            message: "❌ *Invalid Response*\n\nPlease reply with *YES* if this resolved your issue, or *NO* to create a support ticket.\n\n" +
                "━━━━━━━━━━━━━━━━\n\n" +
                "📖 *FAQ Answer Recap:*\n" +
                `*Q: ${collectedData.selectedFaq.question}*\n\n` +
                `*A: ${collectedData.selectedFaq.answer}*\n\n` +
                "━━━━━━━━━━━━━━━━\n\n" +
                "Did this answer your question?",
            nextStep: 'faq_resolution',
            collectedData
        };
    }

    /**
 * Record FAQ resolution for analytics
 */
    async recordFAQResolution(faq, userContext, wasHelpful) {
        try {
            // Create analytics record (you'll need to implement this based on your analytics service)
            const resolutionData = {
                faq_id: faq._id,
                faq_question: faq.question,
                user_id: userContext._id,
                was_helpful: wasHelpful,
                timestamp: new Date(),
                category: faq.category,
                source: 'chatbot_workflow'
            };

            // Store in database or analytics service
            // await analyticsService.trackFAQResolution(resolutionData);

            // Optional: Update user session data
            if (userContext.session) {
                userContext.session.last_faq_helpful = wasHelpful;
                userContext.session.last_faq_id = faq._id;
            }

            return resolutionData;
        } catch (error) {
            console.error('Failed to record FAQ resolution:', error);
            // Don't throw error - this is non-critical
        }
    }

    /**
     * Build FAQ resolution success message
     */
    buildFAQResolutionSuccess(faq) {
        let message = "🎉 *PROBLEM RESOLVED!*\n━━━━━━━━━━━━━━━━\n\n";
        message += "Great news! We're glad the FAQ helped resolve your issue.\n\n";
        message += `✅ *FAQ:* ${faq.question}\n\n`;
        message += "💡 *Pro Tips:*\n";
        message += "• Save this FAQ for future reference\n";
        message += "• Check our knowledge base for more solutions\n";
        message += "• Rate other FAQs to help fellow students\n\n";
        message += "📚 *Browse More FAQs:*\n";
        message += `${process.env.FRONTEND_URL}/support/faq\n\n`;
        message += "Need further assistance? Just type *HELP* anytime!\n\n";
        message += "✨ *Thank you for using our support system!*";

        return message;
    }

    /**
     * Process category selection
     */
    async processCategorySelection(userResponse, collectedData, userContext) {
        const category = userResponse.toLowerCase().trim();

        // Validate category
        const validCategories = Object.values(this.CATEGORIES);
        if (!validCategories.includes(category)) {
            return {
                completed: false,
                message: this.buildInvalidCategoryMessage(validCategories),
                nextStep: 'select_category',
                collectedData
            };
        }

        // Check if there are FAQs for this category
        try {
            const result = await faqService.getFAQsByCategory(category);
            const faqs = result.faqs || [];

            if (faqs && faqs.length > 0) {
                return {
                    completed: false,
                    message: this.buildFAQOfferPrompt(category, faqs),
                    nextStep: 'search_faq',
                    collectedData: { ...collectedData, category, faqs }
                };
            }
        } catch (error) {
            // FAQ service not available yet, skip to type selection
            console.log('FAQ service not available or no FAQs found:', error.message);
        }

        return {
            completed: false,
            message: this.buildTypePrompt(category),
            nextStep: 'select_type',
            collectedData: { ...collectedData, category }
        };
    }

    /**
     * Process type selection
     */
    async processTypeSelection(userResponse, collectedData, userContext) {
        const type = userResponse.toLowerCase().trim().replace(/\s+/g, '_');
        console.log({ type })
        // Validate type
        const validTypes = Object.values(this.FEEDBACK_TYPES).map(type => type.replace(/_/g, ''));
        if (!validTypes.includes(type)) {
            return {
                completed: false,
                message: this.buildInvalidTypeMessage(validTypes),
                nextStep: 'select_type',
                collectedData
            };
        }

        return {
            completed: false,
            message: this.buildIssueDescriptionPrompt(collectedData.category, type),
            nextStep: 'describe_issue',
            collectedData: { ...collectedData, type }
        };
    }

    /**
     * Process FAQ search
     */
    async processFAQSearch(userResponse, collectedData, userContext) {
        const answer = userResponse.toLowerCase().trim();

        if (answer === 'yes' || answer === 'y') {
            // Show FAQs for selection
            return {
                completed: false,
                message: this.buildFAQListPrompt(collectedData.faqs),
                nextStep: 'select_faq',
                collectedData
            };
        }

        if (answer === 'no' || answer === 'n') {
            return {
                completed: false,
                message: this.buildTypePrompt(collectedData.category),
                nextStep: 'select_type',
                collectedData
            };
        }

        return {
            completed: false,
            message: "Please reply with *YES* to see FAQs or *NO* to continue with your request.",
            nextStep: 'search_faq',
            collectedData
        };
    }

    /**
     * Process FAQ selection
     */
    async processFAQSelection(userResponse, collectedData, userContext) {
        const selectedIndex = parseInt(userResponse) - 1;

        if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= collectedData.faqs.length) {
            return {
                completed: false,
                message: "❌ *Invalid selection*\n\nPlease enter a valid number from the list.",
                nextStep: 'select_faq',
                collectedData
            };
        }

        const selectedFaq = collectedData.faqs[selectedIndex];

        // Increment view count for the FAQ
        await faqService.getFAQ(selectedFaq._id, true);

        // Ask if this resolved their issue - THIS GOES TO faq_resolution STEP
        return {
            completed: false,
            message: this.buildFAQResolutionPrompt(selectedFaq),
            nextStep: 'faq_resolution',  // Make sure this is set correctly
            collectedData: { ...collectedData, selectedFaq }
        };
    }

    /**
     * Process issue description
     */
    async processIssueDescription(userResponse, collectedData, userContext) {
        if (!userResponse || userResponse.length < 10) {
            return {
                completed: false,
                message: "⚠️ *Please provide more details*\n\nPlease describe your issue in at least 10 characters so we can better assist you.",
                nextStep: 'describe_issue',
                collectedData
            };
        }

        return {
            completed: false,
            message: this.buildUrgencyPrompt(),
            nextStep: 'set_urgency',
            collectedData: { ...collectedData, message: userResponse }
        };
    }

    /**
     * Process urgency selection
     */
    processUrgencySelection(userResponse, collectedData, userContext) {
        const urgency = userResponse.toLowerCase().trim();

        // Validate urgency level
        const validUrgencies = Object.values(this.URGENCY_LEVELS);
        if (!validUrgencies.includes(urgency)) {
            return {
                completed: false,
                message: this.buildInvalidUrgencyMessage(validUrgencies),
                nextStep: 'set_urgency',
                collectedData
            };
        }

        return {
            completed: false,
            message: this.buildTicketConfirmation(collectedData, urgency),
            nextStep: 'confirm_ticket',
            collectedData: { ...collectedData, urgency }
        };
    }

    /**
     * Process confirmation
     */
    async processConfirmation(userResponse, collectedData, userContext) {
        const answer = userResponse.toLowerCase().trim();

        if (answer === 'confirm' || answer === 'yes' || answer === 'y') {
            try {
                // Create feedback using the existing feedback service
                const feedback = await this.createFeedbackTicket(
                    userContext,
                    collectedData.category,
                    collectedData.type,
                    collectedData.message,
                    collectedData.urgency
                );

                return {
                    completed: true,
                    message: this.buildTicketSuccess(feedback)
                };
            } catch (error) {
                throw error;
            }
        }

        if (answer === 'modify') {
            return {
                completed: false,
                message: this.buildModifyPrompt(),
                nextStep: 'select_category',
                collectedData: {}
            };
        }

        // Cancel help request
        return {
            completed: true,
            message: this.buildCancellationMessage()
        };
    }

    /**
     * Get user's open feedback feedbacks
     */
    async getUserOpenFeedback(studentId) {
        try {
            const result = await feedbackService.searchFeedback('', {
                user_id: studentId,
                status: { $in: ['pending', 'reviewed', 'in_progress'] }
            }, 1, 50);

            return result.feedbacks || [];
        } catch (error) {
            console.error('Failed to fetch feedback:', error);
            return [];
        }
    }

    /**
     * Create feedback feedback using existing service
     */
    async createFeedbackTicket(userContext, category, type, message, urgency) {
        const feedbackData = {
            type: type,
            category: category,
            subject: this.generateSubject(category, type),
            message: message,
            severity: urgency, // Map urgency to severity
            priority: this.mapUrgencyToPriority(urgency),
            user_id: userContext._id,
            metadata: {
                page_url: 'chatbot',
                browser: userContext.browser || 'Unknown',
                os: userContext.os || 'Unknown',
                device: userContext.device || 'Unknown',
                timestamp: new Date(),
                source: 'chatbot_workflow'
            }
        };

        const feedback = await feedbackService.createFeedback(feedbackData);

        return {
            feedbackId: feedback.feedback_id,
            status: feedback.status,
            category: feedback.category,
            type: feedback.type,
            priority: feedback.priority,
            createdAt: feedback.submitted_at,
            estimatedResponseTime: this.getEstimatedResponseTime(urgency)
        };
    }

    /**
     * Generate subject line from category and type
     */
    generateSubject(category, type) {
        const categoryMap = {
            academic: 'Academic',
            technical: 'Technical',
            billing: 'Billing',
            registration: 'Registration',
            general: 'General'
        };

        const typeMap = {
            bug_report: 'Bug Report',
            feature_request: 'Feature Request',
            complaint: 'Complaint',
            praise: 'Praise',
            question: 'Question',
            suggestion: 'Suggestion'
        };

        const categoryLabel = categoryMap[category] || category;
        const typeLabel = typeMap[type] || type;

        return `${categoryLabel} - ${typeLabel}`;
    }

    /**
     * Map urgency to priority for feedback service
     */
    mapUrgencyToPriority(urgency) {
        const priorityMap = {
            low: 'low',
            medium: 'medium',
            high: 'high',
            critical: 'critical'
        };
        return priorityMap[urgency] || 'medium';
    }

    /**
     * Get estimated response time based on urgency
     */
    getEstimatedResponseTime(urgency) {
        const times = {
            critical: '15 minutes',
            high: '1 hour',
            medium: '4 hours',
            low: '24 hours'
        };
        return times[urgency] || '24 hours';
    }

    /**
     * Build messages
     */
    buildCategoryPrompt() {
        return "🎓 *HOW CAN WE HELP?*\n━━━━━━━━━━━━━━━━\n\n" +
            "Please select a category:\n\n" +
            "📚 *ACADEMIC* - Grades, courses, assignments\n" +
            "💻 *TECHNICAL* - Login issues, system errors\n" +
            "💰 *BILLING* - Fees, payments, scholarships\n" +
            "📝 *REGISTRATION* - Course enrollment, scheduling\n" +
            "❓ *GENERAL* - Other inquiries\n\n" +
            "*Type the category name:*\n" +
            "_Example: ACADEMIC or TECHNICAL_";
    }

    buildExistingFeedbackPrompt(openFeedback) {
        let message = "⚠️ *OPEN FEEDBACKS DETECTED*\n━━━━━━━━━━━━━━━━\n\n";
        message += `You have ${openFeedback.length} open support feedback(s):\n\n`;

        openFeedback.forEach((feedback, i) => {
            message += `${i + 1}. *${feedback.feedback_id}* - ${feedback.category}\n`;
            message += `   Status: ${feedback.status} | Type: ${feedback.type}\n`;
            message += `   Created: ${new Date(feedback.submitted_at).toLocaleDateString()}\n\n`;
        });

        message += "Would you like to create a new feedback or check existing ones?\n";
        message += "*Reply:* NEW FEEDBACK | CHECK FEEDBACKS";

        return message;
    }

    buildInvalidCategoryMessage(validCategories) {
        return "❌ *Invalid Category*\n━━━━━━━━━━━━━━━━\n\n" +
            `Please choose from: ${validCategories.join(', ')}\n\n` +
            "Type the category name to continue.";
    }

    buildTypePrompt(category) {
        return `📋 *FEEDBACK TYPE*\n━━━━━━━━━━━━━━━━\n\n` +
            `Category: ${category.toUpperCase()}\n\n` +
            `What type of feedback would you like to submit?\n\n` +
            `🐛 *BUG_REPORT* - Report a technical issue\n` +
            `💡 *FEATURE_REQUEST* - Suggest a new feature\n` +
            `😞 *COMPLAINT* - Express dissatisfaction\n` +
            `🌟 *PRAISE* - Share positive experience\n` +
            `❓ *QUESTION* - Ask for information\n` +
            `💭 *SUGGESTION* - Provide improvement ideas\n\n` +
            `*Type the feedback type:*\n` +
            `_Example: BUG_REPORT or FEATURE_REQUEST_`;
    }

    buildInvalidTypeMessage(validTypes) {
        return "❌ *Invalid Feedback Type*\n━━━━━━━━━━━━━━━━\n\n" +
            `Please choose from: ${validTypes.join(', ')}\n\n` +
            "Type the feedback type to continue.";
    }

    buildFAQOfferPrompt(category, faqs) {
        return `📖 *HELP ARTICLES AVAILABLE*\n━━━━━━━━━━━━━━━━\n\n` +
            `We found ${faqs.length} FAQ(s) related to ${category}.\n\n` +
            `Would you like to see if these resolve your issue?\n\n` +
            `*Reply:* YES or NO`;
    }

    buildFAQListPrompt(faqs) {
        let message = "📚 *FREQUENTLY ASKED QUESTIONS*\n━━━━━━━━━━━━━━━━\n\n";

        faqs.forEach((faq, i) => {
            message += `${i + 1}. *${faq.question}*\n`;
            // Truncate answer to first 100 characters
            const shortAnswer = faq.answer.length > 100 ? faq.answer.substring(0, 100) + '...' : faq.answer;
            message += `   ${shortAnswer}\n\n`;
        });

        message += "Type the number to view full answer, or *NO* to create a feedback.\n";
        message += "_Example: 1_";

        return message;
    }

    buildFAQResolutionPrompt(faq) {
        return `📖 *FAQ ANSWER*\n━━━━━━━━━━━━━━━━\n\n` +
            `*Q: ${faq.question}*\n\n` +
            `*A: ${faq.answer}*\n\n` +
            `━━━━━━━━━━━━━━━━\n\n` +
            `*Was this answer helpful?*\n\n` +
            `✅ *YES* - My issue is resolved\n` +
            `❌ *NO* - I need to create a support ticket\n\n` +
            `*Reply with YES or NO*`;
    }

    buildIssueDescriptionPrompt(category, type) {
        const typeDisplay = type.replace(/_/g, ' ').toUpperCase();

        return `📝 *DESCRIBE YOUR ISSUE*\n━━━━━━━━━━━━━━━━\n\n` +
            `Category: ${category.toUpperCase()}\n` +
            `Type: ${typeDisplay}\n\n` +
            `Please describe your issue in detail:\n` +
            `- What happened?\n` +
            `- When did it occur?\n` +
            `- What have you tried?\n\n` +
            `*Type your response below:*`;
    }

    buildUrgencyPrompt() {
        return "⏰ *URGENCY LEVEL*\n━━━━━━━━━━━━━━━━\n\n" +
            "How critical is this issue?\n\n" +
            "🔴 *CRITICAL* - System down, cannot access essential services\n" +
            "🟠 *HIGH* - Blocking important deadline or functionality\n" +
            "🟡 *MEDIUM* - Impacting but workaround available\n" +
            "🟢 *LOW* - General question or minor issue\n\n" +
            "*Type urgency level:*\n" +
            "_Example: HIGH or MEDIUM_";
    }

    buildInvalidUrgencyMessage(validUrgencies) {
        return "❌ *Invalid Urgency Level*\n━━━━━━━━━━━━━━━━\n\n" +
            `Please choose from: ${validUrgencies.join(', ')}\n\n` +
            "Type the urgency level to continue.";
    }

    buildTicketConfirmation(collectedData, urgency) {
        let message = "⚠️ *CONFIRM SUPPORT FEEDBACK*\n━━━━━━━━━━━━━━━━\n\n";
        message += `*Category:* ${collectedData.category.toUpperCase()}\n`;
        message += `*Type:* ${collectedData.type.replace(/_/g, ' ').toUpperCase()}\n`;
        message += `*Urgency:* ${urgency.toUpperCase()}\n`;
        message += `*Issue:*\n${collectedData.message.substring(0, 200)}${collectedData.message.length > 200 ? '...' : ''}\n\n`;
        message += `*Estimated Response:* ${this.getEstimatedResponseTime(urgency)}\n\n`;
        message += `*Reply:* CONFIRM | CANCEL | MODIFY`;

        return message;
    }

    buildTicketSuccess(feedback) {
        let message = "✅ *SUPPORT FEEDBACK CREATED*\n━━━━━━━━━━━━━━━━\n\n";
        message += `*Feedback ID:* ${feedback.feedbackId}\n`;
        message += `*Status:* ${feedback.status.toUpperCase()}\n`;
        message += `*Category:* ${feedback.category.toUpperCase()}\n`;
        message += `*Type:* ${feedback.type.replace(/_/g, ' ').toUpperCase()}\n`;
        message += `*Priority:* ${feedback.priority.toUpperCase()}\n`;
        message += `*Response Time:* ${feedback.estimatedResponseTime}\n`;
        message += `*Created:* ${new Date(feedback.createdAt).toLocaleString()}\n\n`;
        message += `Our support team will review your feedback and respond shortly.\n\n`;
        message += `*📱 Track Feedback:*\n`;
        message += `${process.env.FRONTEND_URL}/dashboard/support/feedback/${feedback.feedbackId}\n`;
        message += `_Check status and add updates_`;

        return message;
    }

    buildCancellationMessage() {
        return "❌ *Help Request Cancelled*\n━━━━━━━━━━━━━━━━\n\n" +
            "Your support request has been cancelled.\n\n" +
            "Type *HELP* to start over or visit our FAQ page:\n" +
            `${process.env.FRONTEND_URL}/support/faq`;
    }

    buildModifyPrompt() {
        return "✏️ *Start Over*\n━━━━━━━━━━━━━━━━\n\n" +
            "Let's start fresh. Please select a category:\n\n" +
            "📚 ACADEMIC | 💻 TECHNICAL | 💰 BILLING | 📝 REGISTRATION | ❓ GENERAL";
    }

    unknownStepResponse() {
        return {
            completed: true,
            message: "⚠️ *Invalid Option*\n\nPlease type *HELP* to start over."
        };
    }

    completeHelpRequest(feedback) {
        return {
            requiresMoreInfo: false,
            completed: true,
            message: this.buildTicketSuccess(feedback)
        };
    }

    handleError(error) {
        console.error('Help workflow error:', error);
        return {
            requiresMoreInfo: false,
            completed: true,
            message: "❌ *System Error*\n\nUnable to process your request. Please try again later or contact support directly at support@university.edu"
        };
    }
}

export default HelpWorkflow;