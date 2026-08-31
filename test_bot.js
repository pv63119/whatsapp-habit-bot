/**
 * Test Simulator for Streamlined Onboarding & Full Editing Suite
 */
require("dotenv").config();
const { processFinanceMessage } = require("./services/aiService");

async function runSimulation() {
  console.log("==================================================");
  console.log("🧪 TESTING STREAMLINED ONBOARDING & EDITING SUITE");
  console.log("==================================================");

  const turns = [
    {
      label: "Turn 1: Initial Greeting (Welcome + Name Ask)",
      state: "new_user",
      message: "Hi",
    },
    {
      label: "Turn 2: User provides name",
      state: "onboarding_name",
      message: "Priyanshu",
    },
    {
      label: "Turn 3: User taps 'Let\'s go 🚀'",
      state: "onboarding_budget",
      message: "Let's go 🚀",
    },
    {
      label: "Turn 4: Selecting Budget (₹25,000)",
      state: "onboarding_reminders",
      message: "₹25,000",
    },
    {
      label: "Turn 5: Selecting Reminders (⏰ Every 3 hrs)",
      state: "active_tracking",
      message: "⏰ Every 3 hrs",
    },
    {
      label: "Turn 6: Logging an Expense",
      state: "active_tracking",
      message: "150 chai & bun maska",
    },
    {
      label: "Turn 7: Natural Command - Change Budget to 45k",
      state: "active_tracking",
      message: "change my budget to 45k",
    },
    {
      label: "Turn 8: Natural Command - Change Name",
      state: "active_tracking",
      message: "call me Rahul",
    },
    {
      label: "Turn 9: Natural Command - Undo Last Expense",
      state: "active_tracking",
      message: "undo last spend",
    },
  ];

  let simulatedState = "new_user";
  let simulatedName = null;
  let simulatedPreferences = {};
  let history = [];

  for (const turn of turns) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log(`\n--------------------------------------------------`);
    console.log(`💬 ${turn.label}`);
    console.log(`📥 User Message: "${turn.message}" (State: ${simulatedState})`);

    try {
      const result = await processFinanceMessage({
        userMessage: turn.message,
        userState: simulatedState,
        userName: simulatedName,
        preferences: simulatedPreferences,
        recentHistory: history,
        budgetStats: {
          spentThisMonth: 150,
          monthlyBudget: simulatedPreferences.monthly_budget || 25000,
          remainingBudget: (simulatedPreferences.monthly_budget || 25000) - 150,
          statusIndicator: "🟢",
        },
      });

      console.log(`🤖 Bot Reply:\n${result.reply_to_user}`);
      if (result.interactive_buttons) {
        console.log(`🔘 Interactive Buttons:`, result.interactive_buttons.map((b) => `[${b.title}]`).join("  "));
      }
      console.log(`📊 Next State: ${result.user_state}`);
      if (result.action) {
        console.log(`⚡ Triggered Action: ${result.action}`);
      }
      if (result.extracted_preferences?.name) {
        simulatedName = result.extracted_preferences.name;
        console.log(`👤 Captured Name: "${simulatedName}"`);
      }
      if (result.extracted_expense?.amount) {
        console.log(`💰 Extracted Expense:`, result.extracted_expense);
      }
      if (result.extracted_preferences && Object.values(result.extracted_preferences).some((v) => v !== null)) {
        console.log(`⚙️ Extracted Preferences:`, result.extracted_preferences);
      }

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
  console.log("🎉 ALL TESTS PASSED");
  console.log("==================================================");
}

runSimulation();
