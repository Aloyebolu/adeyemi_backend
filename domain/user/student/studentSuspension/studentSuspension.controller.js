import catchAsync from "#utils/catchAsync.js";
import buildResponse from "#utils/responseBuilder.js";
import StudentSuspensionService from "./studentSuspension.service.js";


/**
 * Used to suspend a user
 */
export const createSuspension = catchAsync(async (req, res) => {
        const { student_id } = req.params;
        const suspension = await StudentSuspensionService.createSuspension(
            student_id,
            req.body,
            req.user?._id
        );
        buildResponse.success(res, "Success", suspension)
});

export const getActiveSuspension = catchAsync(async (req, res) => {
        const { student_id } = req.params;
        const suspension = await StudentSuspensionService.getActiveSuspension(student_id);
        buildResponse.success(res, "Success", suspension)    
});

export const getStudentSuspensions = catchAsync(async (req, res) => {
        const { student_id } = req.params;
        const suspensions = await StudentSuspensionService.getStudentSuspensions(student_id);
        buildResponse.success(res, "Success", suspensions)
});

export const liftSuspension = catchAsync(async (req, res) => {
        const { student_id, suspension_id } = req.params;
        const suspension = await StudentSuspensionService.liftSuspension(
            student_id,
            suspension_id,
            req.user?._id
        );
        buildResponse.success(res, "Success", suspension)
});