import { FRONTEND_URL } from "../../../../config/system.js";
import { resolveUserName } from "../../../../utils/resolveUserName.js";
import courseService from "../../../course/course.service.js";
import courseRegistrationService from "../../../course/courseRegistration.service.js";
import ResultService from "../../../result/result.service.js";
import userService from "../../../user/user.service.js";
import CourseRegistrationWorkflow from "./CourseRegistrationWorkflow.js";

// Enterprise-Grade University Assistant System
class UniversityAssistantSystem {
    constructor() {
        // Service registry for external integrations
        this.services = {
            academicService: new AcademicService(),
            financialService: new FinancialService(),
            libraryService: new LibraryService(),
            hostelService: new HostelService(),
            notificationService: new NotificationService(),
            analyticsService: new AnalyticsService()
        };

        // Complex workflow definitions
        this.workflows = {
            'CHECK_PROFILE': new ProfileWorkflow(),
            'REGISTER_COURSES': new CourseRegistrationWorkflow(),
            'VIEW_REGISTRATION': new ViewRegistrtionWorkflow(),
            'VIEW_GRADES': new GradesWorkflow(),
            // 'PAYMENT_PROCESSING': new PaymentWorkflow(),
            // 'LIBRARY_BOOKING': new LibraryBookingWorkflow(),
            // 'HOSTEL_MAINTENANCE': new HostelMaintenanceWorkflow(),
            // 'EXAM_REGISTRATION': new ExamRegistrationWorkflow(),
            // 'TRANSCRIPT_REQUEST': new TranscriptWorkflow(),
            // 'COMPLAINT_SYSTEM': new ComplaintWorkflow(),
            'AI_CONSULTATION': new AIConsultationWorkflow()
        };

        // State management for complex conversations
        this.conversationStates = new Map();
        this.userContextCache = new Map();

        // Advanced pattern matchers
        this.intentMatchers = this.initializeIntentMatchers();
    }

    initializeIntentMatchers() {
        return {
            'CHECK_PROFILE': {
                patterns: [/profile/i, /my\s+info/i, /personal\s+details/i, /student\s+details/i],
                requiredContext: ['studentId'],
                confidence: 0.8
            },
            'REGISTER_COURSES': {
                patterns: [/register\s+courses/i, /enroll/i, /add\s+courses/i, /course\s+registration/i],
                requiredContext: ['studentId', 'semester'],
                confidence: 0.85
            },
            'VIEW_REGISTRATION': {
                patterns: [/view\s+registration/i, /check\s+registration/i],
                requiredContext: ['studentId', 'semester'],
                confidence: '0.85'
            },
            'VIEW_GRADES': {
                patterns: [/grades?/i, /marks/i, /gpa/i, /result/i, /academic\s+performance/i],
                requiredContext: ['studentId'],
                confidence: 0.9
            },
            'PAYMENT_PROCESSING': {
                patterns: [/pay\s+fee/i, /tuition/i, /payment/i, /dues/i, /fee\s+status/i],
                requiredContext: ['studentId', 'financialId'],
                confidence: 0.85
            },
            'LIBRARY_BOOKING': {
                patterns: [/borrow\s+book/i, /library/i, /reserve\s+book/i, /return\s+book/i],
                requiredContext: ['studentId', 'libraryCardId'],
                confidence: 0.8
            },
            'HOSTEL_MAINTENANCE': {
                patterns: [/hostel/i, /room/i, /maintenance/i, /complaint/i, /mess/i],
                requiredContext: ['studentId', 'hostelId'],
                confidence: 0.75
            },
            'EXAM_REGISTRATION': {
                patterns: [/exam\s+registration/i, /register\s+exam/i, /exam\s+form/i],
                requiredContext: ['studentId', 'semester'],
                confidence: 0.85
            },
            'TRANSCRIPT_REQUEST': {
                patterns: [/transcript/i, /certificate/i, /degree/i, /official\s+document/i],
                requiredContext: ['studentId'],
                confidence: 0.9
            },
            'COMPLAINT_SYSTEM': {
                patterns: [/complain/i, /grievance/i, /issue/i, /problem/i, /complaint/i],
                requiredContext: ['studentId'],
                confidence: 0.7
            }
        };
    }

