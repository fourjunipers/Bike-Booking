/**
 * Holiday closures (shop_closures). A closure that repeats every year matches
 * the same month and day in later years, including closures that run over New
 * Year. A 29 February start moves to 1 March in other years. Mirrors the SQL
 * function is_shop_closed_on().
 */

export type Closure = {
  start_date: string; // YYYY-MM-DD
  end_date: string;
  repeats_yearly: boolean;
};

const DAY_MS = 86_400_000;

function toDay(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}

/** The day number of month/day of `date` in `year` (Feb 29 → Mar 1). */
function inYear(date: string, year: number): number {
  const [, m, d] = date.split("-").map(Number);
  return Date.UTC(year, m - 1, 1) / DAY_MS + d - 1;
}

export function isClosedOn(closure: Closure, date: string): boolean {
  const day = toDay(date);
  const start = toDay(closure.start_date);
  const length = toDay(closure.end_date) - start;
  if (day < start) return false;
  if (!closure.repeats_yearly) return day <= start + length;
  const year = Number(date.slice(0, 4));
  return [year, year - 1].some((y) => {
    const s = inYear(closure.start_date, y);
    return day >= s && day <= s + length;
  });
}

/** Whether any of the shop's closures covers `date`. */
export function isShopClosedOn(closures: Closure[], date: string): boolean {
  return closures.some((c) => isClosedOn(c, date));
}
