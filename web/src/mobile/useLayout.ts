import { useCallback, useEffect, useState } from "react";
import { readPref, writePref } from "../lib/prefs";

// Which version of the app this device shows. "auto" follows the screen: a
// phone-sized window gets the mobile app, anything wider the desktop one.
// The choice is per device (localStorage), so someone can keep the desktop
// layout on a tablet, or try the mobile one in a narrow desktop window.
export type LayoutChoice = "auto" | "mobile" | "desktop";

const PHONE_QUERY = "(max-width: 767px)";

function readChoice(): LayoutChoice {
  const v = readPref("layout");
  return v === "mobile" || v === "desktop" ? v : "auto";
}

function phoneSized(): boolean {
  try {
    return window.matchMedia(PHONE_QUERY).matches;
  } catch {
    return false;
  }
}

export function useLayout(): {
  mobile: boolean;
  choice: LayoutChoice;
  setChoice: (c: LayoutChoice) => void;
} {
  const [choice, setChoiceState] = useState<LayoutChoice>(readChoice);
  const [phone, setPhone] = useState<boolean>(phoneSized);

  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(PHONE_QUERY);
    } catch {
      return;
    }
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const setChoice = useCallback((c: LayoutChoice) => {
    setChoiceState(c);
    writePref("layout", c);
  }, []);

  return { mobile: choice === "mobile" || (choice === "auto" && phone), choice, setChoice };
}
