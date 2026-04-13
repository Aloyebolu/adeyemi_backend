import { FRONTEND_URL } from "../../../../config/system.js";
import feedbackService from "../../../support/feedback.service.js";
// FAQ service will be implemented later
import faqService from "../../../support/faq.service.js";

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
            URGENT: 'urgent'
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
            // Check if user has open feedback tickets
            const openFeedback = await this.getUserOpenFeedback(context.userContext._id);
            
            if (!context.conversationState.helpSelection) {
                return this.initiateHelp(openFeedback);
            }
            
            const { category, type, message, urgency } = context.conversationState.helpSelection;
            
            // Create feedback ticket using the existing feedback service
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
            const faqs = await faqService.getFAQsByCategory(category);
            
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
            console.log('FAQ service not available:', error.message);
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
        
        // Validate type
        const validTypes = Object.values(this.FEEDBACK_TYPES);
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
     * Get user's open feedback tickets
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
     * Create feedback ticket using existing service
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
            urgent: 'urgent'
        };
        return priorityMap[urgency] || 'medium';
    }

    /**
     * Get estimated response time based on urgency
     */
    getEstimatedResponseTime(urgency) {
        const times = {
            urgent: '15 minutes',
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
        let message = "⚠️ *OPEN TICKETS DETECTED*\n━━━━━━━━━━━━━━━━\n\n";
        message += `You have ${openFeedback.length} open support ticket(s):\n\n`;
        
        openFeedback.forEach((feedback, i) => {
            message += `${i + 1}. *${feedback.feedback_id}* - ${feedback.category}\n`;
            message += `   Status: ${feedback.status} | Type: ${feedback.type}\n`;
            message += `   Created: ${new Date(feedback.submitted_at).toLocaleDateString()}\n\n`;
        });
        
        message += "Would you like to create a new ticket or check existing ones?\n";
        message += "*Reply:* NEW TICKET | CHECK TICKETS";
        
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
            message += `   ${faq.answer.substring(0, 100)}...\n\n`;
        });
        
        message += "Type the number to view full answer, or *NO* to create a ticket.\n";
        message += "_Example: 1_";
        
        return message;
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
               "How urgent is this issue?\n\n" +
               "🔴 *URGENT* - System down, cannot access essential services\n" +
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
        let message = "✅ *CONFIRM SUPPORT TICKET*\n━━━━━━━━━━━━━━━━\n\n";
        message += `*Category:* ${collectedData.category.toUpperCase()}\n`;
        message += `*Type:* ${collectedData.type.replace(/_/g, ' ').toUpperCase()}\n`;
        message += `*Urgency:* ${urgency.toUpperCase()}\n`;
        message += `*Issue:*\n${collectedData.message.substring(0, 200)}${collectedData.message.length > 200 ? '...' : ''}\n\n`;
        message += `*Estimated Response:* ${this.getEstimatedResponseTime(urgency)}\n\n`;
        message += `*Reply:* CONFIRM | CANCEL | MODIFY`;
        
        return message;
    }
    
    buildTicketSuccess(feedback) {
        let message = "✅ *SUPPORT TICKET CREATED*\n━━━━━━━━━━━━━━━━\n\n";
        message += `*Ticket ID:* ${feedback.feedbackId}\n`;
        message += `*Status:* ${feedback.status.toUpperCase()}\n`;
        message += `*Category:* ${feedback.category.toUpperCase()}\n`;
        message += `*Type:* ${feedback.type.replace(/_/g, ' ').toUpperCase()}\n`;
        message += `*Priority:* ${feedback.priority.toUpperCase()}\n`;
        message += `*Response Time:* ${feedback.estimatedResponseTime}\n`;
        message += `*Created:* ${new Date(feedback.createdAt).toLocaleString()}\n\n`;
        message += `Our support team will review your feedback and respond shortly.\n\n`;
        message += `*📱 Track Ticket:*\n`;
        message += `${FRONTEND_URL}/dashboard/support/feedback/${feedback.feedbackId}\n`;
        message += `_Check status and add updates_`;
        
        return message;
    }
    
    buildCancellationMessage() {
        return "❌ *Help Request Cancelled*\n━━━━━━━━━━━━━━━━\n\n" +
               "Your support request has been cancelled.\n\n" +
               "Type *HELP* to start over or visit our FAQ page:\n" +
               `${FRONTEND_URL}/support/faq`;
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