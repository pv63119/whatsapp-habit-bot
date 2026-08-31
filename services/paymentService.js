const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "habit_bot_rzp_secret_123";
const RAZORPAY_PAYMENT_LINK = process.env.RAZORPAY_PAYMENT_LINK; // Direct Razorpay Payment Page URL
const PAYMENT_UPI_ID = process.env.PAYMENT_UPI_ID; // Custom UPI ID

/**
 * Check if a user currently has an active paid subscription
 */
function isUserSubscribed(user) {
  if (!user || !user.subscription) return false;
  if (user.subscription.status !== "active") return false;
  if (!user.subscription.validUntil) return false;
  return new Date(user.subscription.validUntil) > new Date();
}

/**
 * Generate a dynamic Payment Link for the ₹69 Monthly Membership
 */
async function createPaymentLink({ phoneNumber, name = "Friend", amount = 69, planName = "HabitBot Monthly Membership" }) {
  // Option 1: Direct Razorpay Payment Page / Link configured in environment
  if (RAZORPAY_PAYMENT_LINK) {
    return {
      paymentUrl: RAZORPAY_PAYMENT_LINK,
      amount,
      planName,
      source: "static_link",
    };
  }

  // Option 2: Live Razorpay API Keys configured
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    try {
      const authHeader = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
      const response = await axios.post(
        "https://api.razorpay.com/v1/payment_links",
        {
          amount: amount * 100, // Amount in paise (6900 paise = ₹69)
          currency: "INR",
          accept_partial: false,
          description: `HabitBot Membership: ₹69/month for ${name}`,
          customer: {
            name: name || "Member",
            contact: phoneNumber ? `+${phoneNumber.replace("+", "")}` : undefined,
          },
          notify: {
            sms: false,
            email: false,
          },
          reminder_enable: false,
          notes: {
            phoneNumber,
            planName,
          },
        },
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        paymentUrl: response.data.short_url,
        paymentLinkId: response.data.id,
        amount,
        planName,
        source: "api",
      };
    } catch (err) {
      console.error("❌ Razorpay API error:", err.response ? err.response.data : err.message);
    }
  }

  // Option 3: UPI ID link or fallback
  const upiId = PAYMENT_UPI_ID || "priyanshu@upi";
  const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent("HabitBot")}&am=${amount}&cu=INR&tn=${encodeURIComponent("HabitBot Monthly")}`;

  return {
    paymentUrl: RAZORPAY_PAYMENT_LINK || `https://rzp.io/l/habitbot-monthly`,
    upiUri: upiLink,
    amount,
    planName,
    source: "fallback",
  };
}

/**
 * Verify Razorpay Webhook Signature
 */
function verifyRazorpaySignature(body, signature) {
  if (!RAZORPAY_WEBHOOK_SECRET) return true;
  const expectedSignature = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(typeof body === "string" ? body : JSON.stringify(body))
    .digest("hex");
  return expectedSignature === signature;
}

/**
 * Activate user subscription upon payment completion (30 days access)
 */
async function activateUserSubscription(rawPhone, { paymentId, amount = 69, durationDays = 30 } = {}) {
  try {
    if (!rawPhone) return null;
    const digits = String(rawPhone).replace(/\D/g, "");
    const last10 = digits.slice(-10);

    // Find user matching exact phone or last 10 digits
    let user = await User.findOne({
      phoneNumber: { $regex: new RegExp(`${last10}$`) },
    });

    if (!user) {
      console.warn(`⚠️ No user found matching phone ${rawPhone} (${last10}) for payment activation.`);
      return null;
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + durationDays);

    user.subscription = {
      status: "active",
      validUntil,
      lastPaymentId: paymentId || `pay_${Date.now()}`,
    };

    // Unlock user into active tracking
    user.userState = "active_tracking";

    await user.save();
    console.log(`✅ HabitBot Membership activated for ${user.phoneNumber} until ${validUntil.toISOString()}`);
    return user;
  } catch (err) {
    console.error("❌ Error activating user subscription:", err);
    return null;
  }
}

module.exports = {
  isUserSubscribed,
  createPaymentLink,
  verifyRazorpaySignature,
  activateUserSubscription,
};
