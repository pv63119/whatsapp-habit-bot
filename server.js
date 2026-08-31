require("dotenv").config();
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const cron = require("node-cron");

const User = require("./models/User");
const Expense = require("./models/Expense");
const { processFinanceMessage, FIXED_CATEGORIES } = require("./services/aiService");
const { getNudgeMessage } = require("./services/nudgeService");

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

// Category to Emoji map
const CATEGORY_EMOJI_MAP = {
  "Food & Dining": "🍔",
  "Groceries": "🛒",
  "Travel & Commute": "🚗",
  "Shopping & Lifestyle": "🛍️",
  "Bills & Utilities": "💡",
  "Entertainment": "🍿",
  "Health & Medical": "🏥",
  "General": "📦",
};

// Rolling set to deduplicate incoming Meta Webhook message IDs
const processedMessageIds = new Set();
function isDuplicateMessage(messageId) {
  if (!messageId) return false;
  if (processedMessageIds.has(messageId)) return true;
  processedMessageIds.add(messageId);
  if (processedMessageIds.size > 500) {
    const firstKey = processedMessageIds.values().next().value;
    processedMessageIds.delete(firstKey);
  }
  return false;
}

// 1. Send standard WhatsApp text message
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
    console.log(`✅ Text message sent to ${to_phone_number}`);
  } catch (error) {
    console.error(
      "❌ Error sending text message:",
      error.response ? JSON.stringify(error.response.data) : error.message
    );
  }
}

// 2. Send interactive quick reply buttons (up to 3 buttons)
async function sendWhatsAppInteractiveButtons(to_phone_number, bodyText, buttons) {
  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    console.error("❌ WhatsApp configuration missing.");
    return sendWhatsAppMessage(to_phone_number, bodyText);
  }

  const formattedButtons = buttons.slice(0, 3).map((btn, index) => ({
    type: "reply",
    reply: {
      id: btn.id || `btn_${index}`,
      title: (btn.title || `Option ${index + 1}`).substring(0, 20), // WhatsApp title limit 20 chars
    },
  }));

  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: to_phone_number,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: { buttons: formattedButtons },
    },
  };

  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    console.log(`✅ Interactive buttons sent to ${to_phone_number}`);
  } catch (error) {
    console.error(
      "❌ Error sending interactive buttons, falling back to text:",
      error.response ? JSON.stringify(error.response.data) : error.message
    );
    await sendWhatsAppMessage(to_phone_number, bodyText);
  }
}

