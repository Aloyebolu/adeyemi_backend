// controllers/carryover.controller.js
import AppError from '../errors/AppError.js';
import carryoverService from './carryover.service.js';

class CarryoverController {
  async getStudentCarryovers(req, res) {
    const studentId = req.user._id;
    const { semester, cleared } = req.query;

    const carryovers = await carryoverService.getStudentCarryovers(studentId, {
      semester,
      cleared
    });

    res.status(200).json({
      success: true,
      data: carryovers,
      count: carryovers.length
    });
  }

  async getStudentCarryoverStats(req, res) {
    const studentId = req.user._id;
    const stats = await carryoverService.getStudentCarryoverStats(studentId);

    res.status(200).json({
      success: true,
      data: stats
    });
  }

  async getCarryoverById(req, res) {
    const { id } = req.params;
    const studentId = req.user._id;

    const carryover = await carryoverService.getCarryoverById(id);

    if (!carryover) {
      return res.status(404).json({
        success: false,
        error: 'Carryover not found'
      });
    }

    // Check if student is authorized to view this carryover
    if (req.user.role === 'student' && carryover.student._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this carryover'
      });
    }

    res.status(200).json({
      success: true,
      data: carryover
    });
  }

  async updateCarryoverClearance(req, res) {
    const { id } = req.params;
    const { cleared, remark } = req.body;
    const userId = req.user._id;

    const carryover = await carryoverService.updateCarryoverClearance(
      id,
      cleared,
      userId,
      remark
    );

    res.status(200).json({
      success: true,
      data: carryover,
      message: `Carryover ${cleared ? 'marked as cleared' : 'marked as pending'}`
    });
  }


  async getCarryoversByDepartment(req, res) {
    const { departmentId } = req.params;
    const { semester, cleared, level } = req.query;

    const carryovers = await carryoverService.getCarryoversByDepartment(departmentId, {
      semester,
      cleared,
      level
    });

    res.status(200).json({
      success: true,
      data: carryovers,
      count: carryovers.length
    });
  }

  async createCarryover(req, res) {
    const carryoverData = req.body;
    const createdBy = req.user._id;

    const carryover = await carryoverService.createCarryover(carryoverData, createdBy);

    res.status(201).json({
      success: true,
      data: carryover,
      message: 'Carryover created successfully'
    });
  }

  async deleteCarryover(req, res) {
    const { id } = req.params;
    throw new AppError("Deletion of carryover currently disabled")
    const carryover = await carryoverService.deleteCarryover(id);

    if (!carryover) {
      return res.status(404).json({
        success: false,
        error: 'Carryover not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Carryover deleted successfully'
    });
  }
}

export default new CarryoverController();