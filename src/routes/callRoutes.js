const router = require("express").Router();
const auth = require("../middleware/auth");
const {
  getRoomCallHistory,
  getCallDetails,
} = require("../controllers/callController");

router.get("/history/:roomId", auth, getRoomCallHistory);
router.get("/:callId", auth, getCallDetails);

module.exports = router;