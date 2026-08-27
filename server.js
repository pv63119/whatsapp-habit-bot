require("dotenv").config();
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const cron = require("node-cron");

// Environment Variables
const MONGODB_URI = process.env.MONGODB_URI;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_habit_bot_secret_123";
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is missing from environment variables.");
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log("✅ Successfully connected to MongoDB!"))
    .catch((err) => console.error("❌ MongoDB connection error:", err));
}

// Define the Database Schema for a Habit Log
const habitLogSchema = new mongoose.Schema({
  phoneNumber: String,
  habitId: String,
  habitTitle: String,
  loggedAt: { type: Date, default: Date.now },
});
const HabitLog = mongoose.model("HabitLog", habitLogSchema);

const app = express();
app.use(express.json());

// Function 1: Send a standard text message
async function sendWhatsAppMessage(to_phone_number, message_text) {
  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    console.error("❌ WhatsApp configuration missing (PHONE_NUMBER_ID or WHATSAPP_TOKEN).");
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: to_phone_number,
    type: "text",
    text: { body: message_text },
  };

  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log(`Reply successfully sent to ${to_phone_number}!`);
  } catch (error) {
    console.error(
      "Error sending message:",
      error.response ? JSON.stringify(error.response.data) : error.message
    );
  }
}

// Function 2: Send the interactive button menu
async function sendInteractiveHabitMenu(to_phone_number) {
  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    console.error("❌ WhatsApp configuration missing (PHONE_NUMBER_ID or WHATSAPP_TOKEN).");
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: to_phone_number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "⏰ Evening Check-in! What did you conquer today?" },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "btn_gym_badminton", title: "Gym/Badminton 🏸" },
          },
          {
            type: "reply",
            reply: { id: "btn_read", title: "Read 15 Mins 📖" },
          },
          {
            type: "reply",
            reply: { id: "btn_view_stats", title: "View Stats 📊" },
          },
        ],
      },
    },
  };

  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log(`Proactive menu successfully sent to ${to_phone_number}`);
  } catch (error) {
    console.error(
      "Error sending menu:",
      error.response ? JSON.stringify(error.response.data) : error.message
    );
  }
}

// Helper function to format Date as YYYY-MM-DD
function getDayKey(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper function to subtract days safely
function subtractDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

// Helper function to calculate consecutive streak days
async function calculateStreak(phoneNumber) {
  const logs = await HabitLog.find({ phoneNumber }).sort({ loggedAt: -1 });
  if (!logs || logs.length === 0) return 0;

  const loggedDayKeys = new Set(logs.map((log) => getDayKey(log.loggedAt)));

  const todayKey = getDayKey(new Date());
  const yesterdayKey = getDayKey(subtractDays(new Date(), 1));

  if (!loggedDayKeys.has(todayKey) && !loggedDayKeys.has(yesterdayKey)) {
    return 0;
  }

  let streak = 0;
  let checkDate = loggedDayKeys.has(todayKey) ? new Date() : subtractDays(new Date(), 1);

  while (true) {
    const key = getDayKey(checkDate);
    if (loggedDayKeys.has(key)) {
      streak++;
      checkDate = subtractDays(checkDate, 1);
    } else {
      break;
    }
  }

  return streak;
}

// ==========================================
// PHASE 3: PROACTIVE CRON SCHEDULER
// ==========================================
cron.schedule("0 20 * * *", async () => {
  console.log("⏰ Running daily evening check-in cron job...");
  try {
    const activeUsers = await HabitLog.distinct("phoneNumber");

    for (let phone of activeUsers) {
      console.log(`Sending automated check-in to ${phone}`);
      await sendInteractiveHabitMenu(phone);
    }
  } catch (err) {
    console.error("Error running cron reminder:", err);
  }
});

// 1. GET route: Meta webhook verification handshake
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook officially verified by Meta!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 2. POST route: Meta message receiver
app.post("/webhook", async (req, res) => {
  const body = req.body;

  try {
    if (body?.object) {
      const messageData = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (messageData) {
        const senderPhone = messageData.from;

        // Handle standard text messages
        if (messageData.type === "text") {
          const msgText = messageData.text?.body?.toLowerCase().trim() || "";
          console.log(`Received message from ${senderPhone}: ${msgText}`);

          if (msgText === "menu" || msgText === "hi") {
            await sendInteractiveHabitMenu(senderPhone);
          } else {
            await sendWhatsAppMessage(
              senderPhone,
              `I didn't catch that. Send "menu" to view your tracking options.`
            );
          }
        }
        // Handle button clicks (interactive messages)
        else if (messageData.type === "interactive") {
          const buttonReplyId = messageData.interactive?.button_reply?.id;
          const buttonTitle = messageData.interactive?.button_reply?.title;
          console.log(`User ${senderPhone} clicked button: ${buttonReplyId}`);

          if (buttonReplyId === "btn_view_stats") {
            const currentStreak = await calculateStreak(senderPhone);
            const totalLogs = await HabitLog.countDocuments({
              phoneNumber: senderPhone,
            });

            await sendWhatsAppMessage(
              senderPhone,
              `📊 Your Habit Stats:\n- Current Streak: ${currentStreak} day(s) 🔥\n- Total Check-ins: ${totalLogs}\n\nKeep crushing your goals!`
            );
          } else if (buttonReplyId) {
            try {
              const newLog = new HabitLog({
                phoneNumber: senderPhone,
                habitId: buttonReplyId,
                habitTitle: buttonTitle || buttonReplyId,
              });
              await newLog.save();

              const currentStreak = await calculateStreak(senderPhone);
              await sendWhatsAppMessage(
                senderPhone,
                `Awesome job logging: ${buttonTitle || "habit"}! Recorded securely. Current streak: ${currentStreak} day(s) 🔥`
              );
            } catch (dbError) {
              console.error("Failed to save habit:", dbError);
              await sendWhatsAppMessage(
                senderPhone,
                "Oops, I had trouble saving that. Please try again!"
              );
            }
          }
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error("Error handling webhook POST:", err);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
