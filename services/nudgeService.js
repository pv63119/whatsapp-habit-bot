/**
 * Dynamic Randomized Day-Wise & Time-Aware Nudge Matrix
 * 
 * Rules:
 * 1. Every 3 hours users (12PM, 3PM, 6PM, 9PM, 12AM):
 *    - Randomly mention the day 1 (or max 2) times per day across any of the 5 slots.
 * 2. 3x Daily users (3PM, 7PM, 11PM):
 *    - Randomly mention the day exactly ONCE per day across the 3 slots.
 * 3. Once a day / Night only users (10:30PM):
 *    - Alternates by week:
 *      - Week A (odd week): Mon, Wed, Fri, Sun mention day.
 *      - Week B (even week): Tue, Thu, Sat, Sun mention day.
 */

// Nudge dictionary with both "day" (with day reference) and "neutral" (contextual, no day reference) variants
const NUDGE_VARIANTS = {
  Monday: {
    "12PM": {
      day: "Happy Monday! ☀️ Surviving the start of the week? If you grabbed a morning coffee or cab to kick off the week, drop it here! ☕",
      neutral: "12 PM already! 🥪 Lunch cravings kicking in? Any morning coffee, chai, or travel spends to log before lunch? Drop them here! ☕",
    },
    "3PM": {
      day: "Monday 3 PM slump! 🥱 Powering through with a post-lunch chai or dessert? Log the damage here so we keep your week on track! 🥪",
      neutral: "3 PM post-lunch food coma! 🍱 Ordered lunch on Swiggy or grabbed a quick espresso? Log it now so you don't wonder where that ₹300 went! 😴",
    },
    "6PM": {
      day: "Monday workday officially wrapped! 🌆 Grabbed evening snacks or booked a cab home? Send it over before the evening starts! 🚗",
      neutral: "6 PM! 🫖 Chai, samosa, or office snacks calling? Send over any evening spends before heading out! 🥟",
    },
    "7PM": {
      day: "Monday evening check-in! 🌆 Surviving day 1 of the week? Grabbed chai, snacks, or cab? Log it in 5 seconds! 🫖",
      neutral: "Evening commute rush! 🚗 Paid for metro, fuel, or evening tea? Take 5 seconds to log it and keep your budget shining! 🫖",
    },
    "9PM": {
      day: "Monday night! 🍽️ Did you cook or treat yourself to a Zomato order after a long Monday? Drop the spend here while it's fresh! 🍕",
      neutral: "9 PM dinner time! 🍝 Ordered in, grocery run on Blinkit, or restaurant bill? Text me what you spent while it's fresh! 🛒",
    },
    "10:30PM": {
      day: "Monday done and dusted! 🌟 Before winding down for the night, any spends or bills from today to log? Drop them here & rest easy! 💰",
      neutral: "10:30 PM nightly wrap-up! 🌟 Before you wind down, did you have any spends or earnings today? Send them in one quick message! 💰",
    },
    "11PM": {
      day: "Monday night wrap! 🌙 Great job getting through day 1! Any final dinner or travel spends to record before bed? ✨",
      neutral: "11 PM check-in! 🍽️ Hope dinner was great! Any final spends to record before you sleep? Rest easy! ✨",
    },
    "12AM": {
      day: "Midnight on a Monday! 🛌 Time to sleep and conquer tomorrow. Any late-night munchies to log? Sleep tight! 💤 (I'll let you sleep until 12 PM!)",
      neutral: "Midnight wrap! 🛌 About to call it a night? Any late-night munchies to log? Sleep tight! 💤 (I'll let you sleep until 12 PM!)",
    },
  },
  Tuesday: {
    "12PM": {
      day: "Tuesday 12 PM! 🥪 Lunch cravings kicking in? Any morning travel or tea spends before you head for food? Drop them here! ☕",
      neutral: "12 PM already! 🥪 Lunch cravings kicking in? Any morning coffee, chai, or travel spends to log before lunch? Drop them here! ☕",
    },
    "3PM": {
      day: "Tuesday 3 PM slump! 🥱 Fighting off the food coma? If you just treated yourself to dessert or chai, drop the spend here! ☕",
      neutral: "3 PM post-lunch food coma! 🍱 Ordered lunch on Swiggy or grabbed a quick espresso? Log it now so you don't wonder where that ₹300 went! 😴",
    },
    "6PM": {
      day: "Tuesday 6 PM! 🫖 Chai, samosa, or office snacks calling? Send over any evening spends before heading out! 🥟",
      neutral: "6 PM! 🫖 Chai, samosa, or office snacks calling? Send over any evening spends before heading out! 🥟",
    },
    "7PM": {
      day: "Tuesday evening rush! 🚗 Paid for metro, fuel, or evening tea? Take 5 seconds to log it and keep your budget shining! 🫖",
      neutral: "Evening commute rush! 🚗 Paid for metro, fuel, or evening tea? Take 5 seconds to log it and keep your budget shining! 🫖",
    },
    "9PM": {
      day: "Tuesday dinner time! 🍝 Ordered in, grocery run on Blinkit, or restaurant bill? Text me what you spent while it's fresh! 🛒",
      neutral: "9 PM dinner time! 🍝 Ordered in, grocery run on Blinkit, or restaurant bill? Text me what you spent while it's fresh! 🛒",
    },
    "10:30PM": {
      day: "Tuesday night wrap! 🌙 Hope you had a solid day. Any last-minute spends to log before bed? Drop them here! 💰",
      neutral: "10:30 PM nightly wrap-up! 🌟 Before you wind down, did you have any spends or earnings today? Send them in one quick message! 💰",
    },
    "11PM": {
      day: "Tuesday 11 PM wrap! 🍽️ Hope dinner was great! Any final spends to record before you sleep? Rest easy! ✨",
      neutral: "11 PM check-in! 🍽️ Hope dinner was great! Any final spends to record before you sleep? Rest easy! ✨",
    },
    "12AM": {
      day: "Midnight on a Tuesday! 🛌 Off to sleep? Any late spends from today? Log it now and sleep like a baby! 💤 (Paused till 12 PM)",
      neutral: "Midnight check-in! 🛌 Off to sleep? Any late spends from today? Log it now and sleep like a baby! 💤 (Paused till 12 PM tomorrow)",
    },
  },
  Wednesday: {
    "12PM": {
      day: "Happy Wednesday! 🐫 Halfway through the week! Any morning coffee or cab spends before lunch? Let's log it! 🚀",
      neutral: "12 PM lunch cravings kicking in? 🥪 Any morning travel or tea spends before you head for food? Drop them here! ☕",
    },
    "3PM": {
      day: "Wednesday 3 PM! 😴 Mid-week food coma hitting hard? If you just treated yourself to post-lunch dessert or chai, drop the spend here! ☕",
      neutral: "3 PM post-lunch food coma! 🍱 Ordered lunch on Swiggy or grabbed a quick espresso? Log it now so you don't wonder where that ₹300 went! 😴",
    },
    "6PM": {
      day: "Wednesday 6 PM! 🌆 Mid-week hump conquered! Grabbing evening snacks or heading home? Drop any spends real quick! 🚗",
      neutral: "6 PM! 🫖 Chai, samosa, or office snacks calling? Send over any evening spends before heading out! 🥟",
    },
    "7PM": {
      day: "Wednesday evening! 🫖 Chai & puff break? Log any travel or snacks and keep that mid-week budget on point! ✨",
      neutral: "Evening commute rush! 🚗 Paid for metro, fuel, or evening tea? Take 5 seconds to log it and keep your budget shining! 🫖",
    },
    "9PM": {
      day: "Wednesday dinner time! 🍕 Quick Blinkit run or dinner with friends? Send it over before you unwind! 🛒",
      neutral: "9 PM dinner time! 🍝 Ordered in, grocery run on Blinkit, or restaurant bill? Text me what you spent while it's fresh! 🛒",
    },
    "10:30PM": {
      day: "Wednesday night wrap! 🌙 2 more days to the weekend! Any final spends to record before you sleep? 💤",
      neutral: "10:30 PM nightly wrap-up! 🌟 Before you wind down, did you have any spends or earnings today? Send them in one quick message! 💰",
    },
    "11PM": {
      day: "Wednesday 11 PM wrap! 🌟 Another day closer to the weekend. Drop any final dinner or transit spends! 💰",
      neutral: "11 PM check-in! 🍽️ Hope dinner was great! Any final spends to record before you sleep? Rest easy! ✨",
    },
    "12AM": {
      day: "Midnight Wednesday! 🛌 About to call it a day? Drop any late spends and get that beauty sleep! 🌟 (Quiet till 12 PM)",
      neutral: "Midnight wrap! 🛌 About to call it a night? Any late-night munchies to log? Sleep tight! 💤 (I'll let you sleep until 12 PM!)",
    },
  },
  Thursday: {
    "12PM": {
      day: "Thursday 12 PM! ☀️ Almost at the weekend! Any morning transit or snack spends before lunch? Drop them here! 🥪",
      neutral: "12 PM already! 🥪 Lunch cravings kicking in? Any morning coffee, chai, or travel spends to log before lunch? Drop them here! ☕",
    },
    "3PM": {
      day: "Thursday 3 PM! 🍱 Post-lunch slump check-in! Did you order lunch or grab an iced latte? Log it before you forget! ☕",
      neutral: "3 PM post-lunch food coma! 🍱 Ordered lunch on Swiggy or grabbed a quick espresso? Log it now so you don't wonder where that ₹300 went! 😴",
    },
    "6PM": {
      day: "Thursday 6 PM! 🌆 Pre-weekend vibes starting! Evening chai, snacks, or cab home? Text it over! 🛵",
      neutral: "6 PM! 🫖 Chai, samosa, or office snacks calling? Send over any evening spends before heading out! 🥟",
    },
    "7PM": {
      day: "Thursday evening rush! 🚗 Grabbed chai or paid for the ride home? Log it in 5 seconds and stay on track! 🫖",
      neutral: "Evening commute rush! 🚗 Paid for metro, fuel, or evening tea? Take 5 seconds to log it and keep your budget shining! 🫖",
    },
    "9PM": {
      day: "Thursday 9 PM! 🍽️ Dinner sorted or quick grocery run? Drop the spend here while it's fresh in mind! 🍝",
      neutral: "9 PM dinner time! 🍝 Ordered in, grocery run on Blinkit, or restaurant bill? Text me what you spent while it's fresh! 🛒",
    },
    "10:30PM": {
      day: "Thursday night wrap! 🌟 Friday is almost here! Any spends from today to note down before bed? 💰",
      neutral: "10:30 PM nightly wrap-up! 🌟 Before you wind down, did you have any spends or earnings today? Send them in one quick message! 💰",
    },
    "11PM": {
      day: "Thursday 11 PM check-in! 🌙 Pre-Friday wrap-up. Any last spends to log before hitting the hay? ✨",
      neutral: "11 PM check-in! 🍽️ Hope dinner was great! Any final spends to record before you sleep? Rest easy! ✨",
    },
    "12AM": {
      day: "Midnight Thursday! 🛌 Off to bed before Friday arrives? Drop any late spends & sleep peacefully! 💤",
      neutral: "Midnight check-in! 🛌 Off to sleep? Any late spends from today? Log it now and sleep like a baby! 💤 (Paused till 12 PM tomorrow)",
    },
  },
  Friday: {
    "12PM": {
      day: "TGIF! 🎉 Friday lunch is here! Any morning travel or coffee spends before lunch plans? Drop them here! ☕",
      neutral: "12 PM lunch cravings kicking in? 🥪 Any morning coffee, chai, or travel spends to log before lunch? Drop them here! ☕",
    },
    "3PM": {
      day: "Friday 3 PM! 🕺 Weekend is within reach! If you just ordered a Friday feast or coffee, log it now so we protect your savings! 🍔",
      neutral: "3 PM post-lunch food coma! 🍱 Ordered lunch on Swiggy or grabbed a quick espresso? Log it now so you don't wonder where that ₹300 went! 😴",
    },
    "6PM": {
      day: "Friday 6 PM! 🥳 Work is officially done! Heading out for drinks, dinner, or shopping? Drop your commute/snack spends here! 🚗",
      neutral: "6 PM! 🫖 Chai, samosa, or office snacks calling? Send over any evening spends before heading out! 🥟",
    },
    "7PM": {
      day: "Friday evening! 🌆 Starting weekend plans early? Log any quick cab/chai spends so your weekend budget stays clean! 🫖",
      neutral: "Evening commute rush! 🚗 Paid for metro, fuel, or evening tea? Take 5 seconds to log it and keep your budget shining! 🫖",
    },
    "9PM": {
      day: "Friday night! 🍕 Party, movie, or chill dinner? Whatever you're treating yourself to, just drop the bill here! 🍿",
      neutral: "9 PM dinner time! 🍝 Ordered in, grocery run on Blinkit, or restaurant bill? Text me what you spent while it's fresh! 🛒",
    },
    "10:30PM": {
      day: "Friday night wrap! 🌙 Hope you're enjoying the start of the weekend! Any spends to log before bed? 💤",
      neutral: "10:30 PM nightly wrap-up! 🌟 Before you wind down, did you have any spends or earnings today? Send them in one quick message! 💰",
    },
    "11PM": {
      day: "11 PM Friday! 🥳 Weekend mode on! Any party, dinner, or travel bills to note down before you crash? ✨",
      neutral: "11 PM check-in! 🍽️ Hope dinner was great! Any final spends to record before you sleep? Rest easy! ✨",
    },
    "12AM": {
      day: "Midnight Friday! 🕺 Late night out or Netflix binge? If you had any midnight orders or late spends, drop them here! 🍕",
      neutral: "Midnight wrap! 🛌 About to call it a night? Any late-night munchies to log? Sleep tight! 💤 (I'll let you sleep until 12 PM!)",
    },
  },
  Saturday: {
    "12PM": {
      day: "Happy Saturday! ☀️ Late brunch, shopping, or lazy morning spends? Send them over before the afternoon fun begins! ☕",
      neutral: "12 PM already! 🥪 Late brunch or morning snack spends? Drop them here! ☕",
    },
    "3PM": {
      day: "Saturday 3 PM! 🛍️ Out shopping, catching a movie, or cafe hopping? Log any weekend treats so you stay on track! 🍿",
      neutral: "3 PM check-in! 🛍️ Out shopping, catching a movie, or cafe hopping? Log any treats so you stay on track! 🍿",
    },
    "6PM": {
      day: "Saturday 6 PM! 🌆 Evening plans kicking off? Auto/cab, snacks, or drinks? Drop the spends in 5 seconds! 🚗",
      neutral: "6 PM! 🌆 Evening plans kicking off? Auto/cab, snacks, or drinks? Drop the spends in 5 seconds! 🚗",
    },
    "7PM": {
      day: "Saturday evening! 🍹 Weekend in full swing! Grabbing dinner or shopping? Text your spends while having fun! 🛍️",
      neutral: "Evening rush! 🍹 Grabbing dinner, snacks, or shopping? Text your spends in 5 seconds! 🛍️",
    },
    "9PM": {
      day: "Saturday 9 PM! 🍽️ Dinner out or cozy night in with Swiggy? Drop your dinner or grocery bill here! 🍕",
      neutral: "9 PM dinner time! 🍽️ Dinner out or cozy night in with Swiggy? Drop your dinner or grocery bill here! 🍕",
    },
    "10:30PM": {
      day: "Saturday night wrap! 🌟 Having a great weekend? Drop any spends from today before you hit the bed! 💤",
      neutral: "10:30 PM nightly wrap-up! 🌟 Before you wind down, did you have any spends or earnings today? Send them in one quick message! 💰",
    },
    "11PM": {
      day: "11 PM Saturday! 🌙 Late weekend dinner or movie? Drop any spends to keep your stats 100% accurate! ✨",
      neutral: "11 PM check-in! 🌙 Late dinner or movie? Drop any spends to keep your stats 100% accurate! ✨",
    },
    "12AM": {
      day: "Midnight Saturday! 🌙 Late-night weekend adventures or chill vibes? Any midnight munchies to log? Sleep easy! 😴",
      neutral: "Late-night adventures or chill vibes? 🌙 Any midnight munchies to log? Sleep easy! 😴",
    },
  },
  Sunday: {
    "12PM": {
      day: "Sunday 12 PM! ☀️ Lazy brunch or grocery stock-up for the week? Drop your morning spends here! 🛒",
      neutral: "12 PM lunch cravings kicking in? 🥪 Lazy brunch or grocery run? Drop your morning spends here! 🛒",
    },
    "3PM": {
      day: "Sunday 3 PM! ☕ Relaxing afternoon or weekend outing? If you ordered dessert or coffee, log it real quick! 🍰",
      neutral: "3 PM relaxing afternoon or outing? ☕ If you ordered dessert or coffee, log it real quick! 🍰",
    },
    "6PM": {
      day: "Sunday 6 PM! 🌅 Evening stroll, chai, or weekly grocery run? Drop any spends before the evening unwind! 🫖",
      neutral: "6 PM! 🌅 Evening stroll, chai, or weekly grocery run? Drop any spends before the evening unwind! 🫖",
    },
    "7PM": {
      day: "Sunday evening! 🌆 Getting ready for the week ahead? Log any weekend bills or shopping in 5 seconds! 🛍️",
      neutral: "Evening wrap! 🌆 Getting ready for the week ahead? Log any weekend bills or shopping in 5 seconds! 🛍️",
    },
    "9PM": {
      day: "Sunday 9 PM! 🍝 Last meal of the weekend. Did you order in or cook? Drop the spend here before you kick back! 📺",
      neutral: "9 PM dinner time! 🍝 Ordered in, grocery run on Blinkit, or restaurant bill? Text me what you spent while it's fresh! 🛒",
    },
    "10:30PM": {
      day: "Sunday night reset! 🌙 Tomorrow is a fresh week! Any final weekend spends to log so we start Monday clean? 💰",
      neutral: "10:30 PM nightly wrap-up! 🌟 Before you wind down, did you have any spends or earnings today? Send them in one quick message! 💰",
    },
    "11PM": {
      day: "11 PM Sunday wrap! 🌟 All set for a brand new week tomorrow. Drop any final Sunday spends and sleep well! ✨",
      neutral: "All set for a brand new week tomorrow! 🌟 Drop any final weekend spends and sleep well! ✨",
    },
    "12AM": {
      day: "Midnight Sunday! 🛌 Time for a good night's rest before Monday starts. Any late spends? Log them now & recharge! 💤",
      neutral: "Midnight check-in! 🛌 Time for a good night's rest before the week starts. Any late spends? Log them now & recharge! 💤",
    },
  },
};

