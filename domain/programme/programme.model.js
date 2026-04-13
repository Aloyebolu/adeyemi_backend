import mongoose from "mongoose";

const programmeSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Programme name is required'], 
    trim: true,
    minlength: [3, 'Programme name must be at least 3 characters'],
    maxlength: [200, 'Programme name cannot exceed 200 characters']
  },
  code: {
    type: String,
    required: [true, 'Programme code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [3, 'Programme code must be at least 3 characters'],
    maxlength: [20, 'Programme code cannot exceed 20 characters'],
    match: [/^[A-Z0-9-]+$/, 'Programme code can only contain uppercase letters, numbers, and hyphens']
  },
  department: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Department", 
    required: [true, 'Department reference is required'],
    index: true
  },
  faculty: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Faculty",
    index: true
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 year'],
    max: [7, 'Duration cannot exceed 7 years'],
    default: 4
  },
  degreeType: {
    type: String,
    enum: {
      values: ['BACHELOR', 'MASTER', 'PHD', 'DIPLOMA', 'CERTIFICATE'],
      message: '{VALUE} is not a valid degree type'
    },
    required: [true, 'Degree type is required'],
    index: true
  },
  programmeType: {
    type: String,
    enum: {
      values: [
        // Bachelor Degrees
        'BSC', 'BA', 'BED','BSCED', 'BTECH', 'BENG', 'LLB', 'MBBS', 'BDS',
        // Master Degrees
        'MSC', 'MA', 'MBA', 'MPH', 'MPHIL', 'LLM', 'MENG',
        // Doctorate
        'PHD', 'DPHIL',
        // Diplomas
        'PGD', 'DIP', 'ADV_DIP',
        // Certificates
        'CERT', 'PG_CERT'
      ],
      message: '{VALUE} is not a valid programme type'
    },
    required: [true, 'Programme type is required'],
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  accreditationStatus: {
    type: String,
    enum: ['ACCREDITED', 'PENDING', 'EXPIRED', 'PROVISIONAL'],
    default: 'PENDING',
    index: true
  },
  accreditationExpiry: {
    type: Date,
    validate: {
      validator: function(value) {
        return !value || value > new Date();
      },
      message: 'Accreditation expiry must be in the future'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  intakeCapacity: {
    type: Number,
    min: [1, 'Intake capacity must be at least 1'],
    default: 50
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  lastUpdatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full programme name (e.g., "BSc Computer Science")
programmeSchema.virtual('fullName').get(function() {
  const typeMap = {
    'BSC': 'Bachelor of Science in',
    'BA': 'Bachelor of Arts in',
    'BED': 'Bachelor of Education in',
    'BTECH': 'Bachelor of Technology in',
    'BENG': 'Bachelor of Engineering in',
    'MSC': 'Master of Science in',
    'MA': 'Master of Arts in',
    'MBA': 'Master of Business Administration in',
    'PHD': 'Doctor of Philosophy in',
    'PGD': 'Postgraduate Diploma in',
    'CERT': 'Certificate in'
  };
  
  const prefix = typeMap[this.programmeType] || '';
  return `${prefix} ${this.name}`.trim();
});

// Virtual for programme level (simplified from degreeType)
programmeSchema.virtual('level').get(function() {
  const levelMap = {
    'BACHELOR': 'Undergraduate',
    'MASTER': 'Postgraduate',
    'PHD': 'Doctoral',
    'DIPLOMA': 'Diploma',
    'CERTIFICATE': 'Certificate'
  };
  return levelMap[this.degreeType] || this.degreeType;
});

// Index for efficient queries
programmeSchema.index({ department: 1, isActive: 1 });
programmeSchema.index({ code: 1, isActive: 1 });
programmeSchema.index({ degreeType: 1, programmeType: 1 });
programmeSchema.index({ name: 'text', code: 'text' });

// Pre-save middleware to set faculty from department
programmeSchema.pre('save', async function(next) {
  if (this.isNew && this.department && !this.faculty) {
    try {
      const Department = mongoose.model('Department');
      const department = await Department.findById(this.department).select('faculty');
      if (department && department.faculty) {
        this.faculty = department.faculty;
      }
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Method to check if programme is accredited
programmeSchema.methods.isAccredited = function() {
  if (this.accreditationStatus !== 'ACCREDITED') return false;
  
  if (this.accreditationExpiry) {
    return this.accreditationExpiry > new Date();
  }
  
  return true;
};

// Static method to get active programmes by department
programmeSchema.statics.findActiveByDepartment = function(departmentId) {
  return this.find({ 
    department: departmentId, 
    isActive: true 
  }).sort({ createdAt: -1 });
};

// Static method to get programmes by degree type
programmeSchema.statics.findByDegreeType = function(degreeType, options = {}) {
  const query = { degreeType, isActive: true };
  if (options.departmentId) {
    query.department = options.departmentId;
  }
  return this.find(query).sort({ name: 1 });
};

export default mongoose.model("Programme", programmeSchema);