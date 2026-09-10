import { useT, type Lang } from "../lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useT();
  const opt = (l: Lang, label: string) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={`px-2.5 h-7 text-[11px] font-semibold rounded-full transition-colors ${
        lang === l ? "bg-[#C9A96E] text-[#0A1931]" : "text-[#8BA1C2] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center rounded-full border border-[#1E335E] bg-[#0A1931] p-0.5">
      {opt("it", "IT")}
      {opt("en", "EN")}
    </div>
  );
}
