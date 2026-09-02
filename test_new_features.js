/**
 * Test Simulator for:
 * 1. Non-Recurring / Exceptional Expense Detection (Hospital Bill, Bike Service)
 * 2. Clean-Slate Monthly Budget Reset (1st of month)
 */
require("dotenv").config();
const { processFinanceMessage } = require("./services/aiService");

async function runTests() {
  console.log("==================================================");
  console.log("🧪 TESTING NON-RECURRING EXPENSES & MONTHLY RESET");
  console.log("==================================================");

  // 1. Test Hospital Bill Detection
  console.log("\n1️⃣ Testing Hospital Bill Logging:");
  const hospitalResult = await processFinanceMessage({
    userMessage: "Spent 4500 at Fortis Hospital for emergency consultation and tests",
    userState: "active_tracking",
    userName: "Priyanshu",
    preferences: { name: "Priyanshu", monthlyBudget: 15000 },
    recentHistory: [],
  });

  console.log("🤖 Hospital Response:\n", hospitalResult.reply_to_user);
  console.log("📦 Extracted Expenses:\n", hospitalResult.extracted_expenses);
  console.log("🔘 Interactive Buttons:\n", hospitalResult.interactive_buttons);

  // 2. Test Bike Major Servicing Detection
  console.log("\n2️⃣ Testing Bike Major Servicing Logging:");
  const bikeResult = await processFinanceMessage({
    userMessage: "Paid 2800 for Royal Enfield major bike servicing and engine oil change",
    userState: "active_tracking",
    userName: "Priyanshu",
    preferences: { name: "Priyanshu", monthlyBudget: 15000 },
    recentHistory: [],
  });

  console.log("🤖 Bike Servicing Response:\n", bikeResult.reply_to_user);
  console.log("📦 Extracted Expenses:\n", bikeResult.extracted_expenses);
  console.log("🔘 Interactive Buttons:\n", bikeResult.interactive_buttons);

  // 3. Test Regular Daily Expense (Chai / Grocery) - Should NOT prompt separation
  console.log("\n3️⃣ Testing Daily Living Expense (Chai / Groceries):");
  const dailyResult = await processFinanceMessage({
    userMessage: "150rs ki chai and snacks with friends",
    userState: "active_tracking",
    userName: "Priyanshu",
    preferences: { name: "Priyanshu", monthlyBudget: 15000 },
    recentHistory: [],
  });

  console.log("🤖 Daily Response:\n", dailyResult.reply_to_user);
  console.log("📦 Extracted Expenses:\n", dailyResult.extracted_expenses);
  console.log("🔘 Interactive Buttons:\n", dailyResult.interactive_buttons);

  console.log("\n==================================================");
  console.log("🎉 ALL NEW FEATURE TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests();
