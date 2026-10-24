const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institution',
      required: true,
      index: true
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: {
        values: ['students', 'teachers', 'departments_sections', 'academics', 'student_risks', 'security_system'],
        message: 'Invalid notification category'
      },
      index: true
    },
    severity: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
      index: true
    },
    relatedEntityType: {
      type: String,
      trim: true
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId
    },
    destinationUrl: {
      type: String,
      trim: true
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date
    },
    isDismissed: {
      type: Boolean,
      default: false,
      index: true
    },
    eventKey: {
      type: String,
      trim: true,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for performant sorting, filtering, and unread counts
notificationSchema.index({ recipient: 1, isDismissed: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, category: 1, isDismissed: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, eventKey: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
