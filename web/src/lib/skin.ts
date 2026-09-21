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
const asAppearance = (v: string | null): Appearance | null =>
  v === "light" || v === "dark" ? v : null;

/** Cookie first, then the localStorage mirror, then the default. */
export function readSkin(): Skin {
  return asSkin(readCookie(SKIN_COOKIE)) ?? asSkin(readPref("skin")) ?? DEFAULT_SKIN;
}

export function readAppearance(): Appearance {
  return (
    asAppearance(readCookie(APPEARANCE_COOKIE)) ??
    asAppearance(readPref("appearance")) ??
    DEFAULT_APPEARANCE
  );
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

export function writeAppearance(appearance: Appearance): void {
  writeCookie(APPEARANCE_COOKIE, appearance);
  writePref("appearance", appearance);
  applySkin(readSkin(), appearance);
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
  writeCookie(SKIN_COOKIE, skin);
  writeCookie(APPEARANCE_COOKIE, appearance);
  return { skin, appearance };
}
