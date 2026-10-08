import { useEffect, useState } from "react";
import { useT } from "../lib/i18n";
import { loadMenu, upcomingMenu, type Menu } from "../lib/menu";
import { toISODate, weekdayDate } from "../lib/dates";

// BOARD → the canteen menu, a full-width collapsible bar below Archived.
// Shows today and the next menu days (past days never), from
// src/data/menu.json — updated monthly with menu/menu_from_pdf.py.

const DAYS_SHOWN = 5;

export function MenuBar() {
  const { t, lang } = useT();
  const [open, setOpen] = useState(true);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    loadMenu().then((m) => {
      if (!alive) return;
      setMenu(m);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const today = toISODate(new Date());
  const days = upcomingMenu(menu, today).slice(0, DAYS_SHOWN);
  const todayDish = days[0]?.date === today ? days[0].courses.find((c) => c.course === "daily")?.items[0]?.name : undefined;

  return (
    <div className="bg-[#EFECE6] rounded-[14px] border border-[#E3DFD7] p-3">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2 text-left">
        <span className={`text-[#8A8A8A] text-[11px] transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        <span className="font-trajan text-[11px] uppercase tracking-widest text-[#8A8A8A]">{t("menuBar.title")}</span>
        <span className="text-[11px] font-semibold text-[#8A8A8A] bg-white rounded-full px-2 py-0.5 border border-[#E8E6E1]">
          {days.length}
        </span>
        <span className="text-[10px] text-[#A8A29E] ml-1 hidden sm:inline truncate">
          {todayDish ? `${t("menuBar.today")}: ${todayDish}` : t("menuBar.hint")}
        </span>
      </button>
      {open && (
        <div className="mt-3">
          {days.length === 0 ? (
            <div className="text-[12px] text-[#A8A29E] py-2">{loaded ? t("menuBar.none") : "…"}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
              {days.map((day) => {
                const isToday = day.date === today;
                return (
                  <div
                    key={day.date}
                    className={`rounded-[12px] bg-white border p-3 ${isToday ? "border-[#C9A96E] shadow-sm" : "border-[#E8E6E1]"}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[13px] font-semibold text-[#0A1931]">{weekdayDate(day.date, lang)}</span>
                      {isToday && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8B6F3E] bg-[#FBF6EC] rounded-full px-2 py-0.5">
                          {t("menuBar.today")}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {day.courses.map((c) => (
                        <div key={c.course}>
                          <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[#8B6F3E]">
                            {t(`menuBar.course.${c.course}`)}
                          </div>
                          <ul className="mt-0.5 space-y-0.5">
                            {c.items.map((dish, i) => (
                              <li key={i} className="text-[12px] leading-snug text-[#0A1931]">
                                {dish.name}
                                {dish.allergens.length > 0 && (
                                  <span className="ml-1 text-[9.5px] font-semibold text-[#A8A29E]">{dish.allergens.join("-")}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
