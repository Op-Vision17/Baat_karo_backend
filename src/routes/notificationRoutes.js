
// src/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/userModel");
const authMiddleware = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");
const notificationValidators = require("../validators/notificationValidators");

// Save FCM token
router.post("/register-token", authMiddleware, ...notificationValidators.registerToken, handleValidation, async (req, res) => {
  try {
    const { token, device } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,  // ADD THIS
        message: "User not found" 
      });
    }

    await user.addFcmToken(token, device || 'android');  // Change 'web' to 'android'

    res.status(200).json({ 
      success: true,  // ✅ ADD THIS LINE
      message: "FCM token registered successfully",
      tokens: user.fcmTokens.length
    });
  } catch (error) {
    console.error("Error registering FCM token:", error);
    res.status(500).json({ 
      success: false,  // ADD THIS
      message: "Server error", 
      error: error.message 
    });
  }
});

// Remove FCM token (on logout)
router.post("/remove-token", authMiddleware, ...notificationValidators.removeToken, handleValidation, async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,  // ADD THIS
        message: "User not found" 
      });
    }

    await user.removeFcmToken(token);

    res.status(200).json({ 
      success: true,  // ✅ ADD THIS LINE
      message: "FCM token removed successfully"
    });
  } catch (error) {
    console.error("Error removing FCM token:", error);
    res.status(500).json({ 
      success: false,  // ADD THIS
      message: "Server error", 
      error: error.message 
    });
  }
});

// Update notification settings
router.put("/settings", authMiddleware, ...notificationValidators.updateSettings, handleValidation, async (req, res) => {
  try {
    const { enabled, messageNotifications, soundEnabled, callNotifications } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
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
    if (callNotifications !== undefined) {
      user.notificationSettings.callNotifications = callNotifications;
    }

    await user.save();

    res.status(200).json({ 
      success: true,  // ✅ ADD THIS LINE
      message: "Notification settings updated",
      settings: user.notificationSettings
    });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    res.status(500).json({ 
      success: false,  // ADD THIS
      message: "Server error", 
      error: error.message 
    });
  }
});

// Get notification settings
router.get("/settings", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,  // ADD THIS
        message: "User not found" 
      });
    }

    res.status(200).json({ 
      success: true,  // ✅ ADD THIS LINE
      settings: user.notificationSettings,
      tokenCount: user.fcmTokens.length
    });
  } catch (error) {
    console.error("Error fetching notification settings:", error);
    res.status(500).json({ 
      success: false,  // ADD THIS
      message: "Server error", 
      error: error.message 
    });
  }
});

module.exports = router;