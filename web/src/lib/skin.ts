// -----------------------------------------------------------------------------
// Visual skin: "glass" (the Liquid Glass redesign) or "classic" (the original
// flat cream/navy look), and — when glass is on — its appearance, light or
// dark. Liquid Glass has both on Apple's platforms, and the system palette
// ships a light and a dark variant of every colour, so the two appearances are
// the same design with a different token set.
//
// This is purely a coat of paint. Both choices are attributes on <html> and
// everything they do lives in styles/glass.css — no component renders
// differently, no data path changes, nothing is conditional on them in logic.
//
// Both preferences are stored in COOKIES so they travel with the browser
// profile the way site preferences should, and are mirrored into localStorage
// so nothing is lost if cookies are cleared or blocked.
// -----------------------------------------------------------------------------

import { readPref, writePref } from "./prefs";

export type Skin = "glass" | "classic";
export type Appearance = "light" | "dark";
/** What the person picked: a fixed appearance, or "auto" = follow the device. */
export type AppearanceChoice = Appearance | "auto";

export const DEFAULT_SKIN: Skin = "glass";
export const DEFAULT_APPEARANCE: Appearance = "dark";

const SKIN_COOKIE = "gtd-skin";
const APPEARANCE_COOKIE = "gtd-appearance";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  try {
    const match = document.cookie.match(
      new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string): void {
  try {
    // Lax is right for a display preference: it survives normal navigation and
    // is never sent on cross-site POSTs. Secure only when actually on https,
    // so it still works on http://localhost during development.
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${name}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* cookies blocked — localStorage still holds the preference */
  }
}

const asSkin = (v: string | null): Skin | null =>
  v === "glass" || v === "classic" ? v : null;
const asAppearance = (v: string | null): AppearanceChoice | null =>
  v === "light" || v === "dark" || v === "auto" ? v : null;

function systemAppearance(): Appearance {
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Cookie first, then the localStorage mirror, then the default. */
export function readSkin(): Skin {
  return asSkin(readCookie(SKIN_COOKIE)) ?? asSkin(readPref("skin")) ?? DEFAULT_SKIN;
}

/** The stored choice: light, dark or auto. */
export function readAppearanceChoice(): AppearanceChoice {
  return (
    asAppearance(readCookie(APPEARANCE_COOKIE)) ??
    asAppearance(readPref("appearance")) ??
    DEFAULT_APPEARANCE
  );
}

/** The appearance in effect now ("auto" resolved from the device setting). */
export function readAppearance(): Appearance {
  const c = readAppearanceChoice();
  return c === "auto" ? systemAppearance() : c;
}

/** Both choices land on <html>, so CSS can scope every rule to them. */
export function applySkin(skin: Skin, appearance: Appearance): void {
  document.documentElement.dataset.skin = skin;
  document.documentElement.dataset.appearance = appearance;
}

export function writeSkin(skin: Skin): void {
  writeCookie(SKIN_COOKIE, skin);
  writePref("skin", skin);
  applySkin(skin, readAppearance());
}

/**
 * Glass blur on/off. Off keeps the glass colours but drops backdrop-filter
 * everywhere: an escape hatch for GPUs/browsers that draw seams or lines in
 * blurred surfaces, and lighter on slow machines. Same effect as the OS
 * "Reduce transparency" setting.
 */
export function readBlur(): boolean {
  return readPref("blur") !== "off";
}

export function writeBlur(on: boolean): void {
  writePref("blur", on ? "on" : "off");
  applyBlur(on);
}

function applyBlur(on: boolean): void {
  if (on) delete document.documentElement.dataset.blur;
  else document.documentElement.dataset.blur = "off";
}

export function writeAppearance(choice: AppearanceChoice): void {
  writeCookie(APPEARANCE_COOKIE, choice);
  writePref("appearance", choice);
  applySkin(readSkin(), readAppearance());
}

/**
 * Apply the stored choices before React paints, so the first frame is already
 * correct instead of flashing the other look. Also re-writes the cookies,
 * which refreshes their expiry on every visit.
 */
export function initSkin(): { skin: Skin; appearance: Appearance } {
  const skin = readSkin();
  const appearance = readAppearance();
  applySkin(skin, appearance);
  applyBlur(readBlur());
  writeCookie(SKIN_COOKIE, skin);
  writeCookie(APPEARANCE_COOKIE, readAppearanceChoice());
  // "Auto" follows the device live: switch the phone or computer to light or
  // dark and the open app (installed or in a tab) follows.
  try {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
      if (readAppearanceChoice() === "auto") applySkin(readSkin(), readAppearance());
    });
  } catch {
    /* very old browser: auto is read at start-up only */
  }
  return { skin, appearance };
}
