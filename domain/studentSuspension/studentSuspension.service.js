import { logger } from "../../utils/logger.js";
import mongoose from "mongoose";
import Student from "../student/student.model.js";
import { SUSPENSION_AUDIT, SUSPENSION_STATUS, SUSPENSION_TYPES } from "./studentSuspension.constants.js";
import AppError from "../errors/AppError.js";

class StudentSuspensionService {

    //  Create Suspension
    async createSuspension(student_id, payload, actor_id) {
        // ✅ Check student exists
        const student = await Student.findById(student_id);
        if (!student) throw new AppError("Student not found");

        // ✅ Validate payload fields
        const { type, reason, start_date, end_date } = payload;
        if (!type || ![SUSPENSION_TYPES.PUNISHMENT, SUSPENSION_TYPES.ADMINISTRATIVE].includes(type)) {
            throw new AppError("Invalid or missing suspension type");
        }
        if (!reason || reason.trim() === "") throw new AppError("Reason is required");
        if (!start_date || !end_date) throw new AppError("Start date and end date are required");
        if (new Date(end_date) < new Date(start_date)) throw new AppError("End date cannot be before start date");

        // ✅ Initialize suspension array if missing
        if (!Array.isArray(student.suspension)) student.suspension = [];

        // ✅ Create suspension object
        const suspension = {
            type,
            reason,
            start_date: new Date(start_date),
            end_date: new Date(end_date),
            status: SUSPENSION_STATUS.ACTIVE,
            is_active: true,
            created_by: actor_id
        };

        // ✅ Push and save
        student.suspension.push(suspension);
        await student.save();


        // 🧾 Audit log
        logger.info(SUSPENSION_AUDIT.CREATED, {
            student_id,
            suspension_id: suspension._id,
            actor_id,
            type: suspension.type
        });

        return suspension;
    }

    // 🔍 Get Active Suspension
    async getActiveSuspension(student_id) {
        const student = await Student.findById(student_id);
        if (!student) throw new Error("Student not found");

        return student.suspension.find(s => s.is_active);
    }

    // 📜 Get All Suspensions
    async getStudentSuspensions(student_id) {
        const student = await Student.findById(student_id);
        if (!student) throw new Error("Student not found");

        return student.suspension;
    }

    // 🛑 Lift Suspension
    async liftSuspension(student_id, suspension_id, actor_id) {
        const student = await Student.findById(student_id);
        if (!student) throw new Error("Student not found");

        const suspension = student.suspension.id(suspension_id);
        if (!suspension) throw new Error("Suspension not found");

        suspension.is_active = false;
        suspension.status = SUSPENSION_STATUS.LIFTED;
        suspension.lifted_at = new Date();
        suspension.lifted_by = actor_id;

        await student.save();

        logger.warn(SUSPENSION_AUDIT.LIFTED, {
            student_id,
            suspension_id,
            actor_id
        });

        return suspension;
    }

    // ⏳ Auto Expire Suspensions
    async expireSuspensions() {
        const students = await Student.find({
            "suspension.is_active": true
        });

        for (const student of students) {
            let updated = false;

            student.suspension.forEach(s => {
                if (s.is_active && s.end_date && s.end_date < new Date()) {
                    s.is_active = false;
                    s.status = SUSPENSION_STATUS.EXPIRED;
                    updated = true;
                }
            });

            if (updated) await student.save();
        }

        logger.info("Suspension expiration job executed");
    }

    // 🚫 Access Guard
    async checkStudentAccess(student_id) {
        const suspension = await this.getActiveSuspension(student_id);

        if (!suspension) return { allowed: true };

        return {
            allowed: false,
            reason: suspension.type,
            suspension
        };
    }
}

export default new StudentSuspensionService();








/**
 * YOU MIGHT CONSIDER SWITCHING TO THIS IF YOU WANT TO USE A SEPARATE COLLECTION FOR SUSPENSIONS INSTEAD OF EMBEDDING IN STUDENT DOCUMENTS. THIS APPROACH IS MORE SCALABLE AND FLEXIBLE BUT REQUIRES MORE COMPLEXITY IN MAINTAINING DATA CONSISTENCY AND BACKWARD COMPATIBILITY.
 * CURRENTLY THE MODEL IS OF NO USE AND WOULD BE IN USE IF WE SWITCH TO THE NEW APPROACH. THE SERVICE CODE BELOW ALSO REFLECTS THE NEW APPROACH. THE CONTROLLER CODE REMAINS THE SAME AS IT CALLS SERVICE METHODS, SO NO CHANGE NEEDED THERE.
**/

