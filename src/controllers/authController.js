const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../services/emailService");

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// SEND OTP
exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  let user = await User.findOne({ email });
  if (!user) user = await User.create({ email });

  const otp = generateOTP();
  user.otp = otp;
  user.otpExpiry = Date.now() + 5 * 60 * 1000;
  await user.save();

  await sendEmail(email, "Baatkro OTP", `Your OTP is ${otp}`);

  res.json({ message: "OTP sent" });
};

// VERIFY OTP → LOGIN / REGISTER
exports.verifyOtp = async (req, res) => {
  const { email, otp, name } = req.body; // 🔥 ADD NAME

  const user = await User.findOne({ email });
  if (!user || user.otp !== otp || user.otpExpiry < Date.now()) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  // 🔥 UPDATE NAME IF PROVIDED
  if (name) {
    user.name = name;
  }

  user.otp = null;
  user.otpExpiry = null;
  await user.save();

  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ 
    token, 
    userId: user._id,
    name: user.name,
    email: user.email
  });
};

// 🔥 NEW: Get user profile
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-otp -otpExpiry');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to get profile" });
  }
};

// 🔥 NEW: Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name },
      { new: true }
    ).select('-otp -otpExpiry');
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
};