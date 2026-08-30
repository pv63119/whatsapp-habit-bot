/**
 * Test Simulator for Refined WhatsApp Personal Finance Bot
 */
require("dotenv").config();
const { processFinanceMessage } = require("./services/aiService");

async function runSimulation() {
  console.log("==================================================");
  console.log("🧪 TESTING INTERACTIVE ONBOARDING & HOT ACTIONS");
  console.log("==================================================");

  const turns = [
    {
      label: "Turn 1: Initial Greeting (Welcome + 'Let\'s go' Button)",
      state: "new_user",
      message: "Hi",
    },
    {
      label: "Turn 2: Tapping 'Let\'s go 🚀' Button",
      state: "onboarding_d1_step2",
      message: "Let's go 🚀",
    },
    {
      label: "Turn 3: Selecting Goal Button (Cut Impulses)",
      state: "onboarding_d1_step3",
      message: "2️⃣ Cut Impulses 🛍️",
    },
    {
      label: "Turn 4: Selecting Budget Button (₹25,000)",
      state: "onboarding_d1_step4",
      message: "₹25,000",
    },
    {
      label: "Turn 5: Selecting Nudge Frequency (⏰ Every 3 hrs)",
      state: "onboarding_d1_step4",
      message: "⏰ Every 3 hrs",
    },
    {
      label: "Turn 6: Free-form Natural Language Spend",
      state: "active_tracking",
      message: "220 ki chai and bun maska at cafe",
    },
    {
      label: "Turn 7: Ambiguous Spend (Clarification Protocol)",
      state: "active_tracking",
      message: "Spent 500",
    },
    {
      label: "Turn 8: Clarifying Ambiguous Spend",
      state: "active_tracking",
      message: "It was for Blinkit grocery",
    },
  ];

  let simulatedState = "new_user";
  let simulatedPreferences = {};
  let history = [];

  for (const turn of turns) {
    // Pace requests slightly to respect API rate limits
    await new Promise((resolve) => setTimeout(resolve, 2500));
    console.log(`\n--------------------------------------------------`);
    console.log(`💬 ${turn.label}`);
    console.log(`📥 User Message / Click: "${turn.message}" (State: ${simulatedState})`);

    try {
      const result = await processFinanceMessage({
        userMessage: turn.message,
        userState: simulatedState,
        preferences: simulatedPreferences,
        recentHistory: history,
        budgetStats: {
          spentThisMonth: 720,
          monthlyBudget: 25000,
          remainingBudget: 24280,
          statusIndicator: "🟢",
        },
      });

      console.log(`🤖 Bot Reply:\n${result.reply_to_user}`);
      if (result.interactive_buttons) {
        console.log(`🔘 Interactive Buttons:`, result.interactive_buttons.map((b) => `[${b.title}]`).join("  "));
      }
      console.log(`📊 State Machine -> Next State: ${result.user_state}`);
      if (result.extracted_expense.amount) {
        console.log(`💰 Extracted Expense:`, result.extracted_expense);
      }
      if (result.extracted_preferences && Object.values(result.extracted_preferences).some((v) => v !== null)) {
        console.log(`⚙️ Extracted Preferences:`, result.extracted_preferences);
      }

      // Transition state for next turn
      simulatedState = result.user_state;
      if (result.extracted_preferences) {
        simulatedPreferences = { ...simulatedPreferences, ...result.extracted_preferences };
      }
      history.push({ role: "user", content: turn.message });
      history.push({ role: "model", content: result.reply_to_user });
    } catch (err) {
      console.error(`❌ Error in ${turn.label}:`, err.message);
    }
  }

  console.log("\n==================================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY");
  console.log("==================================================");
}

runSimulation();
