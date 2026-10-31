import { z } from "zod";
import { startOfMonth, startOfToday } from "./dates";

function localDate(date: Date) {
  return new Date(date.getTime() + 5 * 3600000).toISOString().slice(0, 10);
}
export function reportRange(from?: string, to?: string, now = new Date()) {
  const first = from || localDate(startOfMonth(now));
  const last = to || localDate(startOfToday(now));
  if (!z.iso.date().safeParse(first).success || !z.iso.date().safeParse(last).success)
    throw new Error("Enter valid start and end dates.");
  const gte = new Date(`${first}T00:00:00+05:00`);
  const lt = new Date(new Date(`${last}T00:00:00+05:00`).getTime() + 86400000);
  if (gte >= lt) throw new Error("The end date must be on or after the start date.");
  if ((lt.getTime() - gte.getTime()) / 86400000 > 366)
    throw new Error("Choose a range of at most 366 days.");
  return { from: first, to: last, gte, lt };
}

export function csvCell(value: string | number) {
  let text = String(value);
  if (typeof value === "string" && /^[\s]*[=+@\-]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
