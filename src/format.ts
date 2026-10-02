import { parseDate, toDateInput } from "./dates";

const money = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "$1,234.50"; negative values get a leading minus. */
export function formatMoney(value: number): string {
  return `${value < 0 ? "-" : ""}$${money.format(Math.abs(value))}`;
}

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

/** "$1.2K", for chart axes. */
export function formatMoneyShort(value: number): string {
  return `${value < 0 ? "-" : ""}$${compact.format(Math.abs(value))}`;
}

/** "Today", "Yesterday", or e.g. "Mon, 3 Mar" (with the year if not this year). */
export function formatDay(date: string | Date): string {
  const d = typeof date === "string" ? parseDate(date) : date;
  const today = new Date();
  const key = toDateInput(d);
  if (key === toDateInput(today)) return "Today";
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (key === toDateInput(yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== today.getFullYear() && { year: "numeric" }),
  });
}

/** Parses a user-typed amount; NaN if empty or invalid. */
export function parseAmount(s: string): number {
  return s.trim() === "" ? NaN : Number(s.replace(",", "."));
}
