const nf = new Intl.NumberFormat("fa-IR");

export function faNum(n: number): string {
  return nf.format(Math.round(n));
}

export function money(n: number): string {
  return `${faNum(n)} تومان`;
}

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
  );
}

const dFmt = new Intl.DateTimeFormat("fa-IR", {
  day: "numeric",
  month: "long",
});
const dFull = new Intl.DateTimeFormat("fa-IR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const tFmt = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
});
const dtFmt = new Intl.DateTimeFormat("fa-IR", {
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const weekdayFmt = new Intl.DateTimeFormat("fa-IR", { weekday: "long" });

export function fmtDate(ts: number): string {
  return dFmt.format(new Date(ts));
}
export function fmtDateFull(ts: number): string {
  return dFull.format(new Date(ts));
}
export function fmtTime(ts: number): string {
  return tFmt.format(new Date(ts));
}
export function fmtDateTime(ts: number): string {
  return dtFmt.format(new Date(ts));
}
export function fmtWeekday(ts: number): string {
  return weekdayFmt.format(new Date(ts));
}

export interface Countdown {
  label: string;
  overdue: boolean;
  minutes: number;
}

export function countdown(target: number, now: number): Countdown {
  const diff = target - now;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const span =
    h > 0 ? `${faNum(h)} ساعت و ${faNum(m)} دقیقه` : `${faNum(m)} دقیقه`;
  if (diff < 0) {
    return { label: `${span} تأخیر`, overdue: true, minutes: -mins };
  }
  return { label: `${span} مانده`, overdue: false, minutes: mins };
}

export function durationLabel(hours: number): string {
  if (hours >= 24 && hours % 24 === 0)
    return hours === 24 ? "تمام‌روز" : `${faNum(hours / 24)} روزه`;
  return `${faNum(hours)} ساعته`;
}

/** نام فارسی روش پرداخت بر اساس نوع حساب */
export function accountKindLabel(kind: string): string {
  if (kind === "POS") return "کارت‌خوان";
  if (kind === "CASH") return "نقدی";
  if (kind === "TRANSFER") return "کارت به کارت";
  return kind;
}

/** قالب «X دقیقه باقی مانده / X دقیقه دیرکرد» با اعداد فارسی */
export function minutesWords(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${faNum(m)} دقیقه`;
  if (m === 0) return `${faNum(h)} ساعت`;
  return `${faNum(h)} ساعت و ${faNum(m)} دقیقه`;
}

export function isSameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/* ------------------------- تاریخ جلالی (عددهای لاتین) ------------------------- */

const jalaliDateFmt = new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const jalaliTimeFmt = new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const jalaliMonthFmt = new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
  year: "numeric",
  month: "2-digit",
});

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value ?? "00";
}

/** 1405-06-31 — برای نام فایل پشتیبان */
export function jalaliStamp(ts: number): string {
  const d = new Date(ts);
  const dp = jalaliDateFmt.formatToParts(d);
  const tp = jalaliTimeFmt.formatToParts(d);
  return `${part(dp, "year")}-${part(dp, "month")}-${part(dp, "day")}-${part(tp, "hour")}-${part(tp, "minute")}`;
}

/** 1405/06/31 */
export function jalaliDate(ts: number): string {
  const dp = jalaliDateFmt.formatToParts(new Date(ts));
  return `${part(dp, "year")}/${part(dp, "month")}/${part(dp, "day")}`;
}

/** کلید سال/ماه جلالی — برای محاسبه مرز ماه‌ها */
export function jalaliMonthKey(ts: number): string {
  const mp = jalaliMonthFmt.formatToParts(new Date(ts));
  return `${part(mp, "year")}/${part(mp, "month")}`;
}

/* ------------------- اعتبارسنجی بازه دلخواه گزارش (L2) ------------------- */

const DAY_MS = 86_400_000;

export interface RangeValidation {
  ok: boolean;
  /** شروع روز «از» — نیمه‌شب */
  start: number;
  /** پایان روز «تا» — نیمه‌شبِ بعد (بازه نیمه‌باز [start, end)) */
  end: number;
  reason: string;
  /** کدام ورودی نامعتبر است — برای نمایش بصری */
  field: "from" | "to" | null;
}

/**
 * تبدیل مقدار input[type=date] به زمان دقیق نیمه‌شب محلی.
 * تاریخ‌های غیرممکن (مثل 2024-02-30 که جاوااسکریپت به ۱ اسفند می‌غلتاند) رد می‌شوند.
 */
export function parseDateInput(str: string): number | null {
  const s = str.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = new Date(`${s}T00:00`).getTime();
  if (!Number.isFinite(t)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(t);
  if (dt.getFullYear() !== y || dt.getMonth() + 1 !== m || dt.getDate() !== d) {
    return null;
  }
  return t;
}

/** بازه دلخواه — هیچ بازه نامعتبری بی‌صدا با «امروز» جایگزین نمی‌شود */
export function validateCustomRange(fromStr: string, toStr: string): RangeValidation {
  const bad = (reason: string, field: "from" | "to" | null): RangeValidation => ({
    ok: false,
    start: 0,
    end: 0,
    reason,
    field,
  });
  if (!fromStr) return bad("تاریخ شروع وارد نشده است.", "from");
  if (!toStr) return bad("تاریخ پایان وارد نشده است.", "to");
  const start = parseDateInput(fromStr);
  if (start === null) return bad("تاریخ شروع نامعتبر است.", "from");
  const to = parseDateInput(toStr);
  if (to === null) return bad("تاریخ پایان نامعتبر است.", "to");
  if (start > to) return bad("تاریخ شروع بعد از تاریخ پایان است.", "from");
  return { ok: true, start, end: to + DAY_MS, reason: "", field: null };
}
