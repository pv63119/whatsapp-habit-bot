require("dotenv").config();
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const cron = require("node-cron");

const User = require("./models/User");
const Expense = require("./models/Expense");
const { processFinanceMessage, FIXED_CATEGORIES } = require("./services/aiService");
const { getNudgeMessage } = require("./services/nudgeService");
const {
  isUserSubscribed,
  createPaymentLink,
  verifyRazorpaySignature,
  activateUserSubscription,
} = require("./services/paymentService");

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

// 3. Download media from WhatsApp Meta Graph API
async function downloadWhatsAppMedia(mediaId) {
  if (!mediaId || !WHATSAPP_TOKEN) return null;
  try {
    // 1. Get media URL
    const metaRes = await axios.get(`https://graph.facebook.com/v20.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    const mediaUrl = metaRes.data?.url;
    const mimeType = metaRes.data?.mime_type || "image/jpeg";
    if (!mediaUrl) return null;

    // 2. Download binary stream
    const fileRes = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      responseType: "arraybuffer",
    });

    const base64 = Buffer.from(fileRes.data).toString("base64");
    return { base64, mimeType };
  } catch (err) {
    console.error("❌ Error downloading WhatsApp media:", err.response ? err.response.data : err.message);
    return null;
  }
}

// Helper: Calculate monthly budget stats (Separating Living Budget vs One-Off Exceptional Spends)
async function getMonthlyBudgetStats(phoneNumber, monthlyBudget) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Living expenses counted towards monthly budget
  const livingExpenses = await Expense.find({
    phoneNumber,
    createdAt: { $gte: startOfMonth },
    isExcludedFromBudget: { $ne: true },
  });

  // Separate one-off expenses (e.g., hospital bill, major bike service)
  const oneOffExpenses = await Expense.find({
    phoneNumber,
    createdAt: { $gte: startOfMonth },
    isExcludedFromBudget: true,
  });

  const livingSpent = livingExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const oneOffSpent = oneOffExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalSpent = livingSpent + oneOffSpent;

  const budget = monthlyBudget || 0;
  const remaining = budget > 0 ? budget - livingSpent : 0;
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
    livingSpent,
    oneOffSpent,
    monthlyBudget: budget,
    remaining,
    remainingPercent: Math.max(0, Math.round(remainingPercent)),
    statusEmoji,
    statusText,
    count: livingExpenses.length,
    expenses: livingExpenses,
    oneOffExpenses,
  };
}

// Root Health Check endpoint (Ultra-lightweight 2-byte response for cron-job.org & monitors)
app.get("/", (req, res) => {
  res.status(200).type("text/plain").send("OK");
});
app.head("/", (req, res) => {
  res.status(200).end();
});

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

// 2. POST route: Razorpay Payment Confirmation Webhook
app.post("/webhook/razorpay", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const event = req.body;

    console.log("💳 Received Razorpay Webhook Event:", event?.event);

    if (signature && !verifyRazorpaySignature(req.body, signature)) {
      console.warn("⚠️ Invalid Razorpay webhook signature");
      return res.sendStatus(400);
    }

    if (
      event.event === "payment_link.paid" ||
      event.event === "payment.captured" ||
      event.event === "order.paid"
    ) {
      const paymentEntity =
        event.payload?.payment?.entity ||
        event.payload?.payment_link?.entity ||
        event.payload?.order?.entity;

      const rawPhone =
        paymentEntity?.notes?.phoneNumber ||
        paymentEntity?.customer?.contact ||
        paymentEntity?.contact ||
        "";

      const amount = (paymentEntity?.amount || 6900) / 100;

      if (rawPhone) {
        const activatedUser = await activateUserSubscription(rawPhone, {
          paymentId: paymentEntity.id,
          amount,
          durationDays: 30,
        });

        if (activatedUser) {
          const confirmationMsg =
            `🎉 *Payment Successful! Welcome to Kharcha!*\n\n` +
            `Your ₹69 Monthly Membership is now active for 30 Days! 🚀\n\n` +
            `✨ *What you can do right now:*\n` +
            `• Log any spend (e.g. *150 coffee*, *Uber 320 to office*)\n` +
            `• Send a screenshot of any *Blinkit, Zepto, or Swiggy* bill\n` +
            `• Type *stats* to view your monthly spend & 🟢🟡🔴 budget status\n` +
            `• Type *edit budget* to adjust your target anytime\n\n` +
            `Let's take full control of your finances together! 💪`;

          await sendWhatsAppMessage(activatedUser.phoneNumber, confirmationMsg);
          console.log(`📩 Payment notification sent to ${activatedUser.phoneNumber}`);
        }
      }
    }

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("❌ Error handling Razorpay webhook:", err);
    res.sendStatus(500);
  }
});

