// -----------------------------------------------------------------------------
// Visual skin: "glass" (Apple Liquid Glass inspired) or "classic" (the original
// flat cream/navy look).
//
// This is purely a coat of paint. The skin is a single attribute on <html> and
// everything it does lives in styles/glass.css — no component renders
// differently, no data path changes, nothing is conditional on it in logic.
// Turning it off restores the original stylesheet exactly.
// -----------------------------------------------------------------------------

import { readPref, writePref } from "./prefs";

export type Skin = "glass" | "classic";

export const DEFAULT_SKIN: Skin = "glass";

export function readSkin(): Skin {
  return readPref("skin") === "classic" ? "classic" : DEFAULT_SKIN;
}

/** Put the skin on <html> so CSS can scope every rule to `[data-skin="glass"]`. */
export function applySkin(skin: Skin): void {
  document.documentElement.dataset.skin = skin;
}

export function writeSkin(skin: Skin): void {
  writePref("skin", skin);
  applySkin(skin);
}

/**
 * Apply the stored skin before React paints, so the first frame is already
 * correct instead of flashing the other look.
 */
export function initSkin(): Skin {
  const skin = readSkin();
  applySkin(skin);
  return skin;
}
