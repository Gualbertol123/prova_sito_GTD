import { useState } from "react";
import type { Board, Weekly } from "../lib/types";
import { WEEKLY_COLUMNS, genId, isArchived } from "../lib/constants";
import { useT } from "../lib/i18n";
import { useMe } from "../lib/identity";
import { readAppearanceChoice, readBlur, readSkin, writeAppearance, writeBlur, writeSkin, type AppearanceChoice } from "../lib/skin";
import { WeeklyItemField } from "../components/WeeklyView";
import { DailyReflection } from "../components/DailyReflection";
import { SettingsView } from "../components/SettingsView";
import { ReportView } from "../components/ReportView";
import { ProductTreeView } from "../components/ProductTreeView";
import { Avatar, Sheet } from "./ui";
import { useInstall } from "../lib/pwa";
import { music } from "../lib/music";
import { IconBack, IconChevron, IconClose, IconAuto, IconDesktop, IconDownload, IconMoon, IconSun, IconGear, IconLeaf, IconMail, IconReport, IconTree, IconUser, IconWeekly } from "./icons";
import type { Send } from "./actions";
import type { LayoutChoice } from "./useLayout";

export type MorePage = "weekly" | "report" | "reflection" | "products" | "settings" | null;

/** Everything that is not one of the four main tabs. */
export function MoreScreen({
  board,
  send,
  page,
  setPage,
  onMail,
  onMe,
}: {
  board: Board;
  send: Send;
  page: MorePage;
  setPage: (p: MorePage) => void;
  onMail: () => void;
  onMe: () => void;
}) {
  const { t } = useT();
  const { me } = useMe();

  if (page) {
    const back = (
      <div className="m-embed__bar">
        <button className="m-iconbtn" aria-label={t("m.back")} onClick={() => setPage(null)}>
          <IconBack size={18} />
        </button>
      </div>
    );
    if (page === "weekly")
      return (
        <div className="m-page" style={{ paddingTop: 8 }}>
          {back}
          <WeeklyPage board={board} send={send} />
        </div>
      );
    return (
      <div className="m-embed">
        {back}
        {page === "report" && (
          <>
            <p className="m-sub" style={{ margin: "0 4px 12px" }}>
              {t("m.reportHint")}
            </p>
            <div className="m-scroll-x">
              <ReportView board={board} send={send} />
            </div>
          </>
        )}
        {page === "reflection" && <DailyReflection board={board} members={board.members} send={send} />}
        {page === "products" && (
          <div className="m-scroll-x">
            <ProductTreeView />
          </div>
        )}
        {page === "settings" && <SettingsView board={board} send={send} />}
      </div>
    );
  }

  const rows: { icon: React.ReactNode; tile: string; title: string; hint: string; onClick: () => void }[] = [
    { icon: <span style={{ fontSize: 17, lineHeight: 1 }}>♪</span>, tile: "var(--m-red)", title: t("music.title"), hint: t("music.more"), onClick: () => music.open() },
    { icon: <IconWeekly size={18} />, tile: "var(--m-indigo)", title: t("m.page.weekly"), hint: t("m.more.weekly"), onClick: () => setPage("weekly") },
    { icon: <IconMail size={18} />, tile: "var(--m-blue)", title: t("app.mail"), hint: t("m.more.mail"), onClick: onMail },
    { icon: <IconReport size={18} />, tile: "var(--m-orange)", title: t("m.page.report"), hint: t("m.more.report"), onClick: () => setPage("report") },
    { icon: <IconLeaf size={18} />, tile: "var(--m-green)", title: t("m.page.reflection"), hint: t("m.more.reflection"), onClick: () => setPage("reflection") },
    { icon: <IconTree size={18} />, tile: "var(--m-teal)", title: t("m.page.products"), hint: t("m.more.products"), onClick: () => setPage("products") },
    { icon: <IconGear size={18} />, tile: "var(--m-grey)", title: t("m.page.settings"), hint: t("m.more.settings"), onClick: () => setPage("settings") },
  ];

  return (
    <div className="m-page">
      <button className="m-panel m-row" onClick={onMe}>
        {me ? (
          <Avatar name={me} large />
        ) : (
          <span className="m-row__icon">
            <IconUser size={18} />
          </span>
        )}
        <span className="m-row__main">
          <span className="m-row__title">{me || t("m.pickMe")}</span>
          <span className="m-row__hint" style={{ display: "block" }}>
            {t("m.meHint")}
          </span>
        </span>
        <IconChevron size={18} />
      </button>

      <div className="m-label" style={{ marginTop: 18 }}>
        {t("skin.appearance")}
      </div>
      <AppearanceControl />
      <BlurControl />

      <div className="m-panel m-list" style={{ marginTop: 18 }}>
        {rows.map((r) => (
          <button key={r.title} className="m-row" onClick={r.onClick}>
            <span className="m-row__icon" style={{ ["--tile" as string]: r.tile }}>
              {r.icon}
            </span>
            <span className="m-row__main">
              <span className="m-row__title">{r.title}</span>
              <span className="m-row__hint" style={{ display: "block" }}>
                {r.hint}
              </span>
            </span>
            <span className="m-row__end">
              <IconChevron size={18} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The weekly review, stacked: this week's wins from the board, then the five lists. */
function WeeklyPage({ board, send }: { board: Board; send: Send }) {
  const { t } = useT();
  const done = board.tasks.filter((tk) => tk.status === "DONE" && !isArchived(tk));
  const [confirm, setConfirm] = useState(false);
  const [showDone, setShowDone] = useState(false);

  return (
    <>
      <button className="m-panel m-row" onClick={() => setShowDone((v) => !v)}>
        <span className="m-row__icon" style={{ ["--tile" as string]: "var(--m-green)", fontWeight: 800 }}>
          {done.length}
        </span>
        <span className="m-row__main">
          <span className="m-row__title">{t("weekly.doneThisWeek")}</span>
          <span className="m-row__hint" style={{ display: "block" }}>
            {t("m.weeklyFromBoard")}
          </span>
        </span>
        <IconChevron size={18} className={showDone ? "rotate-90" : ""} />
      </button>
      {showDone && done.length > 0 && (
        <div className="m-panel m-list" style={{ marginTop: 8 }}>
          {done.map((tk) => (
            <div key={tk.id} className="m-row" style={{ minHeight: 0, padding: "10px 14px" }}>
              <Avatar name={tk.owner} />
              <span className="m-row__main" style={{ fontSize: 14 }}>
                {tk.title}
              </span>
              <span className="m-chip">{tk.priority}</span>
            </div>
          ))}
        </div>
      )}

      {WEEKLY_COLUMNS.map((col) => (
        <WeeklyBucket key={col.key} bucket={col.key} label={t(`m.weekly.${col.key}`)} items={board.weekly[col.key]} send={send} />
      ))}

      <div style={{ marginTop: 26 }}>
        {confirm ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="m-btn" style={{ flex: 1 }} onClick={() => setConfirm(false)}>
              {t("task.no")}
            </button>
            <button
              className="m-btn m-btn--danger"
              style={{ flex: 1.4 }}
              onClick={() => {
                send({ type: "weeklyClear" });
                setConfirm(false);
              }}
            >
              {t("m.clearYes")}
            </button>
          </div>
        ) : (
          <button className="m-btn m-btn--block" onClick={() => setConfirm(true)}>
            {t("weekly.clear")}
          </button>
        )}
      </div>
    </>
  );
}

function WeeklyBucket({
  bucket,
  label,
  items,
  send,
}: {
  bucket: keyof Weekly;
  label: string;
  items: { id: string; text: string }[];
  send: Send;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    send({ type: "weeklyAdd", column: bucket, item: { id: genId(), text: v } });
    setDraft("");
  };
  return (
    <>
      <h2 className="m-h2">
        {label} <span className="m-count">{items.length}</span>
      </h2>
      <div className="m-panel m-list">
        {items.map((it) => (
          <div key={it.id} className="m-sub-row" style={{ alignItems: "center" }}>
            <WeeklyItemField
              text={it.text}
              onSave={(v) => send({ type: "weeklyUpdate", column: bucket, id: it.id, text: v })}
              className="m-sub-row__text"
            />
            <button
              className="m-hit"
              aria-label={t("m.delete")}
              onClick={() => send({ type: "weeklyDelete", column: bucket, id: it.id })}
            >
              <IconClose size={16} />
            </button>
          </div>
        ))}
        <div className="m-sub-row" style={{ alignItems: "center" }}>
          <input
            className="m-sub-row__text"
            style={{ background: "transparent", border: 0, outline: "none", color: "var(--m-text)", fontSize: 16 }}
            placeholder={t("weekly.add")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            enterKeyHint="done"
          />
          {draft.trim() && (
            <button style={{ color: "var(--m-gold)", fontWeight: 700, fontSize: 14 }} onClick={add}>
              {t("m.add")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** Who you are on this device, language, light/dark, and the desktop layout. */
export function MeSheet({
  members,
  onClose,
  setLayout,
}: {
  members: string[];
  onClose: () => void;
  setLayout: (c: LayoutChoice) => void;
}) {
  const { t, lang, setLang } = useT();
  const { me, setMe } = useMe();

  return (
    <Sheet title={t("m.me")} onClose={onClose}>
      <div className="m-label">{t("m.whoAmI")}</div>
      <div className="m-choices">
        {members.map((m) => (
          <button key={m} className="m-choice" aria-pressed={me === m} onClick={() => setMe(m)}>
            <Avatar name={m} /> {m}
          </button>
        ))}
      </div>
      <p className="m-sub" style={{ marginTop: 8 }}>
        {t("m.whoAmIHint")}
      </p>

      <div className="m-field">
        <span className="m-label">{t("m.language")}</span>
        <div className="m-seg">
          <button aria-pressed={lang === "it"} onClick={() => setLang("it")}>
            Italiano
          </button>
          <button aria-pressed={lang === "en"} onClick={() => setLang("en")}>
            English
          </button>
        </div>
      </div>

      <div className="m-field">
        <span className="m-label">{t("skin.appearance")}</span>
        <AppearanceControl />
      <BlurControl />
      </div>

      <InstallRow />

      <button className="m-btn m-btn--block" style={{ marginTop: 12 }} onClick={() => setLayout("desktop")}>
        <IconDesktop size={18} /> {t("m.useDesktop")}
      </button>
    </Sheet>
  );
}

/** "Install the app": the browser's prompt where there is one, a hint on iOS. */
function InstallRow() {
  const { t } = useT();
  const install = useInstall();
  const [hint, setHint] = useState(false);
  if (install.installed || (!install.canPrompt && !install.iosHint)) return null;
  return (
    <div style={{ marginTop: 22 }}>
      <button
        className="m-btn m-btn--primary m-btn--block"
        onClick={() => (install.canPrompt ? void install.prompt() : setHint((v) => !v))}
      >
        <IconDownload size={18} /> {t("m.install")}
      </button>
      {hint && (
        <div className="m-panel" style={{ marginTop: 10, padding: "12px 14px", fontSize: 14, lineHeight: 1.45 }}>
          {t("m.installIos")}
        </div>
      )}
    </div>
  );
}

/**
 * Dark, light, or automatic (follows the phone's own setting, live). Picking
 * one also turns the Liquid Glass skin on, which is what the phone layout is
 * designed for. Shared with the desktop's ☀ / ☾ / A control on this device.
 */
function AppearanceControl() {
  const { t } = useT();
  const [choice, setChoice] = useState<AppearanceChoice>(() =>
    readSkin() === "glass" ? readAppearanceChoice() : "light"
  );
  const pick = (c: AppearanceChoice) => {
    writeSkin("glass");
    writeAppearance(c);
    setChoice(c);
  };
  return (
    <div className="m-seg" role="group" aria-label={t("skin.appearance")}>
      <button aria-pressed={choice === "dark"} onClick={() => pick("dark")}>
        <IconMoon size={16} /> {t("skin.dark")}
      </button>
      <button aria-pressed={choice === "light"} onClick={() => pick("light")}>
        <IconSun size={16} /> {t("skin.light")}
      </button>
      <button aria-pressed={choice === "auto"} onClick={() => pick("auto")}>
        <IconAuto size={16} /> {t("m.auto")}
      </button>
    </div>
  );
}

/** Glass blur on/off (same as the desktop toggle). */
function BlurControl() {
  const { t } = useT();
  const [on, setOn] = useState<boolean>(() => readBlur());
  const pick = (v: boolean) => {
    writeBlur(v);
    setOn(v);
  };
  return (
    <div style={{ marginTop: 10 }}>
      <div className="m-row__hint" style={{ margin: "0 4px 6px" }}>{t("skin.blur")}</div>
      <div className="m-seg" role="group" aria-label={t("skin.blur")}>
        <button aria-pressed={on} onClick={() => pick(true)}>{t("m.on")}</button>
        <button aria-pressed={!on} onClick={() => pick(false)}>{t("m.off")}</button>
      </div>
    </div>
  );
}