    // Resolve user from phone number
    async resolveUser(senderNumber) {
        try {
            // Check cache first
            if (this.userContextCache.has(senderNumber)) {
                console.log("has cache")
                const cached = this.userContextCache.get(senderNumber);
                if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                    return cached.userData;
                }
            }

            // Call user service to resolve student
            const userData = await userService.getUserByPhoneNumber(senderNumber);

            if (!userData) {
                throw new Error('User not found in university database');
            }

            // Enrich with additional context
            const enrichedData = await this.enrichUserContext(userData);

            // Cache the result
            this.userContextCache.set(senderNumber, {
                userData: enrichedData,
                timestamp: Date.now()
            });

            return enrichedData;
        } catch (error) {
            console.error('User resolution failed:', error);
            throw new Error(`Unable to resolve user: ${error.message}`);
        }
    }

    async enrichUserContext(userData) {
        // Fetch additional data from various services
        const [
            academicInfo,
            financialInfo,
            libraryInfo,
            hostelInfo,
            currentSemester
        ] = await Promise.allSettled([
            this.services.academicService.getStudentAcademicInfo(userData.studentId),
            this.services.financialService.getStudentFinancialStatus(userData.studentId),
            this.services.libraryService.getLibraryMembership(userData.studentId),
            this.services.hostelService.getHostelAllocation(userData.studentId),
            this.services.academicService.getCurrentSemester()
        ]);

        return {
            ...userData,
            academicInfo: academicInfo.status === 'fulfilled' ? academicInfo.value : null,
            financialInfo: financialInfo.status === 'fulfilled' ? financialInfo.value : null,
            libraryInfo: libraryInfo.status === 'fulfilled' ? libraryInfo.value : null,
            hostelInfo: hostelInfo.status === 'fulfilled' ? hostelInfo.value : null,
            currentSemester: currentSemester.status === 'fulfilled' ? currentSemester.value : '2024-1',
            lastUpdated: new Date().toISOString()
        };
    }

    // Process complex message with workflow
    async processMessage(message, sock, notificationManager) {
        let conversationState;
        try {
            const text = this.extractMessageText(message);
            if (!text) return;

            const senderNumber = this.extractSenderNumber(message);
            const remoteJid = message.key.remoteJid;
            const contactName = notificationManager.extractContactName(remoteJid);

            console.log(`💬 Processing message from ${contactName} (${senderNumber}): ${text}`);

            // Get or create conversation state
            conversationState = this.conversationStates.get(senderNumber);
            if (!conversationState) {
                conversationState = new ConversationState(senderNumber);
                this.conversationStates.set(senderNumber, conversationState);
            }

            if (text === "quit") {
                await this.sendResponse(sock, remoteJid, "Session closed successfully.\n Would you like to initiate another session? ");
                return;
            }
            // Check if in active workflow
            if (conversationState.activeWorkflow) {
                const workflowResult = await this.handleActiveWorkflow(
                    conversationState,
                    text,
                    senderNumber
                );

                // Update workflow state based on result
                if (workflowResult.completed) {
                    // Workflow is complete, clear it
                    conversationState.activeWorkflow = null;
                    await this.sendResponse(sock, remoteJid, workflowResult.message);
                } else if (workflowResult.nextStep) {
                    // Workflow needs to continue to next step
                    conversationState.activeWorkflow = {
                        ...conversationState.activeWorkflow,
                        step: workflowResult.nextStep,
                        collectedData: workflowResult.collectedData || conversationState.activeWorkflow.collectedData
                    };
                    await this.sendResponse(sock, remoteJid, workflowResult.message);
                } else {
                    // Still in same step, just send message
                    await this.sendResponse(sock, remoteJid, workflowResult.message);
                }

                return;
            }

            // Resolve user from phone number
            let userContext;
            try {
                userContext = await this.resolveUser(senderNumber);
                conversationState.userContext = userContext;
            } catch (error) {
                await this.sendResponse(
                    sock,
                    remoteJid,
                    this.buildUnregisteredUserMessage(senderNumber)
                );
                return;
            }

            // Detect intent and execute workflow
            const intent = await this.detectIntent(text, userContext);

            if (!intent) {
                console.log("no intent")
                await this.sendResponse(sock, remoteJid, this.buildHelpMenu(userContext));
                return;
            }

            // Execute the workflow
            const workflow = this.workflows[intent];
            if (!workflow) {
                await this.sendResponse(sock, remoteJid, "I couldn't understand that request. Please use the menu options.");
                return;
            }

            // Execute workflow with full context
            const result = await workflow.execute({
                userContext,
                originalMessage: text,
                senderNumber,
                conversationState,
                services: this.services
            });

            // Handle workflow response
            if (result.requiresMoreInfo) {
                conversationState.activeWorkflow = {
                    name: intent,
                    step: result.nextStep,
                    collectedData: result.collectedData,
                    workflow: workflow
                };
                await this.sendResponse(sock, remoteJid, result.prompt);
            } else {
                const formattedResponse = this.formatResponse(result.data, intent, userContext);
                await this.sendResponse(sock, remoteJid, formattedResponse);

                // Log analytics
                await this.services.analyticsService.logInteraction({
                    userId: userContext.studentId,
                    intent: intent,
                    timestamp: new Date(),
                    success: true
                });
            }

            // Update conversation state
            conversationState.lastIntent = intent;
            conversationState.lastInteraction = new Date();

        } catch (error) {
            await this.handleError(error, message, sock);
            if (error.statusCode >= 500) {
                console.error('Error processing message:', error);
                if (conversationState) {
                    conversationState.activeWorkflow = null;
                }
            } else {
                if (error.data?.quitChatBotSession) {
                    conversationState.activeWorkflow = null;

                }
            }
        }
    }

    async handleActiveWorkflow(conversationState, userResponse, senderNumber) {
        const { workflow, step, collectedData } = conversationState.activeWorkflow;

        // Call the workflow's processStep method
        const result = await workflow.processStep({
            step: step,
            userResponse: userResponse,
            collectedData: collectedData,
            userContext: conversationState.userContext,
            services: this.services
        });

        return result;
    }

    async detectIntent(message, userContext) {
        // Advanced intent detection with context awareness
        for (const [intent, matcher] of Object.entries(this.intentMatchers)) {
            for (const pattern of matcher.patterns) {
                if (pattern.test(message)) {
                    // Check if we have required context
                    const hasRequiredContext = matcher.requiredContext.every(
                        ctx => userContext[ctx] || userContext[ctx.replace('Id', 'Info')]
                    );

                    if (hasRequiredContext || matcher.confidence > 0.9) {
                        return intent;
                    } else {
                        return intent
                    }
                }
            }
        }
        return null;
    }

    async handleActiveWorkflow(conversationState, userResponse, senderNumber) {
        const { workflow, step, collectedData } = conversationState.activeWorkflow;

        const result = await workflow.processStep({
            step,
            userResponse,
            collectedData,
            userContext: conversationState.userContext,
            services: this.services
        });

        return result;
    }

    buildHelpMenu(userContext) {
        let menu = "🎓 *UNIVERSITY SMART ASSISTANT* 🎓\n\n";
        menu += `Welcome ${userContext.first_name || 'Student'}! I can help you with:\n\n`;

        const menuItems = [
            { emoji: "👤", name: "View My Profile", cmd: "profile" },
            { emoji: "📚", name: "Course Registration", cmd: "register courses" },
            { emoji: "📊", name: "Check Grades", cmd: "my grades" },
            { emoji: "💰", name: "Fee Payment", cmd: "pay fee" },
            { emoji: "📖", name: "Library Services", cmd: "library" },
            { emoji: "🏠", name: "Hostel Management", cmd: "hostel" },
            { emoji: "📝", name: "Exam Registration", cmd: "exam registration" },
            { emoji: "📜", name: "Request Transcript", cmd: "transcript" },
            { emoji: "⚠️", name: "File Complaint", cmd: "complaint" },
            { emoji: "🤖", name: "AI Academic Advisor", cmd: "ask ai" }
        ];

        menuItems.forEach((item, index) => {
            menu += `${item.emoji} *${index + 1}.* ${item.name}\n`;
            menu += `   \`"${item.cmd}"\`\n\n`;
        });

        menu += "⚡ *Quick Commands:*\n";
        menu += "• Just type what you need naturally\n";
        menu += "• I'll fetch data from all university systems\n";
        menu += "• Your number is linked to your student ID\n";

        return menu;
    }

    buildUnregisteredUserMessage(phoneNumber) {
        return `⚠️ *User Not Found*\n\nWe couldn't find a student record associated with ${phoneNumber}.\n\nPlease contact the university administration to link your WhatsApp number to your student account.\n\n*Help Desk:* +1234567890\n*Email:* support@university.edu`;
    }

    formatResponse(data, intent, userContext) {
        // Dynamic response formatting based on data type
        switch (intent) {
            case 'CHECK_PROFILE':
                return this.formatProfileResponse(data, userContext);
            case 'VIEW_GRADES':
                return this.formatGradesResponse(data);
            case 'PAYMENT_PROCESSING':
                return this.formatPaymentResponse(data);
            case 'REGISTER_COURSES':
                return this.formatCourseRegistrationResponse(data);
            case 'VIEW_REGISTRATIONS':
                return this.formatRegisteredCoursesResponse(data)
            default: {
                // Handle strings directly
                if (typeof data === 'string') return data;

                // Handle common response patterns
                if (data?.message) return data.message;
                if (data?.error) return `❌ ${data.error}`;

                // Handle arrays
                if (Array.isArray(data)) {
                    if (data.length === 0) return `📋 *Empty List*\n━━━━━━━━━━━━━━━━━━━━━\nNo items found.`;
                    if (data.length === 1) return this._formatObjectAsText(data[0]);
                    return `📋 *Found ${data.length} items*\n━━━━━━━━━━━━━━━━━━━━━\n${data.length} result(s) available.\n\n💬 Type *VIEW ALL* or *HELP* for options`;
                }

                // Handle objects - convert to readable text
                if (typeof data === 'object' && data !== null) {
                    return this._formatObjectAsText(data);
                }

                // Handle everything else
                return `✅ *Success*\n━━━━━━━━━━━━━━━━━━━━━\nOperation completed: ${String(data)}`;
            }


        }
    }
    // Helper method to convert any object to readable text
    _formatObjectAsText(obj) {
        // Remove sensitive/internal fields
        const exclude = ['_id', '__v', 'password', 'createdAt', 'updatedAt'];

        const entries = Object.entries(obj)
            .filter(([key]) => !exclude.includes(key))
            .filter(([, val]) => val !== null && val !== undefined)
            .map(([key, val]) => {
                // Format nested objects/arrays nicely
                if (Array.isArray(val)) {
                    return `📋 *${key}:* ${val.length} item(s)`;
                }
                if (typeof val === 'object') {
                    return `📦 *${key}:* See details`;
                }
                return `📌 *${this._formatKey(key)}:* ${val}`;
            });

        if (entries.length === 0) return `✅ *Success*\n━━━━━━━━━━━━━━━━━━━━━\nOperation completed successfully.`;

        // Get a title from the object
        const title = obj.name || obj.title || obj.code || obj.id || 'Response';

        return `📄 *${title}*\n━━━━━━━━━━━━━━━━━━━━━\n${entries.join('\n')}`;
    }

    _formatKey(key) {
        // Convert camelCase or snake_case to Title Case
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    formatProfileResponse(profile, userContext) {
        let response = "👤 *STUDENT PROFILE*\n\n";
        response += `*Name:* ${resolveUserName(profile)}\n`;
        response += `*Student ID:* ${profile._id}\n`;
        // response += `*Department:* ${profile.department}\n`;
        // response += `*Program:* ${profile.program}\n`;
        response += `*Current Semester:* ${profile.currentSemester}\n`;
        response += `*CGPA:* ${profile.cgpa || 'N/A'}\n`;
        response += `*Admission Year:* ${profile.admissionYear}\n\n`;

        if (profile.financialInfo?.feeStatus) {
            response += `💰 *Fee Status:* ${profile.financialInfo.feeStatus}\n`;
        }

        if (profile.hostelInfo?.roomNumber) {
            response += `🏠 *Hostel:* ${profile.hostelInfo.hostelName}, Room ${profile.hostelInfo.roomNumber}\n`;
        }

        return response;
    }

    formatRegisteredCoursesResponse(courses) {
        if (!courses || courses.length === 0) {
            return "❌ *No registered courses found*\n\nType *REGISTER* to add courses";
        }

        const totalCredits = courses.reduce((sum, c) => sum + (c.unit || 0), 0);
        const semester = courses[0]?.semester?.toUpperCase() || 'N/A';
        const level = courses[0]?.level || 'N/A';

        let response = `📚 *REGISTERED COURSES*\n`;
        response += `━━━━━━━━━━━━━━━━━━━━━\n`;
        response += `📊 ${courses.length} courses | ${totalCredits} credits\n`;
        response += `🗓️ ${semester} Semester | Level ${level}\n\n`;

        // Core courses
        const core = courses.filter(c => c.type === 'core');
        if (core.length) {
            response += `*⭐ CORE COURSES (${core.length})*\n`;
            core.forEach((c, i) => {
                response += `${i + 1}. *${c.courseCode}* - ${c.title} (${c.unit} unit)\n`;
            });
            response += `\n`;
        }

        // Elective courses  
        const elective = courses.filter(c => c.type === 'elective');
        if (elective.length) {
            response += `*⚡ ELECTIVE COURSES (${elective.length})*\n`;
            elective.forEach((c, i) => {
                response += `${i + 1}. *${c.courseCode}* - ${c.title} (${c.unit} unit)\n`;
            });
            response += `\n`;
        }

        response += `━━━━━━━━━━━━━━━━━━━━━\n`;
        response += `💬 *Options:* VIEW GRADES | ADD COURSES | DROP COURSES`;

        return response;
    }
    formatGradesResponse(grades) {
        if (!grades.semesterGrades?.length) {
            return `❌ *NO GRADES FOUND*\n━━━━━━━━━━━━━━━━━━━━━\nNo records for ${grades.semester} semester.\n\n💬 Contact academic advisor for assistance.`;
        }

        let response = `📊 *${grades.semester} SEMESTER RESULTS*\n`;
        response += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Show ALL courses
        for (let i = 0; i < grades.semesterGrades.length; i++) {
            const c = grades.semesterGrades[i];
            response += `*${i + 1}. ${c.code}* - ${c.name}\n`;
            response += `Score: ${c.score ?? '___'}% \nGrade ${c.grade || 'N/A'} \nGPA  ${c.gpa.toFixed(2)} GP \nUnits ${c.credits} credit(s)\n`;
            if (c.remark && c.remark !== 'Passed' && c.remark !== 'Failed') {
                response += `   💬 ${c.remark}\n`;
            }
            response += `\n`;
        }

        // Performance summary
        const gpa = grades.semesterGPA;
        const icon = gpa >= 3.5 ? '🏆' : gpa >= 3.0 ? '✅' : gpa >= 2.0 ? '⚠️' : '❌';
        const msg = gpa >= 3.5 ? 'Excellent!' : gpa >= 3.0 ? 'Good!' : gpa >= 2.0 ? 'Average' : 'Needs Improvement';

        response += `━━━━━━━━━━━━━━━━━━━━━\n`;
        response += `${icon} *Semester GPA:* ${gpa.toFixed(2)} - ${msg}\n`;
        response += `🎯 *Cumulative GPA:* ${grades.cumulativeGPA.toFixed(2)}\n`;
        response += `⚠️ Note: This is not your official result, you can view that on ${FRONTEND_URL}/dashboard/student/results/semester`
        return response;
    }

    formatPaymentResponse(payment) {
        let response = "💰 *FEE DETAILS*\n\n";
        response += `*Total Fee:* ₹${payment.totalFee}\n`;
        response += `*Paid Amount:* ₹${payment.paidAmount}\n`;
        response += `*Pending Amount:* ₹${payment.pendingAmount}\n`;
        response += `*Due Date:* ${payment.dueDate}\n\n`;

        if (payment.pendingAmount > 0) {
            response += "⚠️ *Action Required:* Please clear your dues before the due date.\n";
            response += `\n💳 *Payment Link:* ${payment.paymentLink || 'Available in student portal'}`;
        } else {
            response += "✅ *Status:* All fees cleared!";
        }

        return response;
    }

    formatCourseRegistrationResponse(registration) {
        let response = "📚 *COURSE REGISTRATION*\n\n";

        if (registration.status === 'success') {
            response += `✅ Successfully registered for ${registration.semester}\n\n`;
            response += "*Registered Courses:*\n";
            for (const course of registration.courses) {
                response += `• ${course.code}: ${course.name}\n`;
                response += `  Schedule: ${course.schedule}\n`;
            }
            response += `\n*Total Credits:* ${registration.totalCredits}\n`;
            response += `*Registration ID:* ${registration.registrationId}`;
        } else if (registration.requiresSelection) {
            response += "Please select your courses from the available list:\n\n";
            for (const course of registration.availableCourses) {
                response += `${course.code} - ${course.name} (${course.credits} credits)\n`;
                response += `   "${course.code}" to select\n\n`;
            }
            response += "Type the course codes separated by commas to register.";
        }

        return response;
    }

    async handleError(error, message, sock) {
        const remoteJid = message.key.remoteJid;
        let errorMessage = "❌ *System Error*\n\n";
        // Handle expected/client errors (400-499) vs server errors (500+)
        if (error.statusCode && error.statusCode < 500) {
            // Expected, user-facing errors
            errorMessage = error.message || "Invalid request. Please try again.";
        }
        else if (error.message.includes('User not found')) {
            errorMessage += "Your number isn't registered in our system. Please contact the admin office.";
        } else if (error.message.includes('service unavailable')) {
            errorMessage += "A service is temporarily unavailable. Please try again in a few minutes.";
        } else {
            errorMessage += "An unexpected error occurred. Our team has been notified.\n\n";
            errorMessage += "Please try again or contact support.";
        }

        await this.sendResponse(sock, remoteJid, errorMessage);

        // Log error for monitoring
        console.error('System error:', {
            error: error.message,
            stack: error.stack,
            messageId: message.key.id,
            timestamp: new Date()
        });
    }

    extractMessageText(message) {
        if (message.message?.conversation) return message.message.conversation;
        if (message.message?.extendedTextMessage?.text) return message.message.extendedTextMessage.text;
        return null;
    }

    extractSenderNumber(message) {
        try {
            let senderNumber = null;

            // Priority 1: Get from senderPn (this is the actual phone number)
            if (message.key?.senderPn) {
                // senderPn format: "2349156551111@s.whatsapp.net"
                senderNumber = message.key.senderPn.split('@')[0];
            }

            // Priority 2: For group messages, check participant
            if (!senderNumber && message.key?.participant) {
                senderNumber = message.key.participant.split('@')[0];
            }

            // Priority 3: Fallback to remoteJid (but this is often an internal ID)
            if (!senderNumber && message.key?.remoteJid) {
                const remoteJid = message.key.remoteJid;
                // Check if it contains @lid (internal ID) or @s.whatsapp.net
                if (remoteJid.includes('@s.whatsapp.net')) {
                    senderNumber = remoteJid.split('@')[0];
                } else if (!remoteJid.includes('@lid')) {
                    // Only use if it's not a @lid internal ID
                    senderNumber = remoteJid.split('@')[0];
                }
            }

            // Clean the number: remove any non-digit characters except leading '+'
            if (senderNumber) {
                // Keep the number as is, just ensure it's digits
                senderNumber = senderNumber.replace(/\D/g, '');
            }

            console.log(`📱 Extracted sender number: ${senderNumber}`);
            console.log(`   Original senderPn: ${message.key?.senderPn}`);

            return senderNumber;

        } catch (error) {
            console.error('Error extracting sender number:', error);
            return null;
        }
    }

    async sendResponse(sock, remoteJid, text) {
        await sock.sendMessage(remoteJid, { text: text });
    }
}