// 3. POST route: Meta message receiver and AI brain processor
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
      let imageBase64 = null;
      let imageMimeType = "image/jpeg";

      // Handle text message
      if (messageData.type === "text") {
        incomingText = messageData.text?.body?.trim() || "";
      }
      // Handle image / screenshot / receipt
      else if (messageData.type === "image") {
        incomingText = messageData.image?.caption?.trim() || "Attached bill receipt screenshot";
        const mediaId = messageData.image?.id;
        if (mediaId) {
          const media = await downloadWhatsAppMedia(mediaId);
          if (media) {
            imageBase64 = media.base64;
            imageMimeType = media.mimeType;
          }
        }
      }
      // Handle interactive button click or list selection
      else if (messageData.type === "interactive") {
        incomingText =
          messageData.interactive?.button_reply?.title ||
          messageData.interactive?.list_reply?.title ||
          messageData.interactive?.button_reply?.id ||
          "";
      }

      if (!incomingText && !imageBase64) return;

      console.log(`📩 Incoming from ${senderPhone}: "${incomingText}" ${imageBase64 ? "[Image Attached]" : ""}`);

      // 1. Retrieve or create user record
      let user = await User.findOne({ phoneNumber: senderPhone });
      if (!user) {
        user = new User({
          phoneNumber: senderPhone,
          userState: "new_user",
          preferences: {},
          subscription: { status: "unpaid" },
          conversationHistory: [],
        });
        await user.save();
      }

      const lowerText = incomingText.toLowerCase().trim();

      // Quick Payment Link Triggers
      if (
        lowerText === "pay_69_activate" ||
        lowerText === "💳 activate (₹69/mo)" ||
        lowerText === "💳 renew (₹69/mo)" ||
        lowerText === "pay" ||
        lowerText === "subscribe" ||
        lowerText === "membership"
      ) {
        const payment = await createPaymentLink({
          phoneNumber: senderPhone,
          name: user.name || "Friend",
          amount: 69,
          planName: "Kharcha Monthly Membership",
        });
        const payMsg =
          `💳 *Kharcha Monthly Membership (₹69)*\n\n` +
          `Tap the link below to complete your ₹69 payment via UPI, Google Pay, PhonePe, Paytm, or Card:\n\n` +
          `👉 ${payment.paymentUrl}\n\n` +
          `_Your membership activates automatically as soon as payment is confirmed!_ 🎉`;
        await sendWhatsAppMessage(senderPhone, payMsg);
        return;
      }

      // 🛑 PAYWALL CHECK: If user completed onboarding but hasn't paid, block spend logging & check-ins
      const isOnboarding = ["new_user", "onboarding_name", "onboarding_budget", "onboarding_reminders"].includes(
        user.userState
      );

      if (!isOnboarding && !isUserSubscribed(user)) {
        const lockMsg =
          `🔒 *Kharcha Membership Required (₹69/month)*\n\n` +
          `Kharcha is a private, ad-free personal finance tracker. To log your expenses, scan receipt screenshots, and receive daily check-ins, please activate your membership below 👇`;
        const lockButtons = [{ id: "pay_69_activate", title: "💳 Activate (₹69/mo)" }];
        await sendWhatsAppInteractiveButtons(senderPhone, lockMsg, lockButtons);
        return;
      }

      // Quick Action Handler: Exclude from Budget (Non-recurring / One-off spend separation)
      if (
        lowerText === "exclude_from_budget" ||
        lowerText === "🛡️ track separately" ||
        lowerText === "track separately" ||
        lowerText === "exclude"
      ) {
        const lastExpense = await Expense.findOne({ phoneNumber: senderPhone }).sort({ createdAt: -1 });
        if (lastExpense) {
          lastExpense.isExcludedFromBudget = true;
          await lastExpense.save();
          const stats = await getMonthlyBudgetStats(senderPhone, user.preferences.monthlyBudget);
          const confirmMsg =
            `🛡️ *Tracked as Separate One-Off Spend!*\n\n` +
            `*${lastExpense.description}* (₹${lastExpense.amount.toLocaleString("en-IN")}) is excluded from your monthly living budget.\n\n` +
            `🟢 *Your Living Budget Status:*\n` +
            `• Living Spent: ₹${stats.livingSpent.toLocaleString("en-IN")}\n` +
            (stats.monthlyBudget > 0
              ? `• ${stats.statusEmoji} Remaining Budget: ₹${stats.remaining.toLocaleString("en-IN")} (${stats.remainingPercent}%)\n`
              : "") +
            `• Separate One-Off Total: ₹${stats.oneOffSpent.toLocaleString("en-IN")}`;
          await sendWhatsAppMessage(senderPhone, confirmMsg);
          return;
        }
      }

      // Quick Action Handler: Include in Budget
      if (
        lowerText === "include_in_budget" ||
        lowerText === "📊 in budget" ||
        lowerText === "in budget" ||
        lowerText === "include in budget"
      ) {
        const lastExpense = await Expense.findOne({ phoneNumber: senderPhone }).sort({ createdAt: -1 });
        if (lastExpense) {
          lastExpense.isExcludedFromBudget = false;
          await lastExpense.save();
          const stats = await getMonthlyBudgetStats(senderPhone, user.preferences.monthlyBudget);
          const confirmMsg =
            `📊 *Included in Monthly Budget!*\n\n` +
            `*${lastExpense.description}* (₹${lastExpense.amount.toLocaleString("en-IN")}) is counted towards your ₹${stats.monthlyBudget.toLocaleString("en-IN")} budget.\n\n` +
            (stats.monthlyBudget > 0
              ? `${stats.statusEmoji} *Remaining Budget:* ₹${stats.remaining.toLocaleString("en-IN")} (${stats.remainingPercent}%)`
              : `💰 *Living Spent:* ₹${stats.livingSpent.toLocaleString("en-IN")}`);
          await sendWhatsAppMessage(senderPhone, confirmMsg);
          return;
        }
      }

      // Quick Action Handler: Keep Previous Budget for New Month Clean Reset
      if (
        lowerText.startsWith("keep_budget") ||
        lowerText.includes("keep ₹") ||
        lowerText === "keep budget"
      ) {
        const budget = user.preferences.monthlyBudget || 15000;
        const confirmMsg =
          `🎉 *Budget Confirmed for the New Month!*\n\n` +
          `Your monthly budget is set to *₹${budget.toLocaleString("en-IN")}*.\n\n` +
          `All expenses from today start fresh from ₹0. Let's make this month great! 🚀`;
        await sendWhatsAppMessage(senderPhone, confirmMsg);
        return;
      }

      // Quick Action Handler: Set New Budget for New Month
      if (lowerText === "set_new_budget" || lowerText === "✏️ set new budget") {
        user.userState = "editing_budget";
        await user.save();
        const budgetMsg = "Sure! What should your budget target be for this new month? Tap below or type your amount:";
        const budgetButtons = [
          { id: "budget_15k", title: "₹15,000" },
          { id: "budget_25k", title: "₹25,000" },
          { id: "budget_40k", title: "₹40,000" },
        ];
        await sendWhatsAppInteractiveButtons(senderPhone, budgetMsg, budgetButtons);
        return;
      }

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

        if (!categoryBreakdown) categoryBreakdown = "No living expenses logged this month yet!";

        let oneOffSummary = "";
        if (stats.oneOffExpenses && stats.oneOffExpenses.length > 0) {
          const oneOffList = stats.oneOffExpenses
            .map((e) => `• ${e.description} (₹${e.amount.toLocaleString("en-IN")})`)
            .join("\n");
          oneOffSummary = `\n\n🛡️ *Separate One-Off Spends:* ₹${stats.oneOffSpent.toLocaleString("en-IN")}\n${oneOffList}`;
        }

        const statsMessage =
          `📊 *Monthly Spend Summary*\n\n` +
          `💰 *Living Spent:* ₹${stats.livingSpent.toLocaleString("en-IN")}\n` +
          (stats.monthlyBudget > 0
            ? `🎯 *Budget Target:* ₹${stats.monthlyBudget.toLocaleString("en-IN")}\n` +
              `${stats.statusEmoji} *Remaining:* ₹${stats.remaining.toLocaleString("en-IN")} (${stats.remainingPercent}%)\n` +
              `*Status:* ${stats.statusText}`
            : "") +
          `${oneOffSummary}\n\n` +
          `🏷️ *Category Breakdown:*\n${categoryBreakdown}\n\n` +
          `💡 _Notice an error? Tap below to edit or remove any recent entry!_`;

        const statsButtons = [
          { id: "edit_discrepancies", title: "✏️ Discrepancies? Edit" },
        ];
        await sendWhatsAppInteractiveButtons(senderPhone, statsMessage, statsButtons);
        return;
      }

      // Quick Action Handler: 'edit_discrepancies' or 'discrepancies' (Shows last 10 numbered expenses with edit guide)
      if (
        lowerText === "edit_discrepancies" ||
        lowerText === "✏️ discrepancies? edit" ||
        lowerText === "discrepancy" ||
        lowerText === "discrepancies" ||
        lowerText === "edit spends" ||
        lowerText === "manage expenses" ||
        lowerText === "history"
      ) {
        const last10 = await Expense.find({ phoneNumber: senderPhone })
          .sort({ createdAt: -1 })
          .limit(10);

        if (last10.length === 0) {
          await sendWhatsAppMessage(senderPhone, "📝 No expenses recorded yet! Text me something like '150 coffee' to start.");
          return;
        }

        const itemsFormatted = last10
          .map((e, idx) => {
            const dateFormatted = new Date(e.createdAt || e.date).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
            });
            const catEmoji = CATEGORY_EMOJI_MAP[e.category] || "📦";
            const tag = e.isExcludedFromBudget ? " _[One-Off]_" : "";
            return `*${idx + 1}.* ₹${e.amount.toLocaleString("en-IN")} — ${e.description} (${catEmoji} ${e.category})${tag} _(${dateFormatted})_`;
          })
          .join("\n\n");

        const listMsg =
          `📝 *Your Last ${last10.length} Recorded Spends:*\n\n` +
          `${itemsFormatted}\n\n` +
          `───────────────────\n` +
          `✏️ *How to edit or remove:*\n` +
          `• *Change amount:* Text *change 2 to 100*\n` +
          `• *Remove an item:* Text *remove 4* (or *delete 4*)\n` +
          `• *Change details:* Text *change 3 to 120 coffee*`;

        await sendWhatsAppMessage(senderPhone, listMsg);
        return;
      }

      // Quick Action Handler: 'remove X' or 'delete X'
      const removeMatch = lowerText.match(/^(?:remove|delete|del|cancel)\s+(\d+)$/i);
      if (removeMatch) {
        const itemNum = parseInt(removeMatch[1], 10);
        const last10 = await Expense.find({ phoneNumber: senderPhone }).sort({ createdAt: -1 }).limit(10);

        if (itemNum < 1 || itemNum > last10.length) {
          await sendWhatsAppMessage(
            senderPhone,
            `⚠️ Invalid item number! Please choose a number between 1 and ${last10.length}. (Text *edit spends* to view your list).`
          );
          return;
        }

        const targetExpense = last10[itemNum - 1];
        await Expense.findByIdAndDelete(targetExpense._id);

        const stats = await getMonthlyBudgetStats(senderPhone, user.preferences.monthlyBudget);
        const replyMsg =
          `🗑️ *Removed item #${itemNum}:*\n` +
          `${CATEGORY_EMOJI_MAP[targetExpense.category] || "📦"} *₹${targetExpense.amount.toLocaleString("en-IN")}* — ${targetExpense.description}\n\n` +
          (stats.monthlyBudget > 0
            ? `${stats.statusEmoji} *Updated Remaining Budget:* ₹${stats.remaining.toLocaleString("en-IN")} (${stats.remainingPercent}%)`
            : `💰 *Updated Living Spent:* ₹${stats.livingSpent.toLocaleString("en-IN")}`);

        await sendWhatsAppMessage(senderPhone, replyMsg);
        return;
      }

      // Quick Action Handler: 'change X to Y' or 'edit X to Y [desc]'
      const changeMatch = lowerText.match(/^(?:change|update|edit|set)\s+(\d+)\s+(?:to\s+)?(\d+(?:\.\d+)?)(?:\s+(.+))?$/i);
      if (changeMatch) {
        const itemNum = parseInt(changeMatch[1], 10);
        const newAmount = parseFloat(changeMatch[2]);
        const newDescription = changeMatch[3]?.trim();

        const last10 = await Expense.find({ phoneNumber: senderPhone }).sort({ createdAt: -1 }).limit(10);
        if (itemNum < 1 || itemNum > last10.length) {
          await sendWhatsAppMessage(
            senderPhone,
            `⚠️ Invalid item number! Please choose a number between 1 and ${last10.length}. (Text *edit spends* to view your list).`
          );
          return;
        }

        const targetExpense = last10[itemNum - 1];
        const oldAmount = targetExpense.amount;
        targetExpense.amount = newAmount;
        if (newDescription) {
          targetExpense.description = newDescription;
        }
        await targetExpense.save();

        const stats = await getMonthlyBudgetStats(senderPhone, user.preferences.monthlyBudget);
        const descText = newDescription ? ` — ${newDescription}` : ` — ${targetExpense.description}`;
        const replyMsg =
          `✏️ *Updated item #${itemNum}:*\n` +
          `${CATEGORY_EMOJI_MAP[targetExpense.category] || "📦"}${descText}: ₹${oldAmount.toLocaleString("en-IN")} ➔ *₹${newAmount.toLocaleString("en-IN")}*\n\n` +
          (stats.monthlyBudget > 0
            ? `${stats.statusEmoji} *Updated Remaining Budget:* ₹${stats.remaining.toLocaleString("en-IN")} (${stats.remainingPercent}%)`
            : `💰 *Updated Living Spent:* ₹${stats.livingSpent.toLocaleString("en-IN")}`);

        await sendWhatsAppMessage(senderPhone, replyMsg);
        return;
      }

      // Quick Action Handler: 'undo' or 'delete last'
      if (
        user.userState === "active_tracking" &&
        (lowerText === "undo" || lowerText === "delete last" || lowerText === "delete last expense")
      ) {
        const lastExpense = await Expense.findOne({ phoneNumber: senderPhone }).sort({ createdAt: -1 });
        if (!lastExpense) {
          await sendWhatsAppMessage(senderPhone, "📝 No recent expenses found to delete!");
        } else {
          await Expense.findByIdAndDelete(lastExpense._id);
          const stats = await getMonthlyBudgetStats(senderPhone, user.preferences.monthlyBudget);
          const undoMsg =
            `🗑️ *Deleted last transaction:*\n` +
            `${CATEGORY_EMOJI_MAP[lastExpense.category] || "📦"} *₹${lastExpense.amount}* - ${lastExpense.description}\n\n` +
            (stats.monthlyBudget > 0
              ? `${stats.statusEmoji} *Updated Remaining Budget:* ₹${stats.remaining.toLocaleString("en-IN")}`
              : `💰 *Updated Living Spent:* ₹${stats.livingSpent.toLocaleString("en-IN")}`);
          await sendWhatsAppMessage(senderPhone, undoMsg);
        }
        return;
      }

      // Quick Action Handler: 'edit' or 'settings'
      if (user.userState === "active_tracking" && (lowerText === "edit" || lowerText === "settings" || lowerText === "preferences")) {
        const editMsg =
          `⚙️ *Account Settings & Preferences*\n\n` +
          `What would you like to update? Tap an option below or type directly:`;
        const editButtons = [
          { id: "edit_name", title: "👤 Edit Name" },
          { id: "edit_budget", title: "💰 Edit Budget" },
          { id: "edit_reminders", title: "⏰ Edit Reminders" },
        ];
        await sendWhatsAppInteractiveButtons(senderPhone, editMsg, editButtons);
        return;
      }

      // Quick Action Handler: '👤 edit name' or 'edit name'
      if (lowerText === "👤 edit name" || lowerText === "edit name") {
        user.userState = "editing_name";
        await user.save();
        await sendWhatsAppMessage(senderPhone, "Got it! What should I call you from now on? 😊");
        return;
      }

      // Quick Action Handler: '💰 edit budget' or 'edit budget'
      if (lowerText === "💰 edit budget" || lowerText === "edit budget") {
        user.userState = "editing_budget";
        await user.save();
        const budgetMsg = "Sure! What should your new monthly budget target be? Tap below or type your amount:";
        const budgetButtons = [
          { id: "budget_25k", title: "₹25,000" },
          { id: "budget_40k", title: "₹40,000" },
          { id: "budget_60k", title: "₹60,000" },
        ];
        await sendWhatsAppInteractiveButtons(senderPhone, budgetMsg, budgetButtons);
        return;
      }

      // Quick Action Handler: '⏰ edit reminders' or 'edit reminders'
      if (lowerText === "⏰ edit reminders" || lowerText === "edit reminders") {
        user.userState = "editing_reminders";
        await user.save();
        const reminderMsg = "How often would you like me to check in with you?";
        const reminderButtons = [
          { id: "nudge_3hrs", title: "⏰ Every 3 hrs" },
          { id: "nudge_3x_daily", title: "🌅 3x Daily" },
          { id: "nudge_night_only", title: "🌙 Night Only" },
        ];
        await sendWhatsAppInteractiveButtons(senderPhone, reminderMsg, reminderButtons);
        return;
      }

      // Fetch current monthly stats for AI context
      const currentStats = await getMonthlyBudgetStats(senderPhone, user.preferences.monthlyBudget);

      // 2. Process with AI Brain
      const aiResult = await processFinanceMessage({
        userMessage: incomingText,
        imageBase64: imageBase64,
        imageMimeType: imageMimeType,
        userState: user.userState,
        userName: user.name,
        preferences: user.preferences,
        recentHistory: user.conversationHistory.slice(-6),
        budgetStats: {
          spentThisMonth: currentStats.livingSpent,
          monthlyBudget: currentStats.monthlyBudget,
          remainingBudget: currentStats.remaining,
          statusIndicator: currentStats.statusEmoji,
        },
      });

      console.log(`🤖 AI Response:`, JSON.stringify(aiResult, null, 2));

      // 3. Handle Undo / Delete action from AI
      if (aiResult.action === "delete_last_expense") {
        const lastExpense = await Expense.findOne({ phoneNumber: senderPhone }).sort({ createdAt: -1 });
        if (lastExpense) {
          await Expense.findByIdAndDelete(lastExpense._id);
          console.log(`🗑️ Deleted last expense ${lastExpense._id} for ${senderPhone}`);
        }
      }

      // 4. Update User State, Name, and Preferences in MongoDB
      if (aiResult.user_state) {
        user.userState = aiResult.user_state;
      }

      if (aiResult.extracted_preferences) {
        const { name, monthly_budget, recurring_bills, nudge_frequency } =
          aiResult.extracted_preferences;

        if (name) user.name = name;
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

      // 5. Save Expenses if extracted and user is subscribed
      if (
        isUserSubscribed(user) &&
        !aiResult.needs_clarification &&
        aiResult.action !== "delete_last_expense"
      ) {
        const expensesToSave =
          Array.isArray(aiResult.extracted_expenses) && aiResult.extracted_expenses.length > 0
            ? aiResult.extracted_expenses
            : (aiResult.extracted_expense ? [aiResult.extracted_expense] : []);

        for (const exp of expensesToSave) {
          if (exp.amount != null && !isNaN(Number(exp.amount))) {
            const category = exp.category || "General";
            const newExpense = new Expense({
              phoneNumber: senderPhone,
              amount: Number(exp.amount),
              currency: exp.currency || "INR",
              category: category,
              description: exp.description || incomingText,
              date: exp.date || new Date().toISOString().split("T")[0],
              rawMessage: incomingText,
              isUnplannedCandidate: Boolean(exp.is_unplanned_candidate),
              isExcludedFromBudget: false,
            });
            await newExpense.save();
            console.log(`💰 Expense recorded for ${senderPhone}: ₹${newExpense.amount} (${category} - ${newExpense.description}) [Unplanned: ${newExpense.isUnplannedCandidate}]`);
          }
        }
      }

      // 6. Send reply back to user (Interactive Buttons or Text)
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
// TIME-AWARE PROACTIVE SCHEDULERS & CLEAN MONTHLY RESET
// =========================================================

// Helper to broadcast 1st of month clean-slate reset prompt
async function broadcastMonthlyReset() {
  try {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const users = await User.find({
      userState: "active_tracking",
      "subscription.status": "active",
      "subscription.validUntil": { $gt: now },
      "preferences.lastMonthlyResetPrompt": { $ne: currentYearMonth },
    });

    console.log(`🌅 Broadcasting 1st of month clean reset prompt to ${users.length} active subscriber(s)...`);

    for (let user of users) {
      const budget = user.preferences.monthlyBudget || 15000;
      const nameGreeting = user.name ? ` ${user.name}` : "";
      const resetMsg =
        `🌅 *Happy 1st of the Month${nameGreeting}!* 🗓️\n\n` +
        `Your spending has reset for the new month with a clean slate (₹0 spent)! 🚀\n\n` +
        `💰 *Default Monthly Budget:* ₹${budget.toLocaleString("en-IN")}\n\n` +
        `You are all set to continue with *₹${budget.toLocaleString("en-IN")}*. Would you like to keep this or set a different budget for this month?`;

      const resetButtons = [
        { id: `keep_budget_${budget}`, title: `🟢 Keep ₹${budget.toLocaleString("en-IN")}`.substring(0, 20) },
        { id: "set_new_budget", title: "✏️ Set New Budget" },
      ];

      await sendWhatsAppInteractiveButtons(user.phoneNumber, resetMsg, resetButtons);

      // Update user record to mark prompt sent for this month
      user.preferences.lastMonthlyResetPrompt = currentYearMonth;
      await user.save();
    }
  } catch (err) {
    console.error("Error broadcasting monthly reset:", err);
  }
}

// Helper to broadcast contextual nudges to active paid subscribers
async function broadcastNudge(filterRegex, timeSlot, frequencyType) {
  try {
    const now = new Date();
    const users = await User.find({
      userState: "active_tracking",
      "subscription.status": "active",
      "subscription.validUntil": { $gt: now },
      "preferences.nudgeFrequency": { $regex: filterRegex },
    });

    console.log(`⏰ Broadcasting [${timeSlot} / ${frequencyType}] nudge to ${users.length} active subscriber(s)...`);

    for (let user of users) {
      const messageText = getNudgeMessage(frequencyType, timeSlot, new Date(), user.name);
      await sendWhatsAppMessage(user.phoneNumber, messageText);
    }
  } catch (err) {
    console.error(`Error broadcasting ${timeSlot} nudge:`, err);
  }
}

// 1. 1st of Every Month at 9:00 AM IST -> Clean-Slate Monthly Budget Reset
cron.schedule("0 9 1 * *", broadcastMonthlyReset, {
  timezone: "Asia/Kolkata",
});

// 2. 12:00 PM IST (Mid-day / Lunch Prep) -> 3-Hour Nudge
cron.schedule("0 12 * * *", () => broadcastNudge(/3|hour/i, "12PM", "3hr"), {
  timezone: "Asia/Kolkata",
});

// 3. 3:00 PM IST (Post-Lunch Slump) -> 3-Hour & 3x Daily Nudges
cron.schedule("0 15 * * *", () => {
  broadcastNudge(/3|hour/i, "3PM", "3hr");
  broadcastNudge(/3x|afternoon|day/i, "3PM", "3x");
}, {
  timezone: "Asia/Kolkata",
});

// 4. 6:00 PM IST (Evening Chai & Commute) -> 3-Hour Nudge
cron.schedule("0 18 * * *", () => broadcastNudge(/3|hour/i, "6PM", "3hr"), {
  timezone: "Asia/Kolkata",
});

// 5. 7:00 PM IST (Evening Rush) -> 3x Daily Nudge
cron.schedule("0 19 * * *", () => broadcastNudge(/3x|afternoon|day/i, "7PM", "3x"), {
  timezone: "Asia/Kolkata",
});

// 6. 9:00 PM IST (Dinner & Groceries) -> 3-Hour Nudge
cron.schedule("0 21 * * *", () => broadcastNudge(/3|hour/i, "9PM", "3hr"), {
  timezone: "Asia/Kolkata",
});

// 7. 10:30 PM IST (Night Only Wrap) -> Night Only Nudge
cron.schedule("30 22 * * *", () => broadcastNudge(/night/i, "10:30PM", "night_only"), {
  timezone: "Asia/Kolkata",
});

// 8. 11:00 PM IST (Post-Dinner Daily Wrap) -> 3x Daily Nudge
cron.schedule("0 23 * * *", () => broadcastNudge(/3x|afternoon|day/i, "11PM", "3x"), {
  timezone: "Asia/Kolkata",
});

// 9. 12:00 AM Midnight IST (Midnight Bedtime Wrap) -> 3-Hour Nudge
cron.schedule("0 0 * * *", () => broadcastNudge(/3|hour/i, "12AM", "3hr"), {
  timezone: "Asia/Kolkata",
});

// 10. Day 3 Profiling check (11:00 AM IST)
cron.schedule("0 11 * * *", async () => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    const eligibleUsers = await User.find({
      userState: "active_tracking",
      "subscription.status": "active",
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

// HTTP Trigger for External Schedulers & Nudges (cron-job.org)
app.get("/cron/nudge", async (req, res) => {
  try {
    const now = new Date();
    const istTimeStr = now.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: false });
    const istHour = parseInt(istTimeStr.split(":")[0], 10);

    let triggeredSlots = [];

    const customSlot = req.query.slot;
    const customType = req.query.type;
    if (customSlot && customType) {
      await broadcastNudge(customType === "night_only" ? /night/i : (customType === "3x" ? /3x|afternoon|day/i : /3|hour/i), customSlot, customType);
      triggeredSlots.push(`${customSlot} (${customType})`);
    } else {
      if (istHour >= 12 && istHour < 15) {
        await broadcastNudge(/3|hour/i, "12PM", "3hr");
        triggeredSlots.push("12PM 3hr");
      } else if (istHour >= 15 && istHour < 18) {
        await broadcastNudge(/3|hour/i, "3PM", "3hr");
        await broadcastNudge(/3x|afternoon|day/i, "3PM", "3x");
        triggeredSlots.push("3PM 3hr", "3PM 3x");
      } else if (istHour >= 18 && istHour < 19) {
        await broadcastNudge(/3|hour/i, "6PM", "3hr");
        triggeredSlots.push("6PM 3hr");
      } else if (istHour >= 19 && istHour < 21) {
        await broadcastNudge(/3x|afternoon|day/i, "7PM", "3x");
        triggeredSlots.push("7PM 3x");
      } else if (istHour >= 21 && istHour < 22) {
        await broadcastNudge(/3|hour/i, "9PM", "3hr");
        triggeredSlots.push("9PM 3hr");
      } else if (istHour === 22) {
        await broadcastNudge(/night/i, "10:30PM", "night_only");
        triggeredSlots.push("10:30PM night_only");
      } else if (istHour === 23) {
        await broadcastNudge(/3x|afternoon|day/i, "11PM", "3x");
        triggeredSlots.push("11PM 3x");
      } else if (istHour === 0 || istHour === 24) {
        await broadcastNudge(/3|hour/i, "12AM", "3hr");
        triggeredSlots.push("12AM 3hr");
      } else {
        await broadcastNudge(/3|hour/i, "12PM", "3hr");
        triggeredSlots.push("General Day Nudge");
      }
    }

    res.status(200).json({
      status: "success",
      istTime: istTimeStr,
      triggeredSlots,
    });
  } catch (err) {
    console.error("❌ Error in /cron/nudge endpoint:", err);
    res.status(500).json({ error: err.message });
  }
});

// HTTP Trigger for Monthly Reset Testing
app.get("/cron/monthly-reset", async (req, res) => {
  try {
    await broadcastMonthlyReset();
    res.status(200).json({ status: "success", message: "Monthly reset broadcast executed" });
  } catch (err) {
    console.error("❌ Error in /cron/monthly-reset:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Kharcha server is listening on port ${PORT} (Timezone: Asia/Kolkata)`);
});
