
// src/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/userModel");
const authMiddleware = require("../middleware/auth");

// Save FCM token
router.post("/register-token", authMiddleware, async (req, res) => {
  try {
    const { token, device } = req.body;

    if (!token) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.addFcmToken(token, device || 'web');

    res.status(200).json({ 
      message: "FCM token registered successfully",
      tokens: user.fcmTokens.length
    });
  } catch (error) {
    console.error("Error registering FCM token:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Remove FCM token (on logout)
router.post("/remove-token", authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.removeFcmToken(token);

    res.status(200).json({ 
      message: "FCM token removed successfully"
    });
  } catch (error) {
    console.error("Error removing FCM token:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update notification settings
router.put("/settings", authMiddleware, async (req, res) => {
  try {
    const { enabled, messageNotifications, soundEnabled } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (enabled !== undefined) {
      user.notificationSettings.enabled = enabled;
    }
    if (messageNotifications !== undefined) {
      user.notificationSettings.messageNotifications = messageNotifications;
    }
    if (soundEnabled !== undefined) {
      user.notificationSettings.soundEnabled = soundEnabled;
    }

    await user.save();

    res.status(200).json({ 
      message: "Notification settings updated",
      settings: user.notificationSettings
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get notification settings
router.get("/settings", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ 
      settings: user.notificationSettings,
      tokenCount: user.fcmTokens.length
    });
  } catch (error) {
    console.error("Error fetching notification settings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;