/**
 * Get ISO week number for alternate week calculation
 */
function getIsoWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

/**
 * Deterministic pseudo-random seed from date string
 */
function getDailySeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Decide whether this specific timeSlot for this user frequency should mention the day
 * @param {string} frequencyType - "3hr" | "3x" | "night_only"
 * @param {string} timeSlot - e.g. "12PM", "3PM", "6PM", "7PM", "9PM", "10:30PM", "11PM", "12AM"
 * @param {Date} now - Date object in IST
 */
function shouldMentionDay(frequencyType, timeSlot, now = new Date()) {
  const istDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const istDayShort = now.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
  const seed = getDailySeed(istDateStr);

  // Group 1: Every 3 hours (12PM, 3PM, 6PM, 9PM, 12AM) -> exactly 1 or max 2 slots per day
  if (frequencyType === "3hr") {
    const slots3hr = ["12PM", "3PM", "6PM", "9PM", "12AM"];
    // Deterministically pick 1 primary slot based on seed
    const primaryIndex = seed % slots3hr.length;
    // On weekends / Fridays, optionally allow 2 slots
    const allowTwo = (seed % 3 === 0);
    const secondaryIndex = (primaryIndex + 2) % slots3hr.length;

    const chosenSlots = [slots3hr[primaryIndex]];
    if (allowTwo) chosenSlots.push(slots3hr[secondaryIndex]);

    return chosenSlots.includes(timeSlot);
  }

  // Group 2: 3x daily (3PM, 7PM, 11PM) -> exactly 1 slot per day
  if (frequencyType === "3x") {
    const slots3x = ["3PM", "7PM", "11PM"];
    const chosenIndex = seed % slots3x.length;
    return slots3x[chosenIndex] === timeSlot;
  }

  // Group 3: Night only (10:30PM) -> alternate days week by week
  if (frequencyType === "night_only") {
    const weekNum = getIsoWeekNumber(now);
    const isOddWeek = (weekNum % 2 !== 0);

    if (isOddWeek) {
      // Week A: Mon, Wed, Fri, Sun
      return ["Mon", "Wed", "Fri", "Sun"].includes(istDayShort);
    } else {
      // Week B: Tue, Thu, Sat, Sun
      return ["Tue", "Thu", "Sat", "Sun"].includes(istDayShort);
    }
  }

  return false;
}

