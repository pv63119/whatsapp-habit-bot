/**
 * Test Simulator for WhatsApp Personal Finance AI Bot
 *
 * Runs simulation through the progressive onboarding state machine and active tracking.
 */
require("dotenv").config();
const { processFinanceMessage } = require("./services/aiService");

async function runSimulation() {
  console.log("==================================================");
  console.log("🧪 STARTING REFINED ONBOARDING SIMULATION");
  console.log("==================================================");

  const hasApiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_KEY);

  if (!hasApiKey) {
    console.log("⚠️ No GEMINI_API_KEY detected in .env.");
    return;
  }

  const turns = [
    {
      label: "Turn 1: New User Greeting",
      state: "new_user",
      message: "Hi",
      expectedState: "onboarding_d1_step2",
    },
    {
      label: "Turn 2: Response to 'Let\'s go' Prompt",
      state: "onboarding_d1_step2",
      message: "Let's go!",
      expectedState: "onboarding_d1_step3",
    },
    {
      label: "Turn 3: Selecting Goal from 1/2/3",
      state: "onboarding_d1_step3",
      message: "2 (Cut impulse buys)",
      expectedState: "onboarding_d1_step4",
    },
    {
      label: "Turn 4: Setting Budget & Check-in Time",
      state: "onboarding_d1_step4",
      message: "Around 40k. Remind me at night only.",
      expectedState: "active_tracking",
    },
    {
      label: "Turn 5: Ambiguous Expense Logging (Clarification Protocol)",
      state: "active_tracking",
      message: "Spent 500",
      expectedClarification: true,
    },
    {
      label: "Turn 6: Clarified Expense Logging",
      state: "active_tracking",
      message: "It was 500 on groceries at Blinkit",
      expectedClarification: false,
    },
  ];

  let simulatedState = "new_user";
  let simulatedPreferences = {};
  let history = [];

  for (const turn of turns) {
    console.log(`\n--------------------------------------------------`);
    console.log(`💬 ${turn.label}`);
    console.log(`📥 User Message: "${turn.message}" (Current State: ${simulatedState})`);

    try {
      const result = await processFinanceMessage({
        userMessage: turn.message,
        userState: simulatedState,
        preferences: simulatedPreferences,
        recentHistory: history,
      });

      console.log(`🤖 Bot Reply:\n${result.reply_to_user}`);
      console.log(`📊 State Machine -> Next State: ${result.user_state}`);
      console.log(`❓ Needs Clarification: ${result.needs_clarification}`);
      if (result.extracted_expense.amount) {
        console.log(`💰 Extracted Expense:`, result.extracted_expense);
      }
      if (result.extracted_preferences && Object.values(result.extracted_preferences).some((v) => v !== null)) {
        console.log(`⚙️ Extracted Preferences:`, result.extracted_preferences);
      }

      // Update state and history for next turn
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
  console.log("🎉 SIMULATION VERIFICATION COMPLETE");
  console.log("==================================================");
}

runSimulation();
