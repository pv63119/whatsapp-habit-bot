# WhatsApp Personal Finance AI Bot

An empathetic, secure, and user-centric personal finance companion on WhatsApp powered by Google Gemini and Node.js/Express with MongoDB.

---

## 🌟 Key Features

1. **Empathetic & Privacy-First AI**:
   - Never requests or stores sensitive bank details or passwords.
   - Pledges privacy right at onboarding: chats and data belong solely to the user.
2. **Progressive Onboarding State Machine**:
   - `new_user` ➔ Welcome & Privacy Pledge.
   - `onboarding_d1_step2` ➔ Goal acknowledgment & Monthly budget inquiry.
   - `onboarding_d1_step3` ➔ Budget confirmation & Nudge frequency (Morning/Evening/Night/Never).
   - `trigger_day_3_profiling` ➔ Day 3 casual inquiry for Rent / EMI reminders.
   - `active_tracking` ➔ Natural expense parsing & conversational assistance.
3. **Clarification Protocol**:
   - If an expense is ambiguous (e.g. *"spent 500"* without a category), the bot gently requests the missing details without guessing or prematurely logging.
4. **Structured JSON Engine**:
   - Powered by `@google/genai` with strict JSON schema outputs.
5. **Automated Proactive Schedulers**:
   - Cron jobs for Day 3 EMI profiling and daily check-ins based on user's preferred nudge frequency.

---

## 🛠️ Environment Configuration (`.env`)

Add the following variables to your `.env` file:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
WHATSAPP_TOKEN=your_meta_whatsapp_cloud_api_token
PHONE_NUMBER_ID=your_meta_phone_number_id
VERIFY_TOKEN=your_custom_webhook_verify_token
GEMINI_API_KEY=your_gemini_api_key
```

---

## 🚀 Running the Server

```bash
# Start the bot
npm start

# Run the conversation simulation
node test_bot.js
```

---

## 🧪 Simulation Test

You can test conversational flows and state transitions using:
```bash
node test_bot.js
```
