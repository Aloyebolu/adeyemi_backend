
import path from "path";
import fs from "fs/promises";
import ResultService from "../../../result/result.service.js";
import SemesterService from "../../../semester/semester.service.js";

class StudentResultWorkflow {
    constructor() {
        this.VALID_VIEW_TYPES = ['semester', 'transcript', 'grades'];
        this.DOWNLOAD_URL_BASE = `${process.env.FRONTEND_URL}/api/results/download`;
    }

    /**
     * Main entry point for the workflow
     */
    async execute(context) {
        try {
            const availableSemesters = await this.getAvailableSemesters(context);

            if (!context.conversationState.resultSelection) {
                return this.initiateResultViewing(availableSemesters);
            }

            const resultData = await this.fetchStudentResults(
                context.userContext._id,
                context.conversationState.resultSelection
            );

            return this.completeResultViewing(resultData, context.conversationState.resultSelection);
        } catch (error) {
            return this.handleError(error);
        }
    }


    /**
     * Initialize result viewing process
     */
    initiateResultViewing(availableSemesters) {
        return {
            requiresMoreInfo: true,
            nextStep: 'select_view_type',
            collectedData: { availableSemesters },
            prompt: this.buildViewTypeSelectionPrompt()
        };
    }
    /**
     * Update processStep to pass through streaming parameters
     */
    async processStep(context) {
        const { step, userResponse, collectedData, userContext, streamCallback, sock, remoteJid } = context;

        switch (step) {
            case 'select_view_type':
                return this.processViewTypeSelection(userResponse, collectedData, userContext);

            case 'select_semester':
                return await this.processSemesterSelection(userResponse, collectedData, userContext);

            case 'confirm_download':
                return await this.processDownloadConfirmation(
                    userResponse,
                    collectedData,
                    userContext,
                    streamCallback,  // Pass through
                    sock,             // Pass through
                    remoteJid         // Pass through
                );

            default:
                return this.unknownStepResponse();
        }
    }
    /**
     * Process view type selection
     */
    processViewTypeSelection(userResponse, collectedData, userContext) {
        const selection = userResponse.toLowerCase().trim();

        let viewType;
        if (selection.includes('semester') || selection === '1') {
            viewType = 'semester';
        } else if (selection.includes('transcript') || selection === '2') {
            viewType = 'transcript';
        } else if (selection.includes('grade') || selection === '3') {
            viewType = 'grades';
        } else {
            return {
                completed: false,
                message: this.buildInvalidSelectionMessage(),
                nextStep: 'select_view_type',
                collectedData
            };
        }

        // For transcript or grades, we can skip semester selection
        if (viewType === 'transcript' || viewType === 'grades') {
            return {
                completed: false,
                message: this.buildResultReadyPrompt(viewType),
                nextStep: 'confirm_download',
                collectedData: { ...collectedData, viewType }
            };
        }

        // For semester result, need to select semester
        if (!collectedData.availableSemesters || collectedData.availableSemesters.length === 0) {
            return {
                completed: true,
                message: this.buildNoSemestersMessage()
            };
        }

        return {
            completed: false,
            message: this.buildSemesterSelectionPrompt(collectedData.availableSemesters),
            nextStep: 'select_semester',
            collectedData: { ...collectedData, viewType }
        };
    }

    /**
     * Process semester selection
     */
    async processSemesterSelection(userResponse, collectedData, userContext) {
        const semesterIndex = parseInt(userResponse) - 1;

        if (isNaN(semesterIndex) || semesterIndex < 0 || semesterIndex >= collectedData.availableSemesters.length) {
            return {
                completed: false,
                message: this.buildInvalidSemesterMessage(collectedData.availableSemesters),
                nextStep: 'select_semester',
                collectedData
            };
        }

        const selectedSemester = collectedData.availableSemesters[semesterIndex];

        return {
            completed: false,
            message: this.buildResultReadyPrompt(collectedData.viewType, selectedSemester),
            nextStep: 'confirm_download',
            collectedData: { ...collectedData, selectedSemester }
        };
    }

