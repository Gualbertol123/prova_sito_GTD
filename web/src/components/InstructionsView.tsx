import { STATUS_ORDER } from "../lib/constants";
import { statusLabel, useT } from "../lib/i18n";
import type { Priority } from "../lib/types";

const PRIOS: { p: Priority; dot: string }[] = [
  { p: "P1", dot: "bg-[#DC2626]" },
  { p: "P2", dot: "bg-[#C9A96E]" },
  { p: "P3", dot: "bg-[#C9C5BE]" },
  { p: "P4", dot: "bg-transparent border border-dashed border-[#E8E6E1]" },
];

export function InstructionsView() {
  const { t, lang } = useT();

  const workflow = [
    { title: "Board:", body: t("instr.wf.board") },
    { title: "Weekly Review:", body: t("instr.wf.weekly") },
    { title: lang === "it" ? "Calendario:" : "Calendar:", body: t("instr.wf.calendar") },
    { title: "Tracking:", body: t("instr.wf.tracking") },
    { title: "Mail:", body: t("instr.wf.mail") },
  ];

  return (
    <div className="max-w-[900px] mx-auto space-y-4">
      <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-5">
        <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#C9A96E] mb-4">
          {t("instr.statiPrio")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#8A8A8A] mb-2">
              {t("instr.stati")}
            </div>
            <div className="space-y-2">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="flex items-start gap-3">
                  <span className="font-trajan text-[11px] uppercase text-[#0A1931] w-[92px] shrink-0">
                    {statusLabel(lang, s)}
                  </span>
                  <span className="text-[12px] text-[#6B6B6B]">{t(`status.${s}.help`)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#8A8A8A] mb-2">
              {t("instr.priorita")}
            </div>
            <div className="space-y-2">
              {PRIOS.map(({ p, dot }) => (
                <div key={p} className="flex items-start gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1 ${dot}`} />
                  <div>
                    <span className="font-semibold text-[12px] text-[#0A1931]">
                      {p} · {t(`prio.${p}short`)}
                    </span>
                    <span className="text-[12px] text-[#6B6B6B]"> — {t(`prio.${p}desc`)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[14px] border border-[#E8E6E1] p-5">
        <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#C9A96E] mb-4">
          {t("instr.workflow")}
        </h3>
        <div className="space-y-2">
          {workflow.map((w) => (
            <div key={w.title} className="text-[13px] text-[#6B6B6B]">
              <span className="font-semibold text-[#0A1931]">{w.title}</span> {w.body}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#0A1931] rounded-[14px] p-5 text-[#E6EDF8]">
        <h3 className="font-trajan text-[13px] uppercase tracking-widest text-[#C9A96E] mb-2">
          {t("instr.collabTitle")}
        </h3>
        <p className="text-[12px] leading-relaxed">{t("instr.collab")}</p>
      </div>
    </div>
  );
}
