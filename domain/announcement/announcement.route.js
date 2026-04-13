import { Router } from 'express';
import {
  getAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getCategories
} from './announcement.controller.js';
import authenticate from '../../middlewares/authenticate.js';
import validate from '../../middlewares/validate.js';
import announcementValidation from './announcement.validation.js'; // Create this

const router = Router();

// Public routes
router.get('/', getAnnouncements);
router.get('/categories', getCategories);
router.get('/:id', getAnnouncement);

// Protected routes
router.post(
  '/',
  authenticate(['admin', 'instructor']),
  validate(announcementValidation.createAnnouncement), // Add validation
  createAnnouncement
);

router.put(
  '/:id',
  authenticate(['admin', 'instructor']),
  validate(announcementValidation.updateAnnouncement),
  updateAnnouncement
);

router.delete(
  '/:id',
  authenticate(['admin']), // Only admin can delete
  deleteAnnouncement
);

export default router;