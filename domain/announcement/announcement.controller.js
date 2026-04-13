import AnnouncementService from './announcement.service.js';
import buildResponse from '../../utils/responseBuilder.js';
import catchAsync from '../../utils/catchAsync.js';

// @desc    Get all announcements with filtering
// @route   GET /api/announcements
// @access  Public
const getAnnouncements = async (req, res, next) => {
  try {

    const { category, search, targetAudience, page = 1, limit = 10 } = req.query;

    const filters = { category, search, targetAudience };
    const options = { page: parseInt(page), limit: parseInt(limit), populate: true };

    const result = await AnnouncementService.getAnnouncements(filters, options);
    buildResponse.success(res, "success", result)
  } catch (error) {
    next(error)
  }

};

/**
 * @desc    Get single announcement
 * @route   GET /api/announcements/:id
 * @access  Public
 */
const getAnnouncement = catchAsync(async (req, res, next) => {
  try {
    const result = await AnnouncementService.getAnnouncementById(req.params.id);
    buildResponse.success(res, "success", result)
  } catch (error) {
    next(error)
  }
});
/**
 * @desc    Create new announcement
 * @route   POST /api/announcements
 * @access  Private/Admin
*/
const createAnnouncement = catchAsync(async (req, res) => {
  const result = await AnnouncementService.createAnnouncement(req.body, req.user._id);
  buildResponse.success(res, "success", result)
});
/**
// @desc    Update announcement
// @route   PUT /api/announcements/:id
// @access  Private/Admin
*/
const updateAnnouncement = catchAsync(async (req, res) => {
  const result = await AnnouncementService.updateAnnouncement(
    req.params.id,
    req.body,
    req.user._id,
    req.user.role
  );

  buildResponse.success(res, "success", result)
});
/**
 // @desc    Delete announcement (soft delete)
 // @route   DELETE /api/announcements/:id
 // @access  Private/Admin
 */
const deleteAnnouncement = catchAsync(async (req, res) => {
  const result = await AnnouncementService.deleteAnnouncement(
    req.params.id,
    req.user._id,
    req.user.role
  );

  buildResponse.success(res, "success", result)
});
/**
 // @desc    Get announcement categories
 // @route   GET /api/announcements/categories
 // @access  Public
 */
const getCategories = catchAsync(async (req, res) => {
  const result = await AnnouncementService.getCategories();
  buildResponse.success(res, "success", result)
});

export {
  getAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getCategories
};