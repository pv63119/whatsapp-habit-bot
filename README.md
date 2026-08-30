# WhatsApp Personal Finance AI Bot

An empathetic, secure, and user-centric personal finance companion on WhatsApp powered by OpenAI (`gpt-4o-mini`), Node.js/Express, and MongoDB.

---

## 🌟 Key Features

1. **Empathetic & Privacy-First AI**:
   - Zero sensitive bank/password queries.
   - 100% private database tracking.
2. **Interactive WhatsApp Onboarding**:
   - Step 1: Greeting + `[Let's go 🚀]` Interactive Reply Button.
   - Step 2: Goal selection buttons (`[1️⃣ Daily Spends]`, `[2️⃣ Cut Impulses]`, `[3️⃣ Savings Fund]`).
   - Step 3: Fast budget buttons (`[₹15,000]`, `[₹25,000]`, `[₹40,000]` or custom typed).
   - Step 4: Playful reminder frequencies (`[⏰ Every 3 hrs]`, `[🌅 3x Daily]`, `[🌙 Night Only]`).
   - Step 5: Setup summary + AI natural language examples (English / Hinglish) + category list.
3. **Clarification Protocol**:
   - Ambiguous spends trigger gentle clarification without guessing.
4. **Traffic-Light Budget Status Indicators**:
   - 🟢 Green (> 70% remaining)
   - 🟡 Yellow (30% - 70% remaining)
   - 🔴 Red (< 30% remaining)
5. **Fixed Categories & Emojis**:
   - 🍔 Food & Dining | 🛒 Groceries | 🚗 Travel & Commute | 🛍️ Shopping & Lifestyle | 💡 Bills & Utilities | 🍿 Entertainment | 🏥 Health & Medical | 📦 General
6. **Hot Keywords**:
   - `stats` / `summary` ➔ Monthly spending breakdown & budget health
   - `history` ➔ Last 5 transactions
   - `help` ➔ Shortcuts list
   - `edit` ➔ Modify budget or reminder schedule

---

## 🛠️ Environment Configuration (`.env`)

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
WHATSAPP_TOKEN=your_meta_whatsapp_cloud_api_token
PHONE_NUMBER_ID=your_meta_phone_number_id
VERIFY_TOKEN=your_custom_webhook_verify_token
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

---

## 🚀 Running the Server

```bash
# Start the bot
npm start

# Run the simulation suite
node test_bot.js
```
