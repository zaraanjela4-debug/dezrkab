import { useState, type FormEvent } from "react";
import { navigate, useAuth, useNow } from "../state/app";
import { useDB } from "../storage/storage";
import { fmtDateFull, fmtTime, fmtWeekday } from "../utils/format";

import { Btn } from "../ui/kit";
import { IconBike, IconLock, IconUser } from "../ui/icons";

function Wheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="3.5" />
      <g
        className="wheel-spin"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        stroke="#FF8A00"
        strokeWidth="2"
      >
        <line x1={cx - r + 4} y1={cy} x2={cx + r - 4} y2={cy} />
        <line x1={cx} y1={cy - r + 4} x2={cx} y2={cy + r - 4} />
        <line x1={cx - r + 7} y1={cy - r + 7} x2={cx + r - 7} y2={cy + r - 7} />
        <line x1={cx - r + 7} y1={cy + r - 7} x2={cx + r - 7} y2={cy - r + 7} />
      </g>
      <circle cx={cx} cy={cy} r="3.5" fill="#FF8A00" />
    </g>
  );
}

function BikeArt() {
  return (
    <svg viewBox="0 0 230 130" className="w-full max-w-sm text-white/90" aria-hidden>
      <Wheel cx={52} cy={92} r={30} />
      <Wheel cx={178} cy={92} r={30} />
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M52 92 92 46h42l44 46" />
        <path d="M92 46 116 92h-64M116 92 134 46" />
        <path d="M88 38h14M134 46l6-12h12" />
      </g>
      <circle cx="116" cy="92" r="5" fill="#FF8A00" />
    </svg>
  );
}

export default function Login() {
  const db = useDB();
  const { doLogin } = useAuth();
  const now = useNow(1000);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [errKey, setErrKey] = useState(0);
  const [busy, setBusy] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    window.setTimeout(() => {
      try {
        doLogin(username, password);
        navigate("dashboard");
      } catch (ex) {
        setErr(ex instanceof Error ? ex.message : "ورود ناموفق بود");
        setErrKey((k) => k + 1);
      } finally {
        setBusy(false);
      }
    }, 350);
  }

  return (
    <div className="flex min-h-screen">
      {/* پنل برند */}
      <aside className="dots-bg relative hidden flex-1 flex-col justify-between overflow-hidden bg-coal p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #FF8A00 0%, transparent 65%)" }}
        />
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-brand text-white shadow-[0_6px_20px_rgba(255,138,0,0.4)]">
            <IconBike size={26} />
          </span>
          <div>
            <h1 className="font-display text-2xl leading-7">{db.settings.storeName}</h1>
            <p className="text-xs text-white/50">سامانه داخلی اجاره حضوری دوچرخه</p>
          </div>
        </div>

        <div className="anim-up flex flex-col items-start gap-6">
          <BikeArt />
          <div>
            <h2 className="font-display text-4xl leading-tight text-white">
              پیشخوانِ رکاب‌زنانِ امروز
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-7 text-white/60">
              موجودی زنده دسته‌ها، اجاره حضوری در چند ثانیه، برگشت و تسویه شفاف —
              همه در یک پنجره کاری.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["موجودی زنده", "اجاره حضوری", "تسویه سریع", "گزارش روزانه"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="font-display text-5xl text-brand">{fmtTime(now)}</p>
            <p className="mt-1 text-xs text-white/50">
              {fmtWeekday(now)} — {fmtDateFull(now)}
            </p>
          </div>
          <p className="text-[11px] text-white/35">نسخه داخلی فروشگاه — تک‌شعبه‌ای</p>
        </div>
      </aside>

      {/* فرم ورود */}
      <main className="flex flex-1 items-center justify-center bg-paper p-6">
        <div className="anim-pop w-full max-w-sm">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-brand text-white">
              <IconBike size={22} />
            </span>
            <h1 className="font-display text-2xl">{db.settings.storeName}</h1>
          </div>

          <div className="card p-6">
            <h2 className="font-display text-2xl text-ink">ورود به سامانه</h2>
            <p className="mt-1 text-xs text-inksoft">برای ادامه، حساب کاربری خود را وارد کنید</p>

            {err ? (
              <div
                key={errKey}
                className="anim-shake mt-4 rounded-lg border border-danger/30 bg-dangersoft px-3 py-2.5 text-xs font-bold text-danger"
              >
                {err}
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="lbl">نام کاربری</label>
                <div className="relative">
                  <input
                    className="inp pe-3 ps-10"
                    dir="ltr"
                    style={{ textAlign: "left" }}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    autoFocus
                  />
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-inkmute">
                    <IconUser size={17} />
                  </span>
                </div>
              </div>
              <div>
                <label className="lbl">رمز عبور</label>
                <div className="relative">
                  <input
                    className="inp pe-3 ps-10"
                    dir="ltr"
                    style={{ textAlign: "left" }}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                  />
                  <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-inkmute">
                    <IconLock size={17} />
                  </span>
                </div>
              </div>
              <Btn type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? "در حال بررسی…" : "ورود"}
              </Btn>
            </form>
          </div>

          <div className="card mt-4 p-4">
            <p className="text-[11px] font-bold text-inkmute">دسترسی آزمایشی (نسخه نمایشی)</p>
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-2">
                <span className="font-bold text-ink">مدیر فروشگاه</span>
                <code className="num text-inksoft" dir="ltr">
                  manager / 1234
                </code>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-2">
                <span className="font-bold text-ink">فروشنده</span>
                <code className="num text-inksoft" dir="ltr">
                  seller / 1234
                </code>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