    /**
     * Process download confirmation
     */
    /**
        * Process download confirmation with streaming
        */
    /**
     * Process download confirmation - Simplified version
     */
    async processDownloadConfirmation(userResponse, collectedData, userContext, streamCallback, sock, remoteJid) {
        const answer = userResponse.toLowerCase().trim();

        if (answer === 'download' || answer === 'pdf') {
            try {
                // Generate PDF (this will send the 0% and 100% messages internally)
                const downloadResult = await this.generateDownloadableResultWithProgress(
                    userContext.studentId || userContext._id,
                    collectedData.viewType,
                    collectedData.selectedSemester,
                    streamCallback,
                    sock,
                    remoteJid
                );

                // Return final result with download link
                return {
                    completed: true,
                    message: this.buildDownloadLinkMessage(downloadResult, userContext._id),
                    requiresMoreInfo: false,
                    downloadUrl: downloadResult.downloadUrl,
                    actionData: {
                        viewType: collectedData.viewType,
                        semester: collectedData.selectedSemester,
                        filePath: downloadResult.filePath,
                        filename: downloadResult.filename
                    }
                };
            } catch (error) {
                console.error('PDF generation failed:', error);

                return {
                    completed: true,
                    message: this.buildDownloadErrorMessage(error),
                    requiresMoreInfo: false
                };
            }
        }

        // Handle view option
        if (answer === 'view' || answer === 'yes' || answer === 'y') {
            const viewUrl = this.generateViewUrl(collectedData.viewType, collectedData.selectedSemester, userContext);
            return {
                completed: true,
                message: this.buildResultLinkMessage(collectedData.viewType, collectedData.selectedSemester, userContext, viewUrl),
                requiresMoreInfo: false,
                viewUrl
            };
        }

        // Cancel
        return {
            completed: true,
            message: this.buildCancellationMessage()
        };
    }

    /**
     * Build download link message (separate from the progress messages)
     */
    buildDownloadLinkMessage(downloadResult, studentId) {
        let message = "🔗 *DOWNLOAD LINK*\n━━━━━━━━━━━━━━━━\n\n";
        message += `🔗 *Click here to download:*\n${this.generateDownloadUrl(studentId)}\n\n`;
        message += "⏰ *Note:* This link expires in 1 hour.\n";
        message += "_If you have issues downloading, type *RESULT* to try again._";

        return message;
    }

    /**
     * Generate downloadable result with progress streaming
     */
    async generateDownloadableResultWithProgress(studentId, viewType, semester, streamCallback, sock, remoteJid) {
        const sendMessage = async (message) => {
            if (streamCallback) {
                await streamCallback({ type: 'stream', message });
            } else if (sock && remoteJid) {
                await sock.sendMessage(remoteJid, { text: message });
            }
        };

        const buildProgressMessage = (percentage, status) => {
            const progressBar = percentage === 0
                ? '▱▱▱▱▱▱▱▱▱▱'
                : '▰▰▰▰▰▰▰▰▰▰';

            let message = '';

            if (viewType === 'semester') {
                message = percentage === 0
                    ? "📚 *SEMESTER RESULT*\n\n🔍 Retrieving your semester results..."
                    : "📚 *SEMESTER RESULT*\n\n✅ Your semester result PDF has been generated successfully!";
            } else if (viewType === 'transcript') {
                message = percentage === 0
                    ? "📜 *ACADEMIC TRANSCRIPT*\n\n🔍 Compiling your academic history..."
                    : "📜 *ACADEMIC TRANSCRIPT*\n\n✅ Your academic transcript has been generated successfully!";
            } else if (viewType === 'grades') {
                message = percentage === 0
                    ? "📊 *GRADE SUMMARY*\n\n🔍 Calculating your grades and GPA..."
                    : "📊 *GRADE SUMMARY*\n\n✅ Your grade summary has been generated successfully!";
            }

            return `${message}\n${progressBar} ${percentage}%`;
        };

        try {
            let result;

            // STEP 1: Send initial 0% message
            await sendMessage(buildProgressMessage(0, 'processing'));

            // STEP 2: Process based on view type
            if (viewType === 'semester') {
                const resultData = await ResultService.getStudentSemesterResult(
                    studentId,
                    semester?.semesterId,
                    semester?.level
                );

                result = await ResultService.generateStudentResultPDF(
                    studentId,
                    semester?.semesterId,
                    semester?.level,
                    false
                );

            } else if (viewType === 'transcript') {
                const transcriptData = await ResultService.getStudentAcademicHistory(studentId);

                result = await ResultService.generateTranscriptPDF(studentId, false);

            } else if (viewType === 'grades') {
                const gradesData = await ResultService.getStudentGrades(studentId);

                result = await ResultService.generateTranscriptPDF(studentId, false);

            } else {
                throw new Error('Invalid view type');
            }

            // STEP 3: Send completion message with 100%
            const downloadUrl = this.generateDownloadUrl(result.filename);

            let completionMessage = buildProgressMessage(100, 'complete');
            completionMessage += `\n\n📄 *File:* ${result.filename}`;
            completionMessage += `\n👤 *Student:* ${result.matricNumber || result.studentName || 'N/A'}`;

            await sendMessage(completionMessage);

            return {
                ...result,
                downloadUrl
            };

        } catch (error) {
            // Send error message
            await sendMessage(
                `❌ *GENERATION FAILED*\n━━━━━━━━━━━━━━━━\n\n` +
                `Error: ${error.message || 'Unknown error'}\n\n` +
                `Please try again later.`
            );
            throw error;
        }
    }



