/**
 * Test Simulator for Multi-Item Receipt Parsing & Vision OCR
 */
require("dotenv").config();
const { processFinanceMessage } = require("./services/aiService");

async function runSimulation() {
  console.log("==================================================");
  console.log("🧪 TESTING MULTI-ITEM SPLIT CATEGORIZATION");
  console.log("==================================================");

  // Test 1: Multi-item text message (Blinkit order)
  const userMessage = "Blinkit order: 100rs dal, 1 jeans for 999, 1 cat litter refill 350, 1 pack of cigarettes 180";
  console.log(`\n📥 Testing User Input:\n"${userMessage}"`);

  const result = await processFinanceMessage({
    userMessage,
    userState: "active_tracking",
    userName: "Priyanshu",
    preferences: { monthly_budget: 30000 },
    recentHistory: [],
    budgetStats: {
      spentThisMonth: 5000,
      monthlyBudget: 30000,
      remainingBudget: 25000,
      statusIndicator: "🟢",
    },
  });

  console.log(`\n🤖 Bot Response:\n${result.reply_to_user}`);
  console.log(`\n📦 Extracted Expenses (${result.extracted_expenses.length} items):`);
  console.log(JSON.stringify(result.extracted_expenses, null, 2));

  console.log("\n==================================================");
  console.log("🎉 MULTI-ITEM PARSING TEST COMPLETE");
  console.log("==================================================");
}

runSimulation();
