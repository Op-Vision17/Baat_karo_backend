// src/models/userModel.js - FIXED DUPLICATE HANDLING

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
  // 🔔 FCM TOKENS FOR PUSH NOTIFICATIONS
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
  console.log(`🔔 addFcmToken called for user ${this._id}`);
  console.log(`   Token: ${token.substring(0, 20)}...`);
  console.log(`   Current token count: ${this.fcmTokens.length}`);
  
  // Check if token already exists
  const existingTokenIndex = this.fcmTokens.findIndex(t => t.token === token);
  
  if (existingTokenIndex !== -1) {
    // ✅ Token already exists - just update it
    console.log(`   ℹ️ Token already exists at index ${existingTokenIndex}, updating...`);
    this.fcmTokens[existingTokenIndex].lastUsed = Date.now();
    this.fcmTokens[existingTokenIndex].device = device;
    await this.save();
    console.log(`   ✅ Updated existing token`);
    return this;
  }
  
  // Token doesn't exist - add it
  console.log(`   ➕ Adding new token`);
  
  // Limit to 5 devices per user
  if (this.fcmTokens.length >= 5) {
    console.log(`   ⚠️ Reached limit of 5 tokens, removing oldest`);
    this.fcmTokens.sort((a, b) => a.lastUsed - b.lastUsed);
    const removed = this.fcmTokens.shift();
    console.log(`   🗑️ Removed token: ${removed.token.substring(0, 20)}...`);
  }
  
  this.fcmTokens.push({
    token,
    device,
    lastUsed: Date.now()
  });
  
  await this.save();
  console.log(`   ✅ Token added successfully. New count: ${this.fcmTokens.length}`);
  return this;
};

// Remove FCM token (on logout)
userSchema.methods.removeFcmToken = async function(token) {
  console.log(`🗑️ Removing FCM token for user ${this._id}`);
  const beforeCount = this.fcmTokens.length;
  this.fcmTokens = this.fcmTokens.filter(t => t.token !== token);
  const afterCount = this.fcmTokens.length;
  await this.save();
  console.log(`   ✅ Removed ${beforeCount - afterCount} token(s). Remaining: ${afterCount}`);
  return this;
};

// Remove invalid/expired tokens
userSchema.methods.removeInvalidTokens = async function(invalidTokens) {
  console.log(`🧹 Removing ${invalidTokens.length} invalid tokens`);
  const beforeCount = this.fcmTokens.length;
  this.fcmTokens = this.fcmTokens.filter(t => !invalidTokens.includes(t.token));
  const afterCount = this.fcmTokens.length;
  await this.save();
  console.log(`   ✅ Removed ${beforeCount - afterCount} invalid token(s). Remaining: ${afterCount}`);
  return this;
};

// Get all active tokens for this user
userSchema.methods.getActiveFcmTokens = function() {
  return this.fcmTokens.map(t => t.token);
};

module.exports = mongoose.model("User", userSchema);