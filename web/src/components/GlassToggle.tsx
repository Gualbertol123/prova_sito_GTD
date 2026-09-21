import { useState } from "react";
import { useT } from "../lib/i18n";
import {
  readAppearance,
  readSkin,
  writeAppearance,
  writeSkin,
  type Appearance,
  type Skin,
} from "../lib/skin";

// Liquid Glass on/off, plus its light/dark appearance. Styling only — the
// appearance control only appears when glass is on, because it has nothing to
// act on in the classic theme.
export function GlassToggle() {
  const { t } = useT();
  const [skin, setSkin] = useState<Skin>(() => readSkin());
  const [appearance, setAppearance] = useState<Appearance>(() => readAppearance());
  const on = skin === "glass";

  const toggleSkin = () => {
    const next: Skin = on ? "classic" : "glass";
    writeSkin(next);
    setSkin(next);
  };

  const pickAppearance = (next: Appearance) => {
    writeAppearance(next);
    setAppearance(next);
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        onClick={toggleSkin}
        role="switch"
        aria-checked={on}
        title={t(on ? "skin.onHint" : "skin.offHint")}
        className={`glass-switch inline-flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-full border text-[11px] font-semibold tracking-wide transition-colors ${
          on
            ? "bg-white/15 border-white/35 text-white"
            : "bg-transparent border-[#1E335E] text-[#8BA1C2] hover:border-[#C9A96E]"
        }`}
      >
        <span
          className={`relative w-8 h-[18px] rounded-full transition-colors ${
            /* systemGreen when on, like an iOS switch */
            on ? "bg-[#30D158]" : "bg-[#1E335E]"
          }`}
        >
          <span
            className={`glass-switch__knob absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all ${
              on ? "left-[16px]" : "left-[2px]"
            }`}
          />
        </span>
        <span className="hidden sm:inline">{t("skin.label")}</span>
      </button>

      {on && (
        <div
          role="group"
          aria-label={t("skin.appearance")}
          className="glass-appearance inline-flex items-center h-9 p-0.5 rounded-full border border-white/30 bg-white/10"
        >
          {(["light", "dark"] as Appearance[]).map((mode) => {
            const active = appearance === mode;
            return (
              <button
                key={mode}
                onClick={() => pickAppearance(mode)}
                aria-pressed={active}
                title={t(mode === "light" ? "skin.light" : "skin.dark")}
                className={`h-8 w-8 rounded-full text-[13px] leading-none flex items-center justify-center transition-colors ${
                  active ? "bg-white/85 text-[#1c1c1e]" : "text-white/70 hover:text-white"
                }`}
              >
                {mode === "light" ? "☀" : "☾"}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
