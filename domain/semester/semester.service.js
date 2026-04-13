import mongoose, { get } from "mongoose";
import DepartmentSemester from "./semester.model.js";
import { AcademicSemester } from "./semester.academicModel.js";
import AuditLogService from "../auditlog/auditlog.service.js";
import departmentService from "../department/department.service.js";
import AppError from "../errors/AppError.js";
import { defaultLevelSettings, lateRegistrationDate, registrationDeadline } from "./semester.constants.js";

/**
 * ======================================================
 * SEMESTER SERVICE
 * ------------------------------------------------------
 * CHANGE CODES WITH CAUTION
 * ======================================================
 */

const SemesterService = {

    /**
     * --------------------------------------------------
     * GET ACTIVE ACADEMIC SEMESTER (School-wide)
     * --------------------------------------------------
     */
    async getActiveAcademicSemester(session = null, lean = true) {
        let query = AcademicSemester.findOne({ isActive: true }).session(session);
        if (lean) query = query.lean();
        if (!query) throw new AppError("No active academic semester found", 404);
        return query;
    },

    /**
     * --------------------------------------------------
     * GET ACTIVE SEMESTER FOR A DEPARTMENT
     * --------------------------------------------------
     */
    async getActiveDepartmentSemester(departmentId, session = null) {
        if (!departmentId) throw new AppError("Department ID is required");
        return this.getActiveAcademicSemester(session); // Department semesters now rely on academic semester for registration control
    },

    /**
     * --------------------------------------------------
     * CREATE A NEW ACADEMIC SEMESTER
     * --------------------------------------------------
     */
    async createAcademicSemester({
        name,
        sessionYear,
        createdBy,
        session = null
    }) {
        if (!name || !sessionYear) {
            throw new AppError("Semester name and session are required");
        }

        return AcademicSemester.create(
            [{
                name,
                session: sessionYear,
                isActive: false,
                createdBy
            }],
            { session }
        ).then(res => res[0]);
    },

    /**
     * --------------------------------------------------
     * CREATE DEPARTMENT SEMESTERS
     * --------------------------------------------------
     */
    async createDepartmentSemester({
        academicSemesterId,
        departmentId,
        name,
        sessionYear,
        levelSettings,
        createdBy,
        regDeadline,
        lateRegDate,
        session = null
    }) {
        if (!academicSemesterId || !departmentId) {
            throw new AppError("Academic semester and department are required");
        }

        return DepartmentSemester.create(
            [{
                academicSemester: academicSemesterId,
                department: departmentId,
                name,
                session: sessionYear,
                levelSettings: levelSettings || defaultLevelSettings,
                isActive: true,
                isRegistrationOpen: false,
                isResultsPublished: false,
                registrationDeadline: regDeadline || registrationDeadline(),
                lateRegistrationDate: lateRegDate || lateRegistrationDate(),
                createdBy
            }],
            { session }
        ).then(res => res[0]);
    },

    /**
     * --------------------------------------------------
     * ACTIVATE ACADEMIC SEMESTER
     * --------------------------------------------------
     */
    async activateAcademicSemester(academicSemesterId, session = null) {
        if (!academicSemesterId) {
            throw new AppError("AcademicSemester ID is required");
        }

        await AcademicSemester.updateMany(
            { isActive: true },
            { isActive: false, endDate: new Date() },
            { session }
        );

        return AcademicSemester.findByIdAndUpdate(
            academicSemesterId,
            { isActive: true, startDate: new Date() },
            { new: true, session }
        );
    },

    /**
     * --------------------------------------------------
     * ACTIVATE A DEPARTMENT SEMESTER
     * --------------------------------------------------
     */
    async activateDepartmentSemester(semesterId, session = null) {
        if (!semesterId) throw new AppError("Semester ID is required");

        const semester = await DepartmentSemester.findById(semesterId).session(session);
        if (!semester) throw new AppError("Semester not found");

        await DepartmentSemester.updateMany(
            {
                department: semester.department,
                isActive: true
            },
            { isActive: false, endDate: new Date() },
            { session }
        );

        semester.isActive = true;
        semester.startDate = new Date();
        await semester.save({ session });

        return semester;
    },

    async getPreviousAcademicSemesters(semesterId = null, session = null,) {
        let academicSemester;
        if (!semesterId) {
            academicSemester = await this.getActiveAcademicSemester(session);
            semesterId
        } else {
            academicSemester = await this.getAcademicSemesterById(semesterId, session);
        }
        console.log(academicSemester)
        const previousSemesters = await AcademicSemester.find({
            order: { $lt: academicSemester.order }
        }).select("_id");
        const semesterIds = previousSemesters.map(s => s._id);
        return semesterIds || [];
    },


    /** 
     * GET THE ACTIVE SEMESTER FOR A USER DEPARTMENT
     */
    async getUserDepartmentActiveSemester(userId, session = null) {
        const department = await departmentService.getUserDepartment(userId, session);
        if (!department) throw new AppError("User department not found");
        return this.getActiveDepartmentSemester(department._id, session);
    },
    /**
     * --------------------------------------------------
     * OPEN / CLOSE COURSE REGISTRATION
     * --------------------------------------------------
     */
    async setRegistrationState({
        semesterId,
        isOpen,
        session = null
    }) {
        if (!semesterId) throw new AppError("Semester ID is required");

        return DepartmentSemester.findByIdAndUpdate(
            semesterId,
            { isRegistrationOpen: isOpen },
            { new: true, session }
        );
    },

    /**
     * --------------------------------------------------
     * PUBLISH / UNPUBLISH RESULTS
     * --------------------------------------------------
     */
    async setResultPublicationState({
        semesterId,
        isPublished,
        session = null
    }) {
        if (!semesterId) throw new AppError("Semester ID is required");

        return DepartmentSemester.findByIdAndUpdate(
            semesterId,
            { isResultsPublished: isPublished },
            { new: true, session }
        );
    },

    /**
     * --------------------------------------------------
     * LOCK A SEMESTER (No more mutations)
     * --------------------------------------------------
     */
    async lockSemester(semesterId, session = null) {
        if (!semesterId) throw new AppError("Semester ID is required");

        // Temporarily set to false 
        return DepartmentSemester.findByIdAndUpdate(
            semesterId,
            { isLocked: false },
            { new: true, session }
        );
    },

    /**
     * --------------------------------------------------
     * GET LEVEL SETTINGS FOR A STUDENT LEVEL
     * --------------------------------------------------
     */
    async getLevelSettings({
        semesterId,
        level
    }) {
        if (!semesterId || !level) {
            throw new AppError("Semester ID and level are required");
        }

        const semester = await DepartmentSemester.findById(semesterId).lean();
        if (!semester) throw new AppError("Semester not found");

        return semester.levelSettings.find(ls => ls.level === level);
    },

    /**
     * --------------------------------------------------
     * VALIDATE REGISTRATION WINDOW
     * --------------------------------------------------
     */
    async canRegister(semesterId) {
        const semester = await DepartmentSemester.findById(semesterId).lean();
        if (!semester) return false;

        const now = new Date();

        if (!semester.isRegistrationOpen) return false;
        if (semester.registrationDeadline && now > semester.registrationDeadline) {
            return now <= semester.lateRegistrationDate;
        }

        return true;
    },

    /**
     * --------------------------------------------------
     * NEW: UPDATE MULTIPLE SEMESTERS' REGISTRATION STATE
     * --------------------------------------------------
     */
    async updateRegistrationForDepartments({
        departmentIds,
        isOpen,
        userId,
        session = null
    }) {
        if (!departmentIds || !Array.isArray(departmentIds)) {
            throw new AppError("Department IDs array is required");
        }

        const updateData = { isRegistrationOpen: isOpen };
        if (userId) {
            updateData.updatedBy = userId;
        }

        return DepartmentSemester.updateMany(
            { department: { $in: departmentIds }, isActive: true },
            updateData,
            { session }
        );
    },

    /**
     * --------------------------------------------------
     * NEW: UPDATE MULTIPLE SEMESTERS' RESULT PUBLICATION
     * --------------------------------------------------
     */
    async updateResultPublicationForDepartments({
        departmentIds,
        isPublished,
        userId,
        session = null
    }) {
        if (!departmentIds || !Array.isArray(departmentIds)) {
            throw new AppError("Department IDs array is required");
        }

        const updateData = { isResultsPublished: isPublished };
        if (userId) {
            updateData.updatedBy = userId;
        }

        return DepartmentSemester.updateMany(
            { department: { $in: departmentIds }, isActive: true },
            updateData,
            { session }
        );
    },

    /**
     * --------------------------------------------------
     * NEW: GET DEPARTMENT SEMESTERS
     * --------------------------------------------------
     */
    async getDepartmentSemesters(departmentId) {
        if (!departmentId) throw new AppError("Department ID is required");

        return DepartmentSemester.find({ department: departmentId })
            .sort({ createdAt: -1 })
            .populate('department', 'name code')
            .populate('createdBy', 'firstName lastName');
    },

    async getDepartmentSemester(departmentId, { session = null, lean = true } = {}) {
        if (!departmentId) throw new AppError("Department ID is required");
        const academicSemester = await this.getActiveAcademicSemester(session, lean);
        let departmentSemester = DepartmentSemester.findOne({ department: departmentId, academicSemester: academicSemester._id }).session(session);
        if (lean) departmentSemester = departmentSemester.lean();
        // Try to create one if not found (for backward compatibility with legacy data)
        if (!departmentSemester) {
            const newDepartmentSemester = await this.createDepartmentSemester({
                academicSemesterId: academicSemester._id,
                departmentId,
                name: academicSemester.name,
                sessionYear: academicSemester.session,
                levelSettings: defaultLevelSettings,
                createdBy: null // System created
            })
            throw new AppError("Please retry your request.", 400, "Department semester was missing and has been created. Please retry your request.");
            return newDepartmentSemester;
        }
        return departmentSemester;
    },
    /**
     * --------------------------------------------------
     * NEW: UPDATE SEMESTER SETTINGS
     * --------------------------------------------------
     */
    async updateSemesterSettings({
        semesterId,
        levelSettings,
        registrationDeadline,
        lateRegistrationDate,
        userId,
        session = null
    }) {
        if (!semesterId) throw new AppError("Semester ID is required");

        const updateData = {};

        if (levelSettings) {
            updateData.levelSettings = levelSettings;
        }

        if (registrationDeadline) {
            updateData.registrationDeadline = new Date(registrationDeadline);
        }

        if (lateRegistrationDate) {
            updateData.lateRegistrationDate = new Date(lateRegistrationDate);
        }

        if (userId) {
            updateData.updatedBy = userId;
        }

        // Validate deadline dates
        if (registrationDeadline && lateRegistrationDate) {
            const deadline = new Date(registrationDeadline);
            const lateDate = new Date(lateRegistrationDate);
            if (lateDate <= deadline) {
                throw new AppError("Late registration date must be after the registration deadline");
            }
        }

        return DepartmentSemester.findByIdAndUpdate(
            semesterId,
            updateData,
            { new: true, session }
        );
    },

    /**
     * --------------------------------------------------
     * NEW: DEACTIVATE SEMESTER
     * --------------------------------------------------
     */
    async deactivateSemester(semesterId, userId = null, session = null) {
        if (!semesterId) throw new AppError("Semester ID is required");

        const updateData = {
            isActive: false,
            endDate: new Date(),
            isRegistrationOpen: false,
            isResultsPublished: false
        };

        if (userId) {
            updateData.updatedBy = userId;
        }

        return DepartmentSemester.findByIdAndUpdate(
            semesterId,
            updateData,
            { new: true, session }
        );
    },

    // Add to semester.service.js

    /**
     * --------------------------------------------------
     * GET SEMESTER BY ID
     * --------------------------------------------------
     */
    async getSemesterById(semesterId, session = null) {
        if (!semesterId) throw new AppError("Semester ID is required");

        return DepartmentSemester.findById(semesterId)
            .select("name session startDate endDate isActive")
            .populate("academicSemester", "name session")
            .populate("department", "name code")
            .session(session);
    },

    /**
     * --------------------------------------------------
     * GET ACADEMIC SEMESTER BY ID
     * --------------------------------------------------
     */
    async getAcademicSemesterById(academicSemesterId, session = null) {
        academicSemesterId = '2024/2025-second' // TEMPORARY OVERRIDE FOR TESTING - REMOVE THIS LINE
        if (!academicSemesterId) throw new AppError("Academic Semester ID is required");

        // Check if it's a dropdown value format (contains "/" and "-")
        const isDropdownFormat = typeof academicSemesterId === 'string' &&
            academicSemesterId.includes('/') &&
            academicSemesterId.includes('-');

        if (isDropdownFormat) {
            // Parse the dropdown value: "2024/2025-first" or "2024/2025-second"
            const [sessionPart, semesterType] = academicSemesterId.split('-');
            const [startYear, endYear] = sessionPart.split('/');
            const sessionString = `${startYear}/${endYear}`;

            // Find the academic semester by session and semester type
            const semester = await AcademicSemester.findOne({
                session: sessionString,
                name: semesterType
            }).select("name session startDate endDate isActive order")
                .session(session);

            if (!semester) {
                throw new AppError(
                    "Academic Semester not found",
                    404,
                    `No semester found for session ${sessionString} and ${semesterType === 'first' ? 'First' : 'Second'} Semester`
                );
            }

            return semester;
        }

        // Otherwise, treat it as a MongoDB ObjectId
        return AcademicSemester.findById(academicSemesterId)
            .select("name session startDate endDate isActive order")
            .session(session);
    },
    // Add to semester.service.js

    /**
     * --------------------------------------------------
     * DETERMINE IF REGISTRATION IS OPEN FOR DEPARTMENT
     * --------------------------------------------------
     * Checks AcademicSemester first, then department-specific override
     */
    async isRegistrationOpenForDepartment(departmentId, session = null) {
        if (!departmentId) throw new AppError("Department ID is required");

        // Get active academic semester
        const academicSemester = await AcademicSemester.findOne({
            isActive: true
        }).session(session);

        if (!academicSemester) return false;

        // Get active department semester
        const departmentSemester = await DepartmentSemester.findOne({
            department: departmentId,
            isActive: true
        }).session(session);

        if (!departmentSemester) return false;

        // If academic semester registration is closed, department can't override
        if (!academicSemester.isRegistrationOpen) return false;

        // Otherwise use department's setting
        return departmentSemester.isRegistrationOpen;
    },

    /**
     * --------------------------------------------------
     * SET REGISTRATION STATE FOR ACADEMIC SEMESTER
     * --------------------------------------------------
     * This controls the master switch for all departments
     */
    async setAcademicSemesterRegistrationState({
        academicSemesterId,
        isOpen,
        session = null
    }) {
        if (!academicSemesterId) throw new AppError("AcademicSemester ID is required");

        return AcademicSemester.findByIdAndUpdate(
            academicSemesterId,
            { isRegistrationOpen: isOpen },
            { new: true, session }
        );
    },

    /**
     * --------------------------------------------------
     * SET REGISTRATION STATE FOR DEPARTMENT SEMESTER
     * --------------------------------------------------
     * Only works if academic semester registration is open
     */
    async setDepartmentSemesterRegistrationState({
        semesterId,
        isOpen,
        session = null
    }) {
        if (!semesterId) throw new AppError("Semester ID is required");

        const semester = await DepartmentSemester.findById(semesterId)
            .populate('academicSemester')
            .session(session);

        if (!semester) throw new AppError("Semester not found");

        // Can't open registration if academic semester registration is closed
        if (isOpen && !semester.academicSemester.isRegistrationOpen) {
            throw new AppError("Cannot open registration - academic semester registration is closed");
        }

        semester.isRegistrationOpen = isOpen;
        await semester.save({ session });

        return semester;
    },

    /**
     * --------------------------------------------------
     * UPDATE REGISTRATION FOR DEPARTMENTS (FIXED)
     * --------------------------------------------------
     * Now respects the academic semester master switch
     */
    async updateRegistrationForDepartments({
        departmentIds,
        isOpen,
        userId,
        session = null
    }) {
        if (!departmentIds || !Array.isArray(departmentIds)) {
            throw new AppError("Department IDs array is required");
        }

        // Check if academic semester registration is open
        const academicSemester = await AcademicSemester.findOne({
            isActive: true
        }).session(session);

        if (!academicSemester) {
            throw new AppError("No active academic semester found");
        }

        // If trying to open but academic semester is closed, throw error
        if (isOpen && !academicSemester.isRegistrationOpen) {
            throw new AppError("Cannot open registration - academic semester registration is closed");
        }

        const updateData = { isRegistrationOpen: isOpen };
        if (userId) {
            updateData.updatedBy = userId;
        }

        return DepartmentSemester.updateMany(
            {
                department: { $in: departmentIds },
                isActive: true,
                academicSemester: academicSemester._id
            },
            updateData,
            { session }
        );
    },
    /**
     * --------------------------------------------------
     * GET DEPARTMENTS UNDER ACADEMIC SEMESTER
     * --------------------------------------------------
     * Helper function to get all departments affected by registration toggle
     */
    async getDepartmentsUnderAcademicSemester(academicSemesterId, session = null) {
        const departmentSemesters = await DepartmentSemester.find({
            academicSemester: academicSemesterId,
            isActive: true
        })
            .populate('department', 'name code')
            .select('department')
            .session(session);

        return departmentSemesters.map(ds => ({
            departmentId: ds.department._id,
            departmentName: ds.department.name,
            code: ds.department.code
        }));
    },

    /**
     * --------------------------------------------------
     * GET ACTIVE DEPARTMENT SEMESTERS COUNT
     * --------------------------------------------------
     * Quick count of departments affected
     */
    async getActiveDepartmentCount(academicSemesterId, session = null) {
        const count = await DepartmentSemester.countDocuments({
            academicSemester: academicSemesterId,
            isActive: true
        }).session(session);

        return count;
    },

    /**
     * --------------------------------------------------
     * TOGGLE ACADEMIC SEMESTER REGISTRATION WITH AUDIT
     * --------------------------------------------------
     * Complete registration toggle with audit trail
     */
    async toggleAcademicSemesterRegistration({
        userId,
        userDetails,
        ipAddress,
        requestDetails,
        session = null,
        req
    }) {
        if (!userId) throw new AppError("User ID is required");
        if (!userDetails) throw new AppError("User details required for audit");

        const startTime = Date.now();

        try {
            // Get active academic semester
            const academicSemester = await this.getActiveAcademicSemester(session);

            // Store old data for audit
            const oldRegistrationStatus = academicSemester.isRegistrationOpen;
            const newStatus = !oldRegistrationStatus;

            // Perform the toggle in transaction
            let updatedAcademicSemester;
            const updateSession = session || await mongoose.startSession();
            let shouldEndSession = false;

            if (!session) {
                shouldEndSession = true;
            }

            try {
                if (!session) {
                    await updateSession.withTransaction(async () => {
                        updatedAcademicSemester = await this._performRegistrationToggle(
                            academicSemester._id,
                            newStatus,
                            userId,
                            updateSession
                        );
                    });
                } else {
                    updatedAcademicSemester = await this._performRegistrationToggle(
                        academicSemester._id,
                        newStatus,
                        userId,
                        updateSession
                    );
                }
                // Update audit data with success
                const successAuditData = {
                    entity: "AcademicSemester",
                    resource: "AcademicSemester",
                    changes: {
                        entityId: academicSemester._id,

                        after: {
                            isRegistrationOpen: newStatus,
                            semester: {
                                name: updatedAcademicSemester.name,
                                session: updatedAcademicSemester.session,
                                startDate: updatedAcademicSemester.startDate,
                                endDate: updatedAcademicSemester.endDate
                            }
                        },
                        changedFields: ["isRegistrationOpen"],
                        systemImpact: {
                            scope: "system_wide",
                            departments: "all",
                            students: "all_registered_students",
                            courses: "all_courses_in_semester"
                        }
                    },
                    status: "SUCCESS",
                    reason: newStatus
                        ? `Registration opened for ALL departments in ${academicSemester.name} (${academicSemester.session})`
                        : `Registration closed for ALL departments in ${academicSemester.name} (${academicSemester.session})`,
                    metadata: {
                        semesterId: academicSemester._id,
                        oldStatus: oldRegistrationStatus,
                        newStatus: newStatus,
                        action: newStatus ? "opened_registration" : "closed_registration",
                        affectedDepartments: "ALL",
                        systemWide: true,
                        timestamp: new Date().toISOString(),
                        transactionTime: Date.now() - startTime
                    },
                    tags: [
                        newStatus ? "registration_opened" : "registration_closed",
                        "critical_operation",
                        "success"
                    ]
                };

                // Log success

                return {
                    success: true,
                    message: `Registration ${newStatus ? "opened" : "closed"} for ALL departments`,
                    academicSemester: {
                        _id: updatedAcademicSemester._id,
                        name: updatedAcademicSemester.name,
                        session: updatedAcademicSemester.session,
                        isRegistrationOpen: newStatus,
                        startDate: updatedAcademicSemester.startDate,
                        endDate: updatedAcademicSemester.endDate
                    },
                    auditLogId: successAuditData._id, // If audit log returns ID
                    operationTime: Date.now() - startTime,
                    auditContext: successAuditData // Return full audit context for controller use if needed
                };

            } finally {
                if (shouldEndSession) {
                    updateSession.endSession();
                }
            }

        } catch (error) {
            // Handle errors with audit logging
            const errorTime = Date.now();
            const errorAuditData = {
                action: "TOGGLE_REGISTRATION",
                entity: "AcademicSemester",
                status: "ERROR",
                reason: error.message || "Internal server error during registration toggle",
                severity: "CRITICAL",
                isSuspicious: true,
                requiresReview: true,
                tags: ["registration", "admin", "error", "system_configuration", "critical_failure"]
            };

            // Log error
            await AuditLogService.logOperation(errorAuditData);

            // Re-throw the error for controller handling
            throw error;
        }
    },

    /**
     * --------------------------------------------------
     * PRIVATE: PERFORM REGISTRATION TOGGLE
     * --------------------------------------------------
     */
    async _performRegistrationToggle(academicSemesterId, newStatus, userId, session) {
        // Update academic semester
        const updatedAcademicSemester = await AcademicSemester.findByIdAndUpdate(
            academicSemesterId,
            {
                isRegistrationOpen: newStatus,
                updatedBy: userId,
                updatedAt: new Date()
            },
            { new: true, session }
        );

        if (!updatedAcademicSemester) {
            throw new AppError("Failed to update academic semester");
        }

        return updatedAcademicSemester;
    },

    /**
     * --------------------------------------------------
     * CHECK REGISTRATION STATUS WITH AUDIT
     * --------------------------------------------------
     */
    async checkRegistrationStatusWithAudit({
        userId,
        userDetails,
        ipAddress,
        requestDetails,
        departmentId = null
    }) {
        const startTime = Date.now();

        try {
            const academicSemester = await this.getActiveAcademicSemester();

            if (!academicSemester) {
                return {
                    status: 'NO_ACTIVE_SEMESTER',
                    message: "No active academic semester found",
                    isRegistrationOpen: false,
                    academicSemester: null,
                    responseTime: Date.now() - startTime
                };
            }

            let departmentSpecific = false;
            let departmentInfo = null;

            // If departmentId provided, check specific department
            if (departmentId) {
                departmentSpecific = true;
                const departmentSemester = await DepartmentSemester.findOne({
                    department: departmentId,
                    academicSemester: academicSemester._id,
                    isActive: true
                }).populate('department', 'name code');

                departmentInfo = departmentSemester ? {
                    departmentId: departmentSemester.department._id,
                    departmentName: departmentSemester.department.name,
                    semesterId: departmentSemester._id
                } : null;
            }

            const isOpen = academicSemester.isRegistrationOpen;


            return {
                status: isOpen ? 'OPEN' : 'CLOSED',
                message: `Registration is ${isOpen ? 'OPEN' : 'CLOSED'}${departmentInfo ? ` for department ${departmentInfo.departmentName}` : ' for all departments'}`,
                isRegistrationOpen: isOpen,
                academicSemester: {
                    _id: academicSemester._id,
                    name: academicSemester.name,
                    session: academicSemester.session,
                    isRegistrationOpen: isOpen,
                    startDate: academicSemester.startDate,
                    endDate: academicSemester.endDate
                },
                departmentInfo,
                responseTime: Date.now() - startTime
            };

        } catch (error) {
            console.error("Error checking registration status:", error);


            throw error;
        }
    }
};

export default SemesterService;