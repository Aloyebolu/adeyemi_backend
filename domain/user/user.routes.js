import express from 'express';
import { 
  signup, 
  getProfile, 
  deleteUser,
  uploadAvatar,
  getUsers,
  getUser,
} from './user.controller.js';
import authenticate from '../../middlewares/authenticate.js';
import validate from '../../middlewares/validate.js';
import userValidation from './user.validation.js'; // To be created
import { updateProfile } from './services/userProfile.service.js';

const router = express.Router();

// Public routes


router.post(
  '/signup',
  validate(userValidation.signup),
  signup
);

router.post(
  '/fetch',
  getUsers
)

// Protected routes
router.get(
  '/profile',
  authenticate(),
  getProfile
);

router.post(
  '/profile/avatar',
  authenticate(),
  uploadAvatar
);

router.put(
  '/profile',
  authenticate(),
  updateProfile
);

router.delete(
  '/:id',
  authenticate(['admin']), // Only admin can delete users
  validate(userValidation.deleteUser),
  deleteUser
);
router.get(
  "/:id",
  authenticate("admin"),
  getUser
)

export default router;