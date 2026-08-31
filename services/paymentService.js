const axios = require("axios");
const crypto = require("crypto");
const User = require("../models/User");

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "habit_bot_rzp_secret_123";
const DEFAULT_UPI_ID = process.env.PAYMENT_UPI_ID || "paytm.habitbot@icici"; // Fallback UPI ID for testing

/**
 * Generate a dynamic Payment Link via Razorpay or Fallback UPI Link
 */
async function createPaymentLink({ phoneNumber, name = "Friend", amount = 69, planName = "Pro Monthly" }) {
  // If Razorpay API credentials are configured, create a live Razorpay Payment Link
  if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    try {
      const authHeader = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
      const response = await axios.post(
        "https://api.razorpay.com/v1/payment_links",
        {
          amount: amount * 100, // Amount in paise
          currency: "INR",
          accept_partial: false,
          description: `Subscription: ${planName} for ${name}`,
          customer: {
            name: name || "Customer",
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
      // Fallback to UPI link on error
    }
  }

  // Fallback / Sandbox UPI Link
  const encodedName = encodeURIComponent("WhatsApp Habit Bot");
  const upiLink = `upi://pay?pa=${DEFAULT_UPI_ID}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodeURIComponent(planName)}`;

  return {
    paymentUrl: `https://rzp.io/i/test-demo-habitbot?amount=${amount}&phone=${phoneNumber}`,
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
 * Activate user subscription upon payment completion
 */
async function activateUserSubscription(phoneNumber, { paymentId, amount, planName = "Pro Monthly", durationDays = 30 }) {
  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) return null;

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + durationDays);

    user.subscription = {
      status: "active",
      plan: planName,
      validUntil,
      lastPaymentId: paymentId || `pay_${Date.now()}`,
    };

    await user.save();
    console.log(`✅ Subscription activated for ${phoneNumber} (${planName}) until ${validUntil.toISOString()}`);
    return user;
  } catch (err) {
    console.error("❌ Error activating user subscription:", err);
    return null;
  }
}

module.exports = {
  createPaymentLink,
  verifyRazorpaySignature,
  activateUserSubscription,
};
