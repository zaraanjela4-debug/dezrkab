/**
 * تست کنترل‌شده H1 — شکست ذخیره‌سازی
 * =====================================================================
 * شبیه‌سازی پرتاب localStorage.setItem() و بررسی:
 *   1. شکست persist تشخیص داده می‌شود (StorageWriteError)
 *   2. state جدید بی‌صدا commit نمی‌شود
 *   3. آخرین وضعیت سالم (last-good) دست‌نخورده می‌ماند
 *   4. پیام فارسی صحیح به کاربر می‌رسد
 *   5. بعد از «بارگذاری مجدد» وضعیت سالم باقی است
 *   6. تراکنش نیمه‌کاره (دوچرخه/پرداخت یتیم) باقی نمی‌ماند
 *   7. پس از رفع خطا، تلاش مجدد موفق است (retry)
 *
 * اجرا:  npx tsx src/storage/storage.test.ts
 * (یا import از هر runner دلخواه) — این فایل هرگز از باندل محصول import نمی‌شود.
 */

type LSStub = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

/* ---------- حافظه آزمایشگاهی: localStorage جعلی با کلید شکست ---------- */
const store = new Map<string, string>();
let failWrites = false;
let setItemCalls = 0;

const stub: LSStub = {
  getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k, v) => {
    setItemCalls++;
    if (failWrites) throw new DOMException("QuotaExceededError", "QuotaExceededError");
    store.set(k, v);
  },
  removeItem: (k) => {
    store.delete(k);
  },
};

(globalThis as { localStorage?: LSStub }).localStorage = stub;

/* ------------------------------ harness ------------------------------ */
const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = ""): void {
  results.push({ name, ok, detail });
}

const EXPECTED_MSG = "ذخیره‌سازی ناموفق بود. اطلاعات تغییر نکرد.";

