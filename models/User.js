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
        "onboarding_d1_step2",
        "onboarding_d1_step3",
        "onboarding_d1_step4",
        "trigger_day_3_profiling",
        "active_tracking",
      ],
      default: "new_user",
    },
    preferences: {
      primaryGoal: { type: String, default: null },
      monthlyBudget: { type: Number, default: null },
      recurringBills: { type: [String], default: [] },
      nudgeFrequency: { type: String, default: null },
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
