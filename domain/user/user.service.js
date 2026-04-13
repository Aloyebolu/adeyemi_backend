import User from './user.model.js';
import { hashData, verifyHashedData } from '../../utils/hashData.js';
import createToken from '../../utils/createToken.js';
import Admin from '../admin/admin.model.js';
import lecturerModel from '../lecturer/lecturer.model.js';
import studentModel from '../student/student.model.js';
import departmentService from '../department/department.service.js';
import { resolveUserName } from '../../utils/resolveUserName.js';
import AppError from '../errors/AppError.js';
import { logDevice } from '../../utils/deviceLogger.js';
import { toProfessionalAbbreviation } from '../../utils/helpers.js';
import SemesterService from '../semester/semester.service.js';

class UserService {

  /**
   * Create new user (signup)
   */
  async createUser(userData) {
    try {
      const { name, email, password, role } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new AppError('User with this email already exists, please login...', 409);
      }

      // Hash password
      const hashedPassword = await hashData(password);

      // Create and save new user
      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        role
      });

      await newUser.save();

      // Return user without password
      const { password: _, ...userWithoutPassword } = newUser.toObject();
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error.name === 'ValidationError') {
        throw new AppError(`Validation error: ${error.message}`, 400, error);
      }
      throw new AppError('Failed to create user', 500, error);
    }
  }

  /**
   * Get user profile with role-specific details
   */
  async getUserProfile(userId) {
    try {
      // Base user
      const user = await User.findById(userId).lean();
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const returnedUser = {};
      const semester = await SemesterService.getActiveAcademicSemester();
      returnedUser.session = semester ? semester.session : null;

      // Role-based enrichment
      if (['lecturer', 'hod', 'dean'].includes(user.role)) {
        const lecturer = await lecturerModel
          .findById(userId)
          .populate('departmentId', 'name')
          .lean();

        if (lecturer?.departmentId?.name) {
          returnedUser.department = lecturer.departmentId.name;
          returnedUser.staff_id = lecturer.staffId;

        }
      }
      if (['admin'].includes(user.role)) {
        const lecturer = await Admin
          .findById(userId)
          .lean();

        if (lecturer?.departmentId?.name) {
          returnedUser.admin_id = lecturer.admin_id;

        }
      }

      if (user.role === 'student') {
        const student = await studentModel
          .findById(userId)
          .populate([
            {
              path: "programmeId",
              populate: [
                {
                  path: "department",
                  select: "name code faculty",
                  populate: [
                    {
                      path: 'faculty'
                    }
                  ]
                }
              ]
            }])
          .lean();

        if (student) {
          returnedUser.department = student.programmeId.department?.name || null;
          returnedUser.matric_no = student.matricNumber || null;
          returnedUser.programme = toProfessionalAbbreviation(student.programmeId.programmeType) || null;
          returnedUser.level = student.level || null;
          returnedUser.faculty = student.programmeId.department.faculty.name

        }
      }

      // Return profile data
      return {
        ...user,
        ...returnedUser
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.log(error)
      throw new AppError('Failed to get user profile', 500, error);
    }
  }

  /**
   * Get user by phone number with format resolution
   * Supports various phone number formats (e.g., 234913333333, 0913333333, +234913333333, 913333333)
   */
  async getUserByPhoneNumber(phone) {
    try {
      if (!phone) {
        throw new AppError('Phone number is required', 400);
      }

      // Clean and normalize phone number to database format (234913333333)
      let cleanedPhone = phone.toString().replace(/\s+/g, '');

      // Remove leading '+' if present
      cleanedPhone = cleanedPhone.replace(/^\+/, '');

      // Handle Nigerian phone number formats
      if (cleanedPhone.startsWith('0')) {
        // Format: 0913333333 -> 234913333333
        cleanedPhone = '234' + cleanedPhone.substring(1);
      } else if (cleanedPhone.startsWith('234') && cleanedPhone.length === 13) {
        // Already in correct format (234913333333)
        cleanedPhone = cleanedPhone;
      } else if (cleanedPhone.length === 10 && !cleanedPhone.startsWith('0')) {
        // Format: 913333333 -> 234913333333
        cleanedPhone = '234' + cleanedPhone;
      } else if (cleanedPhone.length === 12 && cleanedPhone.startsWith('234')) {
        // Format: 23491333333 (11 digits after 234) - add leading digit logic
        // Assuming missing leading digit, this is ambiguous, try both
        const user = await User.findOne({
          $or: [
            { phone: cleanedPhone },
            { phone: '234' + cleanedPhone.substring(3) }
          ]
        });
        if (user) {
          const { password: _, ...userWithoutPassword } = user.toObject();
          return userWithoutPassword;
        }
        throw new AppError('User not found with this phone number', 404);
      } else if (cleanedPhone.length === 11 && !cleanedPhone.startsWith('234')) {
        // Format: 9133333333 (11 digits) -> 2349133333333 (but database might have 13 digits total)
        cleanedPhone = '234' + cleanedPhone;
      }

      // Ensure final format has 13 digits (234 + 10 digits)
      if (cleanedPhone.length !== 13 || !cleanedPhone.startsWith('234')) {
        throw new AppError('Invalid phone number format', 400);
      }

      // Query database with normalized phone number
      const user = await User.findOne({ phone: cleanedPhone });

      if (!user) {
        throw new AppError('User not found with this phone number', 404);
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user.toObject();
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get user by phone number', 500, error);
    }
  }



  findById(id, params = {}) {
    return User.findById(id).lean(params.lean);
  }
}

export default new UserService();