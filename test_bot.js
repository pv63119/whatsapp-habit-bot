/**
 * Test Simulator for Refined WhatsApp Personal Finance Bot with Name Step
 */
require("dotenv").config();
const { processFinanceMessage } = require("./services/aiService");

async function runSimulation() {
  console.log("==================================================");
  console.log("🧪 TESTING ONBOARDING WITH NAME PROMPT");
  console.log("==================================================");

  const turns = [
    {
      label: "Turn 1: Initial Greeting (Welcome + Name Ask)",
      state: "new_user",
      message: "Hi",
    },
    {
      label: "Turn 2: User provides their name",
      state: "onboarding_name",
      message: "Priyanshu",
    },
    {
      label: "Turn 3: Tapping 'Let\'s go 🚀' Button",
      state: "onboarding_d1_step2",
      message: "Let's go 🚀",
    },
    {
      label: "Turn 4: Selecting Goal (Cut Impulses)",
      state: "onboarding_d1_step3",
      message: "2️⃣ Cut Impulses 🛍️",
    },
    {
      label: "Turn 5: Selecting Budget (₹25,000)",
      state: "onboarding_d1_step4",
      message: "₹25,000",
    },
    {
      label: "Turn 6: Selecting Nudge Frequency (⏰ Every 3 hrs)",
      state: "onboarding_d1_step4",
      message: "⏰ Every 3 hrs",
    },
    {
      label: "Turn 7: Natural Spend Logging",
      state: "active_tracking",
      message: "150 chai & bun maska",
    },
  ];

  let simulatedState = "new_user";
  let simulatedName = null;
  let simulatedPreferences = {};
  let history = [];

  for (const turn of turns) {
    // Pace requests slightly
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log(`\n--------------------------------------------------`);
    console.log(`💬 ${turn.label}`);
    console.log(`📥 User Message / Click: "${turn.message}" (State: ${simulatedState})`);

    try {
      const result = await processFinanceMessage({
        userMessage: turn.message,
        userState: simulatedState,
        userName: simulatedName,
        preferences: simulatedPreferences,
        recentHistory: history,
        budgetStats: {
          spentThisMonth: 150,
          monthlyBudget: 25000,
          remainingBudget: 24850,
          statusIndicator: "🟢",
        },
      });

      console.log(`🤖 Bot Reply:\n${result.reply_to_user}`);
      if (result.interactive_buttons) {
        console.log(`🔘 Interactive Buttons:`, result.interactive_buttons.map((b) => `[${b.title}]`).join("  "));
      }
      console.log(`📊 State Machine -> Next State: ${result.user_state}`);
      if (result.extracted_preferences?.name) {
        simulatedName = result.extracted_preferences.name;
        console.log(`👤 Captured Name: "${simulatedName}"`);
      }
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
  console.log("🎉 SIMULATION COMPLETE");
  console.log("==================================================");
}

runSimulation();
