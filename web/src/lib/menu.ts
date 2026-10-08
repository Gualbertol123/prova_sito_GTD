import type { Period } from "./reportData";
import { mondayOf } from "./reportData";
import { toISODate } from "./dates";

// -----------------------------------------------------------------------------
// The canteen menu, for the report's MENU section.
//
// The menu comes as a monthly PDF; scripts/menu_from_pdf.py turns it into SQL
// that is run in Supabase, into public.canteen_menu (migration 015). Only the
// logged-in team can read that table (fetchMenu in db.ts), nobody can write
// it from the website, and its rule only lets today and later through: a past
// day never comes back.
// -----------------------------------------------------------------------------

export type CourseKey =
  | "daily"
  | "first"
  | "second"
  | "sideHot"
  | "sideRaw"
  | "cold"
  | "salad"
  | "fruit"
  | "dessert";

export interface MenuDish {
  name: string;
  /** Allergen numbers as printed on the menu (EU list, 1–14). */
  allergens: number[];
}

export interface MenuDay {
  date: string; // ISO yyyy-mm-dd
  courses: { course: CourseKey; items: MenuDish[] }[];
}

export interface Menu {
  venue: string;
  days: MenuDay[];
}

/** The two columns of a day's card, in the order of the printed menu. */
export const MENU_COLUMNS: CourseKey[][] = [
  ["daily", "first", "second"],
  ["sideHot", "sideRaw", "cold", "salad", "fruit", "dessert"],
];

/**
 * The days the report shows: the working week after the report's period
 * (the week ahead), leaving out any day before today.
 */
export function menuWeek(menu: Menu | null, period: Period, today: string = toISODate(new Date())): MenuDay[] {
  if (!menu) return [];
  const [y, m, d] = period.to.split("-").map(Number);
  const mon = mondayOf(new Date(y, m - 1, d));
  mon.setDate(mon.getDate() + 7);
  const fri = new Date(mon);
  fri.setDate(fri.getDate() + 4);
  const from = toISODate(mon);
  const to = toISODate(fri);
  return menu.days
    .filter((day) => day.date >= from && day.date <= to && day.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}
