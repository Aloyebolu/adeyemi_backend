import userService from './user.service.js';
import authService from '#domain/auth/auth.service.js';
import catchAsync from '#utils/catchAsync.js';
import AppError from '#shared/errors/AppError.js';
import buildResponse from '#utils/responseBuilder.js';
import userModel from './user.model.js';
import FileService from '#domain/files/files.service.js';
import fetchDataHelper, { fetchData } from '#utils/fetchDataHelper.js';
import { resolveUserName } from '#utils/resolveUserName.js';

/**
 * 
 * @desc    Create new user (signup)
 * @route   POST /api/users/signup
 * @access  Public
*/
const signup = catchAsync(async (req, res) => {
    const userData = req.body;

    // Create user
    const newUser = await userService.createUser(userData);

    return buildResponse.success(res, 'Signup successful!', { user: newUser }, 201);
});
/**
 * 
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
*/
const getProfile = catchAsync(async (req, res) => {
    const userId = req.user._id;

    // Get profile data
    const profileData = await userService.getUserProfile(userId);

    // Get password status
    const passwordStatus = await authService.getPasswordStatus(userId);

    // Combine data
    const response = {
        ...profileData,
        lastPasswordChange: profileData.lastPasswordChange,
        passwordAgeDays: passwordStatus.passwordAgeDays,
        passwordExpiryDays: profileData.passwordExpiryDays,
        passwordStrength: passwordStatus.passwordStrength,
        passwordStatus
    };

    return buildResponse.success(res, 'Profile retrieved', response);
});

// @desc    Delete user (generic)
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { role, model } = req.body; // Can specify role or model in body

    // This function would need implementation in service
    // For now, keeping your existing logic
    throw new AppError('Delete functionality currently disabled', 501);
});

async function uploadAvatar(req, res, next) {
    try {
        const file = req.files?.avatar;
        const userId = req.user._id;

        if (!file) {
            throw new AppError("No avatar file provided", 400);
        }

        // Validate image type manually if needed
        const allowed = ["image/jpeg", "image/png", "image/webp"];
        if (!allowed.includes(file.mimetype)) {
            throw new AppError("Only JPG, PNG or WEBP allowed", 400);
        }

        const uploadedFile = await FileService.uploadFile(
            file,
            userId,
            "user",      // domain
            userId,      // domainId MUST exist here
            {
                category: "avatar",
                isPublic: true,   // avatars should be public
                accessRoles: ["all"],
                tags: ["avatar", "profile"],
                customMetadata: {
                    type: "avatar",
                    uploadedAt: new Date().toISOString()
                }
            }
        );

        // Save avatar reference on user document
        await userModel.findByIdAndUpdate(userId, {
            avatar: uploadedFile.url,
        });

        return buildResponse(res, 200, "Avatar uploaded successfully", { avatarUrl: uploadedFile.url })

    } catch (err) {
        next(err);
    }
}


async function getUsers(req, res, next) {
    // FILTER / SEARCH MODE (READ intent) - NO AUDIT LOGGING FOR READS
    if (req._intent === "READ") {
        const safeFilters = { ...(req.body.filters || {}) };
        const { extras } = req.body || {};
        const searchTerm = req.body.search_term || {}


        const result = await fetchDataHelper(req, res, userModel, {
            lookups: [
                {
                    from: "students",
                    localField: "_id",
                    foreignField: "_id",
                    as: "student",
                    pipeline: [
                        { $match: { matricNumber: { $regex: searchTerm, $options: "i" } } }
                    ]
                },
                {
                    from: "lecturers",
                    localField: "_id",
                    foreignField: "_id",
                    as: "lecturer",
                    pipeline: [
                        { $match: { staffId: { $regex: searchTerm, $options: "i" } } }
                    ]
                }
            ],
            custom_fields: {
                staffId: 'lecturer.staffId',
                matricNumber: 'student.matricNumber'
            },
            populate: [
                { path: "lecturer" },
                { path: "student" },
                { path: "staff" },
            ],
            configMap: {
                "name": (user) => resolveUserName(user),
                "_id": (user) => user._id,
                "avatar": (user) => user.avatar,
                "institutionId": (user) => user?.lecturer?.staffId || user?.staff?.staffId || user?.student?.matricNumber 

            }
        });
        // return buildResponse.success(res, result)
        return;
    }

}
async function getUser(req, res, next) {
    try {
        const user = await userModel.findById(req?.params?.id)
        if (!user) {
            throw new AppError("User not found", 404);
        }

        return buildResponse.success(res, "Success", user)
    } catch (err) {
        next(err)
    }

}
export {
    signup,
    getProfile,
    deleteUser,
    uploadAvatar,
    getUsers,
    getUser
};