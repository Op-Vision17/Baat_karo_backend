const router = require("express").Router();
const auth = require("../middleware/auth");
const { 
  sendOtp, 
  verifyOtp,
  getUserProfile,
  updateProfile
} = require("../controllers/authController");

router.post("/email", sendOtp);
router.post("/verify", verifyOtp);
router.get("/profile", auth, getUserProfile);
router.put("/profile", auth, updateProfile);

module.exports = router;