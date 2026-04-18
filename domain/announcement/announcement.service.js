import announcementModel from './announcement.model.js';
import AppError from '#shared/errors/AppError.js';

class AnnouncementService {
  // Get all announcements with filtering
  async getAnnouncements(filters, options) {
    try {
      const query = { isActive: true, expiresAt: { $gt: new Date() } };
      
      // Apply filters
      if (filters.category && filters.category !== 'all') {
        query.category = filters.category;
      }
      if (filters.search) {
        query.$or = [
          { title: { $regex: filters.search, $options: 'i' } },
          { description: { $regex: filters.search, $options: 'i' } },
          { tags: { $regex: filters.search, $options: 'i' } }
        ];
      }
      if (filters.targetAudience && filters.targetAudience !== 'all') {
        query.targetAudience = { $in: ['all', filters.targetAudience] };
      }

      // Build query
      const dbQuery = announcementModel.find(query);

      // Populate
      if (options?.populate) {
        dbQuery.populate('createdBy', 'name email');
      }

      // Pagination
      const page = options?.page || 1;
      const limit = options?.limit || 10;
      const skip = (page - 1) * limit;

      const [announcements, total] = await Promise.all([
        dbQuery.sort({ priority: -1, date: -1 }).skip(skip).limit(limit).lean(),
        announcementModel.countDocuments(query)
      ]);

      return {
        success: true,
        data: announcements,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      // Unexpected server error
      throw new AppError('Failed to fetch announcements', 500, error);
    }
  }

  // Get single announcement
  async getAnnouncementById(id) {
    try {
      const announcement = await announcementModel
        .findOne({
          _id: id,
          isActive: true,
          expiresAt: { $gt: new Date() }
        })
        .populate('createdBy', 'name email')
        .lean();

      if (!announcement) {
        throw new AppError('Announcement not found', 404);
      }

      return { success: true, data: announcement };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to fetch announcement', 500, error);
    }
  }

  // Create new announcement
  async createAnnouncement(announcementData, userId) {
    try {
      const { title, description, content, category, priority, image, expiresAt, targetAudience, tags } = announcementData;

      // Validation (could be moved to separate validator)
      if (!title || !description || !content || !category || !image || !expiresAt) {
        throw new AppError('Please fill all required fields', 400);
      }

      if (new Date(expiresAt) <= new Date()) {
        throw new AppError('Expiration date must be in the future', 400);
      }

      const announcement = await announcementModel.create({
        title,
        description,
        content,
        category,
        priority: priority || 'medium',
        image,
        expiresAt,
        targetAudience: targetAudience || ['all'],
        tags: tags || [],
        createdBy: userId
      });

      const populatedAnnouncement = await announcementModel
        .findById(announcement._id)
        .populate('createdBy', 'name email')
        .lean();

      return { success: true, data: populatedAnnouncement };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error.name === 'ValidationError') {
        throw new AppError(`Validation error: ${error.message}`, 400, error);
      }
      throw new AppError('Failed to create announcement', 500, error);
    }
  }

  // Update announcement
  async updateAnnouncement(id, updateData, userId, userRole) {
    try {
      const announcement = await announcementModel.findById(id);

      if (!announcement) {
        throw new AppError('Announcement not found', 404);
      }

      // Authorization check
      if (announcement.createdBy.toString() !== userId && !userRole.includes('admin')) {
        throw new AppError('Not authorized to update this announcement', 403);
      }

      // Prevent updating certain fields
      const { createdBy, _id, ...safeUpdateData } = updateData;

      const updatedAnnouncement = await announcementModel
        .findByIdAndUpdate(id, safeUpdateData, {
          new: true,
          runValidators: true
        })
        .populate('createdBy', 'name email')
        .lean();

      return { success: true, data: updatedAnnouncement };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error.name === 'ValidationError') {
        throw new AppError(`Validation error: ${error.message}`, 400, error);
      }
      throw new AppError('Failed to update announcement', 500, error);
    }
  }

  // Delete announcement (soft delete)
  async deleteAnnouncement(id, userId, userRole) {
    try {
      const announcement = await announcementModel.findById(id);

      if (!announcement) {
        throw new AppError('Announcement not found', 404);
      }

      // Authorization check (only admin can delete)
      if (!userRole.includes('admin')) {
        throw new AppError('Not authorized to delete announcements', 403);
      }

      // Soft delete by setting isActive to false
      await announcementModel.findByIdAndUpdate(id, { isActive: false });

      return { success: true, message: 'Announcement deleted successfully' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to delete announcement', 500, error);
    }
  }

  // Get categories
  async getCategories() {
    try {
      const categories = await announcementModel.distinct('category', {
        isActive: true,
        expiresAt: { $gt: new Date() }
      });

      return { success: true, data: ['all', ...categories] };
    } catch (error) {
      throw new AppError('Failed to fetch categories', 500, error);
    }
  }

  // Get active announcements by category (using static method)
  async getActiveByCategory(category = 'all') {
    try {
      const announcements = await announcementModel.getActiveByCategory(category);
      return { success: true, data: announcements };
    } catch (error) {
      throw new AppError('Failed to fetch announcements by category', 500, error);
    }
  }
}

export default new AnnouncementService();