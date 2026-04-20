import Programme from './programme.model.js';
import { logger } from '#utils/logger.js';
import AppError from '#shared/errors/AppError.js';
import { DepartmentService } from '#domain/organization/department/department.service.js';

class ProgrammeService {
    /**
     * Get programme by ID with optional population and session
     */
    async getProgrammeById(id, options = {}) {
        try {
            let query = Programme.findById(id);

            if (options.session) {
                query = query.session(options.session);
            }

            if (options.populate) {
                query = query.populate(options.populate);
            }

            if (options.lean) {
                query = query.lean();
            }

            const programme = await query;

            if (!programme && options.throwIfNotFound !== false) {
                throw new AppError(`Programme with id ${id} not found`);
            }

            return programme;
        } catch (error) {
            logger.error(`ProgrammeService.getProgrammeById failed: ${error.message}`, {
                programmeId: id,
                options,
                stack: error.stack
            });
            throw error;
        }
    }
    getProgrammeById = async (programmeId) => {
        const programme = await Programme.findById(programmeId);

        if (!programme) {
            throw new AppError("Programme not found", 404);
        }

        return programme;
    };

    /**
     * Get programmes by department ID
     */
    async getProgrammesByDepartment(departmentId, options = {}) {
        try {
            let query = Programme.find({ department: departmentId });

            if (options.session) {
                query = query.session(options.session);
            }

            if (options.populate) {
                query = query.populate(options.populate);
            }

            if (options.lean) {
                query = query.lean();
            }

            if (options.sort) {
                query = query.sort(options.sort);
            }

            if (options.isActive !== undefined) {
                query = query.where('isActive').equals(options.isActive);
            }

            if (options.limit) {
                query = query.limit(options.limit);
            }

            if (options.skip) {
                query = query.skip(options.skip);
            }

            return await query;
        } catch (error) {
            logger.error(`ProgrammeService.getProgrammesByDepartment failed: ${error.message}`, {
                departmentId,
                options,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Check if programme exists
     */
    async programmeExists(id) {
        try {
            const count = await Programme.countDocuments({ _id: id });
            return count > 0;
        } catch (error) {
            logger.error(`ProgrammeService.programmeExists failed: ${error.message}`, {
                programmeId: id,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Validate programme data
     */
    validateProgrammeData(data) {
        const { name, code, department, degreeType, programmeType, duration } = data;

        if (!name || !code || !department || !degreeType || !programmeType || !duration) {
            throw new AppError("Required fields: name, code, department, degreeType, programmeType, duration", 400);
        }

        // Validate degreeType
        const validDegreeTypes = ['BACHELOR', 'MASTER', 'PHD', 'DIPLOMA', 'CERTIFICATE'];
        if (!validDegreeTypes.includes(degreeType)) {
            throw new AppError(`Invalid degree type. Must be one of: ${validDegreeTypes.join(', ')}`, 400);
        }

        // Validate duration
        if (duration < 1 || duration > 7) {
            throw new AppError("Duration must be between 1 and 7 years", 400);
        }

        return true;
    }

    /**
     * Check for duplicate programme
     */
    async checkDuplicateProgramme(name, code, excludeId = null) {
        try {
            const query = { $or: [{ name }, { code }] };
            if (excludeId) {
                query._id = { $ne: excludeId };
            }

            const existing = await Programme.findOne(query);

            if (existing) {
                if (existing.name === name) {
                    // throw new AppError("Programme with this name already exists");
                }
                if (existing.code === code) {
                    throw new AppError("Programme with this code already exists");
                }
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Create new programme
     */
    async createProgramme(programmeData) {
        try {
            await this.validateProgrammeData(programmeData);
            await this.checkDuplicateProgramme(programmeData.name, programmeData.code);

            // Validate department exists
            const department = await DepartmentService.getDepartmentById(programmeData.department);
            if (!department) {
                throw new AppError("Department not found");
            }

            // Create programme
            const programme = await Programme.create({
                ...programmeData,
                department: programmeData.department,
                faculty: department.faculty // Auto-populated by pre-save middleware
            });

            logger.info(`Programme created: ${programme.name} (${programme.code})`);
            return programme;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update programme
     */
    async updateProgramme(programmeId, updateData, user) {
        try {
            const programme = await Programme.findById(programmeId);
            if (!programme) {
                throw new AppError("Programme not found");
            }

            const { name, code, department, ...otherUpdates } = updateData;

            // Check duplicates (excluding current programme)
            if (name || code) {
                await this.checkDuplicateProgramme(
                    name || programme.name,
                    code || programme.code,
                    programmeId
                );
            }

            // Update fields
            const updatedFields = {};

            if (name) updatedFields.name = name;
            if (code) updatedFields.code = code;

            // Handle department change
            if (department) {
                const newDepartment = await DepartmentService.getDepartmentById(department);
                if (!newDepartment) {
                    throw new AppError("New department not found");
                }
                updatedFields.department = department;
                updatedFields.faculty = newDepartment.faculty;
            }

            // Update other fields
            Object.keys(otherUpdates).forEach(key => {
                if (otherUpdates[key] !== undefined) {
                    updatedFields[key] = otherUpdates[key];
                }
            });

            // Add update metadata
            updatedFields.lastUpdatedBy = user._id;

            // Apply updates
            Object.assign(programme, updatedFields);
            await programme.save();

            logger.info(`Programme updated: ${programme.name} (${programme.code})`);
            return programme;
        } catch (error) {
            logger.error(`ProgrammeService.updateProgramme failed: ${error.message}`, {
                programmeId,
                updateData,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Update programme status (soft delete)
     */
    async updateProgrammeStatus(programmeId, isActive, updatedBy) {
        try {
            const programme = await Programme.findById(programmeId);
            if (!programme) {
                throw new AppError("Programme not found");
            }

            programme.isActive = isActive;
            programme.lastUpdatedBy = updatedBy;

            await programme.save();

            logger.info(`Programme status updated: ${programme.name} is now ${isActive ? 'active' : 'inactive'}`);
            return programme;
        } catch (error) {
            logger.error(`ProgrammeService.updateProgrammeStatus failed: ${error.message}`, {
                programmeId,
                isActive,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Delete programme (soft delete)
     */
    async deleteProgramme(programmeId, deletedBy) {
        try {
            const programme = await Programme.findById(programmeId);
            if (!programme) {
                throw new AppError("Programme not found");
            }

            // Check if programme has active students (you might want to add this check)
            // For now, we'll just soft delete

            programme.isActive = false;
            programme.lastUpdatedBy = deletedBy;
            await programme.save();

            logger.info(`Programme soft deleted: ${programme.name} (${programme.code})`);
        } catch (error) {
            logger.error(`ProgrammeService.deleteProgramme failed: ${error.message}`, {
                programmeId,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Get programme count with filters
     */
    async getProgrammesCount(filter = {}) {
        try {
            const count = await Programme.countDocuments(filter);
            return count;
        } catch (error) {
            logger.error(`ProgrammeService.getProgrammesCount failed: ${error.message}`, {
                filter,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Get programmes by degree type
     */
    async getProgrammesByDegreeType(degreeType, options = {}) {
        try {
            const query = {
                degreeType: degreeType.toUpperCase(),
                isActive: options.isActive !== undefined ? options.isActive : true
            };

            if (options.departmentId) {
                query.department = options.departmentId;
            }

            if (options.facultyId) {
                query.faculty = options.facultyId;
            }

            let dbQuery = Programme.find(query).sort({ name: 1 });

            if (options.populate) {
                dbQuery = dbQuery.populate(options.populate);
            }

            if (options.limit) {
                dbQuery = dbQuery.limit(options.limit);
            }

            if (options.skip) {
                dbQuery = dbQuery.skip(options.skip);
            }

            return await dbQuery;
        } catch (error) {
            logger.error(`ProgrammeService.getProgrammesByDegreeType failed: ${error.message}`, {
                degreeType,
                options,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Get accredited programmes
     */
    async getAccreditedProgrammes(options = {}) {
        try {
            const query = {
                accreditationStatus: 'ACCREDITED',
                isActive: true
            };

            if (options.departmentId) {
                query.department = options.departmentId;
            }

            let dbQuery = Programme.find(query).sort({ name: 1 });

            if (options.populate) {
                dbQuery = dbQuery.populate(options.populate);
            }

            return await dbQuery;
        } catch (error) {
            logger.error(`ProgrammeService.getAccreditedProgrammes failed: ${error.message}`, {
                options,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * Create audit context for programme operations
     */
    createAuditContext(action, status, reason, metadata = {}, changes = {}) {
        let severity = "MEDIUM";
        if (status === "ERROR") severity = "CRITICAL";
        if (status === "FAILURE" && reason.includes("Unauthorized")) severity = "HIGH";

        return {
            action,
            resource: "Programme",
            severity,
            entityId: metadata.programmeId || null,
            status,
            reason,
            changes,
            metadata: {
                performedBy: metadata.performedBy,
                performedByUserId: metadata.performedByUserId,
                ...metadata
            }
        };
    }

    /**
     * Search programmes
     */
    async searchProgrammes(searchTerm, options = {}) {
        try {
            const query = {
                $or: [
                    { name: { $regex: searchTerm, $options: 'i' } },
                    { code: { $regex: searchTerm, $options: 'i' } }
                ],
                isActive: options.isActive !== undefined ? options.isActive : true
            };

            if (options.departmentId) {
                query.department = options.departmentId;
            }

            if (options.facultyId) {
                query.faculty = options.facultyId;
            }

            if (options.degreeType) {
                query.degreeType = options.degreeType;
            }

            let dbQuery = Programme.find(query).sort({ name: 1 });

            if (options.populate) {
                dbQuery = dbQuery.populate(options.populate);
            }

            if (options.limit) {
                dbQuery = dbQuery.limit(options.limit);
            }

            if (options.skip) {
                dbQuery = dbQuery.skip(options.skip);
            }

            return await dbQuery;
        } catch (error) {
            logger.error(`ProgrammeService.searchProgrammes failed: ${error.message}`, {
                searchTerm,
                options,
                stack: error.stack
            });
            throw error;
        }
    }
}

// Export singleton instance
export default new ProgrammeService();