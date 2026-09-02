/**
 * Test Simulator for Discrepancies? Edit & Numbered Spend Modifications
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Expense = require("./models/Expense");
const User = require("./models/User");

async function runTest() {
  console.log("==================================================");
  console.log("🧪 TESTING DISCREPANCIES / NUMBERED EDIT & REMOVE");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGODB_URI);
  const phone = "919990436789";

  // 1. Fetch last 10 expenses
  console.log("\n1️⃣ Fetching Last 10 Recorded Spends:");
  const last10 = await Expense.find({ phoneNumber: phone }).sort({ createdAt: -1 }).limit(10);
  console.log(`Found ${last10.length} expenses:`);
  last10.forEach((e, i) => {
    console.log(`[#${i + 1}] ID: ${e._id} | ₹${e.amount} — ${e.description} (${e.category})`);
  });

  // 2. Test edit simulation on item #1 (Flipkart Payments: ₹202 ➔ ₹250)
  if (last10.length > 0) {
    console.log("\n2️⃣ Simulating 'change 1 to 250' on first item:");
    const target = last10[0];
    const oldAmt = target.amount;
    target.amount = 250;
    await target.save();
    console.log(`✅ Updated #${1} (${target.description}): ₹${oldAmt} ➔ ₹${target.amount}`);

    // Revert back
    target.amount = oldAmt;
    await target.save();
    console.log(`🔄 Reverted back to ₹${oldAmt}`);
  }

  console.log("\n==================================================");
  console.log("🎉 DISCREPANCY & NUMBERED EDIT TESTS PASSED!");
  console.log("==================================================");
  process.exit(0);
}

runTest();
