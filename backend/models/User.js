const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    password: {
      type: String,
      required: [true, 'Password is required']
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['student', 'teacher', 'admin', 'superadmin'],
        message: 'Role must be student, teacher, admin, or superadmin'
      },
      index: true
    },
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      index: true
    },
    name: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    designation: {
      type: String,
      trim: true,
      default: ''
    },
    highestQualification: {
      type: String,
      trim: true,
      default: ''
    },
    qualifications: {
      type: [String],
      default: []
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    specialization: {
      type: String,
      trim: true,
      default: ''
    },
    profilePhoto: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    mustChangePassword: {
      type: Boolean,
      default: false
    },
    preferences: {
      notifications: {
        inApp: { type: Boolean, default: true },
        academicRecords: { type: Boolean, default: true },
        accountActivity: { type: Boolean, default: true },
        riskAlerts: { type: Boolean, default: true }
      }
    }
  },
  {
    timestamps: true
  }
);

// Method to verify candidate password safely without throwing uncaught exceptions
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    if (!candidatePassword || typeof candidatePassword !== 'string' || !this.password || typeof this.password !== 'string') {
      return false;
    }
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (err) {
    console.error('[User.comparePassword Error]:', err.message);
    return false;
  }
};

// Safe JSON serialization (never leak password)
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