// OLD CODE - IGNORE
/* services/studentSuspension/studentSuspension.service.js
import { logger } from "../../utils/logger.js";
import mongoose from "mongoose";
import Student from "../student/student.model.js";
import StudentSuspension from "./studentSuspension.model.js";
import { SUSPENSION_AUDIT, SUSPENSION_STATUS, SUSPENSION_TYPES } from "./studentSuspension.constants.js";
import AppError from "../errors/AppError.js";

class StudentSuspensionService {

    //  Create Suspension
    async createSuspension(student_id, payload, actor_id) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // ✅ Check student exists
            const student = await Student.findById(student_id).session(session);
            if (!student) throw new AppError("Student not found");

            // ✅ Validate payload fields
            const { type, reason, start_date, end_date } = payload;
            if (!type || ![SUSPENSION_TYPES.PUNISHMENT, SUSPENSION_TYPES.ADMINISTRATIVE].includes(type)) {
                throw new AppError("Invalid or missing suspension type");
            }
            if (!reason || reason.trim() === "") throw new AppError("Reason is required");
            if (!start_date || !end_date) throw new AppError("Start date and end date are required");
            
            const startDate = new Date(start_date);
            const endDate = new Date(end_date);
            if (endDate < startDate) throw new AppError("End date cannot be before start date");

            // ✅ Deactivate any existing active suspensions
            await StudentSuspension.updateMany(
                { 
                    student_id: student_id, 
                    is_active: true 
                },
                { 
                    is_active: false, 
                    status: SUSPENSION_STATUS.LIFTED,
                    lifted_at: new Date(),
                    lifted_by: actor_id
                },
                { session }
            );

            // ✅ Create new suspension in separate collection
            const suspension = await StudentSuspension.create([{
                student_id,
                type,
                reason,
                start_date: startDate,
                end_date: endDate,
                status: SUSPENSION_STATUS.ACTIVE,
                is_active: true,
                created_by: actor_id
            }], { session });

            // ✅ Maintain backward compatibility: add reference to student document
            if (!Array.isArray(student.suspension)) student.suspension = [];
            
            // Create a compatible object for the student.suspension array
            const compatibleSuspension = {
                _id: suspension[0]._id,
                type: suspension[0].type,
                reason: suspension[0].reason,
                start_date: suspension[0].start_date,
                end_date: suspension[0].end_date,
                status: suspension[0].status,
                is_active: suspension[0].is_active,
                created_by: suspension[0].created_by,
                suspension_ref: suspension[0]._id // Reference to new model
            };
            
            student.suspension.push(compatibleSuspension);
            await student.save({ session });

            await session.commitTransaction();

            // 🧾 Audit log
            logger.info(SUSPENSION_AUDIT.CREATED, {
                student_id,
                suspension_id: suspension[0]._id,
                actor_id,
                type: suspension[0].type
            });

            return suspension[0];
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // 🔍 Get Active Suspension
    async getActiveSuspension(student_id) {
        // First try the new model
        const activeSuspension = await StudentSuspension.findOne({
            student_id: student_id,
            is_active: true,
            end_date: { $gt: new Date() }
        }).populate('created_by lifted_by');

        if (activeSuspension) return activeSuspension;

        // Fallback to student document for backward compatibility
        const student = await Student.findById(student_id);
        if (!student) throw new Error("Student not found");

        return student.suspension?.find(s => s.is_active && new Date(s.end_date) > new Date());
    }

    // 📜 Get All Suspensions
    async getStudentSuspensions(student_id) {
        // Get from new model
        const suspensions = await StudentSuspension.find({ student_id })
            .sort({ created_at: -1 })
            .populate('created_by lifted_by');

        if (suspensions.length > 0) return suspensions;

        // Fallback to student document
        const student = await Student.findById(student_id);
        if (!student) throw new Error("Student not found");

        return student.suspension || [];
    }

    // 🛑 Lift Suspension
    async liftSuspension(student_id, suspension_id, actor_id) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Try to lift from new model first
            const suspension = await StudentSuspension.findById(suspension_id).session(session);
            
            if (suspension && suspension.student_id.toString() === student_id) {
                suspension.is_active = false;
                suspension.status = SUSPENSION_STATUS.LIFTED;
                suspension.lifted_at = new Date();
                suspension.lifted_by = actor_id;
                await suspension.save({ session });

                // Update student document for backward compatibility
                const student = await Student.findById(student_id).session(session);
                if (student && student.suspension) {
                    const oldSuspension = student.suspension.id(suspension_id);
                    if (oldSuspension) {
                        oldSuspension.is_active = false;
                        oldSuspension.status = SUSPENSION_STATUS.LIFTED;
                        oldSuspension.lifted_at = new Date();
                        oldSuspension.lifted_by = actor_id;
                        await student.save({ session });
                    }
                }

                await session.commitTransaction();

                logger.warn(SUSPENSION_AUDIT.LIFTED, {
                    student_id,
                    suspension_id,
                    actor_id
                });

                return suspension;
            }

            // Fallback to student document
            const student = await Student.findById(student_id).session(session);
            if (!student) throw new Error("Student not found");

            const oldSuspension = student.suspension?.id(suspension_id);
            if (!oldSuspension) throw new Error("Suspension not found");

            oldSuspension.is_active = false;
            oldSuspension.status = SUSPENSION_STATUS.LIFTED;
            oldSuspension.lifted_at = new Date();
            oldSuspension.lifted_by = actor_id;

            await student.save({ session });
            await session.commitTransaction();

            logger.warn(SUSPENSION_AUDIT.LIFTED, {
                student_id,
                suspension_id,
                actor_id
            });

            return oldSuspension;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // ⏳ Auto Expire Suspensions
    async expireSuspensions() {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Expire from new model
            const now = new Date();
            const expiredSuspensions = await StudentSuspension.find({
                is_active: true,
                end_date: { $lt: now }
            }).session(session);

            for (const suspension of expiredSuspensions) {
                suspension.is_active = false;
                suspension.status = SUSPENSION_STATUS.EXPIRED;
                await suspension.save({ session });

                // Update corresponding student document
                const student = await Student.findById(suspension.student_id).session(session);
                if (student && student.suspension) {
                    const oldSuspension = student.suspension.id(suspension._id);
                    if (oldSuspension) {
                        oldSuspension.is_active = false;
                        oldSuspension.status = SUSPENSION_STATUS.EXPIRED;
                    }
                }
            }

            // Also handle legacy suspensions in student documents
            const students = await Student.find({
                "suspension.is_active": true,
                "suspension.end_date": { $lt: now }
            }).session(session);

            for (const student of students) {
                let updated = false;
                student.suspension.forEach(s => {
                    if (s.is_active && s.end_date && new Date(s.end_date) < now) {
                        s.is_active = false;
                        s.status = SUSPENSION_STATUS.EXPIRED;
                        updated = true;
                    }
                });
                if (updated) await student.save({ session });
            }

            await session.commitTransaction();
            logger.info("Suspension expiration job executed");
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    // 🚫 Access Guard
    async checkStudentAccess(student_id) {
        const suspension = await this.getActiveSuspension(student_id);

        if (!suspension) return { allowed: true };

        return {
            allowed: false,
            reason: suspension.type,
            suspension
        };
    }

    // Migration helper to move existing suspensions to new model
    async migrateExistingSuspensions() {
        const students = await Student.find({ suspension: { $exists: true, $ne: [] } });
        
        for (const student of students) {
            for (const oldSuspension of student.suspension) {
                // Check if already migrated
                const exists = await StudentSuspension.findOne({ _id: oldSuspension._id });
                if (!exists) {
                    await StudentSuspension.create({
                        _id: oldSuspension._id,
                        student_id: student._id,
                        type: oldSuspension.type,
                        reason: oldSuspension.reason,
                        start_date: oldSuspension.start_date,
                        end_date: oldSuspension.end_date,
                        status: oldSuspension.status,
                        is_active: oldSuspension.is_active,
                        created_by: oldSuspension.created_by,
                        lifted_at: oldSuspension.lifted_at,
                        lifted_by: oldSuspension.lifted_by
                    });
                }
            }
        }
        
        logger.info("Migration completed for existing suspensions");
    }
}

export default new StudentSuspensionService(); 

*/