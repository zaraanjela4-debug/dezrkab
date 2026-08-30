import { useState } from "react";
import { expenseService } from "../services/expenseService";
import { useDB } from "../storage/storage";
import { faNum, fmtDateFull, fmtTime, money } from "../utils/format";
import { Btn, Empty, useToast } from "../ui/kit";
import { IconPlus, IconReceipt, IconWallet } from "../ui/icons";

export default function Expenses() {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState({
    title: "",
    amount: "",
    accountId: db.settings.accounts.find((a) => a.active)?.id ?? "",
    note: "",
  });

  const now = Date.now();
  const monthStart = (() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const monthTotal = db.expenses.filter((e) => e.at >= monthStart).reduce((s, e) => s + e.amount, 0);
  const todayTotal = db.expenses
    .filter((e) => new Date(e.at).toDateString() === new Date(now).toDateString())
    .reduce((s, e) => s + e.amount, 0);

  function submit() {
    try {
      expenseService.add({
        title: form.title,
        amount: parseInt(form.amount, 10) || 0,
        accountId: form.accountId,
        note: form.note,
      });
      toast.push("ok", `هزینه «${form.title.trim()}» ثبت شد`);
      setForm({ ...form, title: "", amount: "", note: "" });
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "ثبت هزینه ناموفق بود");
    }
  }

  return (
    <div className="grid items-start gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-4">
        <section className="anim-up card p-4">
          <h2 className="flex items-center gap-2 font-display text-lg text-ink">
            <IconPlus size={18} className="text-branddeep" />
            ثبت هزینه جدید
          </h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="lbl">عنوان هزینه *</label>
              <input className="inp" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً: خرید لاستیک" />
            </div>
            <div>
              <label className="lbl">مبلغ (تومان) *</label>
              <input className="inp num" dir="ltr" style={{ textAlign: "left" }} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="lbl">حساب / روش پرداخت</label>
              <select className="inp" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                {db.settings.accounts.filter((a) => a.active).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">یادداشت</label>
              <input className="inp" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
            <Btn className="w-full" onClick={submit}>
              <IconReceipt size={15} />
              ثبت هزینه
            </Btn>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-inkmute">
            تاریخچه هزینه‌ها هرگز حذف نمی‌شود — برای اصلاح، هزینه جدید ثبت کنید
          </p>
        </section>

        <div className="anim-up grid grid-cols-2 gap-4" style={{ animationDelay: "60ms" }}>
          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-inkmute"><IconWallet size={13} /> امروز</p>
            <p className="num mt-1.5 font-display text-xl text-ink">{money(todayTotal)}</p>
          </div>
          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-inkmute"><IconWallet size={13} /> این ماه</p>
            <p className="num mt-1.5 font-display text-xl text-ink">{money(monthTotal)}</p>
          </div>
        </div>
      </div>

      <section className="anim-up xl:col-span-8 card overflow-hidden" style={{ animationDelay: "90ms" }}>
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-base text-ink">تاریخچه هزینه‌ها ({faNum(db.expenses.length)})</h3>
        </div>
        {db.expenses.length === 0 ? (
          <Empty icon={<IconReceipt size={26} />} text="هزینه‌ای ثبت نشده" />
        ) : (
          <div className="max-h-[68vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-line text-[11px] font-bold text-inkmute">
                  <th className="px-4 py-2.5 text-start">عنوان</th>
                  <th className="px-4 py-2.5 text-start">حساب</th>
                  <th className="px-4 py-2.5 text-start">ثبت‌کننده</th>
                  <th className="px-4 py-2.5 text-start">زمان</th>
                  <th className="px-4 py-2.5 text-start">مبلغ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {db.expenses.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-black/[0.02]">
                    <td className="px-4 py-3">
                      <p className="text-xs font-extrabold text-ink">{e.title}</p>
                      {e.note && <p className="mt-0.5 text-[11px] text-inkmute">{e.note}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-inksoft">
                      {db.settings.accounts.find((a) => a.id === e.accountId)?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-inksoft">
                      {db.users.find((u) => u.id === e.byId)?.name ?? "—"}
                    </td>
                    <td className="num px-4 py-3 text-xs text-inksoft">
                      {fmtDateFull(e.at)} — {fmtTime(e.at)}
                    </td>
                    <td className="num px-4 py-3 text-xs font-extrabold text-danger">− {money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