    // Helper sleep function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    generateViewUrl(viewType, semester, userContext) {
        let url = `${process.env.FRONTEND_URL}/dashboard/student/`;

        if (viewType === 'semester' && semester) {
            url += `results/semester/${semester.semesterId}?level=${semester.level}`;
        } else if (viewType === 'transcript') {
            url += 'transcript';
        } else if (viewType === 'grades') {
            url += 'grades';
        }

        return url;
    }

    generateDownloadUrl(studentId) {
        return `${process.env.BACKEND_URL}/results/download/${studentId}`;
    }

    buildDownloadReadyMessage(downloadResult) {
        let message = "✅ *DOWNLOAD READY*\n━━━━━━━━━━━━━━━━\n\n";

        message += `📄 *File:* ${downloadResult.filename}\n`;
        message += `👤 *Student:* ${downloadResult.matricNumber || downloadResult.studentName}\n\n`;
        message += `🔗 *Download Link:*\n${downloadResult.downloadUrl}\n\n`;
        message += "⏰ *Note:* This link expires in 1 hour.\n";
        message += "_If you have issues downloading, type *RESULT* to try again._";

        return message;
    }

    buildDownloadErrorMessage(error) {
        return "❌ *DOWNLOAD FAILED*\n━━━━━━━━━━━━━━━━\n\n" +
            "Unable to generate your document at this time.\n\n" +
            `*Error:* ${error.message || 'Unknown error'}\n\n` +
            "Please try again later or contact support.";
    }

    buildResultLinkMessage(viewType, semester, userContext, viewUrl) {
        let message = "🔗 *VIEW RESULT ONLINE*\n━━━━━━━━━━━━━━━━\n\n";
        message += `*Access your result here:*\n${viewUrl}\n\n`;
        message += "_Login with your student credentials if required_\n\n";
        message += "📌 *Note:* Results are provisional until approved by Senate.";
        return message;
    }

    buildCancellationMessage() {
        return "❌ *VIEWING CANCELLED*\n━━━━━━━━━━━━━━━━\n\n" +
            "Result viewing cancelled.\n\n" +
            "Type *RESULT* to start over.";
    }

    /**
     * Generate downloadable result (PDF)
     */
    async generateDownloadableResult(studentId, viewType, semester) {
        try {
            let result;

            if (viewType === 'semester') {
                result = await ResultService.generateStudentResultPDF(
                    studentId,
                    semester?.semesterId,
                    semester?.level,
                    false
                );
            } else if (viewType === 'transcript') {
                result = await ResultService.generateTranscriptPDF(
                    studentId,
                    false
                );
            } else if (viewType === 'grades') {
                // For grades, we need to implement a similar PDF generation
                // For now, use transcript as fallback or create a grades PDF generator
                result = await ResultService.generateTranscriptPDF(
                    studentId,
                    false
                );
            } else {
                throw new Error('Invalid view type');
            }

            // Generate download URL
            const downloadUrl = this.generateDownloadUrl(studentId);

            return {
                ...result,
                downloadUrl
            };
        } catch (error) {
            console.error('Failed to generate downloadable result:', error);
            throw error;
        }
    }

    /**
     * Generate view URL for online viewing
     */
    generateViewUrl(viewType, semester, userContext) {
        let url = `${process.env.FRONTEND_URL}/dashboard/student/`;

        if (viewType === 'semester' && semester) {
            url += `results/semester/${semester.semesterId}?level=${semester.level}`;
        } else if (viewType === 'transcript') {
            url += 'transcript';
        } else if (viewType === 'grades') {
            url += 'grades';
        }

        return url;
    }

    /**
     * Fetch student results
     */
    async fetchStudentResults(studentId, selection) {
        try {
            if (selection.viewType === 'semester') {
                return await ResultService.getStudentSemesterResult(
                    studentId,
                    selection.selectedSemester?.semesterId,
                    selection.selectedSemester?.level
                );
            } else if (selection.viewType === 'transcript') {
                return await ResultService.getStudentAcademicHistory(studentId);
            } else if (selection.viewType === 'grades') {
                return await ResultService.getStudentGrades(studentId);
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch results:', error);
            return null;
        }
    }

    /**
     * Complete result viewing
     */
    completeResultViewing(resultData, selection) {
        if (!resultData) {
            return {
                requiresMoreInfo: false,
                completed: true,
                message: this.buildNoResultsMessage()
            };
        }

        return {
            requiresMoreInfo: false,
            completed: true,
            message: this.buildResultSummaryMessage(resultData, selection.viewType),
            data: resultData
        };
    }

    /**
     * Get available semesters for student
     */
    async getAvailableSemesters(context) {
        try {
            // Fetch student's registered semesters from their course registrations
            const studentId = context.userContext._id;
            if (!studentId) return [];

            // This would need to be implemented - fetching semesters the student has results for
            // For now, return current/active semester
            const activeSemester = await SemesterService.getActiveAcademicSemester();
            if (activeSemester) {
                return [{
                    semesterId: activeSemester._id,
                    name: activeSemester.semester,
                    session: activeSemester.session,
                    displayName: `${activeSemester.semester} Semester, ${activeSemester.session}`
                }];
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch semesters:', error);
            return [];
        }
    }

    /**
     * Build messages
     */
    buildViewTypeSelectionPrompt() {
        let message = "📊 *STUDENT RESULTS*\n━━━━━━━━━━━━━━━━\n\n";
        message += "What would you like to view?\n\n";
        message += "1️⃣ *Semester Result*\n";
        message += "   View result for a specific semester\n\n";
        message += "2️⃣ *Academic Transcript*\n";
        message += "   View complete academic history\n\n";
        message += "3️⃣ *Grade Summary*\n";
        message += "   View current semester grades and GPA\n\n";
        message += "*Reply with:* 1, 2, or 3";

        return message;
    }

    buildInvalidSelectionMessage() {
        return "❌ *Invalid Selection*\n━━━━━━━━━━━━━━━━\n\n" +
            "Please select a valid option:\n" +
            "1 - Semester Result\n" +
            "2 - Academic Transcript\n" +
            "3 - Grade Summary";
    }

    buildSemesterSelectionPrompt(semesters) {
        let message = "📅 *SELECT SEMESTER*\n━━━━━━━━━━━━━━━━\n\n";

        semesters.forEach((sem, index) => {
            message += `${index + 1}. ${sem.displayName}\n`;
        });

        message += "\n*Reply with the number* (e.g., 1)";

        return message;
    }

    buildInvalidSemesterMessage(semesters) {
        return `❌ *Invalid Selection*\n\nPlease select a number between 1 and ${semesters.length}`;
    }

    buildResultReadyPrompt(viewType, semester = null) {
        let message = "✅ *RESULT READY*\n━━━━━━━━━━━━━━━━\n\n";

        if (viewType === 'semester' && semester) {
            message += `*Semester:* ${semester.displayName}\n\n`;
        } else if (viewType === 'transcript') {
            message += "*Type:* Academic Transcript\n\n";
        } else if (viewType === 'grades') {
            message += "*Type:* Grade Summary\n\n";
        }

        message += "How would you like to proceed?\n\n";
        message += "📱 *VIEW* - View result online\n";
        message += "📄 *DOWNLOAD* - Download as PDF\n";
        message += "❌ *CANCEL* - Cancel viewing\n\n";
        message += "*Reply:* VIEW | DOWNLOAD | CANCEL";

        return message;
    }

    buildResultLinkMessage(viewType, semester, userContext, viewUrl) {
        let message = "🔗 *VIEW RESULT ONLINE*\n━━━━━━━━━━━━━━━━\n\n";

        message += `*Access your result here:*\n${viewUrl}\n\n`;
        message += "_Login with your student credentials if required_\n\n";
        message += "📌 *Note:* Results are provisional until approved by Senate.";

        return message;
    }

    buildDownloadReadyMessage(downloadResult) {
        let message = "✅ *DOWNLOAD READY*\n━━━━━━━━━━━━━━━━\n\n";

        message += `📄 *File:* ${downloadResult.filename}\n`;
        message += `👤 *Student:* ${downloadResult.matricNumber || downloadResult.studentName}\n\n`;
        message += `🔗 *Download Link:*\n${downloadResult.downloadUrl}\n\n`;
        message += "⏰ *Note:* This link expires in 1 hour.\n";
        message += "_If you have issues downloading, type *CHECK RESULT* to try again._";

        return message;
    }

    buildDownloadInitiatedMessage() {
        let message = "📥 *DOWNLOAD INITIATED*\n━━━━━━━━━━━━━━━━\n\n";

        message += "Your document is being generated.\n\n";
        message += "⏳ *Processing...*\n";
        message += "You'll receive the download link shortly.";
        message += "\n\n_This may take a few moments..._";

        return message;
    }

    buildDownloadErrorMessage(error) {
        let message = "❌ *DOWNLOAD FAILED*\n━━━━━━━━━━━━━━━━\n\n";

        message += "Unable to generate your document at this time.\n\n";
        message += `*Error:* ${error.message || 'Unknown error'}\n\n`;
        message += "Please try again later or contact support.\n";
        message += "_Type *CHECK RESULT* to try again._";

        return message;
    }

    buildResultSummaryMessage(resultData, viewType) {
        let message = "📊 *RESULT SUMMARY*\n━━━━━━━━━━━━━━━━\n\n";

        if (viewType === 'grades' && resultData) {
            message += `*Student:* ${resultData.studentName || 'N/A'}\n`;
            message += `*Matric No:* ${resultData.matricNo || 'N/A'}\n`;
            message += `*Semester GPA:* ${resultData.semesterGPA || 'N/A'}\n`;
            message += `*Cumulative GPA:* ${resultData.cumulativeGPA || 'N/A'}\n\n`;
            message += "_Type *VIEW GRADES* for detailed breakdown_";
        } else if (viewType === 'semester' && resultData) {
            message += `*Student:* ${resultData.name || 'N/A'}\n`;
            message += `*Level:* ${resultData.level || 'N/A'}\n`;
            message += `*Semester:* ${resultData.semester || 'N/A'}\n`;
            message += `*Session:* ${resultData.session || 'N/A'}\n`;
            message += `*GPA:* ${resultData.gpa || 'N/A'}\n`;
            message += `*CGPA:* ${resultData.cgpa || 'N/A'}\n\n`;
            message += "_Type *VIEW RESULT* for full details_";
        } else if (viewType === 'transcript' && resultData) {
            message += `*Student:* ${resultData.studentInfo?.name || 'N/A'}\n`;
            message += `*Programme:* ${resultData.studentInfo?.programmeId?.name || 'N/A'}\n`;
            message += `*Final CGPA:* ${resultData.graduationInfo?.finalCGPA || 'N/A'}\n`;
            message += `*Total Credits:* ${resultData.graduationInfo?.totalCredits || 'N/A'}\n\n`;
            message += "_Type *VIEW TRANSCRIPT* for full record_";
        }

        return message;
    }

    buildNoResultsMessage() {
        return "❌ *NO RESULTS FOUND*\n━━━━━━━━━━━━━━━━\n\n" +
            "No results are available at this time.\n\n" +
            "This could be because:\n" +
            "• Results haven't been uploaded yet\n" +
            "• You haven't registered for courses\n" +
            "• Results are being processed\n\n" +
            "Contact your department for assistance.";
    }

    buildNoSemestersMessage() {
        return "❌ *NO SEMESTERS AVAILABLE*\n━━━━━━━━━━━━━━━━\n\n" +
            "No semesters with results found.\n\n" +
            "Please ensure you have registered for courses and results have been uploaded.";
    }

    buildCancellationMessage() {
        return "❌ *VIEWING CANCELLED*\n━━━━━━━━━━━━━━━━\n\n" +
            "Result viewing cancelled.\n\n" +
            "Type *CHECK RESULT* or *VIEW GRADES* to start over.";
    }

    unknownStepResponse() {
        return {
            completed: true,
            message: "⚠️ *Invalid step*\n\nPlease start over with *CHECK RESULT* or *VIEW GRADES*"
        };
    }

    handleError(error) {
        console.error('Result workflow error:', error);
        return {
            requiresMoreInfo: false,
            completed: true,
            message: "❌ *System Error*\n\nUnable to retrieve results at this time.\n\nPlease try again later or contact support."
        };
    }
}

export default StudentResultWorkflow;