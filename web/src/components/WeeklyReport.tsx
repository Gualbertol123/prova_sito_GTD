import { useMemo, useState } from "react";
import type { Board } from "../lib/types";
import { useT } from "../lib/i18n";
import { collectReport, weekPeriod, type Period } from "../lib/reportData";

interface Props {
  board: Board;
}

const WEEKS_BACK = 12;

// Weekly report generator: pick a period (this week by default, or any of the
// last few weeks, or a custom range) and download a .docx built from the
// Intesa Sanpaolo template.
export function WeeklyReport({ board }: Props) {
  const { t, lang } = useT();
  const [period, setPeriod] = useState<Period>(() => weekPeriod(0));
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // The last N weeks, newest first — the "select one in the past" options.
  const weeks = useMemo(
    () => Array.from({ length: WEEKS_BACK }, (_, i) => ({ offset: i, ...weekPeriod(i) })),
    []
  );

  const data = useMemo(() => collectReport(board, period), [board, period]);

  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", {
      day: "2-digit",
      month: "short",
    });
  };
  const weekLabel = (w: { offset: number; from: string; to: string }) => {
    const range = `${fmt(w.from)} – ${fmt(w.to)}`;
    if (w.offset === 0) return `${range} · ${t("report.thisWeek")}`;
    if (w.offset === 1) return `${range} · ${t("report.lastWeek")}`;
    return range;
  };
  const selected = weeks.find((w) => w.from === period.from && w.to === period.to);

  const download = async () => {
    setBusy(true);
    setErr(null);
    try {
      // Loaded on demand so the docx machinery stays out of the main bundle.
      const { downloadReportDocx } = await import("../lib/reportDocx");
      await downloadReportDocx(data, lang);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const control =
    "h-9 rounded-full bg-white border border-[#E8E6E1] text-[13px] outline-none focus:border-[#C9A96E] px-3";

  return (
    <div className="rounded-[14px] border border-[#C9A96E]/40 bg-[#FBF6EC] p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-trajan text-[11px] uppercase tracking-widest text-[#8B6F3E]">
          📄 {t("report.title")}
        </span>
        <span className="text-[11px] text-[#8A8A8A]">{t("report.hint")}</span>
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-[#8A8A8A]">
            {t("report.period")}
          </span>
          <select
            value={custom ? "custom" : selected ? String(selected.offset) : "custom"}
            onChange={(e) => {
              if (e.target.value === "custom") {
                setCustom(true);
                return;
              }
              setCustom(false);
              setPeriod(weekPeriod(Number(e.target.value)));
            }}
            className={`${control} min-w-[230px]`}
          >
            {weeks.map((w) => (
              <option key={w.offset} value={w.offset}>
                {weekLabel(w)}
              </option>
            ))}
            <option value="custom">{t("report.custom")}</option>
          </select>
        </label>

        {custom && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-[#8A8A8A]">
                {t("report.from")}
              </span>
              <input
                type="date"
                value={period.from}
                max={period.to}
                onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, from: e.target.value }))}
                className={control}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-[#8A8A8A]">
                {t("report.to")}
              </span>
              <input
                type="date"
                value={period.to}
                min={period.from}
                onChange={(e) => e.target.value && setPeriod((p) => ({ ...p, to: e.target.value }))}
                className={control}
              />
            </label>
          </>
        )}

        <button
          onClick={download}
          disabled={busy}
          className="h-9 px-5 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold disabled:opacity-40"
        >
          {busy ? t("report.generating") : t("report.download")}
        </button>
      </div>

      <div className="text-[12px] text-[#6B6B6B]">
        {data.totalTasks === 0 && data.totalSubtasks === 0
          ? t("report.empty")
          : t("report.preview", { t: data.totalTasks, s: data.totalSubtasks })}
      </div>

      {err && <div className="text-[11px] text-[#DC2626]">{t("report.error")} — {err}</div>}
    </div>
  );
}
