/**
 * Large pool of unique inspirational messages.
 * Uses a hash of the date to pick a different one every day.
 * With 50+ messages per category + hash scrambling, repeats are months apart.
 */

const MORNING_MESSAGES = [
  "Today's the day you become the version of yourself you've been imagining.",
  "The only workout you regret is the one you didn't do.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Winners train. Losers complain.",
  "Every rep gets you closer to 75kg. Every day you show up, you're winning.",
  "Discipline is choosing between what you want now and what you want most.",
  "A year from now, you'll wish you started today. Oh wait — you already started.",
  "Pain is temporary. Quitting lasts forever.",
  "You don't have to be extreme, just consistent.",
  "Small progress is still progress. Get after it today.",
  "The hard part isn't getting your body in shape. The hard part is getting your mind in shape.",
  "Don't count the days. Make the days count.",
  "Success isn't owned, it's leased. And rent is due every day.",
  "The difference between try and triumph is a little umph.",
  "Today you can do what others won't, so tomorrow you can do what others can't.",
  "It's not about having time. It's about making time.",
  "Motivation is what gets you started. Habit is what keeps you going.",
  "Your future self is watching you right now through memories.",
  "Be stronger than your excuses.",
  "No one ever drowned in sweat.",
  "Fall in love with taking care of yourself. Mind. Body. Spirit.",
  "The body achieves what the mind believes.",
  "You're not working out because it's easy. You're working out because you're not easy to beat.",
  "Wake up with determination. Go to bed with satisfaction.",
  "What seems impossible today will one day become your warm-up.",
  "Champions don't show up to get everything they want. They show up to give everything they have.",
  "The best project you'll ever work on is you.",
  "Obsessed is just a word the lazy use to describe the dedicated.",
  "You're one workout away from a good mood.",
  "Action is the foundational key to all success.",
  "Remember why you started. Then remember that 75kg version of you is waiting.",
  "Today is a good day to have a good day. And a great workout.",
  "Your only limit is you.",
  "If it doesn't challenge you, it doesn't change you.",
  "Train insane or remain the same.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Good things come to those who sweat.",
  "You are so much stronger than you think.",
  "Make yourself proud today.",
  "The clock is ticking. Make every second count.",
  "Rise and grind. That belly fat doesn't stand a chance.",
  "Your body is a reflection of your lifestyle. Level up.",
  "Every morning you have two choices: continue to sleep with your dreams, or wake up and chase them.",
  "Sweat is fat crying. Make it weep.",
  "The gym is open. Your excuses are closed.",
  "You've got reasons to train today. And fewer kg to lose every week.",
  "Today's effort is tomorrow's result.",
  "The greatest wealth is health. Invest in it today.",
  "Strong is the new skinny. And you're getting there.",
  "Your muscles are waiting. Don't keep them waiting.",
  "Iron sharpens iron. You sharpen yourself every single session.",
  "You didn't come this far to only come this far.",
  "Every day is a chance to get better. Today is no different.",
  "Results happen over time, not overnight. Keep showing up.",
  "The weight room is your therapy session. Time to check in.",
  "Your comfort zone is a beautiful place but nothing ever grows there.",
  "Sore today, strong tomorrow.",
  "The only way to finish is to start. Let's go.",
  "Think of it this way: you're lapping everyone on the couch.",
  "Nobody said it would be easy. They said it would be worth it.",
];

const PUMP_UP_MESSAGES = [
  "Your workout is about to start. Time to turn beast mode ON.",
  "In 30 minutes, you'll be glad you did this. Let's go!",
  "The iron is calling your name. Don't leave it hanging.",
  "This workout is between you and the weights. Show them who's boss.",
  "Remember: every single rep is a step closer to your goal.",
  "You've done this before. You can do it again. Now GO.",
  "The only bad workout is the one that didn't happen. Make it happen.",
  "Imagine how you'll feel after. That post-workout high is waiting.",
  "You're not here to be average. Get in there and prove it.",
  "5 workouts planned, you need 3. Every single one matters. Crush this.",
  "Think of this workout as a deposit in the bank of your future self.",
  "Comfort zones are where dreams go to die. Step out.",
  "You signed up for this. Your body is ready. Your mind just needs to follow.",
  "Less thinking, more lifting. See you in 30 minutes, champion.",
  "Today's workout type is ready. The weights are waiting. YOU are ready.",
  "Don't wish for a good body. Work for it. Starting now.",
  "This is the hour. This is the moment. Make it count.",
  "Somewhere, someone busier than you is working out right now.",
  "You can't spell legendary without LEG DAY. (OK maybe, but still — go!)",
  "Your muscles are begging for attention. Don't ghost them.",
  "The pump is calling. Answer it.",
  "30 minutes of discomfort for 24 hours of feeling like a champion.",
  "Excuses don't burn calories. Workouts do. Let's burn some.",
  "You're about to do something 95% of people won't do today. Be proud.",
  "Channel that energy. Focus. Lift. Conquer.",
  "The weights won't lift themselves. But you will.",
  "Pre-workout mindset: I am capable. I am strong. I am doing this.",
  "This is your time. Nobody can take this from you.",
  "Every champion was once a beginner who refused to give up.",
  "The workout is 30 minutes. The pride lasts all day.",
  "You've rested enough. Now it's time to work.",
  "Think about how far you've come. Then go further.",
  "Pain is just weakness leaving the body. Embrace it.",
  "Lock in. Focus up. It's go time.",
  "Your Fitbit is watching. Make those heart rate numbers dance.",
  "Push past the comfort. That's where the magic happens.",
  "One more workout logged. One step closer. Let's get it.",
  "Don't think about it. Just start. Momentum will carry you.",
  "You're built for this. Now prove it to yourself.",
  "The workout window is open. Walk through it like you own the place.",
  "Every set, every rep, every bead of sweat — it all adds up.",
  "This is the part where you become the person you want to be.",
  "Your future six-pack is doing sit-ups in your imagination. Make it real.",
  "Get angry at the belly fat. Then channel it into every rep.",
  "In 30 minutes this will be done and you'll feel unstoppable.",
  "Stop scrolling. Start lifting.",
  "The only permission you need is from yourself. Permission granted. GO.",
  "Today's pain is tomorrow's power.",
  "Less talk, more chalk. (Or whatever gym people say. Just go!)",
  "Your workout streak won't build itself. Keep the chain going.",
  "The gym doesn't ask questions. The gym understands.",
  "You don't need motivation. You need discipline. You have both.",
  "30 minutes. That's it. Then you're a legend for the rest of the day.",
  "Strong people aren't born. They're built. One workout at a time.",
  "The version of you that shows up today shapes the version that wakes up tomorrow.",
];

/**
 * Simple hash for a string -> number. Produces a well-distributed integer.
 * This ensures that consecutive days get very different indices.
 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Pick a message from a pool based on the current date.
 * Uses a hash of "YYYY-MM-DD:<category>" so:
 *   - Same message all day (stable per date)
 *   - Different message each day (hash scrambles consecutive dates)
 *   - Morning vs pump-up get different messages on the same day
 */
function pickMessage(pool: string[], category: string): string {
  const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
  const idx = hashStr(`${dateStr}:${category}`) % pool.length;
  return pool[idx];
}

export function getMorningInspiration(): string {
  return pickMessage(MORNING_MESSAGES, "morning");
}

export function getPumpUpMessage(): string {
  return pickMessage(PUMP_UP_MESSAGES, "pumpup");
}