/**
 * Decide whether this specific nudge should include the user's name (~30% of nudges)
 */
function shouldIncludeUserName(userName, frequencyType, timeSlot, now = new Date()) {
  if (!userName || !userName.trim()) return false;

  const istDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  const seed = getDailySeed(istDateStr + userName.toLowerCase());

  if (frequencyType === "3hr") {
    const slots = ["12PM", "3PM", "6PM", "9PM", "12AM"];
    const chosenIndex = seed % slots.length;
    // Allow a second slot ~20% of the time so average is ~28-30%
    const allowSecond = ((seed >> 2) % 3 === 0);
    const secondIndex = (chosenIndex + 2) % slots.length;
    return slots[chosenIndex] === timeSlot || (allowSecond && slots[secondIndex] === timeSlot);
  }

  if (frequencyType === "3x") {
    const slots = ["3PM", "7PM", "11PM"];
    const chosenIndex = seed % slots.length;
    return slots[chosenIndex] === timeSlot; // 1 in 3 = 33.3%
  }

  if (frequencyType === "night_only") {
    // 1 in 3 days = 33.3%
    return (seed % 3 === 0);
  }

  return false;
}

/**
 * Naturally blends the user's name into the opening phrase of the nudge
 */
function injectNameIntoNudge(text, userName) {
  if (!userName || !userName.trim()) return text;
  const name = userName.trim();

  // If text starts with a greeting or day greeting with an exclamation:
  // "Happy Monday! ☀️" -> "Happy Monday, Priyanshu! ☀️"
  // "3 PM slump! 🥱" -> "3 PM slump, Priyanshu! 🥱"
  // "TGIF! 🎉" -> "TGIF, Priyanshu! 🎉"
  const match = text.match(/^([A-Za-z0-9\s,–—\.\/:&]+)!(\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]?)(.*)$/u);
  if (match) {
    const prefix = match[1].trim();
    const emoji = match[2] ? match[2].trim() + " " : "";
    const rest = match[3] || "";
    return `${prefix}, ${name}! ${emoji}${rest}`.replace(/\s+/g, " ").trim();
  }

  return `Hey ${name}! 👋 ${text}`;
}

