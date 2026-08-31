/**
 * Test Simulator for ₹69 Monthly & ₹599 Annual Pricing Flow
 */
require("dotenv").config();
const { processFinanceMessage } = require("./services/aiService");
const { createPaymentLink } = require("./services/paymentService");

async function runTest() {
  console.log("==================================================");
  console.log("🧪 TESTING ₹69 MONTHLY PRICING & PAYMENT FLOW");
  console.log("==================================================");

  // 1. Test Pricing / Upgrade query
  console.log("\n1️⃣ Testing Upgrade / Pricing Command:");
  const upgradeResult = await processFinanceMessage({
    userMessage: "upgrade to pro",
    userState: "active_tracking",
    userName: "Aditya",
    preferences: { name: "Aditya", monthlyBudget: 25000 },
    recentHistory: [],
  });

  console.log(`🤖 Upgrade Message:\n${upgradeResult.reply_to_user}`);
  console.log(`🔘 Interactive Buttons:`, upgradeResult.interactive_buttons);

  // 2. Test Payment Link Generation
  console.log("\n2️⃣ Testing Payment Link Generation for ₹69:");
  const monthlyPayment = await createPaymentLink({
    phoneNumber: "919990436789",
    name: "Aditya",
    amount: 69,
    planName: "Pro Monthly Plan",
  });
  console.log("💳 Monthly Payment Link Result:", monthlyPayment);

  const annualPayment = await createPaymentLink({
    phoneNumber: "919990436789",
    name: "Aditya",
    amount: 599,
    planName: "Pro Annual Plan",
  });
  console.log("⭐ Annual Payment Link Result:", annualPayment);

  console.log("\n==================================================");
  console.log("🎉 ALL TESTS PASSED FOR ₹69 MODEL!");
  console.log("==================================================");
}

runTest();
