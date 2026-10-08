import { toISODate } from "./dates";

// -----------------------------------------------------------------------------
// The canteen menu, for the BOARD's Menu mensa bar (components/MenuBar.tsx).
//
// The menu comes as a monthly PDF; menu/menu_from_pdf.py turns it into
// src/data/menu.json (days before the update are dropped; upcomingMenu also
// skips any day already past).
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

/** Every menu day from `today` on, in date order. */
export function upcomingMenu(menu: Menu | null, today: string = toISODate(new Date())): MenuDay[] {
  if (!menu) return [];
  return menu.days.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

/** The menu file, loaded only when the bar needs it; null if it cannot be loaded. */
export async function loadMenu(): Promise<Menu | null> {
  try {
    const mod = await import("../data/menu.json");
    const menu = (mod.default ?? mod) as Menu;
    return Array.isArray(menu.days) ? menu : null;
  } catch {
    return null;
  }
}
