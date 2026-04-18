// courseMaterial.service.js
import AppError from "#shared/errors/AppError.js";
import FileService from "#domain/files/files.service.js";
import CourseMaterial from "./courseMaterial.model.js";

class CourseMaterialService {
    /**
     * Create course material with proper File attachment
     */
    static async createMaterial(courseAssignmentId, userId, file, data) {
        let uploadedFile = null;

        try {
            // 1️⃣ Upload to storage layer
            uploadedFile = await FileService.uploadFile(
                file,
                userId,
                "course",
                courseAssignmentId,
                {
                    category: "course_material",
                    accessRoles: data.isPreview ? ["all"] : ["enrolled", "instructor"],
                    tags: [data.materialType, ...(data.tags || [])],
                    customMetadata: {
                        materialType: data.materialType,
                        week: data.week,
                        originalFileName:
                            file.originalname || file.name
                    }
                }
            );

            // 2️⃣ Create CourseMaterial (DB layer)
            const material = await CourseMaterial.create({
                courseAssignment: courseAssignmentId,
                file: uploadedFile._id,
                title: data.title || uploadedFile.originalName,
                description: data.description,
                week: data.week,
                lectureNumber: data.lectureNumber,
                topic: data.topic,
                order: data.order,
                materialType: data.materialType || "resource",
                isPreview: data.isPreview || false,
                isPublished: data.isPublished !== false,
                availableFrom: data.availableFrom,
                availableTo: data.availableTo,
                tags: data.tags,
                estimatedDuration: data.estimatedDuration,
                uploadedBy: userId
            });

            // 3️⃣ Return populated material
            return await material.populate([
                { path: "file", select: "url name type size" },
                { path: "uploadedBy", select: "name email" }
            ]);

        } catch (error) {
            // 🔁 ROLLBACK LOGIC
            if (uploadedFile?._id) {
                try {
                    await FileService.deleteFile(uploadedFile._id);
                } catch (rollbackError) {
                    console.error(
                        "ROLLBACK FAILED: Orphaned file detected",
                        rollbackError
                    );
                }
            }

            throw error;
        }
    }


