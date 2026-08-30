require("dotenv").config();
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const cron = require("node-cron");

const User = require("./models/User");
const Expense = require("./models/Expense");
const { processFinanceMessage } = require("./services/aiService");

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

const app = express();
app.use(express.json());

// Send WhatsApp text message via Meta Cloud API
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
    console.log(`✅ Message successfully sent to ${to_phone_number}!`);
  } catch (error) {
    console.error(
      "❌ Error sending message:",
      error.response ? JSON.stringify(error.response.data) : error.message
    );
  }
}

// 1. GET route: Meta webhook verification handshake
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook officially verified by Meta!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 2. POST route: Meta message receiver and AI brain processor
app.post("/webhook", async (req, res) => {
  const body = req.body;

  try {
    if (body?.object) {
      const messageData = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (messageData) {
        const senderPhone = messageData.from;

        // Handle text messages
        if (messageData.type === "text") {
          const userText = messageData.text?.body?.trim() || "";
          console.log(`📩 Incoming message from ${senderPhone}: "${userText}"`);

          // 1. Retrieve or create user record
          let user = await User.findOne({ phoneNumber: senderPhone });
          if (!user) {
            user = new User({
              phoneNumber: senderPhone,
              userState: "new_user",
              preferences: {},
              conversationHistory: [],
            });
            await user.save();
          }

          // 2. Send to AI Brain
          const aiResult = await processFinanceMessage({
            userMessage: userText,
            userState: user.userState,
            preferences: user.preferences,
            recentHistory: user.conversationHistory.slice(-6),
          });

          console.log(`🤖 AI Result for ${senderPhone}:`, JSON.stringify(aiResult, null, 2));

          // 3. Update User State and Preferences in MongoDB
          if (aiResult.user_state) {
            user.userState = aiResult.user_state;
          }

          if (aiResult.extracted_preferences) {
            const { primary_goal, monthly_budget, recurring_bills, nudge_frequency } =
              aiResult.extracted_preferences;

            if (primary_goal) user.preferences.primaryGoal = primary_goal;
            if (monthly_budget != null) user.preferences.monthlyBudget = monthly_budget;
            if (nudge_frequency) user.preferences.nudgeFrequency = nudge_frequency;
            if (Array.isArray(recurring_bills) && recurring_bills.length > 0) {
              user.preferences.recurringBills = Array.from(
                new Set([...(user.preferences.recurringBills || []), ...recurring_bills])
              );
            }
          }

          // Save conversation history (rolling window of last 20 messages)
          user.conversationHistory.push({ role: "user", content: userText });
          user.conversationHistory.push({ role: "model", content: aiResult.reply_to_user });
          if (user.conversationHistory.length > 20) {
            user.conversationHistory = user.conversationHistory.slice(-20);
          }

          await user.save();

          // 4. Save Expense if extracted and not needing clarification
          if (
            !aiResult.needs_clarification &&
            aiResult.extracted_expense &&
            aiResult.extracted_expense.amount != null
          ) {
            const expense = new Expense({
              phoneNumber: senderPhone,
              amount: aiResult.extracted_expense.amount,
              currency: aiResult.extracted_expense.currency || "INR",
              category: aiResult.extracted_expense.category || "General",
              description: aiResult.extracted_expense.description || userText,
              date: aiResult.extracted_expense.date || new Date().toISOString().split("T")[0],
              rawMessage: userText,
            });
            await expense.save();
            console.log(`💰 Expense saved for ${senderPhone}: ₹${expense.amount} (${expense.category})`);
          }

          // 5. Send reply back to user via WhatsApp
          await sendWhatsAppMessage(senderPhone, aiResult.reply_to_user);
        }
      }
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error("❌ Error handling webhook POST:", err);
    res.sendStatus(500);
  }
});

// ==========================================
// PROACTIVE SCHEDULERS (Nudges & Day 3 Profiling)
// ==========================================

// Check for Day 3 profiling trigger once a day at 11:00 AM
cron.schedule("0 11 * * *", async () => {
  console.log("⏰ Running Day 3 Profiling check...");
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    // Find users registered ~3 days ago who are in active_tracking and have no recurring bills logged
    const eligibleUsers = await User.find({
      userState: "active_tracking",
      createdAt: { $gte: fourDaysAgo, $lte: threeDaysAgo },
      "preferences.recurringBills": { $size: 0 },
    });

    for (let user of eligibleUsers) {
      console.log(`Triggering Day 3 profiling for ${user.phoneNumber}`);
      user.userState = "trigger_day_3_profiling";
      await user.save();

      const day3Message =
        "By the way, do you have a rent payment or EMI you'd like me to remind you about on a specific date?";
      await sendWhatsAppMessage(user.phoneNumber, day3Message);
    }
  } catch (err) {
    console.error("Error in Day 3 Profiling cron:", err);
  }
});

// Evening check-in at 8:00 PM for users who chose Evening or Morning/Evening reminders
cron.schedule("0 20 * * *", async () => {
  console.log("⏰ Running Evening Nudge check...");
  try {
    const eveningUsers = await User.find({
      userState: "active_tracking",
      "preferences.nudgeFrequency": { $regex: /evening|night/i },
    });

    for (let user of eveningUsers) {
      await sendWhatsAppMessage(
        user.phoneNumber,
        "Hey! 👋 Quick check-in: did you have any expenses or savings to log today?"
      );
    }
  } catch (err) {
    console.error("Error in Evening Nudge cron:", err);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Personal Finance Bot server is listening on port ${PORT}`);
});