// Helper: Calculate monthly budget stats with Traffic-Light indicators
async function getMonthlyBudgetStats(phoneNumber, monthlyBudget) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const expenses = await Expense.find({
    phoneNumber,
    createdAt: { $gte: startOfMonth },
  });

  const totalSpent = expenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const budget = monthlyBudget || 0;
  const remaining = budget > 0 ? budget - totalSpent : 0;
  const remainingPercent = budget > 0 ? (remaining / budget) * 100 : 100;

  let statusEmoji = "🟢";
  let statusText = "Healthy";
  if (budget > 0) {
    if (remainingPercent <= 30) {
      statusEmoji = "🔴";
      statusText = "Low Budget Alert";
    } else if (remainingPercent <= 70) {
      statusEmoji = "🟡";
      statusText = "Moderate Spending";
    }
  }

  return {
    totalSpent,
    monthlyBudget: budget,
    remaining,
    remainingPercent: Math.max(0, Math.round(remainingPercent)),
    statusEmoji,
    statusText,
    count: expenses.length,
    expenses,
  };
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
  // Acknowledge Meta immediately to prevent timeout retries
  res.sendStatus(200);

  const body = req.body;

  try {
    if (body?.object) {
      const change = body.entry?.[0]?.changes?.[0]?.value;
      
      // Ignore delivery receipts / read statuses
      if (!change?.messages || change.messages.length === 0) {
        return;
      }

      const messageData = change.messages[0];
      const messageId = messageData.id;

      // Deduplicate webhook re-deliveries
      if (isDuplicateMessage(messageId)) {
        console.log(`⚠️ Ignored duplicate message ID: ${messageId}`);
        return;
      }

      const senderPhone = messageData.from;
      let incomingText = "";

      // Handle text message
      if (messageData.type === "text") {
        incomingText = messageData.text?.body?.trim() || "";
      }
      // Handle interactive button click or list selection
      else if (messageData.type === "interactive") {
        incomingText =
          messageData.interactive?.button_reply?.title ||
          messageData.interactive?.list_reply?.title ||
          messageData.interactive?.button_reply?.id ||
          "";
      }

      if (!incomingText) return;

      console.log(`📩 Incoming from ${senderPhone}: "${incomingText}"`);

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

      const lowerText = incomingText.toLowerCase().trim();

      // Quick Action Handler: 'stats' or 'summary'
      if (user.userState === "active_tracking" && (lowerText === "stats" || lowerText === "summary")) {
        const stats = await getMonthlyBudgetStats(senderPhone, user.preferences.monthlyBudget);

        const categoryTotals = {};
        for (let exp of stats.expenses) {
          categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        }

        let categoryBreakdown = Object.entries(categoryTotals)
          .map(([cat, amt]) => `${CATEGORY_EMOJI_MAP[cat] || "📦"} *${cat}:* ₹${amt.toLocaleString("en-IN")}`)
          .join("\n");

        if (!categoryBreakdown) categoryBreakdown = "No expenses logged this month yet!";

        const statsMessage =
          `📊 *Monthly Spend Summary*\n\n` +
          `💰 *Total Spent:* ₹${stats.totalSpent.toLocaleString("en-IN")}\n` +
          (stats.monthlyBudget > 0
            ? `🎯 *Budget:* ₹${stats.monthlyBudget.toLocaleString("en-IN")}\n` +
              `${stats.statusEmoji} *Remaining:* ₹${stats.remaining.toLocaleString("en-IN")} (${stats.remainingPercent}%)\n` +
              `*Status:* ${stats.statusText}\n\n`
            : "\n") +
          `🏷️ *Category Breakdown:*\n${categoryBreakdown}\n\n` +
          `💡 _Tip: Just text me any spend to add to your stats!_`;

        await sendWhatsAppMessage(senderPhone, statsMessage);
        return;
      }

      // Quick Action Handler: 'history'
      if (user.userState === "active_tracking" && lowerText === "history") {
        const recentExpenses = await Expense.find({ phoneNumber: senderPhone })
          .sort({ createdAt: -1 })
          .limit(5);

        if (recentExpenses.length === 0) {
          await sendWhatsAppMessage(senderPhone, "📝 No expenses logged yet! Text me something like '150 coffee' to start.");
        } else {
          const historyList = recentExpenses
            .map((e) => `${CATEGORY_EMOJI_MAP[e.category] || "📦"} *₹${e.amount}* - ${e.description} _(${e.date})_`)
            .join("\n");

          await sendWhatsAppMessage(senderPhone, `📜 *Last 5 Transactions:*\n\n${historyList}`);
        }
        return;
      }

      // Fetch current monthly stats for AI context
      const currentStats = await getMonthlyBudgetStats(senderPhone, user.preferences.monthlyBudget);

      // 2. Process with AI Brain
      const aiResult = await processFinanceMessage({
        userMessage: incomingText,
        userState: user.userState,
        userName: user.name,
        preferences: user.preferences,
        recentHistory: user.conversationHistory.slice(-6),
        budgetStats: {
          spentThisMonth: currentStats.totalSpent,
          monthlyBudget: currentStats.monthlyBudget,
          remainingBudget: currentStats.remaining,
          statusIndicator: currentStats.statusEmoji,
        },
      });

      console.log(`🤖 AI Response:`, JSON.stringify(aiResult, null, 2));

      // 3. Update User State, Name, and Preferences in MongoDB
      if (aiResult.user_state) {
        user.userState = aiResult.user_state;
      }

      if (aiResult.extracted_preferences) {
        const { name, primary_goal, monthly_budget, recurring_bills, nudge_frequency } =
          aiResult.extracted_preferences;

        if (name) user.name = name;
        if (primary_goal) user.preferences.primaryGoal = primary_goal;
        if (monthly_budget != null) user.preferences.monthlyBudget = monthly_budget;
        if (nudge_frequency) user.preferences.nudgeFrequency = nudge_frequency;
        if (Array.isArray(recurring_bills) && recurring_bills.length > 0) {
          user.preferences.recurringBills = Array.from(
            new Set([...(user.preferences.recurringBills || []), ...recurring_bills])
          );
        }
      }

      // Maintain conversation history
      user.conversationHistory.push({ role: "user", content: incomingText });
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
        const category = aiResult.extracted_expense.category || "General";
        const expense = new Expense({
          phoneNumber: senderPhone,
          amount: aiResult.extracted_expense.amount,
          currency: aiResult.extracted_expense.currency || "INR",
          category: category,
          description: aiResult.extracted_expense.description || incomingText,
          date: aiResult.extracted_expense.date || new Date().toISOString().split("T")[0],
          rawMessage: incomingText,
        });
        await expense.save();
        console.log(`💰 Expense recorded for ${senderPhone}: ₹${expense.amount} (${category})`);
      }

      // 5. Send reply back to user (Interactive Buttons or Text)
      if (aiResult.interactive_buttons && aiResult.interactive_buttons.length > 0) {
        await sendWhatsAppInteractiveButtons(
          senderPhone,
          aiResult.reply_to_user,
          aiResult.interactive_buttons
        );
      } else {
        await sendWhatsAppMessage(senderPhone, aiResult.reply_to_user);
      }
    }
  } catch (err) {
    console.error("❌ Error handling webhook POST:", err);
  }
});

