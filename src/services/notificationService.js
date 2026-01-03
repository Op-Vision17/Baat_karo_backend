// src/services/notificationService.js - PRODUCTION READY

const admin = require("firebase-admin");

// Initialize Firebase Admin SDK using environment variables
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized || admin.apps.length > 0) {
    return;
  }

  try {
    // Check if running in production (Render) or development (local)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // PRODUCTION: Use environment variable
      console.log('🔥 Initializing Firebase with environment variable');
      
      let serviceAccount;
      const envVar = process.env.FIREBASE_SERVICE_ACCOUNT;
      
      try {
        // Try to parse as JSON directly first
        serviceAccount = JSON.parse(envVar);
        console.log('📄 Parsed as direct JSON');
      } catch (e) {
        // If that fails, try base64 decoding
        console.log('🔓 Attempting base64 decode...');
        try {
          const decoded = Buffer.from(envVar, 'base64').toString('utf-8');
          serviceAccount = JSON.parse(decoded);
          console.log('📄 Parsed from base64');
        } catch (e2) {
          console.error('❌ Failed to parse as JSON or base64:', e2.message);
          console.error('First 100 chars of env var:', envVar.substring(0, 100));
          throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT format. Must be valid JSON or base64-encoded JSON.');
        }
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      console.log('✅ Firebase initialized from environment variable');
      console.log('✅ Project ID:', serviceAccount.project_id);
    } else {
      // DEVELOPMENT: Use local file
      console.log('🔥 Initializing Firebase with local file');
      
      const serviceAccount = require("../../serviceAccountKey.json");
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      
      console.log('✅ Firebase initialized from local file');
    }
    
    firebaseInitialized = true;
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error.message);
    throw error;
  }
}

// Initialize Firebase on module load
initializeFirebase();

/**
 * Send push notification to a single device
 */
async function sendNotification(fcmToken, notification, data = {}) {
  try {
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: data,
      token: fcmToken,
      android: {
        notification: {
          sound: "default",
          channelId: "chat_messages"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default"
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log("✅ Notification sent:", response);
    return { success: true, response };
  } catch (error) {
    console.error("❌ Error sending notification:", error);
    
    // Handle invalid tokens
    if (error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token') {
      return { success: false, error: error.message, invalidToken: true };
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to multiple devices
 */
async function sendMulticastNotification(fcmTokens, notification, data = {}) {
  try {
    if (!fcmTokens || fcmTokens.length === 0) {
      return { success: false, error: "No FCM tokens provided" };
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: data,
      tokens: fcmTokens,
      android: {
        notification: {
          sound: "default",
          channelId: "chat_messages"
        }
      },
      apns: {
        payload: {
          aps: {
            sound: "default"
          }
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ ${response.successCount}/${fcmTokens.length} notifications sent`);
    
    // Collect invalid tokens
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        if (resp.error.code === 'messaging/registration-token-not-registered' ||
            resp.error.code === 'messaging/invalid-registration-token') {
          invalidTokens.push(fcmTokens[idx]);
        }
      }
    });
    
    return { 
      success: true, 
      response,
      invalidTokens,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error("❌ Error sending multicast notification:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification about a new message
 */
async function sendMessageNotification(recipientTokens, senderName, messageText, roomId, messageType = 'text') {
  // Prepare notification body based on message type
  let body = messageText;
  if (messageType === 'image' && !messageText) {
    body = "📷 Sent an image";
  } else if (messageType === 'voice' && !messageText) {
    body = "🎤 Sent a voice message";
  } else if (messageText && messageText.length > 100) {
    body = messageText.substring(0, 100) + "...";
  }

  const notification = {
    title: senderName,
    body: body
  };

  const data = {
    type: "NEW_MESSAGE",
    roomId: roomId,
    timestamp: Date.now().toString(),
    click_action: "FLUTTER_NOTIFICATION_CLICK"
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