// src/services/notificationService.js
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
// Download your service account key from Firebase Console
// and save it as serviceAccountKey.json in your project root
const serviceAccount = require("../../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

/**
 * Send push notification to a single device
 */
async function sendNotification(fcmToken, notification, data = {}) {
  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || "/default-icon.png"
      },
      data: data,
      token: fcmToken
    };

    const response = await admin.messaging().send(message);
    console.log("✅ Notification sent successfully:", response);
    return { success: true, response };
  } catch (error) {
    console.error("❌ Error sending notification:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to multiple devices
 */
async function sendMulticastNotification(fcmTokens, notification, data = {}) {
  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || "/default-icon.png"
      },
      data: data,
      tokens: fcmTokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ ${response.successCount} notifications sent successfully`);
    
    if (response.failureCount > 0) {
      console.log(`❌ ${response.failureCount} notifications failed`);
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`Failed to send to token ${idx}:`, resp.error);
        }
      });
    }
    
    return { success: true, response };
  } catch (error) {
    console.error("❌ Error sending multicast notification:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification about a new message
 */
async function sendMessageNotification(recipientTokens, senderName, messageText, roomId) {
  const notification = {
    title: senderName,
    body: messageText.length > 100 ? messageText.substring(0, 100) + "..." : messageText,
    icon: "/chat-icon.png"
  };

  const data = {
    type: "NEW_MESSAGE",
    roomId: roomId,
    timestamp: Date.now().toString()
  };

  if (recipientTokens.length === 1) {
    return await sendNotification(recipientTokens[0], notification, data);
  } else {
    return await sendMulticastNotification(recipientTokens, notification, data);
  }
}

module.exports = {
  sendNotification,
  sendMulticastNotification,
  sendMessageNotification
};

