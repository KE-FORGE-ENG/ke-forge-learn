// SM-2 spaced repetition algorithm
// quality: 0=Again, 3=Hard, 4=Good, 5=Easy
export type Card = { ease: number; interval_days: number; reps: number };

export function sm2(card: Card, quality: 0 | 3 | 4 | 5): Card & { dueInDays: number } {
  let { ease, interval_days, reps } = card;
  if (quality < 3) {
    reps = 0;
    interval_days = 0; // due again soon
  } else {
    if (reps === 0) interval_days = 1;
    else if (reps === 1) interval_days = 3;
    else interval_days = Math.round(interval_days * ease);
    reps += 1;
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  return { ease, interval_days, reps, dueInDays: interval_days };
}

export function nextDueAt(dueInDays: number) {
  const d = new Date();
  if (dueInDays <= 0) {
    d.setMinutes(d.getMinutes() + 10); // 10 min for "Again"
  } else {
    d.setDate(d.getDate() + dueInDays);
  }
  return d.toISOString();
}
