import { addMonths } from "date-fns";

/** Preserve paid coverage; overdue memberships restart on the payment date. */
export function renewalPeriod(due: Date, now: Date) {
  const start = new Date(Math.max(due.getTime(), now.getTime()));
  return { start, end: addMonths(start, 1), advance: due.getTime() > now.getTime() };
}
