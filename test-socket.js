const io = require("socket.io-client");
const axios = require("axios");

// 🔑 Replace with actual tokens from your database
const USER1_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NDgxNzAzYjIwYWFhOGEwZDE0NjBkNCIsImlhdCI6MTc2NjMzMjI3MywiZXhwIjoxNzY2OTM3MDczfQ.16apMjaNrpYvCkQDdDXAI5nYFDTSXYLmcup-fbaIiDI"; // User 1 token
const USER2_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NDgyNDk3MmQxMjcyMDU0NzdmYzFhYyIsImlhdCI6MTc2NjMzNTY4NSwiZXhwIjoxNzY2OTQwNDg1fQ._pJAIAV5BcWCGiajCZhBpsJr0zl_BLnqqfD7KZ3vz4g"; // User 2 token

async function testTwoUserChat() {
  try {
    // 1️⃣ User 1 creates a room
    console.log("📝 User 1 creating room...");
    const roomResponse = await axios.post(
      "http://localhost:3000/api/room/create",
      { name: "Two User Chat" },
      { headers: { authorization: USER1_TOKEN } }
    );
    
    const roomId = roomResponse.data._id;
    console.log("✅ Room created:", roomId);
    
    // 2️⃣ Connect User 1
    console.log("\n🔌 Connecting User 1...");
    const socket1 = io("http://localhost:3000", {
      auth: { token: USER1_TOKEN }
    });

    // 3️⃣ Connect User 2
    console.log("🔌 Connecting User 2...");
    const socket2 = io("http://localhost:3000", {
      auth: { token: USER2_TOKEN }
    });

    // USER 1
    socket1.on("connect", () => {
      console.log("✅ User 1 connected");
      socket1.emit("joinRoom", roomId);
    });

    socket1.on("receiveMessage", (data) => {
      console.log(`📩 User 1 received: "${data.text}"`);
    });

    // USER 2
    socket2.on("connect", () => {
      console.log("✅ User 2 connected");
      socket2.emit("joinRoom", roomId);
      
      // Start conversation
      setTimeout(() => {
        console.log("\n💬 User 2: Sending message...");
        socket2.emit("sendMessage", {
          roomId,
          text: "Hello User 1! 👋"
        });
      }, 1000);
      
      setTimeout(() => {
        console.log("💬 User 1: Replying...");
        socket1.emit("sendMessage", {
          roomId,
          text: "Hi User 2! Nice to meet you! 😊"
        });
      }, 3000);
      
      setTimeout(() => {
        console.log("💬 User 2: Replying back...");
        socket2.emit("sendMessage", {
          roomId,
          text: "The chat is working perfectly! 🎉"
        });
      }, 5000);
    });

    socket2.on("receiveMessage", (data) => {
      console.log(`📩 User 2 received: "${data.text}"`);
    });

    // Cleanup
    setTimeout(() => {
      console.log("\n✅ Test complete! Disconnecting...");
      socket1.disconnect();
      socket2.disconnect();
      process.exit(0);
    }, 8000);

  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
    process.exit(1);
  }
}

testTwoUserChat();