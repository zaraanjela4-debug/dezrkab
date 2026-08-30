import { useEffect, useMemo, useState } from "react";
import { useNow, useRoute } from "../state/app";
import { customerService } from "../services/customerService";
import { paymentService } from "../services/paymentService";
import { pricingService } from "../services/pricingService";
import { rentalService, STATUS_LABEL } from "../services/rentalService";
import { returnService } from "../services/returnService";
import { useDB } from "../storage/storage";
import { accountKindLabel, countdown, faNum, fmtDateTime, fmtTime, money } from "../utils/format";
import { Badge, Btn, Empty, KV, Modal, Stepper, useToast } from "../ui/kit";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconFlag,
  IconPhone,
  IconReturn,
  IconSearch,
  IconWallet,
} from "../ui/icons";

export default function Returns() {
  const db = useDB();
  const route = useRoute();
  const toast = useToast();
  const now = useNow(15_000);

  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => route.params.get("id")
  );
  const [returns, setReturns] = useState<Record<string, number>>({});
  const [payStr, setPayStr] = useState("");
  const [payTouched, setPayTouched] = useState(false);
  const [accountId, setAccountId] = useState(
    () =>
      db.settings.accounts.find((a) => a.kind === "POS" && a.active)?.id ??
      db.settings.accounts.find((a) => a.active)?.id ??
      ""
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const inProgress = db.rentals.filter(
    (r) => r.status === "ACTIVE" || r.status === "PARTIAL"
  );
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return inProgress;
    return inProgress.filter((r) => {
      const c = db.customers.find((x) => x.id === r.customerId);
      return (
        String(r.number).includes(s) ||
        (c && (c.name.toLowerCase().includes(s) || c.phone.includes(s)))
      );
    });
  }, [inProgress, db.customers, q]);

  const rental = db.rentals.find((r) => r.id === selectedId) ?? null;
  const customer = rental ? db.customers.find((c) => c.id === rental.customerId) : null;

  const outstanding = useMemo(() => {
    const m: Record<string, number> = {};
    if (rental) {
      for (const i of rental.items) m[i.categoryId] = i.qty - i.returnedQty;
    }
    return m;
  }, [rental]);

  // با تغییر اجاره انتخابی، تعداد برگشتی روی «همه» تنظیم می‌شود
  useEffect(() => {
    const m: Record<string, number> = {};
    if (rental && (rental.status === "ACTIVE" || rental.status === "PARTIAL")) {
      for (const i of rental.items) m[i.categoryId] = i.qty - i.returnedQty;
    }
    setReturns(m);
    setPayTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const preview = rental ? pricingService.previewReturn(db, rental, now) : null;
  const hasOutstanding = Object.values(outstanding).some((v) => v > 0);
  const returningAll =
    rental !== null &&
    hasOutstanding &&
    rental.items.every((i) => (returns[i.categoryId] ?? 0) === i.qty - i.returnedQty);

  const previewTotal = rental
    ? rental.subtotal - rental.discount + (returningAll && preview ? preview.lateFee : 0)
    : 0;
  const paid = rental ? paymentService.paidFor(db, rental.id) : 0;
  const remaining = previewTotal - paid;

  // مبلغ دریافت به‌صورت پیش‌فرض = مانده فعلی؛ تا وقتی فروشنده دستی تغییرش نداده
  useEffect(() => {
    if (rental && !payTouched) {
      setPayStr(String(Math.max(0, Math.round(remaining))));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rental?.id, remaining, payTouched]);

  function doReturn() {
    if (!rental) return;
    const items = Object.entries(returns)
      .filter(([, n]) => n > 0)
      .map(([categoryId, qty]) => ({ categoryId, qty }));
    if (items.length === 0) {
      toast.push("err", "تعداد برگشتی را مشخص کنید");
      return;
    }
    try {
      const res = returnService.processReturn({
        rentalId: rental.id,
        returns: items,
        paymentAmount: Math.max(0, parseInt(payStr, 10) || 0),
        accountId,
      });
      if (res.full) {
        toast.push(
          "ok",
          res.lateFee > 0
            ? `برگشت کامل — جریمه تأخیر ${money(res.lateFee)} ثبت شد`
            : "برگشت کامل ثبت شد — دوچرخه‌ها آماده اجاره‌اند"
        );
      } else {
        toast.push("ok", `برگشت نسبی — ${faNum(res.releasedCount)} دستگاه آزاد شد`);
      }
      setPayStr("");
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "برگشت ثبت نشد");
    }
  }

  function receivePayment() {
    if (!rental) return;
    const amount = parseInt(payStr, 10) || 0;
    if (amount <= 0) {
      toast.push("err", "مبلغ دریافتی را وارد کنید");
      return;
    }
    try {
      paymentService.addPayment({
        rentalId: rental.id,
        kind: "RENT",
        amount,
        accountId,
        note: "دریافت مانده",
      });
      toast.push("ok", `${money(amount)} دریافت شد`);
      setPayStr("");
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "دریافت ناموفق بود");
    }
  }

  function doCancel() {
    if (!rental) return;
    try {
      rentalService.cancelRental(rental.id, cancelReason);
      toast.push("ok", `اجاره #${faNum(rental.number)} لغو شد و موجودی آزاد شد`);
      setCancelOpen(false);
      setCancelReason("");
      setSelectedId(null);
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "لغو ناموفق بود");
    }
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-12">
      {/* فهرست اجاره‌های در جریان */}
      <section className="xl:col-span-5 card overflow-hidden">
        <div className="border-b border-line p-3.5">
          <div className="relative">
            <input
              className="inp ps-10"
              placeholder="جستجو: شماره اجاره، نام یا تلفن مشتری…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-inkmute">
              <IconSearch size={17} />
            </span>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <Empty icon={<IconReturn size={26} />} text="اجاره در جریانی نیست" sub="همه دوچرخه‌ها برگشته‌اند" />
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((r) => {
                const c = db.customers.find((x) => x.id === r.customerId);
                const cd = countdown(r.plannedEndAt, now);
                const sel = r.id === selectedId;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelectedId(r.id)}
                      className={`flex w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-start transition-colors ${
                        sel ? "bg-brandsoft/70 border-e-[3px] border-brand" : "hover:bg-black/[0.02]"
                      }`}
                    >
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl font-display text-sm ${sel ? "bg-brand text-white" : "bg-coal text-white"}`}>
                        {faNum(r.number)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-ink">
                          {c?.name ?? "—"}
                          {r.status === "PARTIAL" && (
                            <Badge tone="warn" className="ms-2">برگشت نسبی</Badge>
                          )}
                        </span>
                        <span className="num mt-0.5 block text-[11px] text-inkmute">
                          {r.items.map((i) => `${faNum(i.qty - i.returnedQty)}×${i.name}`).join(" + ")} — سررسید {fmtTime(r.plannedEndAt)}
                        </span>
                      </span>
                      <Badge tone={cd.overdue ? "danger" : cd.minutes < 30 ? "warn" : "neutral"}>
                        {cd.label}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* جزئیات و عملیات برگشت */}
      <section className="xl:col-span-7">
        {!rental ? (
          <div className="card">
            <Empty
              icon={<IconReturn size={28} />}
              text="یک اجاره در جریان را از فهرست انتخاب کنید"
              sub="اطلاعات مشتری، موعد برگشت و محاسبه جریمه همین‌جا نمایش داده می‌شود"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* وضعیت زمان */}
            <div
              className={`anim-up card p-4 ${
                preview?.lateFee ? "border-danger/40" : preview?.early ? "border-ok/40" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-2xl text-ink">
                    اجاره #{faNum(rental.number)}
                  </p>
                  <p className="num mt-0.5 text-xs text-inkmute">
                    شروع {fmtDateTime(rental.startAt)} — سررسید {fmtDateTime(rental.plannedEndAt)}
                  </p>
                </div>
                {preview && hasOutstanding ? (
                  preview.lateFee > 0 ? (
                    <div className="rounded-xl bg-dangersoft px-3.5 py-2.5 text-end">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold text-danger">
                        <IconAlert size={14} />
                        تأخیر {faNum(Math.round(preview.lateMinutes + db.settings.graceMinutes))} دقیقه‌ای
                      </p>
                      <p className="num mt-0.5 text-sm font-extrabold text-danger">
                        جریمه {money(preview.lateFee)}
                      </p>
                    </div>
                  ) : preview.early ? (
                    <Badge tone="ok" className="px-3 py-1.5 text-xs">
                      <IconCheck size={13} />
                      برگشت زودهنگام — موجودی همان لحظه آزاد می‌شود
                    </Badge>
                  ) : (
                    <Badge tone="neutral" className="px-3 py-1.5 text-xs">
                      <IconClock size={13} />
                      در بازه مجاز (مهلت {faNum(db.settings.graceMinutes)} دقیقه)
                    </Badge>
                  )
                ) : (
                  <Badge tone={rental.status === "SETTLED" ? "ok" : "neutral"} className="px-3 py-1.5">
                    {STATUS_LABEL[rental.status]}
                  </Badge>
                )}
              </div>
            </div>

            {/* مشتری */}
            {customer && (
              <div className="anim-up card flex flex-wrap items-center gap-3 p-4" style={{ animationDelay: "50ms" }}>
                <span className="grid size-11 place-items-center rounded-full bg-coal font-display text-lg text-white">
                  {customer.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-ink">{customer.name}</p>
                  <p className="num mt-0.5 flex items-center gap-1 text-[11px] text-inksoft">
                    <IconPhone size={12} />
                    <span dir="ltr">{customer.phone}</span>
                    {customer.idNumber && (
                      <span className="ms-2 text-inkmute">— مدارک: <span dir="ltr" className="num">{customer.idNumber}</span></span>
                    )}
                  </p>
                </div>
                <Badge tone="neutral">
                  {faNum(customerService.stats(db, customer.id).count)} اجاره
                </Badge>
              </div>
            )}

            {/* اقلام و برگشت */}
            <div className="anim-up card p-4" style={{ animationDelay: "100ms" }}>
              <h3 className="mb-3 text-sm font-extrabold text-ink">دوچرخه‌های بیرون</h3>
              <div className="space-y-2">
                {rental.items.map((i) => {
                  const out = i.qty - i.returnedQty;
                  return (
                    <div
                      key={i.categoryId}
                      className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                        out === 0 ? "border-ok/40 bg-oksoft/50" : "border-line"
                      }`}
                    >
                      <span className="grid size-9 place-items-center rounded-lg bg-coal font-display text-base text-white">
                        {i.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-ink">{i.name}</p>
                        <p className="num text-[11px] text-inkmute">
                          {out === 0
                            ? "همه برگشته"
                            : `${faNum(out)} دستگاه بیرون — ${faNum(i.returnedQty)} برگشته`}
                        </p>
                      </div>
                      {out === 0 ? (
                        <Badge tone="ok">
                          <IconCheck size={12} />
                          تکمیل
                        </Badge>
                      ) : hasOutstanding && rental.status !== "CANCELLED" ? (
                        <Stepper
                          value={returns[i.categoryId] ?? 0}
                          max={out}
                          onChange={(v) => setReturns((r) => ({ ...r, [i.categoryId]: v }))}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {hasOutstanding && rental.status !== "CANCELLED" && (
                <>
                  <div className="mt-4 grid gap-3 rounded-xl bg-black/[0.03] p-3 sm:grid-cols-3">
                    <div>
                      <label className="lbl">دریافت همراه برگشت (تومان)</label>
                      <input
                        className="inp num"
                        dir="ltr"
                        style={{ textAlign: "left" }}
                        type="number"
                        min={0}
                        value={payStr}
                        onChange={(e) => {
                          setPayStr(e.target.value);
                          setPayTouched(true);
                        }}
                        placeholder="0 — اختیاری"
                      />
                    </div>
                    <div>
                      <label className="lbl">روش پرداخت</label>
                      <select className="inp" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                        {db.settings.accounts.filter((a) => a.active).map((a) => (
                          <option key={a.id} value={a.id}>
                            {accountKindLabel(a.kind)} — {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Btn className="w-full" onClick={doReturn}>
                        <IconReturn size={16} />
                        {returningAll ? "ثبت برگشت کامل" : "ثبت برگشت"}
                      </Btn>
                    </div>
                  </div>
                  {!returningAll && (
                    <p className="mt-2 text-[11px] font-bold text-warn">
                      برگشت نسبی: جریمه تأخیر هنگام برگشتِ کاملِ آخرین دستگاه محاسبه می‌شود
                    </p>
                  )}
                </>
              )}
            </div>

            {/* تسویه */}
            <div className="anim-up card p-4" style={{ animationDelay: "150ms" }}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
                <IconWallet size={17} className="text-branddeep" />
                تسویه حساب
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-0.5">
                  <KV k="جمع اجاره" v={money(rental.subtotal)} />
                  {rental.discount > 0 && <KV k="تخفیف" v={<span className="text-danger">− {money(rental.discount)}</span>} />}

                  {/* ریز دیرکرد — شفاف برای مشتری */}
                  {(() => {
                    const b =
                      preview && returningAll && preview.lateMinutes > 0
                        ? {
                            actual: now,
                            total: preview.lateMinutes,
                            grace: preview.graceMinutes,
                            chargeable: preview.chargeableMinutes,
                            fee: preview.lateFee,
                          }
                        : rental.lateFee > 0 && rental.actualEndAt
                          ? (() => {
                              const bd = pricingService.lateBreakdown(
                                db.settings,
                                rental.items,
                                rental.plannedEndAt,
                                rental.actualEndAt
                              );
                              return {
                                actual: rental.actualEndAt as number,
                                total: bd.totalLateMinutes,
                                grace: bd.graceMinutes,
                                chargeable: bd.chargeableMinutes,
                                fee: rental.lateFee,
                              };
                            })()
                          : null;
                    if (!b) return null;
                    return (
                      <div className="my-1.5 rounded-lg bg-warnsoft/60 px-2.5 py-2">
                        <KV k="زمان بازگشت مقرر" v={fmtTime(rental.plannedEndAt)} />
                        <KV k="زمان بازگشت" v={fmtTime(b.actual)} />
                        <KV k="دیرکرد" v={`${faNum(b.total)} دقیقه`} />
                        <KV k="بخشوده" v={`${faNum(Math.min(b.grace, b.total))} دقیقه`} />
                        <KV k="دیرکرد قابل محاسبه" v={`${faNum(b.chargeable)} دقیقه`} />
                        <KV k="هزینه دیرکرد" v={<span className="text-danger">{money(b.fee)}</span>} />
                      </div>
                    );
                  })()}

                  <div className="my-1 border-t border-dashed border-linedeep" />
                  <KV k="مبلغ نهایی" v={money(rental.lateFee > 0 || !hasOutstanding ? rental.total : previewTotal)} strong />
                  <KV k="پرداخت‌شده" v={money(paid)} />
                </div>
                <div className="flex flex-col justify-between rounded-xl bg-brandsoft/70 p-4">
                  <div>
                    <p className="text-xs font-bold text-branddeep">مانده قابل دریافت</p>
                    <p className={`num mt-1 font-display text-3xl ${remaining > 0 ? "text-ink" : "text-ok"}`}>
                      {money(Math.max(0, hasOutstanding ? remaining : rental.total - paid))}
                    </p>
                  </div>
                  {rental.status === "SETTLED" ? (
                    <div className="mt-3 space-y-2">
                      <Badge tone="ok" className="px-3 py-1.5">
                        <IconCheck size={13} />
                        تسویه کامل شد
                      </Badge>
                    </div>
                  ) : !hasOutstanding && remaining > 0 ? (
                    <div className="mt-3 space-y-2">
                      <Btn size="sm" className="w-full" onClick={receivePayment}>
                        دریافت مانده
                      </Btn>
                    </div>
                  ) : remaining <= 0 && !hasOutstanding ? (
                    <p className="mt-3 text-xs font-bold text-ok">مانده‌ای نمانده — در انتظار وضعیت تسویه</p>
                  ) : null}
                </div>
              </div>
            </div>

            {rental.status === "ACTIVE" && (
              <div className="flex justify-end">
                <Btn variant="outline" className="border-danger/40 text-danger hover:border-danger" onClick={() => setCancelOpen(true)}>
                  <IconFlag size={15} />
                  لغو اجاره
                </Btn>
              </div>
            )}
          </div>
        )}
      </section>

      {/* مودال لغو */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="لغو اجاره">
        <div className="flex items-start gap-2.5 rounded-xl bg-dangersoft p-3 text-xs font-bold leading-6 text-danger">
          <IconAlert size={18} className="mt-0.5 shrink-0" />
          با لغو، همه دوچرخه‌های این اجاره فوراً به موجودی برمی‌گردند و رکورد اجاره برای همیشه در تاریخچه حفظ می‌شود. این عمل قابل بازگشت نیست.
        </div>
        <div className="mt-3">
          <label className="lbl">دلیل لغو (اختیاری)</label>
          <textarea
            className="inp min-h-[70px]"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="مثلاً: انصراف مشتری"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Btn variant="outline" className="flex-1" onClick={() => setCancelOpen(false)}>
            انصراف
          </Btn>
          <Btn variant="danger" className="flex-1" onClick={doCancel}>
            بله، اجاره لغو شود
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