class AcademicService {
    async getStudentAcademicInfo(studentId) {
        // Call academic database
        return {
            program: "B.Tech CSE",
            enrollmentStatus: "Active",
            advisor: "Dr. Smith",
            creditsCompleted: 45,
            totalCredits: 160
        };
    }

    async getCurrentSemester() {
        return "Fall 2024";
    }

    async getStudentGrades(studentId, semester = null) {
        // Fetch from grade system
        return {
            semester: semester || "Fall 2024",
            semesterGPA: 3.8,
            cumulativeGPA: 3.75,
            semesterGrades: [
                { code: "CS301", name: "Algorithms", grade: "A", credits: 3, gpa: 4.0 },
                { code: "CS302", name: "Database Systems", grade: "A-", credits: 3, gpa: 3.7 }
            ]
        };
    }
}

class FinancialService {
    async getStudentFinancialStatus(studentId) {
        // Call fee management system
        return {
            totalFee: 75000,
            paidAmount: 50000,
            pendingAmount: 25000,
            dueDate: "2024-11-30",
            feeStatus: "Partial Payment",
            paymentLink: "https://pay.university.edu/student/STU2024001"
        };
    }
}

class LibraryService {
    async getLibraryMembership(studentId) {
        return {
            libraryCardId: "LIB" + studentId,
            issuedBooks: [],
            pendingFines: 0,
            membershipValid: true
        };
    }
}

