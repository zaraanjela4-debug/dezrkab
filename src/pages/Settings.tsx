import { useState, type ReactNode } from "react";
import { authService } from "../services/authService";
import { inventoryService } from "../services/inventoryService";
import { settingsService } from "../services/settingsService";
import { availabilityService } from "../services/availabilityService";
import { useDB } from "../storage/storage";
import { faNum, fmtDateTime, money } from "../utils/format";
import { Badge, Btn, Modal, useToast } from "../ui/kit";
import {
  IconAlert,
  IconBox,
  IconCheck,
  IconGear,
  IconHistory,
  IconMinus,
  IconPlus,
  IconUser,
  IconWallet,
  IconX,
} from "../ui/icons";

type Tab = "cats" | "rules" | "accounts" | "users" | "general";

export default function Settings() {
  const [tab, setTab] = useState<Tab>("cats");

  const tabs: Array<{ id: Tab; label: string; icon: ReactNode }> = [
    { id: "cats", label: "دسته‌ها و موجودی", icon: <IconBox size={15} /> },
    { id: "rules", label: "قوانین و قیمت‌گذاری", icon: <IconGear size={15} /> },
    { id: "accounts", label: "حساب‌های پرداخت", icon: <IconWallet size={15} /> },
    { id: "users", label: "کاربران", icon: <IconUser size={15} /> },
    { id: "general", label: "عمومی و تاریخچه", icon: <IconHistory size={15} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="anim-up card flex flex-wrap gap-1.5 p-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              tab === t.id ? "bg-coal text-white shadow-sm" : "text-inksoft hover:bg-black/5"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div key={tab} className="anim-up">
        {tab === "cats" && <CatsTab />}
        {tab === "rules" && <RulesTab />}
        {tab === "accounts" && <AccountsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "general" && <GeneralTab />}
      </div>
    </div>
  );
}

/* ------------------------------ دسته‌ها ------------------------------ */

function CatsTab() {
  const db = useDB();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", hourlyRate: "" });

  function changeStock(catId: string, delta: number) {
    try {
      if (delta > 0) inventoryService.increaseStock(catId, delta);
      else inventoryService.decreaseStock(catId, -delta);
      toast.push("ok", "موجودی به‌روزرسانی شد");
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "ناموفق");
    }
  }

  function add() {
    try {
      inventoryService.addCategory({
        code: form.code,
        name: form.name,
        hourlyRate: parseInt(form.hourlyRate, 10) || 0,
      });
      toast.push("ok", "دسته جدید اضافه شد");
      setAddOpen(false);
      setForm({ code: "", name: "", hourlyRate: "" });
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "ناموفق");
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="font-display text-base text-ink">دسته‌های دوچرخه</h3>
        <Btn size="sm" onClick={() => setAddOpen(true)}>
          <IconPlus size={14} />
          دسته جدید
        </Btn>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] font-bold text-inkmute">
            <th className="px-4 py-2.5 text-start">کد</th>
            <th className="px-4 py-2.5 text-start">نام</th>
            <th className="px-4 py-2.5 text-start">نرخ ساعتی</th>
            <th className="px-4 py-2.5 text-start">موجودی</th>
            <th className="px-4 py-2.5 text-start">وضعیت</th>
            <th className="px-4 py-2.5 text-start">تغییر موجودی</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {db.categories.map((c) => {
            const counts = availabilityService.countsFor(db, c.id);
            return (
              <tr key={c.id} className="transition-colors hover:bg-black/[0.02]">
                <td className="px-4 py-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-coal font-display text-sm text-white">{c.code}</span>
                </td>
                <td className="px-4 py-3 font-extrabold text-ink">{c.name}</td>
                <td className="num px-4 py-3 text-xs text-inksoft">{money(c.hourlyRate)}</td>
                <td className="num px-4 py-3">
                  <Badge tone="neutral">
                    {faNum(counts.available)} آزاد از {faNum(counts.total)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      try {
                        inventoryService.updateCategory(c.id, { active: !c.active });
                        toast.push("ok", c.active ? "غیرفعال شد" : "فعال شد");
                      } catch (e) {
                        toast.push("err", e instanceof Error ? e.message : "ناموفق");
                      }
                    }}
                    className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                      c.active ? "bg-oksoft text-ok hover:bg-ok hover:text-white" : "bg-black/5 text-inkmute hover:bg-ok hover:text-white"
                    }`}
                  >
                    {c.active ? "فعال" : "غیرفعال"}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <button onClick={() => changeStock(c.id, -1)} className="grid size-7 cursor-pointer place-items-center rounded-lg border border-linedeep text-inksoft hover:border-danger hover:text-danger">
                      <IconMinus size={12} />
                    </button>
                    <button onClick={() => changeStock(c.id, 1)} className="grid size-7 cursor-pointer place-items-center rounded-lg border border-linedeep text-inksoft hover:border-ok hover:text-ok">
                      <IconPlus size={12} />
                    </button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="دسته جدید">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="lbl">کد *</label>
              <input className="inp" dir="ltr" style={{ textAlign: "left" }} maxLength={2} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="F" />
            </div>
            <div>
              <label className="lbl">نام *</label>
              <input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="کوهستان" />
            </div>
            <div>
              <label className="lbl">نرخ ساعتی *</label>
              <input className="inp num" dir="ltr" style={{ textAlign: "left" }} type="number" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} />
            </div>
          </div>
          <Btn className="w-full" onClick={add}>افزودن دسته</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------ قوانین ------------------------------ */

function RulesTab() {
  const db = useDB();
  const toast = useToast();
  const s = db.settings;
  const [grace, setGrace] = useState(String(s.graceMinutes));
  const [release, setRelease] = useState(String(s.releaseDelayMinutes));
  const [mult, setMult] = useState(String(s.lateMultiplier));
  const [prep, setPrep] = useState(String(s.prepMinutes));
  const [rewardHours, setRewardHours] = useState(String(s.rewardThresholdHours));
  const [rewardPct, setRewardPct] = useState(String(s.rewardDiscountPercent));

  function saveRules() {
    try {
      settingsService.updateGeneral({
        graceMinutes: parseInt(grace, 10) || 0,
        releaseDelayMinutes: parseInt(release, 10) || 0,
        lateMultiplier: parseFloat(mult) || 1.5,
        prepMinutes: parseInt(prep, 10) || 0,
        rewardThresholdHours: parseInt(rewardHours, 10) || 5,
        rewardDiscountPercent: parseInt(rewardPct, 10) || 30,
      });
      toast.push("ok", "قوانین ذخیره شد — از اجاره بعدی اعمال می‌شود");
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "ناموفق");
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="card p-4">
        <h3 className="font-display text-base text-ink">قوانین اجاره و تأخیر</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className="lbl">مهلت بخشودگی بعد از سررسید (دقیقه)</label>
            <input className="inp num" dir="ltr" style={{ textAlign: "left" }} type="number" value={grace} onChange={(e) => setGrace(e.target.value)} />
            <p className="mt-1 text-[11px] text-inkmute">این تعداد دقیقه بعد از سررسید رایگان است و جریمه‌ای ندارد (پیش‌فرض ۵)</p>
          </div>
          <div>
            <label className="lbl">زمان گردش بعد از برگشت زودهنگام (دقیقه)</label>
            <input className="inp num" dir="ltr" style={{ textAlign: "left" }} type="number" value={release} onChange={(e) => setRelease(e.target.value)} />
            <p className="mt-1 text-[11px] text-inkmute">
              بعد از برگشت زودهنگام، دوچرخه پس از این مدت دوباره قابل اجاره می‌شود (بازرسی/آماده‌سازی) — صفر یعنی بلافاصله
            </p>
          </div>
          <div>
            <label className="lbl">ضریب جریمه تأخیر</label>
            <input className="inp num" dir="ltr" style={{ textAlign: "left" }} type="number" step="0.1" value={mult} onChange={(e) => setMult(e.target.value)} />
            <p className="mt-1 text-[11px] text-inkmute">
              جریمه = دقیقه قابل‌محاسبه × نرخ دقیقه‌ای × این ضریب × تعداد دوچرخه‌ها (پیش‌فرض ۲)
            </p>
          </div>
          <Btn onClick={saveRules}>
            <IconCheck size={15} />
            ذخیره قوانین
          </Btn>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <h3 className="font-display text-base text-ink">پاداش مشتری و آماده‌سازی</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="lbl">ساعت لازم برای پاداش</label>
              <input className="inp num" dir="ltr" style={{ textAlign: "left" }} type="number" value={rewardHours} onChange={(e) => setRewardHours(e.target.value)} />
            </div>
            <div>
              <label className="lbl">درصد تخفیف پاداش</label>
              <input className="inp num" dir="ltr" style={{ textAlign: "left" }} type="number" value={rewardPct} onChange={(e) => setRewardPct(e.target.value)} />
            </div>
            <div>
              <label className="lbl">زمان آماده‌سازی (دقیقه، حداکثر ۵)</label>
              <input className="inp num" dir="ltr" style={{ textAlign: "left" }} type="number" value={prep} onChange={(e) => setPrep(e.target.value)} />
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-inkmute">
            هر {faNum(parseInt(rewardHours, 10) || s.rewardThresholdHours)} ساعت اجاره تکمیل‌شده، یک تخفیف {faNum(parseInt(rewardPct, 10) || s.rewardDiscountPercent)}٪ روی کل فاکتور بعدی باز می‌کند.
            زمان شروع اجاره به‌صورت خودکار «الان + زمان آماده‌سازی» است.
          </p>
          <Btn className="mt-3" onClick={saveRules}>
            <IconCheck size={15} />
            ذخیره قوانین
          </Btn>
        </div>

        <div className="card p-4">
          <h3 className="font-display text-base text-ink">بازه‌های زمانی اجاره (ثابت)</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.durations.map((d) => (
              <span key={d.hours} className="rounded-xl border border-linedeep px-3 py-1.5 text-xs font-bold text-ink">
                {d.label}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-inkmute">فهرست بازه‌ها طبق استاندارد فروشگاه ثابت است و تغییر نمی‌کند</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- حساب‌ها ---------------------------- */

function AccountsTab() {
  const db = useDB();
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("POS");

  function add() {
    try {
      settingsService.addAccount(name, kind);
      toast.push("ok", `حساب «${name.trim()}» اضافه شد`);
      setName("");
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "ناموفق");
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-base text-ink">حساب‌های دریافت پول</h3>
        </div>
        <ul className="divide-y divide-line">
          {db.settings.accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-brandsoft text-branddeep">
                <IconWallet size={18} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-ink">{a.name}</p>
                <p className="text-[11px] text-inkmute">
                  {a.kind === "POS" ? "دستگاه کارت‌خوان" : a.kind === "CASH" ? "نقدی" : "کارت به کارت"}
                </p>
              </div>
              <button
                onClick={() => {
                  try {
                    settingsService.toggleAccount(a.id);
                  } catch (e) {
                    toast.push("err", e instanceof Error ? e.message : "ناموفق");
                  }
                }}
                className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                  a.active ? "bg-oksoft text-ok hover:bg-ok hover:text-white" : "bg-black/5 text-inkmute hover:bg-ok hover:text-white"
                }`}
              >
                {a.active ? "فعال" : "غیرفعال"}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-4">
        <h3 className="font-display text-base text-ink">حساب جدید</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className="lbl">نام حساب *</label>
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: کارت‌خوان شماره ۲" />
          </div>
          <div>
            <label className="lbl">نوع</label>
            <select className="inp" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="POS">دستگاه کارت‌خوان</option>
              <option value="CASH">نقدی</option>
              <option value="TRANSFER">کارت به کارت</option>
            </select>
          </div>
          <Btn className="w-full" onClick={add}>
            <IconPlus size={15} />
            افزودن حساب
          </Btn>
          <p className="text-[11px] leading-5 text-inkmute">
            حساب‌ها هرگز حذف نمی‌شوند تا اسناد مالی گذشته قابل خواندن بمانند — فقط غیرفعال می‌شوند
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ کاربران ------------------------------ */

function UsersTab() {
  const db = useDB();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "SELLER" as "SELLER" | "MANAGER" });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPass, setNewPass] = useState("");

  function add() {
    try {
      authService.addUser(form);
      toast.push("ok", `کاربر «${form.name.trim()}» ساخته شد`);
      setForm({ name: "", username: "", password: "", role: "SELLER" });
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "ناموفق");
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-base text-ink">کاربران سامانه</h3>
        </div>
        <ul className="divide-y divide-line">
          {db.users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`grid size-9 place-items-center rounded-full font-display text-sm text-white ${u.role === "MANAGER" ? "bg-brand" : "bg-coal"}`}>
                {u.name.slice(0, 1)}
              </span>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-ink">{u.name}</p>
                <p className="num text-[11px] text-inkmute" dir="ltr">@{u.username}</p>
              </div>
              <Badge tone={u.role === "MANAGER" ? "brand" : "neutral"}>
                {u.role === "MANAGER" ? "مدیر" : "فروشنده"}
              </Badge>
              <button
                onClick={() => {
                  setResetFor(u.id);
                  setNewPass("");
                }}
                className="cursor-pointer rounded-lg border border-linedeep px-2.5 py-1 text-[11px] font-bold text-inksoft transition-colors hover:border-brand hover:text-brand"
              >
                بازنشانی رمز
              </button>
              <button
                onClick={() => {
                  try {
                    authService.setUserActive(u.id, !u.active);
                    toast.push("ok", u.active ? "کاربر غیرفعال شد" : "کاربر فعال شد");
                  } catch (e) {
                    toast.push("err", e instanceof Error ? e.message : "ناموفق");
                  }
                }}
                className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition-colors ${
                  u.active ? "bg-oksoft text-ok hover:bg-ok hover:text-white" : "bg-black/5 text-inkmute hover:bg-ok hover:text-white"
                }`}
              >
                {u.active ? "فعال" : "غیرفعال"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4">
        <h3 className="font-display text-base text-ink">کاربر جدید</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className="lbl">نام و نام خانوادگی *</label>
            <input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="lbl">نام کاربری *</label>
              <input className="inp" dir="ltr" style={{ textAlign: "left" }} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <label className="lbl">رمز عبور *</label>
              <input className="inp" dir="ltr" style={{ textAlign: "left" }} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="lbl">نقش</label>
            <select className="inp" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "SELLER" | "MANAGER" })}>
              <option value="SELLER">فروشنده — عملیات روزانه</option>
              <option value="MANAGER">مدیر — دسترسی کامل</option>
            </select>
          </div>
          <Btn className="w-full" onClick={add}>
            <IconPlus size={15} />
            ایجاد کاربر
          </Btn>
          <p className="text-[11px] leading-5 text-inkmute">
            فروشنده به تنظیمات، گزارش‌ها، هزینه‌ها و تعمیرات دسترسی ندارد و نمی‌تواند رکورد تاریخی را حذف کند
          </p>
        </div>
      </div>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title="بازنشانی رمز عبور">
        <div className="space-y-3">
          <div>
            <label className="lbl">رمز جدید (حداقل ۴ کاراکتر)</label>
            <input className="inp" dir="ltr" style={{ textAlign: "left" }} type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoFocus />
          </div>
          <Btn
            className="w-full"
            onClick={() => {
              if (!resetFor) return;
              try {
                authService.resetPassword(resetFor, newPass);
                toast.push("ok", "رمز عبور تغییر کرد");
                setResetFor(null);
              } catch (e) {
                toast.push("err", e instanceof Error ? e.message : "ناموفق");
              }
            }}
          >
            ذخیره رمز جدید
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

/* --------------------------- عمومی و تاریخچه --------------------------- */

function GeneralTab() {
  const db = useDB();
  const toast = useToast();
  const [storeName, setStoreName] = useState(db.settings.storeName);
  const [resetOpen, setResetOpen] = useState(false);
  const [auditQ, setAuditQ] = useState("");

  function saveName() {
    try {
      settingsService.updateGeneral({ storeName });
      toast.push("ok", "نام فروشگاه ذخیره شد");
    } catch (e) {
      toast.push("err", e instanceof Error ? e.message : "ناموفق");
    }
  }

  const audit = db.audit.filter((a) => {
    const s = auditQ.trim();
    if (!s) return true;
    return (
      a.action.includes(s) || a.details.includes(s) || a.actorName.includes(s)
    );
  });

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="card p-4">
          <h3 className="font-display text-base text-ink">اطلاعات فروشگاه</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="lbl">نام فروشگاه</label>
              <div className="flex gap-2">
                <input className="inp flex-1" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                <Btn variant="dark" onClick={saveName}>
                  <IconCheck size={14} />
                  ذخیره
                </Btn>
              </div>
            </div>
          </div>
        </div>
        <div className="card border-danger/30 p-4">
          <h3 className="flex items-center gap-2 font-display text-base text-danger">
            <IconAlert size={17} />
            منطقه خطر
          </h3>
          <p className="mt-1 text-[11px] leading-5 text-inksoft">
            همه داده‌ها پاک و داده اولیه نمایشی دوباره ساخته می‌شود. فقط برای تست.
          </p>
          <Btn variant="danger" className="mt-3" onClick={() => setResetOpen(true)}>
            بازنشانی داده‌های نمایشی
          </Btn>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="flex items-center gap-2 font-display text-base text-ink">
            <IconHistory size={17} className="text-branddeep" />
            تاریخچه رویدادها
          </h3>
          <input className="inp w-44" placeholder="جستجو…" value={auditQ} onChange={(e) => setAuditQ(e.target.value)} />
        </div>
        <ul className="max-h-[54vh] divide-y divide-line overflow-y-auto">
          {audit.length === 0 ? (
            <li className="p-6 text-center text-xs text-inkmute">رویدادی نیست</li>
          ) : (
            audit.slice(0, 120).map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-black/[0.04] text-inksoft">
                  <IconHistory size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold text-ink">
                    {a.action}
                    <span className="ms-2 font-normal text-inkmute">{a.actorName}</span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-inksoft">{a.details}</p>
                </div>
                <span className="num shrink-0 text-[10px] text-inkmute">{fmtDateTime(a.at)}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="بازنشانی داده‌ها">
        <p className="text-sm leading-7 text-inksoft">
          مطمئنید؟ همه اجاره‌ها، مشتریان، پرداخت‌ها و تنظیمات فعلی پاک می‌شود و داده نمونه اولیه جایگزین می‌شود.
        </p>
        <div className="mt-4 flex gap-2">
          <Btn variant="outline" className="flex-1" onClick={() => setResetOpen(false)}>انصراف</Btn>
          <Btn
            variant="danger"
            className="flex-1"
            onClick={() => {
              settingsService.resetDemoData();
              setResetOpen(false);
              toast.push("ok", "داده‌ها بازنشانی شد");
            }}
          >
            بله، بازنشانی کن
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