/* -------------------------------- تست‌ها -------------------------------- */
async function main(): Promise<void> {
  const storage = await import("./storage");
  const { authService } = await import("../services/authService");
  const { customerService } = await import("../services/customerService");
  const { rentalService } = await import("../services/rentalService");
  const { paymentService } = await import("../services/paymentService");
  const { availabilityService } = await import("../services/availabilityService");

  /* ============ T0: راه‌اندازی اولیه (M3) — بدون حساب پیش‌فرض ============ */
  {
    const needsBefore = authService.needsSetup();
    const mgr = authService.createFirstManager({
      name: "مدیر آزمایش",
      username: "boss",
      password: "test-pass-1",
    });
    check("T0a — needsSetup() در حالت اولیه true بود", needsBefore);
    check("T0b — حساب مدیر با رمز انتخابی ساخته شد", mgr.role === "MANAGER" && mgr.active && mgr.username === "boss");
    check("T0c — بعد از ساخت مدیر، راه‌اندازی اولیه بسته شد", !authService.needsSetup());
    let dup: unknown = null;
    try {
      authService.createFirstManager({ name: "دوم", username: "second", password: "whatever" });
    } catch (e) {
      dup = e;
    }
    check("T0d — ساخت مدیر دوم مسدود شد", dup instanceof Error);
  }

  authService.login("boss", "test-pass-1"); // نشست روی stub — بدون شکست
  const db0 = storage.getDB();
  const catA = db0.categories.find((c) => c.code === "A");
  const cus1 = db0.customers[0];
  if (!catA || !cus1) throw new Error("seed data missing");

  /* ============ T1: mutation مشتری زیر شکست persist ============ */
  {
    const before = storage.getDB().customers.length;
    const lastGood = store.get(storage.KEYS.db) as string;
    failWrites = true;
    let caught: unknown = null;
    try {
      customerService.add({ name: "تست اچ‌وان", phone: "09120000099", idNumber: "", note: "" });
    } catch (e) {
      caught = e;
    }
    failWrites = false;

    check("T1a — StorageWriteError پرتاب شد", caught instanceof storage.StorageWriteError);
    check(
      "T1b — پیام فارسی صحیح",
      caught instanceof Error && caught.message === EXPECTED_MSG,
      caught instanceof Error ? caught.message : "no error"
    );
    check("T1c — state حافظه commit نشد", storage.getDB().customers.length === before);
    check("T1d — last-good روی دیسک دست‌نخورده", store.get(storage.KEYS.db) === lastGood);

    // تلاش مجدد پس از رفع خطا
    const retried = customerService.add({ name: "تست اچ‌وان", phone: "09120000099", idNumber: "", note: "" });
    check("T1e — retry موفق", storage.getDB().customers.length === before + 1 && !!retried.id);
    check(
      "T1f — persist جدید شامل مشتری است",
      (store.get(storage.KEYS.db) as string).includes("09120000099")
    );
  }

  /* ============ T2: mutation اجاره زیر شکست persist ============ */
  {
    const dbBefore = storage.getDB();
    const rentalsBefore = dbBefore.rentals.length;
    const rentedBefore = dbBefore.bikes.filter((b) => b.status === "RENTED").length;
    const availBefore = availabilityService.availableCount(dbBefore, catA.id);
    const lastGood = store.get(storage.KEYS.db) as string;

    failWrites = true;
    let caught: unknown = null;
    try {
      rentalService.createRental({
        customer: { id: cus1.id },
        items: [{ categoryId: catA.id, qty: 1 }],
        hours: 1,
        startAt: Date.now(),
        note: "",
        discountRate: 0,
        consumeReward: false,
        prepayAmount: 0,
        accountId: "acc-cash",
      });
    } catch (e) {
      caught = e;
    }
    failWrites = false;

    const dbAfter = storage.getDB();
    check("T2a — StorageWriteError پرتاب شد", caught instanceof storage.StorageWriteError);
    check("T2b — rentals تغییر نکرد", dbAfter.rentals.length === rentalsBefore);
    check(
      "T2c — موجودی/دوچرخه‌ها تغییر نکرد",
      dbAfter.bikes.filter((b) => b.status === "RENTED").length === rentedBefore &&
        availabilityService.availableCount(dbAfter, catA.id) === availBefore
    );
    check("T2d — last-good روی دیسک دست‌نخورده", store.get(storage.KEYS.db) === lastGood);

    // بررسی تراکنش نیمه‌کاره: هیچ دوچرخه‌ای به اجاره‌ی ناموجود اشاره نکند
    const rentalIds = new Set(dbAfter.rentals.map((r) => r.id));
    const orphans = dbAfter.bikes.filter((b) => b.rentalId !== null && !rentalIds.has(b.rentalId));
    check("T2e — دوچرخه یتیم وجود ندارد", orphans.length === 0);
  }

  /* ============ T3: mutation پرداخت زیر شکست persist ============ */
  {
    // ابتدا یک اجاره موفق برای پرداخت
    const rental = rentalService.createRental({
      customer: { id: cus1.id },
      items: [{ categoryId: catA.id, qty: 1 }],
      hours: 1,
      startAt: Date.now(),
      note: "",
      discountRate: 0,
      consumeReward: false,
      prepayAmount: 0,
      accountId: "acc-cash",
    });

    const paysBefore = storage.getDB().payments.length;
    const lastGood = store.get(storage.KEYS.db) as string;

    failWrites = true;
    let caught: unknown = null;
    try {
      paymentService.addPayment({
        rentalId: rental.id,
        kind: "RENT",
        amount: 10_000,
        accountId: "acc-cash",
        note: "تست",
      });
    } catch (e) {
      caught = e;
    }
    failWrites = false;

    const dbAfter = storage.getDB();
    check("T3a — StorageWriteError پرتاب شد", caught instanceof storage.StorageWriteError);
    check("T3b — payments تغییر نکرد", dbAfter.payments.length === paysBefore);
    check("T3c — last-good روی دیسک دست‌نخورده", store.get(storage.KEYS.db) === lastGood);

    // پرداخت یتیم: هیچ پرداختی به اجاره ناموجود اشاره نکند
    const rentalIds = new Set(dbAfter.rentals.map((r) => r.id));
    const orphanPays = dbAfter.payments.filter((p) => p.rentalId !== null && !rentalIds.has(p.rentalId));
    check("T3d — پرداخت یتیم وجود ندارد", orphanPays.length === 0);

    // تلاش مجدد موفق
    paymentService.addPayment({ rentalId: rental.id, kind: "RENT", amount: 10_000, accountId: "acc-cash", note: "تست" });
    check("T3e — retry موفق", storage.getDB().payments.length === paysBefore + 1);
  }

  /* ============ T4: شبیه‌سازی reload — last-good باقی است ============ */
  {
    const persistedRaw = store.get(storage.KEYS.db) as string;
    const persisted = JSON.parse(persistedRaw) as ReturnType<typeof storage.getDB>;
    const mem = storage.getDB();
    check(
      "T4a — دیسک و حافظه هم‌خوان (rev)",
      persisted.rev === mem.rev,
      `disk=${persisted.rev} mem=${mem.rev}`
    );
    check(
      "T4b — تعداد رکوردهای دیسک و حافظه برابر",
      persisted.customers.length === mem.customers.length &&
        persisted.rentals.length === mem.rentals.length &&
        persisted.payments.length === mem.payments.length &&
        persisted.bikes.length === mem.bikes.length
    );
    check("T4c — persist واقعاً انجام شده (setItem > 0)", setItemCalls > 0);
  }

  /* ------------------------------ گزارش ------------------------------ */
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
  if (failed.length > 0) {
    throw new Error(`H1 persistence-failure test failed: ${failed.map((f) => f.name).join(", ")}`);
  }
}

await main();

export {};

