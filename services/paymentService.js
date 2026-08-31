const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "habit_bot_rzp_secret_123";
const DEFAULT_UPI_ID = process.env.PAYMENT_UPI_ID || "paytm.habitbot@icici"; // Fallback UPI ID for testing

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
  // If Razorpay API credentials are configured, create a live Razorpay Payment Link
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
        isLiveGateway: true,
      };
    } catch (err) {
      console.error("❌ Razorpay API error:", err.response ? err.response.data : err.message);
      // Fallback to sandbox link on error
    }
  }

  // Sandbox / UPI Fallback Link
  const encodedName = encodeURIComponent("HabitBot Membership");
  const upiLink = `upi://pay?pa=${DEFAULT_UPI_ID}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodeURIComponent("HabitBot Monthly ₹69")}`;

  return {
    paymentUrl: `https://rzp.io/i/habitbot-69?amount=${amount}&phone=${phoneNumber}`,
    upiUri: upiLink,
    amount,
    planName,
    isLiveGateway: false,
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
async function activateUserSubscription(phoneNumber, { paymentId, amount = 69, durationDays = 30 } = {}) {
  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) return null;

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
    console.log(`✅ HabitBot Membership activated for ${phoneNumber} until ${validUntil.toISOString()}`);
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
