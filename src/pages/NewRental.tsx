import { useEffect, useMemo, useState } from "react";
import type { Rental } from "../domain/models";
import { navigate, useRoute } from "../state/app";
import { availabilityService } from "../services/availabilityService";
import { customerService } from "../services/customerService";
import { pricingService } from "../services/pricingService";
import { rentalService } from "../services/rentalService";
import { useDB } from "../storage/storage";
import {
  faNum,
  fmtDateTime,
  fromLocalInput,
  money,
  toLocalInput,
} from "../utils/format";
import { Badge, Btn, KV, Modal, Stepper, useToast } from "../ui/kit";
import {
  IconBike,
  IconCheck,
  IconClipboard,
  IconClock,
  IconMinus,
  IconPlus,
  IconSearch,
  IconUser,
  IconX,
} from "../ui/icons";

function StepTitle({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-coal font-display text-sm text-white">
        {n}
      </span>
      <div>
        <h2 className="text-sm font-extrabold text-ink">{title}</h2>
        {sub ? <p className="text-[11px] text-inkmute">{sub}</p> : null}
      </div>
    </div>
  );
}

export default function NewRental() {
  const db = useDB();
  const route = useRoute();
  const toast = useToast();

  const [qty, setQty] = useState<Record<string, number>>({});
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showNewCus, setShowNewCus] = useState(false);
  const [nc, setNc] = useState({ name: "", phone: "", idNumber: "", note: "" });
  const [hours, setHours] = useState<number>(db.settings.durations[1]?.hours ?? 2);
  const [startMode, setStartMode] = useState<"now" | "at">("now");
  const [startAt, setStartAt] = useState(() => toLocalInput(Date.now()));
  const [discount, setDiscount] = useState("");
  const [note, setNote] = useState("");
  const [depositStr, setDepositStr] = useState("");
  const [accountId, setAccountId] = useState(
    () => db.settings.accounts.find((a) => a.active)?.id ?? ""
  );
  const [receipt, setReceipt] = useState<Rental | null>(null);
  const [busy, setBusy] = useState(false);

  const availability = useMemo(
    () => new Map(availabilityService.snapshot(db).map((a) => [a.category.id, a.available])),
    [db]
  );

  // پیش‌انتخاب دسته از پارامتر لینک (کلیک روی کارت موجودی در پیشخوان)
  useEffect(() => {
    const code = route.params.get("cat");
    if (!code) return;
    const cat = db.categories.find((c) => c.code === code && c.active);
    if (cat && (availability.get(cat.id) ?? 0) > 0) {
      setQty((q) => ({ ...q, [cat.id]: 1 }));
    }
    // فقط بار اول
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCats = db.categories.filter((c) => c.active);
  const selectedItems = Object.entries(qty)
    .filter(([, n]) => n > 0)
    .map(([categoryId, n]) => ({ categoryId, qty: n }));

  const discountNum = Math.max(0, parseInt(discount, 10) || 0);
  const quote = useMemo(() => {
    if (selectedItems.length === 0) return null;
    try {
      return pricingService.quote(db, selectedItems, hours, discountNum);
    } catch {
      return null;
    }
  }, [db, selectedItems, hours, discountNum]);

  const depositValue =
    depositStr === "" ? (quote?.depositTotal ?? 0) : Math.max(0, parseInt(depositStr, 10) || 0);

  const customer = customerId ? db.customers.find((c) => c.id === customerId) : null;
  const results = useMemo(
    () => customerService.search(db, query).slice(0, 6),
    [db, query]
  );

  const startTs = startMode === "now" ? Date.now() : fromLocalInput(startAt);
  const unitsCount = selectedItems.reduce((s, i) => s + i.qty, 0);

  function resetAll() {
    setQty({});
    setCustomerId(null);
    setQuery("");
    setShowNewCus(false);
    setNc({ name: "", phone: "", idNumber: "", note: "" });
    setDiscount("");
    setNote("");
    setDepositStr("");
    setStartMode("now");
    setStartAt(toLocalInput(Date.now()));
  }

  function submit() {
    if (!customerId) {
      toast.push("err", "مشتری را انتخاب یا ثبت کنید");
      return;
    }
    if (selectedItems.length === 0) {
      toast.push("err", "حداقل یک دوچرخه انتخاب کنید");
      return;
    }
    if (!accountId) {
      toast.push("err", "حساب دریافت ودیعه را انتخاب کنید");
      return;
    }
    setBusy(true);
    try {
      const rental = rentalService.createRental({
        customerId,
        items: selectedItems,
        hours,
        startAt: startTs,
        discount: discountNum,
        note,
        depositAmount: depositValue,
        accountId,
      });
      toast.push("ok", `اجاره #${faNum(rental.number)} ثبت شد — رکاب خوش بگذره!`);
      setReceipt(rental);
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "ثبت اجاره ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  function addCustomer() {
    try {
      const c = customerService.add(nc);
      setCustomerId(c.id);
      setShowNewCus(false);
      setQuery("");
      toast.push("ok", `مشتری «${c.name}» ثبت شد`);
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "ثبت مشتری ناموفق بود");
    }
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-8">
        {/* ۱ — انتخاب دوچرخه */}
        <section className="anim-up card p-4">
          <StepTitle n="۱" title="انتخاب دوچرخه" sub="دسته + تعداد — موجودی همان لحظه کسر می‌شود" />
          <div className="space-y-2">
            {activeCats.map((cat) => {
              const avail = availability.get(cat.id) ?? 0;
              const val = qty[cat.id] ?? 0;
              return (
                <div
                  key={cat.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition-colors ${
                    val > 0 ? "border-brand bg-brandsoft/50" : "border-line"
                  } ${avail === 0 ? "opacity-60" : ""}`}
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-coal font-display text-lg text-white">
                    {cat.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-ink">{cat.name}</p>
                    <p className="num text-[11px] text-inkmute">
                      {money(cat.hourlyRate)} / ساعت — ودیعه {money(cat.deposit)}
                    </p>
                  </div>
                  {avail === 0 ? (
                    <Badge tone="danger">ناموجود</Badge>
                  ) : (
                    <>
                      <Badge tone={avail <= 2 ? "warn" : "ok"}>{faNum(avail)} موجود</Badge>
                      <Stepper
                        value={val}
                        max={avail}
                        onChange={(v) => setQty((q) => ({ ...q, [cat.id]: v }))}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {unitsCount > 0 && (
            <p className="mt-3 text-xs font-bold text-branddeep">
              {faNum(unitsCount)} دستگاه انتخاب شد — موجودی به‌صورت زنده بررسی می‌شود
            </p>
          )}
        </section>

        {/* ۲ — مشتری */}
        <section className="anim-up card p-4" style={{ animationDelay: "60ms" }}>
          <StepTitle n="۲" title="مشتری" sub="جستجو با نام یا شماره موبایل — مشتری تکراری ساخته نمی‌شود" />

          {customer ? (
            <div className="flex items-center gap-3 rounded-xl border border-ok/40 bg-oksoft/60 p-3">
              <span className="grid size-10 place-items-center rounded-full bg-ok text-white">
                <IconUser size={20} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-ink">{customer.name}</p>
                <p className="num text-[11px] text-inksoft" dir="ltr">
                  {customer.phone}
                </p>
              </div>
              <Badge tone="ok">
                <IconCheck size={12} />
                انتخاب شد
              </Badge>
              <button
                onClick={() => setCustomerId(null)}
                className="cursor-pointer rounded-lg p-1.5 text-inksoft hover:bg-black/5"
                aria-label="حذف مشتری"
              >
                <IconX size={16} />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  className="inp ps-10"
                  placeholder="نام یا شماره موبایل…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-inkmute">
                  <IconSearch size={17} />
                </span>
              </div>
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {results.length === 0 ? (
                  <li className="p-3 text-center text-xs font-bold text-inkmute">
                    مشتری‌ای پیدا نشد — «مشتری جدید» را بزنید
                  </li>
                ) : (
                  results.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => {
                          setCustomerId(c.id);
                          setQuery("");
                        }}
                        className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-start transition-colors hover:bg-brandsoft/60"
                      >
                        <span className="grid size-8 place-items-center rounded-full bg-black/5 text-inksoft">
                          <IconUser size={16} />
                        </span>
                        <span className="flex-1 text-sm font-bold text-ink">{c.name}</span>
                        <span className="num text-xs text-inksoft" dir="ltr">
                          {c.phone}
                        </span>
                        <span className="num text-[11px] text-inkmute">
                          {faNum(customerService.stats(db, c.id).count)} اجاره
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <button
                onClick={() => setShowNewCus((s) => !s)}
                className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-branddeep hover:underline"
              >
                {showNewCus ? <IconMinus size={13} /> : <IconPlus size={13} />}
                مشتری جدید
              </button>

              {showNewCus && (
                <div className="anim-pop mt-3 grid gap-3 rounded-xl border border-line bg-black/[0.02] p-3 sm:grid-cols-2">
                  <div>
                    <label className="lbl">نام و نام خانوادگی *</label>
                    <input className="inp" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="lbl">موبایل *</label>
                    <input className="inp num" dir="ltr" style={{ textAlign: "left" }} value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} placeholder="09xxxxxxxxx" />
                  </div>
                  <div>
                    <label className="lbl">کد ملی / شماره مدارک</label>
                    <input className="inp num" dir="ltr" style={{ textAlign: "left" }} value={nc.idNumber} onChange={(e) => setNc({ ...nc, idNumber: e.target.value })} />
                  </div>
                  <div>
                    <label className="lbl">یادداشت</label>
                    <input className="inp" value={nc.note} onChange={(e) => setNc({ ...nc, note: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Btn variant="ok" size="sm" onClick={addCustomer}>
                      <IconCheck size={14} />
                      ثبت و انتخاب مشتری
                    </Btn>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* ۳ — زمان و مدت */}
        <section className="anim-up card p-4" style={{ animationDelay: "120ms" }}>
          <StepTitle n="۳" title="زمان و مدت اجاره" sub="قیمت بر اساس نرخ ساعتی هر دسته محاسبه می‌شود" />
          <div className="flex flex-wrap gap-2">
            {db.settings.durations.map((d) => (
              <button
                key={d.hours}
                onClick={() => setHours(d.hours)}
                className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold transition-all ${
                  hours === d.hours
                    ? "border-brand bg-brand text-white shadow-[0_4px_14px_rgba(255,138,0,0.3)]"
                    : "border-linedeep bg-white text-inksoft hover:border-brand hover:text-brand"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="lbl">شروع اجاره</label>
              <div className="flex gap-1 rounded-xl border border-linedeep p-1">
                <button
                  onClick={() => setStartMode("now")}
                  className={`flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                    startMode === "now" ? "bg-coal text-white" : "text-inksoft hover:bg-black/5"
                  }`}
                >
                  همین حالا
                </button>
                <button
                  onClick={() => setStartMode("at")}
                  className={`flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                    startMode === "at" ? "bg-coal text-white" : "text-inksoft hover:bg-black/5"
                  }`}
                >
                  ساعت خاص
                </button>
              </div>
            </div>
            {startMode === "at" && (
              <div className="anim-pop sm:col-span-1">
                <label className="lbl">زمان شروع</label>
                <input
                  type="datetime-local"
                  className="inp num"
                  dir="ltr"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
            )}
            <div className="sm:col-span-1">
              <label className="lbl">تخفیف (تومان)</label>
              <input
                className="inp num"
                dir="ltr"
                style={{ textAlign: "left" }}
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="lbl">یادداشت اجاره</label>
            <textarea
              className="inp min-h-[64px] resize-y"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثلاً: تحویل در پارک لاله، ساعت ۶ برگشت"
            />
          </div>
        </section>
      </div>

      {/* فاکتور */}
      <aside className="anim-up xl:col-span-4 xl:sticky xl:top-4 card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-line bg-coal px-4 py-3.5 text-white">
          <IconClipboard size={20} className="text-brand" />
          <h2 className="font-display text-lg">فاکتور اجاره</h2>
          {unitsCount > 0 && (
            <Badge tone="brand" className="ms-auto bg-brand text-white">
              {faNum(unitsCount)} دستگاه
            </Badge>
          )}
        </div>
        <div className="p-4">
          {!quote ? (
            <div className="rounded-xl border border-dashed border-linedeep p-6 text-center">
              <IconBike size={30} className="mx-auto text-inkmute" />
              <p className="mt-2 text-xs font-bold text-inksoft">
                هنوز دوچرخه‌ای انتخاب نشده
              </p>
              <p className="mt-1 text-[11px] text-inkmute">
                از بخش ۱ دسته و تعداد را مشخص کنید
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {quote.lines.map((l) => (
                <div key={l.categoryId} className="flex items-center justify-between text-sm">
                  <span className="font-bold text-inksoft">
                    {faNum(l.qty)} × {l.name}
                    <span className="ms-1 text-[11px] text-inkmute">({faNum(hours)} ساعت)</span>
                  </span>
                  <span className="num font-extrabold text-ink">{money(l.lineTotal)}</span>
                </div>
              ))}
              <div className="my-2 border-t border-dashed border-linedeep" />
              <KV k="جمع اجاره" v={money(quote.subtotal)} />
              {quote.discount > 0 && <KV k="تخفیف" v={<span className="text-danger">− {money(quote.discount)}</span>} />}
              <KV k="مبلغ اجاره" v={money(quote.total)} strong />
            </div>
          )}

          <div className="mt-4 space-y-3 rounded-xl bg-black/[0.03] p-3">
            <div>
              <div className="flex items-center justify-between">
                <label className="lbl mb-0">ودیعه دریافتی الآن</label>
                <button
                  className="cursor-pointer text-[11px] font-bold text-branddeep hover:underline"
                  onClick={() => setDepositStr("")}
                >
                  کل ودیعه ({quote ? money(quote.depositTotal) : "—"})
                </button>
              </div>
              <input
                className="inp num mt-1"
                dir="ltr"
                style={{ textAlign: "left" }}
                type="number"
                min={0}
                value={depositStr === "" ? (quote?.depositTotal ?? 0) : depositStr}
                onChange={(e) => setDepositStr(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-inkmute">
                ودیعه نزد فروشگاه می‌ماند و هنگام تسویه برگشت یا به اجاره منظور می‌شود
              </p>
            </div>
            <div>
              <label className="lbl">حساب دریافت</label>
              <select className="inp" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {db.settings.accounts.filter((a) => a.active).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {quote && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-brandsoft px-3 py-2.5">
              <span className="text-xs font-bold text-branddeep">سررسید برگشت</span>
              <span className="num flex items-center gap-1.5 text-xs font-extrabold text-branddeep">
                <IconClock size={14} />
                {fmtDateTime(startTs + hours * 3_600_000)}
              </span>
            </div>
          )}

          <Btn size="lg" className="mt-4 w-full" onClick={submit} disabled={busy || !quote || !customer}>
            <IconCheck size={18} />
            {busy ? "در حال ثبت…" : "ثبت اجاره و دریافت ودیعه"}
          </Btn>
          {!customer && quote && (
            <p className="mt-2 text-center text-[11px] font-bold text-warn">
              ابتدا مشتری را انتخاب کنید (بخش ۲)
            </p>
          )}
        </div>
      </aside>

      {/* رسید */}
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="اجاره ثبت شد">
        {receipt && (
          <div>
            <div className="flex items-center justify-between rounded-xl bg-oksoft px-4 py-3">
              <div>
                <p className="text-xs font-bold text-ok">شماره اجاره</p>
                <p className="num font-display text-3xl text-ink">#{faNum(receipt.number)}</p>
              </div>
              <Badge tone="ok">{rentalServiceStatus(receipt.status)}</Badge>
            </div>
            <div className="mt-4 space-y-1">
              <KV k="مشتری" v={db.customers.find((c) => c.id === receipt.customerId)?.name ?? "—"} />
              {receipt.items.map((i) => (
                <KV key={i.categoryId} k={`${faNum(i.qty)} × ${i.name}`} v={money(i.hourlyRate * i.qty * receipt.hours)} />
              ))}
              <div className="my-2 border-t border-dashed border-linedeep" />
              <KV k="شروع" v={fmtDateTime(receipt.startAt)} />
              <KV k="سررسید برگشت" v={fmtDateTime(receipt.plannedEndAt)} />
              <KV k="مبلغ اجاره" v={money(receipt.total)} strong />
              <KV k="ودیعه دریافت‌شده" v={money(depositValue)} />
            </div>
            <div className="mt-5 flex gap-2">
              <Btn
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setReceipt(null);
                  resetAll();
                }}
              >
                اجاره بعدی
              </Btn>
              <Btn
                className="flex-1"
                onClick={() => {
                  setReceipt(null);
                  resetAll();
                  navigate("dashboard");
                }}
              >
                بازگشت به پیشخوان
              </Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function rentalServiceStatus(s: Rental["status"]): string {
  return s === "ACTIVE" ? "فعال" : s;
}
