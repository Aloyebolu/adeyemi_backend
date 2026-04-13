// courseMaterial.controller.js
import { validate } from "uuid";
import buildResponse from "../../../utils/responseBuilder.js";
import AppError from "../../errors/AppError.js";
import SemesterService from "../../semester/semester.service.js";
import courseAssignmentModel from "../courseAssignment.model.js";
import CourseMaterialService from "./courseMaterial.service.js";

export async function uploadMaterial(req, res, next) {
  try {
    const { courseId } = req.params;
    req.body = req.body || {};
    const semester = await SemesterService.getUserDepartmentActiveSemester(req.user._id);
    if (!semester) {
      return buildResponse.error(res, "Active semester not found for user's department", 400);
    }


    // Get the course assignment ID for the course in the active semester
    const courseAssignment = await courseAssignmentModel.findOne({ course: courseId, semester: semester._id });
    const courseAssignmentId = courseAssignment._id
    if(!courseAssignmentId) {
      return buildResponse.error(res, `Course assignment not found for the specified course in the active semester, ${"course"}${courseId}, ${"semester"}${semester._id}`, 400);
    }
    const {
      title,
      description,
      week,
      lectureNumber,
      topic,
      materialType,
      isPreview,
      availableFrom,
      availableTo,
      tags
    } = req.body;
    if(!title){
      throw new AppError("Title is required")
    }

    const material = await CourseMaterialService.createMaterial(
      courseAssignmentId,
      req.user._id,
      req.files.file,
      {
        title,
        description,
        week: week ? parseInt(week) : undefined,
        lectureNumber: lectureNumber ? parseInt(lectureNumber) : undefined,
        topic,
        materialType,
        isPreview: isPreview === 'true',
        availableFrom: availableFrom ? new Date(availableFrom) : undefined,
        availableTo: availableTo ? new Date(availableTo) : undefined,
        tags: tags ? tags.split(',').map(t => t.trim()) : []
      }
    );

    return buildResponse.success(res, "Material uploaded successfully", material);
  } catch (error) {
    next(error)
  }
}

export async function getMaterials(req, res, next) {
  try {
    const { courseId } = req.params;
    const semester = await SemesterService.getUserDepartmentActiveSemester(req.user._id);
    if (!semester) {
      return buildResponse.error(res, "Active semester not found for user's department", 400);
    }

    // Get the course assignment ID for the course in the active semester
    const courseAssignment = await courseAssignmentModel.findOne({ course: courseId, semester: semester._id });
    const courseAssignmentId = courseAssignment._id;
    if(!courseAssignmentId) {
      return buildResponse.error(res, `Course assignment not found for the specified course in the active semester, ${"course"}${courseId}, ${"semester"}${semester._id}`, 400);
    }
    const {
      materialType,
      week,
      isPreview,
      page,
      limit,
      includeUnpublished
    } = req.query;

    const isInstructorOrAdmin = ['instructor', 'admin', 'ta', 'lecturer'].includes(req.user.role);

    const result = await CourseMaterialService.getMaterials(courseAssignmentId, {
      userRole: req.user.role,
      userId: req.user._id,
      includeUnpublished: isInstructorOrAdmin && includeUnpublished === 'true',
      materialType,
      week: week ? parseInt(week) : undefined,
      isPreview: isPreview ? isPreview === 'true' : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50
    });

    return buildResponse.success(res, "Materials fetched successfully", result.data);
  } catch (error) {
    next(error)
  }
};

export async function getMaterial(req, res, next) {
  try {
    const { materialId } = req.params;

    // Optional: Pass enrollment check function
    const enrollmentCheck = async (userId, courseAssignmentId) => {
      // return await EnrollmentService.isUserEnrolled(userId, courseAssignmentId);
    };

    const material = await CourseMaterialService.getMaterialForStudent(
      materialId,
      req.user._id,
      req.user.role === 'student' ? enrollmentCheck : null
    );

    return buildResponse.success(res, "Material fetched successfully", material);
  } catch (error) {
    next(error)
  }
};

export async function updateMaterial(req, res, next) {
  try {
    const { materialId } = req.params;
    const updates = req.body;

    const material = await CourseMaterialService.updateMaterial(
      materialId,
      updates,
      req.user._id
    );

    return buildResponse.success(res, "Material updated successfully", material);
  } catch (error) {
    next(error)
  }
};

export async function deleteMaterial(req, res, next) {
  try {
    const { materialId } = req.params;
    if(!validate(materialId)){
      // throw new AppError("Incorrect ID type provided")
    }

    await CourseMaterialService.deleteMaterial(
      materialId,
      req.user._id,
      req.user.role
    );

    return buildResponse.success(res, "Material deleted successfully");
  } catch (error) {
    next(error)
  }
};

export async function reorderMaterials(req, res, next) {
  try {
    const { courseAssignmentId } = req.params;
    const { order } = req.body; // array of material IDs in new order

    const materials = await CourseMaterialService.reorderMaterials(
      courseAssignmentId,
      order
    );

    return buildResponse.success(res, "Materials reordered successfully", materials);
  } catch (error) {
    next(error)
  }
};

export async function getByWeek(req, res, next) {
  try {
    const { courseAssignmentId } = req.params;

    const materialsByWeek = await CourseMaterialService.getMaterialsByWeek(
      courseAssignmentId,
      req.user.role
    );

    return buildResponse.success(res, "Materials by week fetched successfully", materialsByWeek);
  } catch (error) {
    next(error)
  }
};