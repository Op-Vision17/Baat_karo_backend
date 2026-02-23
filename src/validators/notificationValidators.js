const { body } = require("express-validator");

const registerToken = [
  body("token").notEmpty().trim().withMessage("FCM token is required"),
  body("device").optional().isString(),
];

const removeToken = [
  body("token").notEmpty().trim().withMessage("FCM token is required"),
];

const updateSettings = [
  body("enabled").optional().isBoolean().withMessage("enabled must be boolean"),
  body("messageNotifications")
    .optional()
    .isBoolean()
    .withMessage("messageNotifications must be boolean"),
  body("soundEnabled")
    .optional()
    .isBoolean()
    .withMessage("soundEnabled must be boolean"),
  body("callNotifications")
    .optional()
    .isBoolean()
    .withMessage("callNotifications must be boolean"),
];

module.exports = { registerToken, removeToken, updateSettings };