// =========================================================
// TIME-AWARE PROACTIVE SCHEDULERS (Asia/Kolkata / IST Time)
// =========================================================

// Helper to broadcast contextual nudges to specific frequency groups
async function broadcastNudge(filterRegex, timeSlot, frequencyType) {
  try {
    const users = await User.find({
      userState: "active_tracking",
      "preferences.nudgeFrequency": { $regex: filterRegex },
    });

    const messageText = getNudgeMessage(frequencyType, timeSlot);
    console.log(`⏰ Broadcasting [${timeSlot} / ${frequencyType}] nudge to ${users.length} user(s)...`);

    for (let user of users) {
      await sendWhatsAppMessage(user.phoneNumber, messageText);
    }
  } catch (err) {
    console.error(`Error broadcasting ${timeSlot} nudge:`, err);
  }
}

// 1. 12:00 PM IST (Mid-day / Lunch Prep) -> 3-Hour Nudge
cron.schedule("0 12 * * *", () => broadcastNudge(/3|hour/i, "12PM", "3hr"), {
  timezone: "Asia/Kolkata",
});

// 2. 3:00 PM IST (Post-Lunch Slump) -> 3-Hour & 3x Daily Nudges
cron.schedule("0 15 * * *", () => {
  broadcastNudge(/3|hour/i, "3PM", "3hr");
  broadcastNudge(/3x|afternoon|day/i, "3PM", "3x");
}, {
  timezone: "Asia/Kolkata",
});

// 3. 6:00 PM IST (Evening Chai & Commute) -> 3-Hour Nudge
cron.schedule("0 18 * * *", () => broadcastNudge(/3|hour/i, "6PM", "3hr"), {
  timezone: "Asia/Kolkata",
});

// 4. 7:00 PM IST (Evening Rush) -> 3x Daily Nudge
cron.schedule("0 19 * * *", () => broadcastNudge(/3x|afternoon|day/i, "7PM", "3x"), {
  timezone: "Asia/Kolkata",
});

// 5. 9:00 PM IST (Dinner & Groceries) -> 3-Hour Nudge
cron.schedule("0 21 * * *", () => broadcastNudge(/3|hour/i, "9PM", "3hr"), {
  timezone: "Asia/Kolkata",
});

// 6. 10:30 PM IST (Night Only Wrap) -> Night Only Nudge
cron.schedule("30 22 * * *", () => broadcastNudge(/night/i, "10:30PM", "night_only"), {
  timezone: "Asia/Kolkata",
});

// 7. 11:00 PM IST (Post-Dinner Daily Wrap) -> 3x Daily Nudge
cron.schedule("0 23 * * *", () => broadcastNudge(/3x|afternoon|day/i, "11PM", "3x"), {
  timezone: "Asia/Kolkata",
});

// 8. 12:00 AM Midnight IST (Midnight Bedtime Wrap) -> 3-Hour Nudge
cron.schedule("0 0 * * *", () => broadcastNudge(/3|hour/i, "12AM", "3hr"), {
  timezone: "Asia/Kolkata",
});

// 9. Day 3 Profiling check (11:00 AM IST)
cron.schedule("0 11 * * *", async () => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    const eligibleUsers = await User.find({
      userState: "active_tracking",
      createdAt: { $gte: fourDaysAgo, $lte: threeDaysAgo },
      "preferences.recurringBills": { $size: 0 },
    });

    for (let user of eligibleUsers) {
      user.userState = "trigger_day_3_profiling";
      await user.save();

      const day3Message =
        "By the way! 👋 Do you have a recurring rent payment or EMI you'd like me to remind you about on a specific date?";
      await sendWhatsAppMessage(user.phoneNumber, day3Message);
    }
  } catch (err) {
    console.error("Error in Day 3 Profiling cron:", err);
  }
}, {
  timezone: "Asia/Kolkata",
});

app.listen(PORT, () => {
  console.log(`🚀 Personal Finance Bot server is listening on port ${PORT} (Timezone: Asia/Kolkata)`);
});
