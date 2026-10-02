const pad = (n: number) => String(n).padStart(2, "0");

/** Formats as local "YYYY-MM-DDTHH:MM:SS", the storage format for all dates. */
export function toLocalIso(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Local "YYYY-MM-DD", the format <input type="date"> uses; "" if d isn't a valid date. */
export function toDateInput(d: Date | string): string {
  try {
    return toLocalIso(typeof d === "string" ? parseDate(d) : d).slice(0, 10);
  } catch {
    return "";
  }
}

/**
 * Parses the date formats the app and the legacy Go backend produced, e.g. "YYYY-MM-DD",
 * "YYYY-MM-DDTHH:MM:SS", RFC 3339, or Go's "2006-01-02 15:04:05.999999999-07:00".
 * Any timezone suffix is ignored and the wall-clock date/time is kept: legacy rows were
 * mostly date-only inputs saved as UTC midnight, and converting them would shift the day.
 */
export function parseDate(s: string): Date {
  const m = s
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) throw new Error(`Invalid date: ${s}`);
  const [y, mo, d, h = "0", mi = "0", sec = "0"] = m.slice(1);
  const date = new Date(+y, +mo - 1, +d, +h, +mi, +sec);
  if (date.getMonth() !== +mo - 1) throw new Error(`Invalid date: ${s}`);
  return date;
}

/** Normalizes user or imported input to the storage format; empty means now. */
export function normalizeDate(input?: string | Date | null): string {
  if (input instanceof Date) return toLocalIso(input);
  if (!input) return toLocalIso(new Date());
  return toLocalIso(parseDate(input));
}
