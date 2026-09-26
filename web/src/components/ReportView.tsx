import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Board } from "../lib/types";
import { useT } from "../lib/i18n";
import { collectReport, weekPeriod, type Period } from "../lib/reportData";
import { GlassReport } from "./GlassReport";
import type { ReportDoc } from "../lib/reportDoc";
import { supabase } from "../lib/supabaseClient";
import { shortDate } from "../lib/dates";
import { clearReportDraft, purgeReportDrafts, readReportDraft } from "../lib/prefs";
import "@fontsource-variable/inter";
import "../styles/glassReport.css";

interface Props {
  board: Board;
}

const WEEKS_BACK = 12;

type Stage = "setup" | "editing";

// The REPORT tab.
//
// Flow: pick a period → Generate. The report is laid out right here as A4
// pages in Liquid Glass (GlassReport); every text on it can be edited in
// place, cards can be hidden, and "Download PDF" sends the report — texts
// as they now read on the pages — to the server, which makes the PDF
// (netlify/functions/report-pdf.mts), so it is the same on every device.
// The old Word template is still available as a direct download.
export function ReportView({ board }: Props) {
  const { t, lang } = useT();
  const [period, setPeriod] = useState<Period>(() => weekPeriod(0));
  const [custom, setCustom] = useState(false);
  const draftKey = `${period.from}_${period.to}`;
  // Coming back to the tab with a saved draft for this week reopens it.
  const [stage, setStage] = useState<Stage>(() => {
    purgeReportDrafts();
    const p = weekPeriod(0);
    return readReportDraft(`${p.from}_${p.to}`) ? "editing" : "setup";
  });
  const [hasDraft, setHasDraft] = useState(false);
  const [resetN, setResetN] = useState(0);
  useEffect(() => setHasDraft(!!readReportDraft(draftKey)), [draftKey]);
  const onDraftChange = useCallback((v: boolean) => setHasDraft(v), []);

  // Throw away this week's changes and start again from the board.
  const resetReport = () => {
    if (!window.confirm(t("report.resetConfirm"))) return;
    clearReportDraft(draftKey);
    setHasDraft(false);
    setResetN((n) => n + 1);
  };
  const [busy, setBusy] = useState<null | "docx" | "pdf">(null);
  const [err, setErr] = useState<string | null>(null);

  const docRef = useRef<(() => ReportDoc) | null>(null);

  const weeks = useMemo(
    () => Array.from({ length: WEEKS_BACK }, (_, i) => ({ offset: i, ...weekPeriod(i) })),
    []
  );
  const data = useMemo(() => collectReport(board, period), [board, period]);

  const fmt = (iso: string, withYear = false) => {
    const [y, m, d] = iso.split("-").map(Number);
    return shortDate(new Date(y, m - 1, d), lang, withYear, true);
  };

  const weekLabel = (w: { offset: number; from: string; to: string }) => {
    const range = `${fmt(w.from)} – ${fmt(w.to)}`;
    if (w.offset === 0) return `${range} · ${t("report.thisWeek")}`;
    if (w.offset === 1) return `${range} · ${t("report.lastWeek")}`;
    return range;
  };
  const selected = weeks.find((w) => w.from === period.from && w.to === period.to);
  const periodText = `${fmt(period.from)} – ${fmt(period.to, true)}`;

  // The old Word template, straight to a download.
  const downloadWord = async () => {
    setErr(null);
    setBusy("docx");
    try {
      const { downloadReportDocx } = await import("../lib/reportDocx");
      await downloadReportDocx(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    const build = docRef.current;
    if (!build) return;
    setErr(null);
    setBusy("pdf");
    try {
      // Finish an edit still in progress so it is part of the document.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      await new Promise((r) => setTimeout(r, 0));
      const doc = build();
      const { data: auth } = await supabase.auth.getSession();
      const token = auth.session?.access_token;
      if (!token) throw new Error(t("report.pdfLogin"));
      const res = await fetch("/.netlify/functions/report-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(doc),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`${res.status} ${msg}`.trim());
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const control =
    "h-9 rounded-full bg-white border border-[#E8E6E1] text-[13px] outline-none focus:border-[#C9A96E] px-3";
  const primaryBtn =
    "h-9 px-5 rounded-full bg-[#0A1931] text-[#C9A96E] text-[12px] font-semibold disabled:opacity-40";
  const ghostBtn =
    "h-9 px-4 rounded-full bg-white text-[#0A1931] border border-[#E8E6E1] text-[12px] font-semibold hover:border-[#C9A96E] disabled:opacity-40";

  return (
    <div className="space-y-4">
      {/* Controls */}
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
              disabled={stage === "editing"}
              onChange={(e) => {
                if (e.target.value === "custom") return setCustom(true);
                setCustom(false);
                setPeriod(weekPeriod(Number(e.target.value)));
              }}
              className={`${control} min-w-[230px] disabled:opacity-50`}
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
                  disabled={stage === "editing"}
                  onChange={(e) =>
                    e.target.value && setPeriod((p) => ({ ...p, from: e.target.value }))
                  }
                  className={`${control} disabled:opacity-50`}
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
                  disabled={stage === "editing"}
                  onChange={(e) =>
                    e.target.value && setPeriod((p) => ({ ...p, to: e.target.value }))
                  }
                  className={`${control} disabled:opacity-50`}
                />
              </label>
            </>
          )}

          {stage !== "editing" ? (
            <>
              <button onClick={() => setStage("editing")} className={primaryBtn}>
                {t("report.generate")}
              </button>
              <button onClick={downloadWord} disabled={busy !== null} className={ghostBtn}>
                {busy === "docx" ? t("report.generating") : t("report.downloadWordClassic")}
              </button>
            </>
          ) : (
            <>
              <button onClick={downloadPdf} disabled={busy !== null} className={primaryBtn}>
                {busy === "pdf" ? t("report.pdfMaking") : t("report.downloadPdf")}
              </button>
              <button onClick={() => setStage("setup")} disabled={busy !== null} className={ghostBtn}>
                {t("report.close")}
              </button>
            </>
          )}
          {(stage === "editing" || hasDraft) && (
            <button
              onClick={resetReport}
              disabled={busy !== null || !hasDraft}
              className={`${ghostBtn} text-[#DC2626] border-[#FECACA] hover:border-[#DC2626]`}
              title={t("report.resetHint")}
            >
              ↺ {t("report.reset")}
            </button>
          )}
        </div>

        {hasDraft && (
          <div className="text-[11px] text-[#065F46]">✓ {t("report.draftSaved")}</div>
        )}

        <div className="text-[12px] text-[#6B6B6B]">
          {data.totalTasks === 0 && data.totalSubtasks === 0
            ? t("report.empty")
            : t("report.preview", { t: data.totalTasks, s: data.totalSubtasks })}
        </div>

        {err && (
          <div className="text-[11px] text-[#DC2626]">
            {t("report.error")} — {err}
          </div>
        )}
      </div>

      {stage === "editing" && (
        <div className="space-y-2">
          <div className="text-[11px] text-[#8A8A8A] text-center">{t("report.editHint")}</div>
          <GlassReport
            key={`${draftKey}#${resetN}`}
            board={board}
            data={data}
            periodText={periodText}
            docRef={docRef}
            draftKey={draftKey}
            onDraftChange={onDraftChange}
          />
        </div>
      )}
    </div>
  );
}
