import { FRONTEND_URL } from "../../../../config/system.js";
import courseService from "../../../course/course.service.js";
import courseRegistrationService from "../../../course/courseRegistration.service.js";

class CourseRegistrationWorkflow {
    constructor() {
        this.MIN_CREDITS = 12;
        this.MAX_CREDITS = 24;
    }

    /**
     * Main entry point for the workflow
     */
    async execute(context) {
        try {
            const availableCourses = await this.getAvailableCourses(context);

            if (!context.conversationState.courseSelection) {
                return this.initiateRegistration(availableCourses);
            }

            const registration = await this.registerCourses(
                context.userContext.studentId,
                context.conversationState.courseSelection
            );

            return this.completeRegistration(registration);
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
            case 'select_courses':
                return await this.processCourseSelection(userResponse, collectedData, userContext);

            case 'confirm_registration':
                return this.processConfirmation(userResponse, collectedData, userContext);

            default:
                return this.unknownStepResponse();
        }
    }

    /**
     * Initialize registration process
     */
    initiateRegistration(availableCourses) {
        if (!availableCourses || availableCourses.length === 0) {
            return {
                requiresMoreInfo: false,
                completed: true,
                message: this.buildNoCoursesMessage()
            };
        }

        return {
            requiresMoreInfo: true,
            nextStep: 'select_courses',
            collectedData: { availableCourses },
            prompt: this.buildCourseSelectionPrompt(availableCourses)
        };
    }

    /**
     * Process course selection step
     */
    async processCourseSelection(userResponse, collectedData, userContext) {
        const selectedCodes = userResponse
            .split(',')
            .map(c => c.trim().toUpperCase())
            .filter(c => c.length > 0);

        const selectedCourses = collectedData.availableCourses.filter(
            c => selectedCodes.includes(c.code)
        );

        // Validate selection
        const validation = this.validateCourseSelection(selectedCourses, selectedCodes);
        try {

        } catch {

        }

        if (!validation.isValid) {
            return {
                completed: false,
                message: validation.message,
                nextStep: 'select_courses',
                collectedData
            };
        }

        // Run a real validation to make sure the courses can be registered
        let courses = [];
        collectedData.availableCourses.map((v) => {
            if(selectedCodes.includes(v.courseCode)){
                courses.push(v._id)}
            }
        )
        await courseRegistrationService.validateAndPrepareRegistration(userContext, { courses })

        return {
            completed: false,
            message: this.buildRegistrationConfirmation(selectedCourses),
            nextStep: 'confirm_registration',
            collectedData: { ...collectedData, selectedCourses,selectedCourseIds: courses  }
        };
    }

    /**
     * Process confirmation step
     */
    async processConfirmation(userResponse, collectedData, userContext) {
        const answer = userResponse.toLowerCase().trim();

        if (answer === 'confirm' || answer === 'yes' || answer === 'y') {
            try {

                const result = await courseRegistrationService.registerCourses(userContext, { courses: collectedData.selectedCourseIds });

                return {
                    completed: true,
                    message: this.buildRegistrationSuccess(result)
                };
            } catch (error) {
               throw error
            }
        }

        if (answer === 'modify') {
            return {
                completed: false,
                message: this.buildModifyPrompt(),
                nextStep: 'select_courses',
                collectedData: { availableCourses: collectedData.availableCourses }
            };
        }

        // Cancel registration
        return {
            completed: true,
            message: this.buildCancellationMessage()
        };
    }

    /**
     * Validate course selection
     */
    validateCourseSelection(selectedCourses, requestedCodes) {
        const foundCodes = selectedCourses.map(c => c.code);
        const notFound = requestedCodes.filter(code => !foundCodes.includes(code));

        if (selectedCourses.length === 0) {
            return {
                isValid: false,
                message: "❌ *No valid courses selected*\n\nPlease enter valid course codes from the list."
            };
        }

        if (notFound.length > 0) {
            return {
                isValid: false,
                message: `⚠️ *Invalid course codes:* ${notFound.join(', ')}\n\nPlease check and try again.`
            };
        }

        const totalCredits = this.calculateTotalCredits(selectedCourses);

        if (totalCredits > this.MAX_CREDITS) {
            return {
                isValid: false,
                message: `⚠️ *Credit limit exceeded*\n\nTotal credits: ${totalCredits}\nMaximum allowed: ${this.MAX_CREDITS}\n\nPlease reduce your course selection.`
            };
        }

        if (totalCredits < this.MIN_CREDITS) {
            return {
                isValid: false,
                message: `⚠️ *Insufficient credits*\n\nTotal credits: ${totalCredits}\nMinimum required: ${this.MIN_CREDITS}\n\nPlease add more courses.`
            };
        }

        return { isValid: true };
    }

    /**
     * Calculate total credits
     */
    calculateTotalCredits(courses) {
        return courses.reduce((sum, course) => sum + (course.unit ?? 0), 0);
    }

    /**
     * Get available courses
     */
    async getAvailableCourses(context) {
        try {
            const courses = await courseService.getRegisterableCourses(context.userContext._id);
            return courses || [];
        } catch (error) {
            console.error('Failed to fetch courses:', error);
            return [];
        }
    }

