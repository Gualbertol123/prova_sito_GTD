import { useEffect } from "react";

// After IDLE_MS with no interaction anywhere on the site, open IDLE_URL in a
// new tab. It fires once per idle spell; the next interaction starts a new one.
//
// Browsers usually block a tab opened without a click or key press. When the
// tab is blocked, it opens on the user's next real click or key press instead:
// that counts as a user action, so the browser allows it. (A click simulated
// from code would not: browsers ignore those for popups.)

const IDLE_MS = 10 * 60 * 1000;
const IDLE_URL = "https://www.petitchef.it/imgupl/recipe/pizza-ai-frutti-di-mare--lg-455626p707845.webp";
const ACTIVITY = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;
// Events that let a page open a tab (user activation).
const GESTURES = ["click", "keydown", "pointerup", "touchend"] as const;

/** Opens the tab; false when the browser blocked it. */
function openTab(): boolean {
  // No "noopener" feature: with it window.open returns null even when the
  // tab opened, so a refusal could not be told apart. Cut the link instead.
  const win = window.open(IDLE_URL, "_blank");
  if (!win) return false;
  win.opener = null;
  return true;
}

export function IdleOpener() {
  useEffect(() => {
    let timer: number | undefined;
    let pending = false; // blocked, waiting for the next real click or key press

    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!openTab()) pending = true;
      }, IDLE_MS);
    };
    const onGesture = () => {
      if (pending && openTab()) pending = false;
    };

    reset();
    for (const e of ACTIVITY) window.addEventListener(e, reset, { passive: true, capture: true });
    for (const e of GESTURES) window.addEventListener(e, onGesture, { capture: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of ACTIVITY) window.removeEventListener(e, reset, { capture: true });
      for (const e of GESTURES) window.removeEventListener(e, onGesture, { capture: true });
    };
  }, []);

  return null;
}
