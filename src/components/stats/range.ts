import { addDays, daysBetween, parseDate, toDateInput } from "../../dates";
import { Bucket } from "../../api/stats";

export type Preset = "month" | "3m" | "year" | "all" | "custom";

/**
 * The Stats date range. `anchor` is a day inside the shown period for the month/3m/year presets;
 * `from`/`to` hold the custom range.
 */
export type RangeState = { preset: Preset; anchor: string; from: string; to: string };

/** Inclusive "YYYY-MM-DD" days; missing means open-ended ("All"). */
export type Range = { from?: string; to?: string; label: string };

const monthName = (d: Date, year = true) =>
  d.toLocaleDateString(undefined, { month: "short", ...(year && { year: "numeric" }) });

const dayName = (day: string, year = true) =>
  parseDate(day).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(year && { year: "numeric" }) });

export function initialRange(preset: Preset = "month", today = new Date()): RangeState {
  const t = toDateInput(today);
  return { preset, anchor: t, from: addDays(t, -29), to: t };
}

export function resolveRange(s: RangeState): Range {
  const a = parseDate(s.anchor);
  const y = a.getFullYear();
  const m = a.getMonth();
  switch (s.preset) {
    case "month":
      return {
        from: toDateInput(new Date(y, m, 1)),
        to: toDateInput(new Date(y, m + 1, 0)),
        label: a.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      };
    case "3m": {
      const first = new Date(y, m - 2, 1);
      return {
        from: toDateInput(first),
        to: toDateInput(new Date(y, m + 1, 0)),
        label: `${monthName(first, first.getFullYear() !== y)} – ${monthName(a)}`,
      };
    }
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
    case "all":
      return { label: "All time" };
    case "custom": {
      const sameYear = s.from.slice(0, 4) === s.to.slice(0, 4);
      return { from: s.from, to: s.to, label: `${dayName(s.from, !sameYear)} – ${dayName(s.to)}` };
    }
  }
}

/** Moves to the previous (-1) or next (1) period of the same kind. */
export function stepRange(s: RangeState, dir: -1 | 1): RangeState {
  if (s.preset === "all") return s;
  if (s.preset === "custom") {
    const length = daysBetween(s.from, s.to) + 1;
    return { ...s, from: addDays(s.from, dir * length), to: addDays(s.to, dir * length) };
  }
  const a = parseDate(s.anchor);
  const months = { month: 1, "3m": 3, year: 12 }[s.preset];
  return { ...s, anchor: toDateInput(new Date(a.getFullYear(), a.getMonth() + dir * months, 1)) };
}

/** The range clipped to end today, so averages and comparisons don't count days that haven't happened. */
export function elapsed(range: Range, today: string): Range {
  return range.to && range.to > today ? { ...range, to: today } : range;
}

/**
 * The period before this one, cut to the same number of elapsed days when the current one is still
 * running, so "this month so far" compares with the same days of last month. Null for All.
 */
export function comparisonRange(s: RangeState, today: string): Range | null {
  const range = resolveRange(s);
  if (!range.from || !range.to) return null;
  const prev = resolveRange(stepRange(s, -1));
  if (range.to <= today) return prev;
  if (range.from > today) return null;
  const to = addDays(prev.from!, daysBetween(range.from, today));
  return { from: prev.from, to: to < prev.to! ? to : prev.to, label: `same days of ${prev.label}` };
}

/** A bucket size that gives a readable number of bars for the range. */
export function bucketFor(from: string, to: string): Bucket {
  const days = daysBetween(from, to) + 1;
  if (days <= 31) return "day";
  if (days <= 92) return "week";
  if (days <= 3 * 366) return "month";
  return "year";
}

/** Short axis label and full tooltip label for the bucket starting on `start`. */
export function bucketLabels(start: string, bucket: Bucket, multiYear: boolean): { short: string; full: string } {
  const d = parseDate(start);
  switch (bucket) {
    case "day":
      return { short: String(d.getDate()), full: formatFullDay(d) };
    case "week":
      return { short: dayName(start, false), full: `Week of ${dayName(start)}` };
    case "month":
      return {
        short: multiYear ? d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }) : monthName(d, false),
        full: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      };
    case "year":
      return { short: String(d.getFullYear()), full: String(d.getFullYear()) };
  }
}

const formatFullDay = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** How often each weekday (Monday first) occurs from `from` to `to`, for per-weekday averages. */
export function weekdayCounts(from: string, to: string): number[] {
  const counts = Array(7).fill(0);
  const days = daysBetween(from, to) + 1;
  const first = (parseDate(from).getDay() + 6) % 7;
  for (let i = 0; i < 7; i++) counts[(first + i) % 7] = Math.floor(days / 7) + (i < days % 7 ? 1 : 0);
  return counts;
}
