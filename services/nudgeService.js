/**
 * Dynamic Day-Wise & Time-Aware Nudge Message Matrix
 * Contextual, engaging nudges in Indian Standard Time (Asia/Kolkata).
 * ~30% of messages mention the day name for a natural, personal touch.
 */

const NUDGE_MATRIX = {
  Monday: {
    "12PM": "Happy Monday! ☀️ Surviving the start of the week? If you grabbed a morning coffee or cab, drop it here! ☕",
    "3PM": "3 PM slump! 🥱 Powering through with a post-lunch chai or dessert? Log the damage here so we keep your budget safe! 🥪",
    "6PM": "Workday officially wrapped! 🌆 Grabbed evening snacks or booked a cab home? Send it over before the evening starts! 🚗",
    "7PM": "Surviving day 1 of the week? 🌆 Grabbed chai, snacks, or cab? Log it in 5 seconds! 🫖",
    "9PM": "Dinner sorted or ordered in on Zomato? 🍽️ Drop the spend here while it's fresh in mind! 🍕",
    "10:30PM": "Before winding down for the night, any spends or bills from today to log? Drop them here & rest easy! 💰",
    "11PM": "Monday done and dusted! 🌟 Any final dinner or travel spends to record before bed? ✨",
    "12AM": "Midnight wrap! 🛌 About to call it a night? Any late-night munchies to log? Sleep tight! 💤 (I'll let you sleep until 12 PM!)",
  },
  Tuesday: {
    "12PM": "12 PM lunch cravings kicking in? 🥪 Any morning travel or tea spends before you head for food? Drop them here! ☕",
    "3PM": "3 PM post-lunch food coma! 🍱 Ordered lunch on Swiggy or grabbed a quick espresso? Log it now so you don't wonder where that ₹300 went! 😴",
    "6PM": "6 PM! 🫖 Chai, samosa, or office snacks calling? Send over any evening spends before heading out! 🥟",
    "7PM": "Evening commute rush! 🚗 Paid for metro, fuel, or evening tea? Take 5 seconds to log it and keep your budget shining! 🫖",
    "9PM": "9 PM dinner time! 🍝 Ordered in, grocery run on Blinkit, or restaurant bill? Text me what you spent while it's fresh! 🛒",
    "10:30PM": "Nightly wrap-up! 🌙 Hope you had a solid day. Any last-minute spends to log before bed? Drop them here! 💰",
    "11PM": "11 PM check-in! 🍽️ Hope dinner was great! Any final spends to record before you sleep? Rest easy! ✨",
    "12AM": "Midnight check-in! 🛌 Off to sleep? Any late spends from today? Log it now and sleep like a baby! 💤 (Paused till 12 PM tomorrow)",
  },
  Wednesday: {
    "12PM": "Happy Wednesday! 🐫 Halfway through the week! Any morning coffee or cab spends before lunch? Let's log it! 🚀",
    "3PM": "Wednesday 3 PM! 😴 Mid-week food coma hitting hard? If you just treated yourself to post-lunch dessert or chai, drop the spend here! ☕",
    "6PM": "6 PM! 🌆 Mid-week hump conquered! Grabbing evening snacks or heading home? Drop any spends real quick! 🚗",
    "7PM": "Evening chai & puff break? 🫖 Log any travel or snacks and keep your budget on point! ✨",
    "9PM": "9 PM dinner time! 🍕 Quick Blinkit run or dinner with friends? Send it over before you unwind! 🛒",
    "10:30PM": "Wednesday night wrap! 🌙 2 more days to the weekend! Any final spends to record before you sleep? 💤",
    "11PM": "11 PM wrap! 🌟 Another day closer to the weekend. Drop any final dinner or transit spends! 💰",
    "12AM": "Midnight wrap! 🛌 About to call it a day? Drop any late spends and get that beauty sleep! 🌟 (Quiet till 12 PM)",
  },
  Thursday: {
    "12PM": "12 PM already! ☀️ Almost at the weekend! Any morning transit or snack spends before lunch? Drop them here! 🥪",
    "3PM": "3 PM post-lunch slump check-in! 🍱 Did you order lunch or grab an iced latte? Log it before you forget! ☕",
    "6PM": "6 PM! 🌆 Pre-weekend vibes starting! Evening chai, snacks, or cab home? Text it over! 🛵",
    "7PM": "Evening rush! 🚗 Grabbed chai or paid for the ride home? Log it in 5 seconds and stay on track! 🫖",
    "9PM": "9 PM! 🍽️ Dinner sorted or quick grocery run? Drop the spend here while it's fresh in mind! 🍝",
    "10:30PM": "Thursday night wrap! 🌟 Friday is almost here! Any spends from today to note down before bed? 💰",
    "11PM": "11 PM check-in! 🌙 Pre-Friday wrap-up. Any last spends to log before hitting the hay? ✨",
    "12AM": "Midnight check-in! 🛌 Off to bed before Friday arrives? Drop any late spends & sleep peacefully! 💤",
  },
  Friday: {
    "12PM": "TGIF! 🎉 Friday lunch is here! Any morning travel or coffee spends before lunch plans? Drop them here! ☕",
    "3PM": "Friday 3 PM! 🕺 Weekend is within reach! If you just ordered a Friday feast or coffee, log it now so we protect your savings! 🍔",
    "6PM": "Friday 6 PM! 🥳 Work is officially done! Heading out for drinks, dinner, or shopping? Drop your commute/snack spends here! 🚗",
    "7PM": "Weekend plans kicking off early? 🌆 Log any quick cab or chai spends so your weekend budget stays clean! 🫖",
    "9PM": "Friday night! 🍕 Party, movie, or chill dinner? Whatever you're treating yourself to, just drop the bill here! 🍿",
    "10:30PM": "Hope you're enjoying the start of the weekend! 🌙 Any party or dinner spends to log before bed? 💤",
    "11PM": "11 PM Friday! 🥳 Weekend mode on! Any party, dinner, or travel bills to note down before you crash? ✨",
    "12AM": "Late night out or Netflix binge? 🕺 If you had any midnight orders or late spends, drop them here! 🍕",
  },
  Saturday: {
    "12PM": "Happy Saturday! ☀️ Late brunch, shopping, or lazy morning spends? Send them over before the afternoon fun begins! ☕",
    "3PM": "3 PM check-in! 🛍️ Out shopping, catching a movie, or cafe hopping? Log any weekend treats so you stay on track! 🍿",
    "6PM": "6 PM! 🌆 Evening plans kicking off? Auto/cab, snacks, or drinks? Drop the spends in 5 seconds! 🚗",
    "7PM": "Saturday evening! 🍹 Weekend in full swing! Grabbing dinner or shopping? Text your spends while having fun! 🛍️",
    "9PM": "9 PM! 🍽️ Dinner out or cozy night in with Swiggy? Drop your dinner or grocery bill here! 🍕",
    "10:30PM": "Having a great weekend? 🌟 Drop any spends from today before you hit the bed! 💤",
    "11PM": "11 PM Saturday! 🌙 Late weekend dinner or movie? Drop any spends to keep your stats 100% accurate! ✨",
    "12AM": "Late-night weekend adventures or chill vibes? 🌙 Any midnight munchies to log? Sleep easy! 😴",
  },
  Sunday: {
    "12PM": "Sunday 12 PM! ☀️ Lazy brunch or grocery stock-up for the week? Drop your morning spends here! 🛒",
    "3PM": "3 PM relaxing afternoon or outing? ☕ If you ordered dessert or coffee, log it real quick! 🍰",
    "6PM": "6 PM! 🌅 Evening stroll, chai, or weekly grocery run? Drop any spends before the evening unwind! 🫖",
    "7PM": "Getting ready for the week ahead? 🌆 Log any weekend bills or shopping in 5 seconds! 🛍️",
    "9PM": "Sunday 9 PM! 🍝 Last meal of the weekend! Did you order in or cook? Drop the spend here before you kick back! 📺",
    "10:30PM": "Sunday night reset! 🌙 Tomorrow is a fresh week! Any final weekend spends to log so we start Monday clean? 💰",
    "11PM": "All set for a brand new week tomorrow! 🌟 Drop any final weekend spends and sleep well! ✨",
    "12AM": "Midnight check-in! 🛌 Time for a good night's rest before the week starts. Any late spends? Log them now & recharge! 💤",
  },
};

/**
 * Get contextual nudge message for current IST day and time slot.
 * @param {string} timeSlot - "12PM" | "3PM" | "6PM" | "7PM" | "9PM" | "10:30PM" | "11PM" | "12AM"
 * @param {Date} [now] - Current date object (defaults to current IST time)
 * @returns {string} Nudge message text
 */
function getNudgeMessage(timeSlot, now = new Date()) {
  const istString = now.toLocaleDateString("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
  });

  const dayOfWeek = istString.split(",")[0].trim();
  const daySchedule = NUDGE_MATRIX[dayOfWeek] || NUDGE_MATRIX["Monday"];
  return (
    daySchedule[timeSlot] ||
    "⏰ Quick check-in! Did you make any spends recently? Just drop a message to log it! ✨"
  );
}

module.exports = {
  NUDGE_MATRIX,
  getNudgeMessage,
};
