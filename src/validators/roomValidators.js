const { body, param } = require("express-validator");

const createRoom = [
  body("name").trim().notEmpty().withMessage("Room name is required"),
  body("name").trim().isLength({ min: 1, max: 100 }).withMessage("Room name must be 1–100 characters"),
  body("roomPhoto").optional({ values: "falsy" }).isString(),
];

const joinRoom = [
  body("roomCode")
    .trim()
    .notEmpty()
    .withMessage("Room code is required"),
  body("roomCode")
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage("Room code must be 6 digits"),
];

const roomIdParam = [
  param("roomId").isMongoId().withMessage("Invalid room ID"),
];

const updateRoom = [
  param("roomId").isMongoId().withMessage("Invalid room ID"),
  body("name")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be 1–100 characters"),
  body("roomPhoto").optional({ values: "falsy" }).isString(),
];

module.exports = { createRoom, joinRoom, roomIdParam, updateRoom };
