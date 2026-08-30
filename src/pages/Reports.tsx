import { useMemo, useState } from "react";
import { reportService } from "../services/reportService";
import { STATUS_LABEL } from "../services/rentalService";
import { useDB } from "../storage/storage";
import { faNum, fmtDateFull, fmtDateTime, money, startOfDay } from "../utils/format";
import { Badge, Empty } from "../ui/kit";
import { IconChart, IconClock } from "../ui/icons";

type Preset = "today" | "yesterday" | "7d" | "month" | "custom";

function toInput(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function Reports() {
  const db = useDB();
  const [preset, setPreset] = useState<Preset>("today");
  const [fromStr, setFromStr] = useState(() => toInput(startOfDay(Date.now()) - 6 * 86_400_000));
  const [toStr, setToStr] = useState(() => toInput(Date.now()));

  const [start, end] = useMemo((): [number, number] => {
    switch (preset) {
      case "today":
        return reportService.todayRange();
      case "yesterday":
        return reportService.yesterdayRange();
      case "7d":
        return reportService.last7Range();
      case "month":
        return reportService.thisMonthRange();
      case "custom": {
        const s = new Date(fromStr + "T00:00").getTime();
        const e = new Date(toStr + "T23:59").getTime() + 59_000;
        if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return reportService.todayRange();
        return [s, e];
      }
    }
  }, [preset, fromStr, toStr]);

  const rep = useMemo(() => reportService.build(db, start, end), [db, start, end]);
  const maxRev = Math.max(1, ...rep.daily.map((d) => d.revenue));

  const tiles: Array<{ label: string; value: string; tone?: "ok" | "danger" | "warn" | "brand" }> = [
    { label: "درآمد اجاره", value: money(rep.revenue), tone: "ok" },
    { label: "تعداد اجاره", value: faNum(rep.rentalCount), tone: "brand" },
    { label: "تکمیل‌شده", value: faNum(rep.completedCount) },
    { label: "لغوشده", value: faNum(rep.cancelledCount), tone: "danger" },
    { label: "جریمه تأخیر", value: money(rep.lateFees), tone: "warn" },
    { label: "تخفیفها", value: money(rep.discounts) },
    { label: "هزینه‌ها", value: money(rep.expenses), tone: "danger" },
    { label: "خالص (درآمد − هزینه)", value: money(rep.net), tone: rep.net >= 0 ? "ok" : "danger" },
  ];

  return (
    <div className="space-y-4">
      <div className="anim-up card flex flex-wrap items-center gap-2 p-3.5">
        <div className="flex rounded-xl border border-linedeep p-1">
          {(
            [
              ["today", "امروز"],
              ["yesterday", "دیروز"],
              ["7d", "۷ روز"],
              ["month", "این ماه"],
              ["custom", "سفارشی"],
            ] as Array<[Preset, string]>
          ).map(([p, label]) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                preset === p ? "bg-coal text-white" : "text-inksoft hover:bg-black/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="anim-pop flex items-center gap-2">
            <input type="date" className="inp num w-36" dir="ltr" value={fromStr} onChange={(e) => setFromStr(e.target.value)} />
            <span className="text-xs text-inkmute">تا</span>
            <input type="date" className="inp num w-36" dir="ltr" value={toStr} onChange={(e) => setToStr(e.target.value)} />
          </div>
        )}
        <span className="ms-auto text-[11px] font-bold text-inkmute">
          {fmtDateFull(start)} تا {fmtDateFull(end - 1)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.label} className="anim-up card p-3.5" style={{ animationDelay: `${i * 40}ms` }}>
            <p className="text-[11px] font-bold text-inkmute">{t.label}</p>
            <p
              className={`num mt-1.5 font-display text-xl ${
                t.tone === "ok" ? "text-ok" : t.tone === "danger" ? "text-danger" : t.tone === "warn" ? "text-warn" : t.tone === "brand" ? "text-branddeep" : "text-ink"
              }`}
            >
              {t.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-12">
        {/* روند روزانه */}
        <section className="anim-up xl:col-span-5 card p-4">
          <h3 className="flex items-center gap-2 font-display text-base text-ink">
            <IconChart size={17} className="text-branddeep" />
            روند درآمد روزانه
          </h3>
          <div className="mt-4 flex h-40 items-end gap-1.5">
            {rep.daily.map((d) => (
              <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${money(d.revenue)}`}>
                <span className="num text-[9px] font-bold text-inkmute opacity-0 transition-opacity group-hover:opacity-100">
                  {d.revenue > 0 ? faNum(Math.round(d.revenue / 1000)) + "ه" : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-brand/80 transition-all duration-300 group-hover:bg-brand"
                  style={{ height: `${Math.max(3, (d.revenue / maxRev) * 100)}%` }}
                />
                <span className="num text-[9px] text-inkmute">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
            <div>
              <p className="num font-display text-lg text-ink">{faNum(rep.rentalCount)}</p>
              <p className="text-[10px] font-bold text-inkmute">اجاره ثبت‌شده</p>
            </div>
            <div>
              <p className="num font-display text-lg text-ink">{faNum(rep.activeNow)}</p>
              <p className="text-[10px] font-bold text-inkmute">در جریان (الان)</p>
            </div>
            <div>
              <p className="num font-display text-lg text-ink">{faNum(rep.settledCount)}</p>
              <p className="text-[10px] font-bold text-inkmute">تسویه‌شده در بازه</p>
            </div>
          </div>
        </section>

        {/* عملکرد دسته‌ها */}
        <section className="anim-up xl:col-span-4 card p-4" style={{ animationDelay: "60ms" }}>
          <h3 className="font-display text-base text-ink">عملکرد دسته‌ها</h3>
          {rep.byCategory.length === 0 ? (
            <Empty icon={<IconChart size={24} />} text="در این بازه اجاره‌ای نیست" />
          ) : (
            <ul className="mt-3 space-y-3">
              {rep.byCategory.map((c) => {
                const max = Math.max(1, ...rep.byCategory.map((x) => x.revenue));
                return (
                  <li key={c.code}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-extrabold text-ink">
                        <span className="grid size-6 place-items-center rounded-md bg-coal font-display text-[11px] text-white">{c.code}</span>
                        {c.name}
                        <span className="num text-[10px] font-bold text-inkmute">{faNum(c.units)} دستگاه-اجاره</span>
                      </span>
                      <span className="num font-bold text-inksoft">{money(c.revenue)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/5">
                      <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${(c.revenue / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="mt-5 border-t border-line pt-4 font-display text-base text-ink">مشتریان برتر</h3>
          {rep.topCustomers.length === 0 ? (
            <p className="mt-2 text-xs text-inkmute">پرداختی در این بازه نیست</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {rep.topCustomers.map((c, i) => (
                <li key={c.id} className="flex items-center gap-2.5 rounded-xl bg-black/[0.03] px-3 py-2">
                  <span className={`grid size-7 place-items-center rounded-full font-display text-xs ${i === 0 ? "bg-brand text-white" : "bg-black/10 text-inksoft"}`}>
                    {faNum(i + 1)}
                  </span>
                  <span className="flex-1 text-xs font-extrabold text-ink">{c.name}</span>
                  <span className="num text-[11px] text-inkmute">{faNum(c.count)} اجاره</span>
                  <span className="num text-xs font-bold text-ok">{money(c.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* اجاره‌های بازه */}
        <section className="anim-up xl:col-span-3 card overflow-hidden" style={{ animationDelay: "120ms" }}>
          <div className="border-b border-line px-4 py-3">
            <h3 className="font-display text-base text-ink">اجاره‌های بازه</h3>
          </div>
          {rep.recentRentals.length === 0 ? (
            <Empty icon={<IconClock size={24} />} text="موردی نیست" />
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {rep.recentRentals.map((r) => (
                <li key={r.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="num font-display text-xs text-inksoft">#{faNum(r.number)}</span>
                    <Badge tone={r.status === "CANCELLED" ? "danger" : r.status === "SETTLED" || r.status === "COMPLETED" ? "ok" : "brand"}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs font-bold text-ink">
                    {db.customers.find((c) => c.id === r.customerId)?.name}
                    <span className="ms-1.5 font-normal text-inkmute">{r.items.map((i) => `${faNum(i.qty)}×${i.name}`).join("+")}</span>
                  </p>
                  <div className="num mt-0.5 flex items-center justify-between text-[10px] text-inkmute">
                    <span>{fmtDateTime(r.createdAt)}</span>
                    <span className="font-bold text-ink">{money(r.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
