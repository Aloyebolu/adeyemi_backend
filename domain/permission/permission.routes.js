// permission.routes.js
import express from 'express';
import { issuePermissionController } from './permission.controller.js';

const router = express.Router();

// POST /permissions/issue
// Only admins can issue permissions
router.post('/issue', authenticate["admin"], issuePermissionController);

export default router;
