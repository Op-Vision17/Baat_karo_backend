const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  name: { type: String }, // 🔥 ADD NAME
  otp: String,
  otpExpiry: Date
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);