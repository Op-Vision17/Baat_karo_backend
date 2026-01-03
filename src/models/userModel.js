// src/models/userModel.js - UPDATED WITH FCM TOKENS

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: { 
    type: String,
    trim: true
  },
  profilePhoto: {
    type: String,
    default: null
  },
  otp: String,
  otpExpiry: Date,
  refreshToken: String,
  
  // ============================================
  // 🔔 FCM TOKENS FOR PUSH NOTIFICATIONS (NEW)
  // ============================================
  fcmTokens: [{
    token: {
      type: String,
      required: true
    },
    device: {
      type: String,
      enum: ['android', 'ios', 'web'],
      default: 'android'
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Notification preferences
  notificationSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    messageNotifications: {
      type: Boolean,
      default: true
    },
    soundEnabled: {
      type: Boolean,
      default: true
    }
  }
}, { 
  timestamps: true 
});

// ============================================
// FCM TOKEN METHODS
// ============================================

// Add or update FCM token
userSchema.methods.addFcmToken = async function(token, device = 'android') {
  // Check if token already exists
  const existingToken = this.fcmTokens.find(t => t.token === token);
  
  if (existingToken) {
    // Update last used time and device
    existingToken.lastUsed = Date.now();
    existingToken.device = device;
  } else {
    // Add new token (limit to 5 devices per user)
    if (this.fcmTokens.length >= 5) {
      // Remove oldest token
      this.fcmTokens.sort((a, b) => a.lastUsed - b.lastUsed);
      this.fcmTokens.shift();
    }
    
    this.fcmTokens.push({
      token,
      device,
      lastUsed: Date.now()
    });
  }
  
  await this.save();
  return this;
};

// Remove FCM token (on logout)
userSchema.methods.removeFcmToken = async function(token) {
  this.fcmTokens = this.fcmTokens.filter(t => t.token !== token);
  await this.save();
  return this;
};

// Remove invalid/expired tokens
userSchema.methods.removeInvalidTokens = async function(invalidTokens) {
  this.fcmTokens = this.fcmTokens.filter(t => !invalidTokens.includes(t.token));
  await this.save();
  return this;
};

// Get all active tokens for this user
userSchema.methods.getActiveFcmTokens = function() {
  return this.fcmTokens.map(t => t.token);
};



module.exports = mongoose.model("User", userSchema);