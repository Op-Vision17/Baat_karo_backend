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
  refreshToken: String
}, { 
  timestamps: true 
});

// Index for faster lookups
userSchema.index({ email: 1 });

module.exports = mongoose.model("User", userSchema);