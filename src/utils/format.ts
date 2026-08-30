const nf = new Intl.NumberFormat("fa-IR");
const nf1 = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

export function faNum(n: number): string {
  return nf.format(Math.round(n));
}

export function faNum1(n: number): string {
  return nf1.format(n);
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

export function toLocalInput(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export function fromLocalInput(s: string): number {
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : Date.now();
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
