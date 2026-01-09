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

/**
 * 🔔 Send Call Notification (NEW)
 */
async function sendCallNotification(
  fcmTokens,
  callerName,
  roomName,
  callType,
  roomId,
  callId,
  callerAvatar = null
) {
  try {
    if (!fcmTokens || fcmTokens.length === 0) {
      return { success: false, error: "No FCM tokens" };
    }

    const callIcon = callType === "video" ? "📹" : "📞";

    const message = {
      data: {
        type: "incoming_call",
        callType: callType,
        roomId: roomId,
        callId: callId,
        callerName: callerName,
        roomName: roomName,
        callerAvatar: callerAvatar || "",
        timestamp: Date.now().toString(),
      },
      notification: {
        title: `${callIcon} Incoming ${callType} call`,
        body: `${callerName} is calling in ${roomName}`,
      },
      android: {
        priority: "high",
        ttl: 30000, // 30 seconds
        notification: {
          channelId: "calls",
          sound: "default",
          priority: "max",
          visibility: "public",
          tag: `call_${callId}`,
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            alert: {
              title: `${callIcon} Incoming ${callType} call`,
              body: `${callerName} is calling in ${roomName}`,
            },
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    if (fcmTokens.length === 1) {
      const response = await admin.messaging().send({
        ...message,
        token: fcmTokens[0],
      });
      console.log("✅ Call notification sent");
      return { success: true, messageId: response, successCount: 1 };
    } else {
      const response = await admin.messaging().sendEachForMulticast({
        ...message,
        tokens: fcmTokens,
      });

      console.log(`✅ Call notifications sent: ${response.successCount}/${fcmTokens.length}`);

      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          if (
            resp.error?.code === "messaging/invalid-registration-token" ||
            resp.error?.code === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(fcmTokens[idx]);
          }
        }
      });

      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    }
  } catch (error) {
    console.error("❌ Call notification error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 📵 Send Missed Call Notification (NEW)
 */
async function sendMissedCallNotification(
  fcmTokens,
  callerName,
  roomName,
  callType
) {
  try {
    if (!fcmTokens || fcmTokens.length === 0) {
      return { success: false };
    }

    const message = {
      notification: {
        title: "📵 Missed Call",
        body: `You missed a ${callType} call from ${callerName} in ${roomName}`,
      },
      data: {
        type: "missed_call",
        callerName: callerName,
        roomName: roomName,
        callType: callType,
        timestamp: Date.now().toString(),
      },
      android: {
        priority: "high",
        notification: {
          channelId: "missed_calls",
          sound: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: "📵 Missed Call",
              body: `You missed a ${callType} call from ${callerName} in ${roomName}`,
            },
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    if (fcmTokens.length === 1) {
      await admin.messaging().send({ ...message, token: fcmTokens[0] });
      console.log("✅ Missed call notification sent");
    } else {
      const response = await admin.messaging().sendEachForMulticast({
        ...message,
        tokens: fcmTokens,
      });
      console.log(`✅ Missed call notifications sent: ${response.successCount}/${fcmTokens.length}`);
    }

    return { success: true };
  } catch (error) {
    console.error("❌ Missed call notification error:", error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendNotification,
  sendMulticastNotification,
  sendMessageNotification,
  sendCallNotification,        // ✅ NEW
  sendMissedCallNotification,  // ✅ NEW
};