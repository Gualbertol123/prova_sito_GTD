import { useEffect, useMemo, useRef, useState } from "react";
import type { Board } from "../lib/types";
import { useT } from "../lib/i18n";
import { collectReport, weekPeriod, type Period } from "../lib/reportData";
import {
  createReportEditor,
  downloadBlob,
  exportEditedDocx,
  preloadSuperDoc,
  printForPdf,
  type SuperDocInstance,
} from "../lib/reportEditor";

interface Props {
  board: Board;
}

const WEEKS_BACK = 12;

type Stage = "setup" | "building" | "editing";

// The REPORT tab.
//
// Flow: pick a period → Generate. The .docx is built in memory and handed
// straight to the SuperDoc editor; it is only written to disk when someone
// actually asks for it. SuperDoc starts downloading the moment this tab
// mounts, so it is normally already in memory by the time a report exists.
export function ReportView({ board }: Props) {
  const { t, lang } = useT();
  const [period, setPeriod] = useState<Period>(() => weekPeriod(0));
  const [custom, setCustom] = useState(false);
  const [stage, setStage] = useState<Stage>("setup");
  const [busy, setBusy] = useState<null | "docx" | "pdf">(null);
  const [err, setErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState("Weekly_Report.docx");

  const editorEl = useRef<HTMLDivElement>(null);
  const toolbarEl = useRef<HTMLDivElement>(null);
  const instance = useRef<SuperDocInstance | null>(null);
  const pendingFile = useRef<File | null>(null);

  // Warm the editor bundle as soon as the tab is opened, so the download
  // overlaps with choosing a period and building the document.
  useEffect(() => {
    preloadSuperDoc().catch(() => {
      /* reported when the editor is actually needed */
    });
  }, []);

  // Tear the editor down when leaving the tab.
  useEffect(
    () => () => {
      instance.current?.destroy();
      instance.current = null;
    },
    []
  );

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

  // Build the .docx (never downloaded here) and open it in the editor.
  const generate = async () => {
    setErr(null);
    setStage("building");
    try {
      // Both halves start together: the document builds while SuperDoc lands.
      const [{ buildReportDocx, reportFileName }] = await Promise.all([
        import("../lib/reportDocx"),
        preloadSuperDoc(),
      ]);
      const blob = await buildReportDocx(data);
      const name = reportFileName(data);
      setFileName(name);
      pendingFile.current = new File([blob], name, { type: blob.type });
      setStage("editing"); // mounts the editor host elements
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setStage("setup");
    }
  };

  // Mount SuperDoc once the host elements exist.
  useEffect(() => {
    if (stage !== "editing" || !pendingFile.current) return;
    const file = pendingFile.current;
    pendingFile.current = null;
    let cancelled = false;
    (async () => {
      try {
        const sd = await createReportEditor({
          editorEl: editorEl.current!,
          toolbarEl: toolbarEl.current!,
          file,
        });
        if (cancelled) sd.destroy();
        else instance.current = sd;
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e));
          setStage("setup");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stage]);

  const closeEditor = () => {
    instance.current?.destroy();
    instance.current = null;
    setStage("setup");
  };

  // Download the document straight from the generator, skipping the editor.
  const downloadUnedited = async () => {
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

  const downloadEditedDocx = async () => {
    if (!instance.current) return;
    setErr(null);
    setBusy("docx");
    try {
      downloadBlob(await exportEditedDocx(instance.current), fileName);
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
      {/* Controls — hidden while printing */}
      <div className="report-no-print rounded-[14px] border border-[#C9A96E]/40 bg-[#FBF6EC] p-4 space-y-3">
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
              <button onClick={generate} disabled={stage === "building"} className={primaryBtn}>
                {stage === "building" ? t("report.generating") : t("report.generate")}
              </button>
              <button onClick={downloadUnedited} disabled={busy !== null} className={ghostBtn}>
                {t("report.downloadDirect")}
              </button>
            </>
          ) : (
            <button onClick={closeEditor} className={ghostBtn}>
              {t("report.close")}
            </button>
          )}
        </div>

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

      {/* Editor */}
      {stage === "editing" && (
        <div className="space-y-3">
          <div className="report-no-print flex items-center gap-2 flex-wrap">
            <button onClick={downloadEditedDocx} disabled={busy !== null} className={primaryBtn}>
              {busy === "docx" ? t("report.generating") : t("report.downloadWord")}
            </button>
            <button onClick={printForPdf} disabled={busy !== null} className={ghostBtn}>
              {t("report.downloadPdf")}
            </button>
            <span className="text-[11px] text-[#8A8A8A]">{t("report.pdfHint")}</span>
          </div>

          <div className="report-print-root rounded-[14px] border border-[#E8E6E1] bg-white overflow-hidden">
            <div ref={toolbarEl} className="report-no-print border-b border-[#E8E6E1]" />
            <div ref={editorEl} className="report-editor-host min-h-[70vh] bg-[#F5F3EF]" />
          </div>
        </div>
      )}

      {stage === "building" && (
        <div className="report-no-print rounded-[14px] border border-[#E8E6E1] bg-white p-10 text-center text-[13px] text-[#8A8A8A]">
          {t("report.buildingEditor")}
        </div>
      )}
    </div>
  );
}
