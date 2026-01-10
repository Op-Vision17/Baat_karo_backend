const router = require("express").Router();
const auth = require("../middleware/auth");
const {
  getRoomCallHistory,
  getCallDetails,
  checkRoomActiveCall,      // ✅ NEW
  getMyActiveRoomCalls,     // ✅ NEW
} = require("../controllers/callController");

// Existing routes
router.get("/history/:roomId", auth, getRoomCallHistory);
router.get("/:callId", auth, getCallDetails);

// ✅ NEW: Active call routes
router.get("/room/:roomId/active", auth, checkRoomActiveCall);
router.get("/my-rooms/active", auth, getMyActiveRoomCalls);

module.exports = router;