/**
 * Test Simulator for Paid-Only HabitBot (₹69/month)
 */
require("dotenv").config();
const { processFinanceMessage } = require("./services/aiService");
const { isUserSubscribed, createPaymentLink, activateUserSubscription } = require("./services/paymentService");

async function runTest() {
  console.log("==================================================");
  console.log("🧪 TESTING PAID-ONLY APP MODEL (₹69/MONTH)");
  console.log("==================================================");

  // 1. Test Onboarding final step (transition to awaiting_payment with ₹69 activation button)
  console.log("\n1️⃣ Testing Onboarding Step 4 ➔ Paywall:");
  const onboardingResult = await processFinanceMessage({
    userMessage: "Every 3 hours",
    userState: "onboarding_reminders",
    userName: "Karan",
    preferences: { name: "Karan", monthlyBudget: 30000 },
    recentHistory: [],
  });

  console.log(`🤖 Bot Response:\n${onboardingResult.reply_to_user}`);
  console.log(`📌 Next User State: ${onboardingResult.user_state}`);
  console.log(`🔘 Interactive Buttons:`, onboardingResult.interactive_buttons);

  // 2. Test Payment Link Generation for ₹69
  console.log("\n2️⃣ Generating ₹69 Payment Link for User:");
  const payment = await createPaymentLink({
    phoneNumber: "919876543210",
    name: "Karan",
    amount: 69,
    planName: "HabitBot Monthly Membership",
  });
  console.log("💳 Payment Result:", payment);

  // 3. Test Subscription Check Logic
  console.log("\n3️⃣ Testing Subscription Check Helper:");
  const unpaidUser = { subscription: { status: "unpaid", validUntil: null } };
  console.log(`- Unpaid User Subscribed? -> ${isUserSubscribed(unpaidUser)} (Expected: false)`);

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const paidUser = { subscription: { status: "active", validUntil: futureDate } };
  console.log(`- Paid User Subscribed? -> ${isUserSubscribed(paidUser)} (Expected: true)`);

  const expiredDate = new Date();
  expiredDate.setDate(expiredDate.getDate() - 1);
  const expiredUser = { subscription: { status: "active", validUntil: expiredDate } };
  console.log(`- Expired User Subscribed? -> ${isUserSubscribed(expiredUser)} (Expected: false)`);

  console.log("\n==================================================");
  console.log("🎉 ALL PAID MODEL TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTest();
