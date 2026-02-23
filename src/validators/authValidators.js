const { body } = require("express-validator");

const sendOtp = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
];

const verifyOtp = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("otp")
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage("OTP must be 6 digits"),
];

const completeOnboarding = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Name must be 1–100 characters"),
  body("profilePhoto").optional({ values: "falsy" }).isString(),
];

const refreshToken = [
  body("refreshToken").notEmpty().withMessage("Refresh token is required"),
];

module.exports = { sendOtp, verifyOtp, completeOnboarding, refreshToken };