    /**
     * Get materials for a course assignment with proper filtering
     */
    static async getMaterials(courseAssignmentId, options = {}) {
        const {
            userRole, // 'student', 'instructor', 'ta', 'admin'
            userId, // for enrolled check if needed
            includeUnpublished = false,
            materialType,
            week,
            isPreview,
            page = 1,
            limit = 50,
            sortBy = 'order',
            sortOrder = 'asc'
        } = options;

        const query = { courseAssignment: courseAssignmentId };

        // Access control based on role
        if (userRole === 'student') {
            query.isPublished = true;
            const now = new Date();
            query.$or = [
                { availableFrom: { $lte: now }, availableTo: { $gte: now } },
                { availableFrom: null, availableTo: null },
                { availableFrom: { $lte: now }, availableTo: null },
                { availableFrom: null, availableTo: { $gte: now } }
            ];
        }

        // Additional filters
        if (materialType) query.materialType = materialType;
        if (week !== undefined) query.week = week;
        if (isPreview !== undefined) query.isPreview = isPreview;

        // If instructor/TA/admin wants to see everything
        if (includeUnpublished && ['instructor', 'ta', 'admin'].includes(userRole)) {
            delete query.isPublished;
        }

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        const [materials, total] = await Promise.all([
            CourseMaterial.find(query)
                .populate({
                    path: 'file',
                    select: 'url name type size extension createdAt'
                })
                .populate('uploadedBy', 'name email')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            CourseMaterial.countDocuments(query)
        ]);

        // Check file access for each material
        const accessibleMaterials = await Promise.all(
            materials.map(async (material) => {
                // Add virtual isAvailable check
                const now = new Date();
                material.isAvailable = true;
                if (!material.isPublished) material.isAvailable = false;
                if (material.availableFrom && now < material.availableFrom) material.isAvailable = false;
                if (material.availableTo && now > material.availableTo) material.isAvailable = false;

                return material;
            })
        );

        return {
            data: accessibleMaterials,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get material for student access with all checks
     */
    static async getMaterialForStudent(materialId, userId, enrollmentCheck) {
        const material = await CourseMaterial.findById(materialId)
            .populate({
                path: 'file',
                select: 'url name type size accessRoles isPublic'
            })
            .populate({
                path: 'courseAssignment',
                select: 'course instructor',
                populate: {
                    path: 'course',
                    select: 'title'
                }
            });

        if (!material) throw new AppError("Material not found");

        // Check if material is published
        if (!material.isPublished) {
            throw new AppError("This material is not available");
        }

        // Check availability dates
        const now = new Date();
        if (material.availableFrom && now < material.availableFrom) {
            throw new AppError(`Material will be available from ${material.availableFrom.toDateString()}`);
        }
        if (material.availableTo && now > material.availableTo) {
            throw new AppError("This material is no longer available");
        }

        // Check enrollment (optional - pass a function to check)
        if (enrollmentCheck && !material.isPreview) {
            const isEnrolled = await enrollmentCheck(userId, material.courseAssignment._id);
            if (!isEnrolled) {
                throw new AppError("You must be enrolled in this course to access this material");
            }
        }

        // Increment view count
        await CourseMaterial.findByIdAndUpdate(materialId, {
            $inc: { viewsCount: 1 }
        });

        return material;
    }

    /**
     * Update material (pedagogy metadata only)
     */
    static async updateMaterial(materialId, updates, updatedBy) {
        // Don't allow direct file updates - that's File model's job
        const allowedUpdates = [
            'title', 'description', 'week', 'lectureNumber', 'topic',
            'order', 'materialType', 'isPreview', 'isPublished',
            'availableFrom', 'availableTo', 'tags', 'estimatedDuration'
        ];

        const filteredUpdates = Object.keys(updates)
            .filter(key => allowedUpdates.includes(key))
            .reduce((obj, key) => {
                obj[key] = updates[key];
                return obj;
            }, {});

        filteredUpdates.lastUpdatedBy = updatedBy;

        const material = await CourseMaterial.findByIdAndUpdate(
            materialId,
            filteredUpdates,
            { new: true, runValidators: true }
        ).populate('file', 'url name');

        if (!material) throw new AppError("Material not found");

        return material;
    }

    /**
     * Delete material and its associated file
     */
    static async deleteMaterial(materialId, userId, userRole) {
        try{

            const material = await CourseMaterial.findById(materialId)
                .populate('courseAssignment', 'instructor');
    
            if (!material) throw new AppError("Material not found");
    
            // Delete the file from storage
            await FileService.deleteFile(material.file);
    
            // Delete the material record
            await material.deleteOne();
    
            return true;
        }catch(err){
            throw new AppError(null, 500, err)
        }
    }

    /**
     * Reorder materials
     */
    static async reorderMaterials(courseAssignmentId, newOrder) {
        const session = await CourseMaterial.startSession();
        session.startTransaction();

        try {
            const updatePromises = newOrder.map((materialId, index) =>
                CourseMaterial.findOneAndUpdate(
                    { _id: materialId, courseAssignment: courseAssignmentId },
                    { order: index },
                    { session, new: true }
                )
            );

            await Promise.all(updatePromises);
            await session.commitTransaction();

            return await CourseMaterial.find({ courseAssignment: courseAssignmentId })
                .sort({ order: 1 })
                .populate('file', 'url name type');
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Get materials by week for syllabus view
     */
    static async getMaterialsByWeek(courseAssignmentId, userRole) {
        const materials = await CourseMaterial.find({
            courseAssignment: courseAssignmentId,
            ...(userRole === 'student' ? { isPublished: true } : {})
        })
            .sort({ week: 1, order: 1 })
            .populate('file', 'url name type size')
            .lean();

        // Group by week
        const groupedByWeek = materials.reduce((acc, material) => {
            const week = material.week || 0;
            if (!acc[week]) acc[week] = [];
            acc[week].push(material);
            return acc;
        }, {});

        return groupedByWeek;
    }
}

export default CourseMaterialService;