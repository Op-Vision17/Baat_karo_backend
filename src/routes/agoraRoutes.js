const router = require("express").Router();
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
const auth = require("../middleware/auth");

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

// Generate Agora RTC Token
router.post("/generate-token", auth, (req, res) => {
  try {
    const { channelName, uid } = req.body;

    if (!channelName || !uid) {
      return res.status(400).json({
        success: false,
        message: "channelName and uid are required",
      });
    }

    if (!APP_ID || !APP_CERTIFICATE) {
      console.error("❌ Agora credentials not configured");
      return res.status(500).json({
        success: false,
        message: "Agora service not configured. Please contact admin.",
      });
    }

    // Token valid for 24 hours
    const expirationTimeInSeconds = 3600 * 24;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Build token
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    console.log(`✅ Generated Agora token for user ${req.user.id} in channel ${channelName}`);

    res.json({
      success: true,
      token,
      channelName,
      uid,
      appId: APP_ID,
      expiresAt: privilegeExpiredTs,
    });
  } catch (err) {
    console.error("❌ Token generation error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to generate token",
      error: err.message,
    });
  }
});

module.exports = router;