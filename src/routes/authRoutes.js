const router = require("express").Router();
const auth = require("../middleware/auth");
const { handleValidation } = require("../middleware/validate");
const authValidators = require("../validators/authValidators");
const {
  sendOtp,
  verifyOtp,
  completeOnboarding,
  refreshToken,
  getUserProfile,
  updateProfile,
  logout
} = require("../controllers/authController");

// Public routes (with validation)
router.post("/send-otp", ...authValidators.sendOtp, handleValidation, sendOtp);
router.post("/verify-otp", ...authValidators.verifyOtp, handleValidation, verifyOtp);
router.post("/refresh-token", ...authValidators.refreshToken, handleValidation, refreshToken);

// Protected routes (require authentication)
router.post("/complete-onboarding", auth, ...authValidators.completeOnboarding, handleValidation, completeOnboarding);
router.get("/profile", auth, getUserProfile);
router.put("/profile", auth, updateProfile);
router.post("/logout", auth, logout);

module.exports = router;