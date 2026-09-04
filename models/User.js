const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: null,
    },
    userState: {
      type: String,
      enum: [
        "new_user",
        "onboarding_name",
        "onboarding_budget",
        "onboarding_reminders",
        "awaiting_payment",
        "trigger_day_3_profiling",
        "active_tracking",
        "editing_name",
        "editing_budget",
        "editing_reminders",
      ],
      default: "new_user",
    },
    preferences: {
      monthlyBudget: { type: Number, default: null },
      recurringBills: { type: [String], default: [] },
      nudgeFrequency: { type: String, default: null },
      lastMonthlyResetPrompt: { type: String, default: null }, // e.g. "2026-09"
      lastNudgeDateSlot: { type: String, default: null }, // e.g. "2026-09-04_9PM"
    },
    subscription: {
      status: {
        type: String,
        enum: ["unpaid", "active", "expired"],
        default: "unpaid",
      },
      validUntil: {
        type: Date,
        default: null,
      },
      lastPaymentId: {
        type: String,
        default: null,
      },
    },
    conversationHistory: [
      {
        role: { type: String, enum: ["user", "model"], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
