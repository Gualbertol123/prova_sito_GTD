import { useMe } from "../lib/identity";
import { useT } from "../lib/i18n";

// Compact "who am I" control in the header. Remembered per browser and used as
// the default author / owner across the app.
export function IdentityPicker({ members }: { members: string[] }) {
  const { t } = useT();
  const { me, setMe } = useMe();
  const valid = me && members.includes(me);
  const initial = valid ? me.charAt(0).toUpperCase() : "?";

  return (
    <div
      title={t("reflection.me")}
      className="inline-flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-full bg-[#112040] border border-[#1E335E]"
    >
      <span className="w-6 h-6 rounded-full bg-[#C9A96E] text-[#0A1931] text-[10px] font-bold flex items-center justify-center">
        {initial}
      </span>
      <select
        value={valid ? me : ""}
        onChange={(e) => setMe(e.target.value)}
        className="bg-transparent text-[12px] text-[#E6EDF8] outline-none cursor-pointer max-w-[110px]"
      >
        <option value="" className="text-[#0A1931]">
          {t("reflection.pickMe")}
        </option>
        {members.map((m) => (
          <option key={m} value={m} className="text-[#0A1931]">
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
