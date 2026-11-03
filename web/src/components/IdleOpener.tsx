import { useEffect, useState } from "react";

// After IDLE_MS with no interaction anywhere on the site, open IDLE_URL in a
// new tab. It fires once per idle spell; the next interaction starts a new one.
//
// Browsers usually block a tab opened without a click or key press, so when
// window.open is refused a small link appears instead, and clicking it opens
// the page.

const IDLE_MS = 10 * 60 * 1000;
const IDLE_URL = "https://www.petitchef.it/imgupl/recipe/pizza-ai-frutti-di-mare--lg-455626p707845.webp";
const EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;

export function IdleOpener() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const fire = () => {
      // No "noopener" feature: with it window.open returns null even when the
      // tab opened, so a refusal could not be told apart. Cut the link instead.
      const win = window.open(IDLE_URL, "_blank");
      if (win) win.opener = null;
      else setBlocked(true);
    };
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fire, IDLE_MS);
    };
    reset();
    for (const e of EVENTS) window.addEventListener(e, reset, { passive: true, capture: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of EVENTS) window.removeEventListener(e, reset, { capture: true });
    };
  }, []);

  if (!blocked) return null;
  return (
    <a
      href={IDLE_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => setBlocked(false)}
      className="fixed bottom-4 right-4 z-[1000] rounded-full bg-[#0A1931] text-white text-[12px] font-semibold px-4 py-2 shadow-lg"
    >
      🍕 Pizza ai frutti di mare →
    </a>
  );
}
