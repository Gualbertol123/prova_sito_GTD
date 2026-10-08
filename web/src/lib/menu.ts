import type { Period } from "./reportData";
import { mondayOf } from "./reportData";
import { toISODate } from "./dates";

// -----------------------------------------------------------------------------
// The canteen menu, for the report's MENU section.
//
// The menu comes as a monthly PDF; menu/menu_from_pdf.py turns it into
// src/data/menu.json (days before the update are dropped; menuWeek also skips
// any day already past).
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

/** The menu file, loaded only when the REPORT tab needs it; null if it cannot be loaded. */
export async function loadMenu(): Promise<Menu | null> {
  try {
    const mod = await import("../data/menu.json");
    const menu = (mod.default ?? mod) as Menu;
    return Array.isArray(menu.days) ? menu : null;
  } catch {
    return null;
  }
}
