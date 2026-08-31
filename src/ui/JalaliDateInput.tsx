/**
 * انتخابگر تاریخ جلالی — جایگزین کامل input[type=date] میلادی مرورگر
 * هفته از شنبه؛ نام ماه‌های فارسی؛ روز ناموجود اصلاً قابل انتخاب نیست؛
 * پیمایش ماه/سال؛ کلید Escape و کلیک بیرون، تقویم را می‌بندند.
 */
import { useEffect, useRef, useState } from "react";
import {
  faNum,
  JALALI_MONTHS,
  JALALI_WEEKDAYS_SHORT,
  jalaliInputString,
  jalaliMonthLength,
  jalaliParts,
  jalaliToTime,
  startOfDay,
} from "../utils/format";
import { IconArrowLeft, IconArrowRight } from "./icons";

export default function JalaliDateInput({
  value,
  onChange,
  invalid,
  compact,
}: {
  value: number | null;
  onChange: (ts: number) => void;
  invalid?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => jalaliParts(value ?? Date.now()));
  const wrapRef = useRef<HTMLDivElement>(null);

  /* با بازشدن، نمای تقویم روی ماهِ مقدار فعلی قفل می‌شود */
  useEffect(() => {
    if (open) setView(jalaliParts(value ?? Date.now()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const moveMonth = (n: number) => {
    let jy = view.jy;
    let jm = view.jm + n;
    while (jm < 1) {
      jm += 12;
      jy -= 1;
    }
    while (jm > 12) {
      jm -= 12;
      jy += 1;
    }
    setView({ jy, jm, jd: 1 });
  };

  const monthStartTs = jalaliToTime(view.jy, view.jm, 1);
  /* فاصله اولین روز ماه از خانه نخست — شنبه = ۰ */
  const offset = (new Date(monthStartTs).getDay() + 1) % 7;
  const len = jalaliMonthLength(view.jy, view.jm);
  const todayP = jalaliParts(startOfDay(Date.now()));
  const selP = value ? jalaliParts(startOfDay(value)) : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inp num cursor-pointer text-center text-sm font-bold transition-colors hover:border-brand ${
          compact ? "w-32" : "w-36"
        } ${invalid ? "border-danger ring-2 ring-danger/20" : ""} ${
          value ? "text-ink" : "text-inkmute"
        }`}
      >
        {value ? jalaliInputString(value) : "انتخاب تاریخ"}
      </button>

      {open && (
        <div className="anim-pop absolute start-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-pop)]">
          {/* سربرگ ماه و سال */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="cursor-pointer rounded-lg p-1.5 text-inksoft transition-colors hover:bg-brandsoft hover:text-branddeep"
              aria-label="ماه قبل"
              title="ماه قبل"
            >
              <IconArrowRight size={15} />
            </button>
            <div className="text-center">
              <p className="font-display text-base leading-5 text-ink">
                {JALALI_MONTHS[view.jm - 1]}
              </p>
              <p className="num text-[11px] font-bold text-inkmute">{faNum(view.jy)}</p>
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="cursor-pointer rounded-lg p-1.5 text-inksoft transition-colors hover:bg-brandsoft hover:text-branddeep"
              aria-label="ماه بعد"
              title="ماه بعد"
            >
              <IconArrowLeft size={15} />
            </button>
          </div>

          {/* شبکه روزها — راست‌به‌چپ با شنبه در نخستین ستون */}
          <div className="mt-2.5 grid grid-cols-7 gap-1 text-center">
            {JALALI_WEEKDAYS_SHORT.map((w) => (
              <span key={w} className="py-1 text-[10px] font-extrabold text-inkmute">
                {w}
              </span>
            ))}
            {Array.from({ length: offset }).map((_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: len }).map((_, i) => {
              const d = i + 1;
              const isSel =
                !!selP && selP.jy === view.jy && selP.jm === view.jm && selP.jd === d;
              const isToday =
                todayP.jy === view.jy && todayP.jm === view.jm && todayP.jd === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    onChange(jalaliToTime(view.jy, view.jm, d));
                    setOpen(false);
                  }}
                  className={`num aspect-square cursor-pointer rounded-lg text-xs font-bold transition-all duration-100 active:scale-90 ${
                    isSel
                      ? "bg-brand text-white shadow-[0_3px_10px_rgba(255,138,0,0.4)]"
                      : isToday
                        ? "bg-brandsoft text-branddeep ring-1 ring-brand/40"
                        : "text-ink hover:bg-black/5"
                  }`}
                >
                  {faNum(d)}
                </button>
              );
            })}
          </div>

          {/* پانوشت: میانبر امروز + تاریخ اول ماه جاری */}
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(startOfDay(Date.now()));
                setOpen(false);
              }}
              className="cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold text-branddeep transition-colors hover:bg-brandsoft"
            >
              امروز
            </button>
            <span className="num text-[10px] font-bold text-inkmute">
              {jalaliInputString(monthStartTs)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
