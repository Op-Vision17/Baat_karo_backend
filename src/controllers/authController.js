const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../services/emailService");

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Generate access token (short-lived)
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" } // 15 minutes
  );
};

// Generate refresh token (long-lived)
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" } // 7 days
  );
};

// SEND OTP
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = Date.now() + 5 * 60 * 1000;
    await user.save();

    await sendEmail(email, `Your Baatkro OTP: ${otp}`, otp);

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Send OTP error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

// VERIFY OTP → LOGIN
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    
    if (!user || user.otp !== otp || user.otpExpiry < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Clear OTP after verification
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in user document
    user.refreshToken = refreshToken;
    await user.save();

    // Check if user needs onboarding (no name means new user)
    const needsOnboarding = !user.name;

    res.json({
      accessToken,
      refreshToken,
      needsOnboarding,
      userId: user._id,
      email: user.email,
      name: user.name || null
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
};

// COMPLETE ONBOARDING (Set user name)
exports.completeOnboarding = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = name.trim();
    await user.save();

    res.json({
      message: "Onboarding completed successfully",
      user: {
        userId: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err) {
    console.error("Complete onboarding error:", err);
    res.status(500).json({ message: "Failed to complete onboarding" });
  }
};

// REFRESH TOKEN
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Find user and verify refresh token matches
    const user = await User.findById(decoded.id);
    
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id);

    res.json({
      accessToken: newAccessToken
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(403).json({ message: "Invalid or expired refresh token" });
  }
};

// GET USER PROFILE
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-otp -otpExpiry -refreshToken');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      userId: user._id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Failed to get profile" });
  }
};

// UPDATE USER PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name: name.trim() },
      { new: true }
    ).select('-otp -otpExpiry -refreshToken');

    res.json({
      message: "Profile updated successfully",
      user: {
        userId: user._id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

// LOGOUT
exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user) {
      user.refreshToken = null;
      await user.save();
    }

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Failed to logout" });
  }
};