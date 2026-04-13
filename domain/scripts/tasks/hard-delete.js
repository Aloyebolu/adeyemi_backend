import mongoose from "mongoose";
import AppError from "../../errors/AppError.js";

/**
 * Script to hard delete entities (students, courses, lecturers) from the database
 * This performs permanent deletion with cascade options
 */
export default {
    name: "hard-delete",
    description: "Permanently delete a student, course, or lecturer with cascade options",

    /**
     * Execute the hard delete script
     * @param {Object} deps - Dependencies
     * @param {Object} deps.models - Database models
     * @param {Object} params - Script parameters
     * @param {string} params.entityType - Type of entity: 'student', 'course', or 'lecturer'
     * @param {string} params.entityId - ID of the entity to delete
     * @param {boolean} params.cascade - Whether to delete related records
     * @param {boolean} params.confirm - Confirmation flag (must be true)
     * @returns {Promise<Object>} Execution result
     */
    run: async (deps, params) => {
        const { models } = deps;
        const { entityType, entityId, cascade = false, confirm = false } = params;


        // Safety check - require explicit confirmation
        if (!confirm) {
            throw new AppError("Confirmation required: Set 'confirm: true' to proceed with hard delete");
        }

        // Validate entity type
        const validTypes = ['student', 'course', 'lecturer'];
        if (!validTypes.includes(entityType)) {
            throw new AppError(`Invalid entity type. Must be one of: ${validTypes.join(', ')}`);
        }

        // Validate entity ID
        if (!entityId) {
            throw new AppError("Entity ID is required");
        }
        if (!mongoose.isValidObjectId(entityId)) {
            throw new AppError("Entity id incorrect")
        }
        // Get the appropriate model
        let Model, relatedModels = [];
        switch (entityType) {
            case 'student':
                Model = models.User; // Assuming User model with role discriminator
                relatedModels = [
                    { model: models.Result, field: 'student', description: 'results' },
                    { model: models.Attendance, field: 'student', description: 'attendance records' },
                    { model: models.Enrollment, field: 'student', description: 'enrollments' }
                ];
                break;
            case 'lecturer':
                Model = models.User; // Assuming User model with role discriminator
                relatedModels = [
                    { model: models.Course, field: 'lecturer', description: 'courses taught' },
                    { model: models.Attendance, field: 'lecturer', description: 'attendance records' }
                ];
                break;
            case 'course':
                Model = models.Course;
                relatedModels = [
                    { model: models.Result, field: 'course', description: 'results' },
                    { model: models.Enrollment, field: 'course', description: 'enrollments' },
                    { model: models.Schedule, field: 'course', description: 'schedules' }
                ];
                break;
        }

        // Find the entity first
        let entity;
        if (entityType === 'student' || entityType === 'lecturer') {
            // For users, filter by role
            const role = entityType === 'student' ? 'student' : 'lecturer';
            entity = await Model.findOne({
                _id: entityId,
                role: role
            });
        } else {
            entity = await Model.findById(entityId);
        }

        if (!entity) {
            throw new AppError(`${entityType} with ID ${entityId} not found`, 404);
        }

        // Store entity info for audit
        const entityInfo = {
            id: entity._id,
            name: entity.name || entity.title || entity.email,
            // Add other identifying fields
            ...(entity.email && { email: entity.email }),
            ...(entity.code && { code: entity.code })
        };

        const deletedRecords = {
            main: null,
            related: []
        };

        // Handle cascade deletion if requested
        if (cascade) {
            for (const rel of relatedModels) {
                try {
                    const result = await rel.model.deleteMany({ [rel.field]: entityId });
                    if (result.deletedCount > 0) {
                        deletedRecords.related.push({
                            type: rel.description,
                            count: result.deletedCount
                        });
                    }
                } catch (error) {
                    console.warn(`Failed to delete related ${rel.description}:`, error.message);
                    // Continue with main deletion even if related deletion fails
                }
            }
        } else {
            // Check for related records if not cascading
            const relatedCounts = [];
            for (const rel of relatedModels) {
                const count = await rel.model.countDocuments({ [rel.field]: entityId });
                if (count > 0) {
                    relatedCounts.push(`${count} ${rel.description}`);
                }
            }

            if (relatedCounts.length > 0) {
                throw new AppError(
                    `Cannot delete: Found related records (${relatedCounts.join(', ')}). ` +
                    `Use cascade: true to delete related records as well.`
                );
            }
        }

        // Perform the hard delete
        const deletedEntity = await Model.findByIdAndDelete(entityId);
        deletedRecords.main = {
            type: entityType,
            id: deletedEntity._id,
            name: entityInfo.name
        };

        return {
            summary: {
                entityType,
                entityId,
                entityName: entityInfo.name,
                mainDeleted: true,
                relatedDeleted: deletedRecords.related.length,
                totalRelatedRecords: deletedRecords.related.reduce((acc, curr) => acc + curr.count, 0)
            },
            details: {
                deleted: deletedRecords,
                warnings: cascade ? [] : ['Related records were preserved']
            },
            message: `Successfully hard deleted ${entityType}: ${entityInfo.name}`
        };
    }
};