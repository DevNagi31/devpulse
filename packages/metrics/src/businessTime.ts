import { DEFAULT_OFF_HOURS, type OffHoursConfig } from './types.js';

/**
 * Returns the number of seconds between `from` and `to` that fall within
 * business hours (and weekdays). Used so that "review wait" doesn't penalize
 * reviewers for not working overnight or on weekends.
 *
 * Approach: walk the interval in 5-minute chunks and count chunks whose
 * midpoint is within working hours. Coarse but predictable, easy to test,
 * and accurate enough for review-wait metrics where seconds don't matter.
 */
export function businessSecondsBetween(
  from: Date,
  to: Date,
  cfg: OffHoursConfig = DEFAULT_OFF_HOURS,
): number {
  if (to <= from) return 0;
  const STEP_MS = 5 * 60 * 1000;
  const weekend = new Set(cfg.weekendDays ?? [6, 7]);
  let business = 0;
  for (let t = from.getTime() + STEP_MS / 2; t < to.getTime(); t += STEP_MS) {
    const d = new Date(t);
    const isoDow = ((d.getUTCDay() + 6) % 7) + 1; // 1=Mon..7=Sun
    if (weekend.has(isoDow)) continue;
    const hour = d.getUTCHours();
    const inHours =
      cfg.offHourStart > cfg.offHourEnd
        ? hour >= cfg.offHourEnd && hour < cfg.offHourStart
        : hour >= cfg.offHourStart || hour < cfg.offHourEnd;
    if (inHours) business += STEP_MS / 1000;
  }
  return Math.round(business);
}