/**
 * Get the contextual nudge message
 * @param {string} frequencyType - "3hr" | "3x" | "night_only"
 * @param {string} timeSlot - "12PM" | "3PM" | "6PM" | "7PM" | "9PM" | "10:30PM" | "11PM" | "12AM"
 * @param {Date} [now] - Date object
 * @param {string} [userName] - Optional user name
 * @returns {string} Nudge message
 */
function getNudgeMessage(frequencyType, timeSlot, now = new Date(), userName = null) {
  const istString = now.toLocaleDateString("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
  });

  const dayOfWeek = istString.split(",")[0].trim();
  const dayData = NUDGE_VARIANTS[dayOfWeek] || NUDGE_VARIANTS["Monday"];
  const slotData = dayData[timeSlot] || {
    day: "⏰ Quick check-in! Did you make any spends recently? Just drop a message to log it! ✨",
    neutral: "⏰ Quick check-in! Did you make any spends recently? Just drop a message to log it! ✨",
  };

  const useDayVariant = shouldMentionDay(frequencyType, timeSlot, now);
  let messageText = useDayVariant ? slotData.day : slotData.neutral;

  // Personalize with user name in ~30% of nudges
  if (userName && shouldIncludeUserName(userName, frequencyType, timeSlot, now)) {
    messageText = injectNameIntoNudge(messageText, userName);
  }

  return messageText;
}

module.exports = {
  NUDGE_VARIANTS,
  shouldMentionDay,
  shouldIncludeUserName,
  injectNameIntoNudge,
  getNudgeMessage,
};
