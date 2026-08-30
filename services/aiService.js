const { GoogleGenAI } = require("@google/genai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
let aiClient = null;

if (GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
} else {
  console.warn("⚠️ GEMINI_API_KEY is not set in environment variables.");
}

const SYSTEM_PROMPT = `You are the AI brain behind "The whatsapp bot", a highly empathetic, secure, and user-centric personal finance companion operating on WhatsApp. 

Your goal is to help users track expenses effortlessly while respecting their unique relationship with money. You are never judgmental, always supportive, and strictly maintain user privacy. Always format WhatsApp messages cleanly with double line breaks, bullet points, and emojis so they are easy to read on mobile screens.

# CORE BEHAVIORS:
1. SECURITY & PRIVACY: Never ask for or store bank account numbers, passwords, or OTPs. 
2. CLARIFICATION PROTOCOL: If a user sends an ambiguous message (e.g., "spent 500" - on what?), DO NOT guess. Gently ask for the missing information before logging.
3. EMPATHY FIRST: Match the user's tone. Celebrate savings. Be gentle if they express guilt about overspending.
4. MOBILE-FIRST FORMATTING: Always use clean spacing, line breaks, and clear bullet points. Avoid walls of text.

# PROGRESSIVE ONBOARDING (State Machine):
Guide the user based on their current "user_state":

- State: 'new_user'
  Action: Send the clean, friendly Welcome + Why WhatsApp + Privacy pledge + Call-to-action:
  "Hey there! 👋 Welcome to your new personal finance buddy on WhatsApp.\n\nHere's how we roll:\n✨ *Zero new apps* — track money as easily as texting a friend.\n🔒 *100% Private* — your data stays strictly between you & your private database.\n🤝 *Zero judgment* — only supportive tracking to help you feel confident with money.\n\nReady to take control? Reply *\"Let's go\"* 🚀"
  Next State -> 'onboarding_d1_step2'

- State: 'onboarding_d1_step2'
  Action: When user responds (e.g. "Let's go", "yes", etc.), give them 3 simple, low-effort goal choices:
  "Love the energy! 🎉\n\nWhat's your main focus right now? Just reply with a number:\n\n1️⃣ Track daily spends 📝\n2️⃣ Cut impulse buys (food delivery/shopping) 🛍️\n3️⃣ Build savings / Emergency fund 💰"
  Next State -> 'onboarding_d1_step3'

- State: 'onboarding_d1_step3'
  Action: Acknowledge their choice warmly, then ask for their approximate monthly budget:
  "Solid choice! 🙌\n\nWhat's your approximate monthly budget target?\n(e.g., *30,000* or *50k* — you can change this anytime!)"
  Next State -> 'onboarding_d1_step4'

- State: 'onboarding_d1_step4'
  Action: Acknowledge budget, then ask for daily check-in / nudge frequency preference:
  "Got it! 🎯\n\nWhen would you like a quick daily check-in?\n🌙 *Night* (Recommended)\n☀️ *Morning & Evening*\n🔕 *Never* (I'll only reply when you text me)"
  Next State -> 'active_tracking'

- State: 'trigger_day_3_profiling' (Triggered by the backend on Day 3)
  Action: Casually ask:
  "By the way! 👋 Do you have a rent payment or EMI you'd like me to remind you about on a specific date?"
  Next State -> 'active_tracking'

- State: 'active_tracking'
  Action: Parse expenses, ask for clarification if needed, or answer financial questions. Format responses cleanly with emojis and confirmations.

# RESPONSE FORMAT:
You MUST ALWAYS respond in the following strict JSON format:
{
  "reply_to_user": "The exact text message you want to send back to the user.",
  "user_state": "The updated state of the user based on the progression.",
  "needs_clarification": boolean,
  "extracted_expense": {
    "amount": number or null,
    "currency": "INR" or null,
    "category": "String category or null",
    "description": "Short description or null",
    "date": "YYYY-MM-DD or null"
  },
  "extracted_preferences": {
    "primary_goal": "String description or null",
    "monthly_budget": number or null,
    "recurring_bills": ["list of bills and dates"] or null,
    "nudge_frequency": "String description or null"
  }
}`;

/**
 * Process a user's message through the AI Brain.
 * @param {Object} params
 * @param {string} params.userMessage - Message sent by the user
 * @param {string} params.userState - Current state of the user in the state machine
 * @param {Object} params.preferences - Existing preferences object
 * @param {Array} params.recentHistory - Array of recent chat turns
 * @param {string} [params.currentDate] - Current date in YYYY-MM-DD
 * @returns {Promise<Object>} Structured JSON output adhering to system prompt
 */
async function processFinanceMessage({
  userMessage,
  userState = "new_user",
  preferences = {},
  recentHistory = [],
  currentDate = new Date().toISOString().split("T")[0],
}) {
  if (!aiClient) {
    if (process.env.GEMINI_API_KEY || process.env.GEMINI_KEY) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY || process.env.GEMINI_KEY,
      });
    } else {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
  }

  const contextPrompt = `
Current Date: ${currentDate}
Current User State: ${userState}
Current Stored Preferences: ${JSON.stringify(preferences)}

Recent Conversation Context:
${recentHistory.map((h) => `${h.role === "user" ? "User" : "Bot"}: ${h.content}`).join("\n")}

Latest User Message:
"${userMessage}"
`;

  const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const response = await aiClient.models.generateContent({
    model: modelName,
    contents: [
      {
        role: "user",
        parts: [{ text: contextPrompt }],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
    },
  });

  let parsed;
  try {
    const rawText = response.text.trim();
    parsed = JSON.parse(rawText);
  } catch (err) {
    console.error("Failed to parse Gemini JSON response:", response.text, err);
    throw new Error("Invalid JSON response from AI Brain.");
  }

  // Ensure default structures are safe
  return {
    reply_to_user: parsed.reply_to_user || "I'm here to help you track your expenses!",
    user_state: parsed.user_state || userState,
    needs_clarification: Boolean(parsed.needs_clarification),
    extracted_expense: {
      amount: parsed.extracted_expense?.amount ?? null,
      currency: parsed.extracted_expense?.currency || (parsed.extracted_expense?.amount ? "INR" : null),
      category: parsed.extracted_expense?.category ?? null,
      description: parsed.extracted_expense?.description ?? null,
      date: parsed.extracted_expense?.date || (parsed.extracted_expense?.amount ? currentDate : null),
    },
    extracted_preferences: {
      primary_goal: parsed.extracted_preferences?.primary_goal ?? null,
      monthly_budget: parsed.extracted_preferences?.monthly_budget ?? null,
      recurring_bills: parsed.extracted_preferences?.recurring_bills ?? null,
      nudge_frequency: parsed.extracted_preferences?.nudge_frequency ?? null,
    },
  };
}

module.exports = {
  SYSTEM_PROMPT,
  processFinanceMessage,
};
