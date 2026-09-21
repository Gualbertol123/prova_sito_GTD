// -----------------------------------------------------------------------------
// Visual skin: "glass" (the Liquid Glass redesign) or "classic" (the original
// flat cream/navy look).
//
// This is purely a coat of paint. The skin is a single attribute on <html> and
// everything it does lives in styles/glass.css — no component renders
// differently, no data path changes, nothing is conditional on it in logic.
//
// The preference is stored in a COOKIE so it travels with the browser profile
// the way a site preference should, and is mirrored into localStorage so the
// two never disagree if cookies are cleared or blocked.
// -----------------------------------------------------------------------------

import { readPref, writePref } from "./prefs";

export type Skin = "glass" | "classic";

export const DEFAULT_SKIN: Skin = "glass";

const COOKIE = "gtd-skin";
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

const valid = (v: string | null): Skin | null =>
  v === "glass" || v === "classic" ? v : null;

/** Cookie first, then the localStorage mirror, then the default. */
export function readSkin(): Skin {
  return valid(readCookie(COOKIE)) ?? valid(readPref("skin")) ?? DEFAULT_SKIN;
}

/** Put the skin on <html> so CSS can scope every rule to `[data-skin="glass"]`. */
export function applySkin(skin: Skin): void {
  document.documentElement.dataset.skin = skin;
}

export function writeSkin(skin: Skin): void {
  writeCookie(COOKIE, skin);
  writePref("skin", skin);
  applySkin(skin);
}

/**
 * Apply the stored skin before React paints, so the first frame is already
 * correct instead of flashing the other look. Also re-writes the cookie, which
 * refreshes its expiry on every visit.
 */
export function initSkin(): Skin {
  const skin = readSkin();
  applySkin(skin);
  writeCookie(COOKIE, skin);
  return skin;
}
