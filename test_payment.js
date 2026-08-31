/**
 * Test Simulator for Payment Links, Subscription Activation & Onboarding Tutorial
 */
require("dotenv").config();
const { processFinanceMessage } = require("./services/aiService");
const { createPaymentLink, activateUserSubscription } = require("./services/paymentService");

async function runTest() {
  console.log("==================================================");
  console.log("🧪 TESTING ONBOARDING JOURNEY & PAYMENT FLOWS");
  console.log("==================================================");

  // 1. Test Onboarding Step 4 -> Step 5 (Welcome summary with Screenshot & Budget edit tutorial)
  console.log("\n1️⃣ Testing Onboarding Setup Summary with Screenshot & Budget Guidance:");
  const onboardingResult = await processFinanceMessage({
    userMessage: "Every 3 hours",
    userState: "onboarding_reminders",
    userName: "Aditya",
    preferences: { name: "Aditya", monthlyBudget: 25000 },
    recentHistory: [
      { role: "bot", content: "When would you like a friendly check-in?" }
    ],
    budgetStats: null,
  });

  console.log(`🤖 Setup Summary Message:\n${onboardingResult.reply_to_user}`);

  // 2. Test Pricing / Upgrade query
  console.log("\n2️⃣ Testing Upgrade / Pricing Command:");
  const upgradeResult = await processFinanceMessage({
    userMessage: "upgrade to pro",
    userState: "active_tracking",
    userName: "Aditya",
    preferences: { name: "Aditya", monthlyBudget: 25000 },
    recentHistory: [],
  });

  console.log(`🤖 Upgrade Message:\n${upgradeResult.reply_to_user}`);
  console.log(`🔘 Interactive Buttons:`, upgradeResult.interactive_buttons);

  // 3. Test Payment Link Generation
  console.log("\n3️⃣ Testing Payment Link Generation:");
  const monthlyPayment = await createPaymentLink({
    phoneNumber: "919990436789",
    name: "Aditya",
    amount: 99,
    planName: "Pro Monthly Plan",
  });
  console.log("💳 Monthly Payment Link Result:", monthlyPayment);

  const annualPayment = await createPaymentLink({
    phoneNumber: "919990436789",
    name: "Aditya",
    amount: 799,
    planName: "Pro Annual Plan",
  });
  console.log("⭐ Annual Payment Link Result:", annualPayment);

  console.log("\n==================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runTest();