    /**
     * Register courses
     */
    async registerCourses(studentId, courses) {
        // Call registration API
        const totalCredits = this.calculateTotalCredits(courses);

        // Simulate API call - replace with actual implementation
        return {
            status: 'success',
            semester: 'Fall 2024',
            courses: courses,
            totalCredits: totalCredits,
            registrationId: `REG${Date.now()}`,
            registrationDate: new Date().toISOString()
        };
    }

    /**
     * Build messages
     */
    buildNoCoursesMessage() {
        return "❌ *No courses available*\n━━━━━━━━━━━━━━━━\n\nNo registerable courses found at this time.\n\nContact academic advisor for assistance.";
    }

    buildCourseSelectionPrompt(courses) {
        if (!courses || courses.length === 0) {
            return this.buildNoCoursesMessage();
        }

        let prompt = "📚 *COURSE REGISTRATION*\n━━━━━━━━━━━━━━━━\n\n";

        // Group and display courses
        const grouped = this._groupByLevel(courses);

        for (const [level, levelCourses] of Object.entries(grouped)) {
            prompt += `*LEVEL ${level}*\n`;

            for (const course of levelCourses) {
                prompt += `┌ *${course.code}* - ${course.title}\n`;
                prompt += `├ ${course.unit || 3} credits | Level ${course.level}\n`;
                if (course.prerequisite) {
                    prompt += `├ Prereq: ${course.prerequisite}\n`;
                }
                prompt += `└─────────────────────\n\n`;
            }
        }

        prompt += `*Total:* ${courses.length} courses | ${this.calculateTotalCredits(courses)} credits\n`;
        prompt += `*Max:* ${this.MAX_CREDITS} credits | *Min:* ${this.MIN_CREDITS} credits\n\n`;
        prompt += `*Enter course codes:*\n`;
        prompt += `_Example: CS401, CS402, CS403_`;

        return prompt;
    }

    buildRegistrationConfirmation(selectedCourses) {
        if (!selectedCourses || selectedCourses.length === 0) {
            return "❌ *No courses selected*\n\nType *VIEW COURSES* to start over.";
        }

        const totalCredits = this.calculateTotalCredits(selectedCourses);
        let message = "✅ *Confirm Registration*\n━━━━━━━━━━━━━━━━\n\n";

        message += `*${selectedCourses.length} course(s) selected:*\n`;
        selectedCourses.forEach((course, i) => {
            message += `${i + 1}. ${course.code} (${course.unit ?? 'N/A'} credits)\n`;
        });

        message += `\n*Total Credits:* ${totalCredits}\n`;

        if (totalCredits > this.MAX_CREDITS) {
            message += `⚠️ Exceeds ${this.MAX_CREDITS} credit limit\n`;
        } else if (totalCredits < this.MIN_CREDITS) {
            message += `⚠️ Below ${this.MIN_CREDITS} credit minimum\n`;
        }

        message += `\n*Reply:* CONFIRM | CANCEL | MODIFY`;

        return message;
    }

    buildRegistrationSuccess(result) {
        let message = "✅ *REGISTRATION SUCCESSFUL*\n━━━━━━━━━━━━━━━━\n\n";
        message += `*ID:* ${result.registrationId}\n`;
        message += `*Semester:* ${result.semester}\n`;
        message += `*Courses:* ${result.courses.length}\n`;
        message += `*Total Credits:* ${result.totalCredits}\n`;
        message += `*Date:* ${new Date(result.registrationDate).toLocaleDateString()}\n\n`;
        message += `Registration completed successfully!\n`;
        message += `\n*📱 Access Portal:*\n`;
        message += `${FRONTEND_URL}/dashboard/student/course-registration\n`;
        message += `_Login with your credentials_`;

        return message;
    }

    buildRegistrationError(error) {
        return "❌ *Registration Failed*\n━━━━━━━━━━━━━━━━\n\n" +
            `Error: ${error.message || 'Unable to complete registration'}\n\n` +
            `Please try again or contact support.`;
    }

    buildCancellationMessage() {
        return "❌ *Registration Cancelled*\n━━━━━━━━━━━━━━━━\n\n" +
            "Your registration has been cancelled.\n\n" +
            "Type *REGISTER COURSES* to start over.";
    }

    buildModifyPrompt() {
        return "✏️ *Modify Selection*\n━━━━━━━━━━━━━━━━\n\n" +
            "Please enter new course codes:\n" +
            "_Example: CS401, CS402, CS403_";
    }

    unknownStepResponse() {
        return {
            completed: true,
            message: "⚠️ *Invalid step*\n\nPlease start over with *REGISTER COURSES*"
        };
    }

    handleError(error) {
        console.error('Workflow error:', error);
        return {
            requiresMoreInfo: false,
            completed: true,
            message: "❌ *System Error*\n\nPlease try again later or contact support."
        };
    }

    /**
     * Helper: Group courses by level
     */
    _groupByLevel(courses) {
        const grouped = {};
        for (const course of courses) {
            const level = course.level || 'Unknown';
            if (!grouped[level]) grouped[level] = [];
            grouped[level].push(course);
        }

        // Sort by level
        return Object.fromEntries(
            Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b))
        );
    }
}

export default CourseRegistrationWorkflow;