class HostelService {
    async getHostelAllocation(studentId) {
        return {
            hostelId: "H101",
            hostelName: "Boys Hostel A",
            roomNumber: "204",
            messPlan: "Vegetarian",
            warden: "Prof. Kumar"
        };
    }
}

class NotificationService {
    async sendNotification(userId, title, body) {
        // Push notification to user's app
        console.log(`[Notification] To: ${userId} - ${title}`);
    }
}

class AnalyticsService {
    async logInteraction(data) {
        // Log to analytics platform
        console.log('[Analytics]', data);
    }
}

// Workflow Definitions
class ProfileWorkflow {
    async execute(context) {
        const profile = await context.services.academicService.getStudentAcademicInfo(
            context.userContext.studentId
        );

        return {
            data: {
                ...context.userContext,
                ...profile
            },
            requiresMoreInfo: false
        };
    }
}
class GradesWorkflow {
    async execute(context) {
        const grades = await ResultService.getStudentGrades(
            context.userContext._id
        );

        return {
            data: grades,
            requiresMoreInfo: false
        };
    }
}
class ViewRegistrtionWorkflow {
    async execute(context) {
        const grades = await courseRegistrationService.getRegistrationsByStudent(
            context.userContext._id
        );

        return {
            data: grades,
            requiresMoreInfo: false
        };
    }
}

class ConversationState {
    constructor(userId) {
        this.userId = userId;
        this.activeWorkflow = null;
        this.userContext = null;
        this.lastIntent = null;
        this.lastInteraction = null;
        this.courseSelection = null;
        this.conversationHistory = [];
    }
}

class AIConsultationWorkflow {
    async execute(context) {
        // Connect to GPT-4 or Claude API for intelligent responses
        const aiResponse = await this.callAIService(
            context.originalMessage,
            context.userContext
        );

        return {
            data: { message: aiResponse },
            requiresMoreInfo: false
        };
    }

    async callAIService(query, userContext) {
        // Integrate with OpenAI, Claude, or custom LLM
        const prompt = `
        You are a university academic advisor for ${userContext.program} student.
        Student Context: ${JSON.stringify(userContext)}
        Student Query: ${query}
        
        Provide helpful, accurate academic guidance.
        `;

        // Example API call to OpenAI
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer YOUR_OPENAI_KEY',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [{ role: 'user', content: prompt }]
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async processStep(context) {
        // Handle multi-turn AI conversations
        return {
            completed: false,
            message: await this.callAIService(context.userResponse, context.userContext)
        };
    }
}

// Initialize and export
export const universitySystem = new UniversityAssistantSystem();

