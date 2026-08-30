import { navigate, useAuth, useNow } from "../state/app";
import { availabilityService } from "../services/availabilityService";
import { STATUS_LABEL } from "../services/rentalService";
import { useDB } from "../storage/storage";
import { countdown, faNum, fmtTime, isSameDay, money } from "../utils/format";
import { Badge, Btn, Empty } from "../ui/kit";
import {
  IconArrowLeft,
  IconBike,
  IconCash,
  IconClock,
  IconReturn,
  IconUsers,
} from "../ui/icons";

function greeting(hour: number): string {
  if (hour < 5) return "شب‌زنده‌داری بخیر";
  if (hour < 12) return "صبح بخیر";
  if (hour < 17) return "ظهر بخیر";
  if (hour < 21) return "عصر بخیر";
  return "شب بخیر";
}

export default function Dashboard() {
  const db = useDB();
  const { user } = useAuth();
  const now = useNow(15_000);

  const availability = availabilityService.snapshot(db, now);
  const rentedUnits = db.bikes.filter((b) => b.status === "RENTED").length;
  const maintUnits = db.bikes.filter((b) => b.status === "MAINTENANCE").length;
  const outUnits = db.bikes.filter((b) => b.status === "OUT_OF_SERVICE").length;

  const activeRentals = db.rentals.filter(
    (r) => r.status === "ACTIVE" || r.status === "PARTIAL"
  );
  const todayRentals = db.rentals.filter((r) => isSameDay(r.createdAt, now));
  const nextDue = activeRentals
    .slice()
    .sort((a, b) => a.plannedEndAt - b.plannedEndAt)[0];

  const hour = new Date(now).getHours();

  return (
    <div className="space-y-4">
      {/* ردیف اصلی: CTA + موجودی لحظه‌ای */}
      <div className="grid gap-4 xl:grid-cols-12">
        <button
          onClick={() => navigate("rental")}
          className="anim-up group relative xl:col-span-3 overflow-hidden rounded-2xl bg-brand p-5 text-start text-white shadow-[0_10px_30px_rgba(255,138,0,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-branddeep cursor-pointer"
        >
          <div
            className="pointer-events-none absolute -left-10 -top-10 size-40 rounded-full opacity-25 transition-transform duration-300 group-hover:scale-125"
            style={{ background: "radial-gradient(circle, #fff 0%, transparent 60%)" }}
          />
          <span className="grid size-14 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <IconBike size={34} />
          </span>
          <h2 className="mt-4 font-display text-3xl leading-9">اجاره دوچرخه</h2>
          <p className="mt-1 text-sm text-white/85">شروع اجاره جدید</p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-white/90">
            ورود به پیشخوان اجاره
            <IconArrowLeft size={15} className="transition-transform duration-200 group-hover:-translate-x-1" />
          </span>
        </button>

        <div className="xl:col-span-9">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-inksoft">
              دوچرخه‌های آماده — همین لحظه
            </h2>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-ok">
              <span className="dot-live inline-block size-2 rounded-full bg-ok" />
              به‌روزرسانی زنده
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {availability.map((a, i) => (
              <button
                key={a.category.id}
                onClick={() => navigate(`rental?cat=${a.category.code}`)}
                disabled={a.available === 0}
                style={{ animationDelay: `${i * 55}ms` }}
                className={`anim-up card group relative cursor-pointer p-3.5 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_8px_24px_rgba(30,30,25,0.1)] disabled:cursor-not-allowed disabled:opacity-70 ${
                  a.available === 0 ? "border-danger/30" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-lg bg-coal font-display text-lg text-white">
                    {a.category.code}
                  </span>
                  {a.available > 0 ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-ok">
                      <span className="dot-live size-1.5 rounded-full bg-ok" />
                      موجود
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-danger">ناموجود</span>
                  )}
                </div>
                <p className="num mt-2 font-display text-4xl leading-none text-ink">
                  {faNum(a.available)}
                </p>
                <p className="mt-1.5 text-xs font-bold text-inksoft">
                  {a.category.name}
                  <span className="ms-1 font-normal text-inkmute">
                    — {faNum(a.available)} موجود
                  </span>
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ردیف دوم: آمار فشرده + در جریان‌ها */}
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="anim-up card p-4">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl bg-brandsoft text-branddeep">
                  <IconBike size={20} />
                </span>
                <span className="text-[11px] font-bold text-inkmute">دستگاه</span>
              </div>
              <p className="num mt-2 font-display text-3xl text-ink">{faNum(rentedUnits)}</p>
              <p className="text-xs font-bold text-inksoft">در حال رکاب</p>
            </div>
            <div className="anim-up card p-4" style={{ animationDelay: "60ms" }}>
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-xl bg-oksoft text-ok">
                  <IconUsers size={20} />
                </span>
                <span className="text-[11px] font-bold text-inkmute">اجاره</span>
              </div>
              <p className="num mt-2 font-display text-3xl text-ink">{faNum(todayRentals.length)}</p>
              <p className="text-xs font-bold text-inksoft">اجاره‌های امروز</p>
            </div>
          </div>

          {nextDue ? (
            <button
              onClick={() => navigate(`returns?id=${nextDue.id}`)}
              className="anim-up card block w-full cursor-pointer p-4 text-start transition-all hover:border-brand"
              style={{ animationDelay: "100ms" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-inksoft">نزدیک‌ترین سررسید</p>
                <IconClock size={16} className="text-inkmute" />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold text-ink">
                    #{faNum(nextDue.number)} — {customerName(db, nextDue.customerId)}
                  </p>
                  <p className="num mt-0.5 text-[11px] text-inkmute">
                    سررسید {fmtTime(nextDue.plannedEndAt)}
                  </p>
                </div>
                {(() => {
                  const cd = countdown(nextDue.plannedEndAt, now);
                  return (
                    <Badge tone={cd.overdue ? "danger" : cd.minutes < 30 ? "warn" : "ok"}>
                      {cd.label}
                    </Badge>
                  );
                })()}
              </div>
            </button>
          ) : (
            <div className="anim-up card p-4 text-center text-xs font-bold text-inkmute">
              هیچ اجاره‌ای در جریان نیست — خیال راحت!
            </div>
          )}

          <div className="anim-up card p-4" style={{ animationDelay: "140ms" }}>
            <p className="text-xs font-bold text-inksoft">وضعیت ناوگان</p>
            <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-black/5">
              {rentedUnits > 0 && (
                <span className="bg-brand" style={{ width: `${(rentedUnits / Math.max(1, db.bikes.length)) * 100}%` }} />
              )}
              {maintUnits > 0 && (
                <span className="bg-warn" style={{ width: `${(maintUnits / Math.max(1, db.bikes.length)) * 100}%` }} />
              )}
              {outUnits > 0 && (
                <span className="bg-inkmute" style={{ width: `${(outUnits / Math.max(1, db.bikes.length)) * 100}%` }} />
              )}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-inksoft">
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-brand" /> در اجاره {faNum(rentedUnits)}</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-warn" /> تعمیر {faNum(maintUnits)}</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-inkmute" /> خارج {faNum(outUnits)}</span>
              <button onClick={() => navigate("bikes")} className="ms-auto cursor-pointer text-branddeep hover:underline">
                جزئیات دوچرخه‌ها
              </button>
            </div>
          </div>
        </div>

        <div className="anim-up xl:col-span-8 card overflow-hidden" style={{ animationDelay: "80ms" }}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="font-display text-lg text-ink">اجاره‌های در جریان</h3>
            <Badge tone="brand">{faNum(activeRentals.length)} مورد</Badge>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {activeRentals.length === 0 ? (
              <Empty icon={<IconReturn size={26} />} text="اجاره فعالی نیست" sub="با «اجاره دوچرخه» اولین رکاب‌سوار امروز را ثبت کنید" />
            ) : (
              <ul className="divide-y divide-line">
                {activeRentals.map((r) => {
                  const cd = countdown(r.plannedEndAt, now);
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02]">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-coal font-display text-sm text-white">
                        {faNum(r.number)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-ink">
                          {customerName(db, r.customerId)}
                          <span className="ms-2 text-[11px] font-bold text-inkmute">
                            {r.items.map((i) => `${faNum(i.qty - i.returnedQty)}×${i.name}`).join(" + ")}
                          </span>
                        </p>
                        <p className="num mt-0.5 text-[11px] text-inkmute">
                          شروع {fmtTime(r.startAt)} — سررسید {fmtTime(r.plannedEndAt)}
                        </p>
                      </div>
                      <Badge tone={cd.overdue ? "danger" : cd.minutes < 30 ? "warn" : "neutral"} className={cd.overdue ? "dot-warn" : ""}>
                        {cd.label}
                      </Badge>
                      <Btn size="sm" variant="dark" onClick={() => navigate(`returns?id=${r.id}`)}>
                        <IconReturn size={14} />
                        برگشت
                      </Btn>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ردیف سوم: امروز */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="anim-up card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="font-display text-lg text-ink">اجاره‌های امروز</h3>
            <Badge tone="neutral">{faNum(todayRentals.length)} اجاره</Badge>
          </div>
          {todayRentals.length === 0 ? (
            <Empty icon={<IconClock size={26} />} text="هنوز اجاره‌ای ثبت نشده" />
          ) : (
            <ul className="max-h-56 divide-y divide-line overflow-y-auto">
              {todayRentals.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="num w-14 font-display text-sm text-inksoft">#{faNum(r.number)}</span>
                  <span className="flex-1 truncate text-sm font-bold text-ink">
                    {customerName(db, r.customerId)}
                    <span className="ms-2 text-[11px] font-normal text-inkmute">
                      {r.items.map((i) => `${faNum(i.qty)}×${i.name}`).join(" + ")}
                    </span>
                  </span>
                  <span className="num text-xs font-bold text-inksoft">{money(r.total)}</span>
                  <Badge tone={r.status === "CANCELLED" ? "danger" : r.status === "SETTLED" ? "ok" : r.status === "COMPLETED" ? "ok" : "brand"}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="anim-up card overflow-hidden" style={{ animationDelay: "60ms" }}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="font-display text-lg text-ink">دریافتی‌های امروز</h3>
            <IconCash size={18} className="text-inkmute" />
          </div>
          <TodayMoney />
        </div>
      </div>
    </div>
  );
}

function customerName(db: ReturnType<typeof useDB>, id: string): string {
  return db.customers.find((c) => c.id === id)?.name ?? "مشتری حذف‌شده";
}

function TodayMoney() {
  const db = useDB();
  const now = useNow(30_000);
  const pays = db.payments.filter((p) => isSameDay(p.createdAt, now));
  const rent = pays
    .filter((p) => p.kind === "RENT" || p.kind === "CORRECTION" || p.kind === "DEPOSIT_APPLY")
    .reduce((s, p) => s + p.amount, 0);
  const count = pays.filter((p) => p.kind === "RENT").length;

  return (
    <div className="p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-bold text-inkmute">درآمد اجاره امروز</p>
          <p className="num mt-1 font-display text-3xl text-ink">{money(rent)}</p>
        </div>
        <div className="text-end">
          <p className="text-[11px] font-bold text-inkmute">اسناد دریافت امروز</p>
          <p className="num mt-1 text-sm font-extrabold text-inksoft">{faNum(count)} سند</p>
        </div>
      </div>
      <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto">
        {pays.length === 0 ? (
          <li className="py-2 text-center text-xs font-bold text-inkmute">امروز دریافتی ثبت نشده</li>
        ) : (
          pays.slice(0, 6).map((p) => {
            const r = db.rentals.find((x) => x.id === p.rentalId);
            return (
              <li key={p.id} className="flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-1.5 text-xs">
                <span className="font-bold text-inksoft">
                  #{r ? faNum(r.number) : "—"} —{" "}
                  {p.kind === "DEPOSIT" ? "ودیعه" : p.kind === "DEPOSIT_REFUND" ? "بازگشت ودیعه" : p.kind === "DEPOSIT_APPLY" ? "منظور ودیعه" : p.kind === "CORRECTION" ? "اصلاحیه" : "اجاره"}
                </span>
                <span className={`num font-extrabold ${p.amount < 0 ? "text-danger" : "text-ok"}`}>
                  {money(p.amount)}
                </span>
              </li>
            );
          })
        )}
      </ul>
      <button
        onClick={() => navigate("payments")}
        className="mt-3 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-branddeep hover:underline"
      >
        همه پرداخت‌ها
        <IconArrowLeft size={13} />
      </button>
    </div>
  );
}
