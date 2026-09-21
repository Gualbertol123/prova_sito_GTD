import { useState } from "react";
import { useT } from "../lib/i18n";
import { readSkin, writeSkin, type Skin } from "../lib/skin";

// Liquid Glass on/off. Lives in the header's right slot; styling only.
export function GlassToggle() {
  const { t } = useT();
  const [skin, setSkin] = useState<Skin>(() => readSkin());
  const on = skin === "glass";

  const toggle = () => {
    const next: Skin = on ? "classic" : "glass";
    writeSkin(next);
    setSkin(next);
  };

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={on}
      title={t(on ? "skin.onHint" : "skin.offHint")}
      className={`glass-switch group inline-flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-full border text-[11px] font-semibold tracking-wide transition-colors ${
        on
          ? "bg-white/15 border-white/35 text-[#C9A96E]"
          : "bg-transparent border-[#1E335E] text-[#8BA1C2] hover:border-[#C9A96E]"
      }`}
    >
      {/* The little switch track */}
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
  );
}
