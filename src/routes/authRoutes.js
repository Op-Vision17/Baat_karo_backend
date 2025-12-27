const router = require("express").Router();
const auth = require("../middleware/auth");
const { 
  sendOtp, 
  verifyOtp,
  completeOnboarding,
  refreshToken,
  getUserProfile,
  updateProfile,
  logout
} = require("../controllers/authController");

// Public routes
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/refresh-token", refreshToken);

// Protected routes (require authentication)
router.post("/complete-onboarding", auth, completeOnboarding);
router.get("/profile", auth, getUserProfile);
router.put("/profile", auth, updateProfile);
router.post("/logout", auth, logout);

module.exports = router;