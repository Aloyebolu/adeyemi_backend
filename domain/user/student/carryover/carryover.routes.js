// routes/carryover.routes.js
import express from 'express';
import carryoverController from './carryover.controller.js';
import authenticate from '#middlewares/authenticate.js';
import catchAsync from '#utils/catchAsync.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate());

// Student routes
router.get('/student', catchAsync(carryoverController.getStudentCarryovers));
router.get('/student/stats', catchAsync(carryoverController.getStudentCarryoverStats));
router.get('/:id', catchAsync(carryoverController.getCarryoverById));

// Staff routes (create, update, delete, bulk operations)
router.post('/', catchAsync(carryoverController.createCarryover));
router.post('/generate-from-results', catchAsync(carryoverController.generateCarryoversFromResults));
router.get('/department/:departmentId', catchAsync(carryoverController.getCarryoversByDepartment));
router.put('/:id/clear', catchAsync(carryoverController.updateCarryoverClearance));
router.delete('/:id', catchAsync(carryoverController.deleteCarryover));

export default router;