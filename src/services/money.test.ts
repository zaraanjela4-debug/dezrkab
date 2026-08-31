/**
 * تست خودکار L3 — فرمول‌های پولی سامانه
 * =====================================================================
 * فرمول‌های موجود (بدون هیچ تغییر) روی مسیر واقعی سرویس‌ها آزموده می‌شوند:
 *   - مبلغ اجاره:   زیرجمع − تخفیف = مبلغ نهایی        (rentalService)
 *   - جریمه تأخیر:  دقیقه قابل‌محاسبه × نرخ دقیقه‌ای × ضریب(۲) × تعداد دوچرخه (pricingService.lateBreakdown)
 *   - مانده:        مبلغ نهایی + جریمه − پرداخت‌شده = مانده      (paymentService)
 *   - پاداش مشتری:  مجموع(تعداد × مدت) فقط پس از تکمیل اجاره    (returnService)
 *
 * اجرا:  npx tsx src/services/money.test.ts
 * این فایل هرگز از باندل محصول import نمی‌شود و داده واقعی فروشگاه را لمس نمی‌کند.
 */

type LSStub = {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
};

const store = new Map<string, string>();
const stub: LSStub = {
  getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
  setItem: (k, v) => {
    store.set(k, v);
  },
  removeItem: (k) => {
    store.delete(k);
  },
};
(globalThis as { localStorage?: LSStub }).localStorage = stub;

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = ""): void {
  results.push({ name, ok, detail });
}

const H = 3_600_000;
const M = 60_000;

async function main(): Promise<void> {
  const storage = await import("../storage/storage");
  const { authService } = await import("./authService");
  const { rentalService } = await import("./rentalService");
  const { returnService } = await import("./returnService");
  const { paymentService } = await import("./paymentService");
  const { pricingService } = await import("./pricingService");
  const { customerService } = await import("./customerService");
  type RentalItem = import("../domain/models").RentalItem;

  authService.createFirstManager({ name: "مدیر تست پول", username: "money-boss", password: "money-test-1" });
  authService.login("money-boss", "money-test-1");

  const db0 = storage.getDB();
  const catA = db0.categories.find((c) => c.code === "A"); // 50,000
  const catB = db0.categories.find((c) => c.code === "B"); // 70,000
  const catC = db0.categories.find((c) => c.code === "C"); // 40,000
  if (!catA || !catB || !catC) throw new Error("seed categories missing");
  const threshold = db0.settings.rewardThresholdHours; // 4

  let custSeq = 0;
  const mkCustomer = () =>
    customerService.add({
      name: `مشتری تست ${++custSeq}`,
      phone: `0912${String(9000000 + custSeq)}`,
      idNumber: "",
      note: "",
    });

  const create = (
    custId: string,
    items: Array<{ categoryId: string; qty: number }>,
    hours: number,
    startAt: number,
    discountRate: number,
    consumeReward = false
  ) =>
    rentalService.createRental({
      customer: { id: custId },
      items,
      hours,
      startAt,
      note: "",
      discountRate,
      consumeReward,
      prepayAmount: 0,
      accountId: "acc-cash",
    });

  const returnAll = (rentalId: string, items: Array<{ categoryId: string; qty: number }>) =>
    returnService.processReturn({
      rentalId,
      returns: items,
      paymentAmount: 0,
      accountId: "acc-cash",
    });

  const custHours = (id: string) =>
    storage.getDB().customers.find((c) => c.id === id)?.completedHours ?? -1;

  /* ================= A/B: مبلغ اجاره با تخفیف ================= */
  const c1 = mkCustomer();
  const itemsA2 = [{ categoryId: catA.id, qty: 2 }];
  const rA = create(c1.id, itemsA2, 4, Date.now() - 4.5 * H, 0); // 2×50,000×4 = 400,000
  check(
    "A — 400,000 با 0٪ تخفیف → 400,000",
    rA.subtotal === 400_000 && rA.discount === 0 && rA.total === 400_000,
    `sub=${rA.subtotal} disc=${rA.discount} total=${rA.total}`
  );
  const rB = create(c1.id, itemsA2, 4, Date.now() - 4.5 * H, 30);
  check(
    "B — 400,000 با 30٪ تخفیف → 280,000",
    rB.subtotal === 400_000 && rB.discount === 120_000 && rB.total === 280_000,
    `disc=${rB.discount} total=${rB.total}`
  );
  check(
    "مانده با پرداخت صفر = کل مبلغ",
    paymentService.remainingFor(storage.getDB(), rA) === 400_000
  );
  returnAll(rA.id, [{ categoryId: catA.id, qty: 2 }]); // آزادسازی ناوگان (دیرکرد — بدون قفل گردش)
  returnAll(rB.id, [{ categoryId: catA.id, qty: 2 }]);

  /* ================= مرزهای تخفیف ۰/۱۰/۲۰/۳۰/۴۰ ================= */
  const c2 = mkCustomer();
  const boundaries: Array<[number, number]> = [
    [0, 0],
    [10, 4_000],
    [20, 8_000],
    [30, 12_000],
    [40, 16_000],
  ];
  for (const [rate, expected] of boundaries) {
    const r = create(c2.id, [{ categoryId: catC.id, qty: 1 }], 1, Date.now() - 1.5 * H, rate); // 40,000
    check(
      `تخفیف ${rate}٪ روی 40,000 → ${expected.toLocaleString("en-US")} و نهایی ${ (40_000 - expected).toLocaleString("en-US")}`,
      r.subtotal === 40_000 && r.discount === expected && r.total === 40_000 - expected,
      `disc=${r.discount} total=${r.total}`
    );
    returnAll(r.id, [{ categoryId: catC.id, qty: 1 }]);
  }

  /* ================= درستی گردکردن روی شبکه نرخ×مدت واقعی ================= */
  {
    let allInt = true;
    const durations = [0.5, 1, 1.5, 2, 3, 4, 24];
    for (const cat of db0.categories) {
      for (const h of durations) {
        for (const qty of [1, 2, 3]) {
          const sub = cat.hourlyRate * qty * h;
          if (!Number.isInteger(sub)) allInt = false;
          for (let rate = 0; rate <= 40; rate += 10) {
            if (!Number.isInteger(Math.round((sub * rate) / 100))) allInt = false;
          }
        }
      }
    }
    check("همه زیرجمع‌ها و تخفیف‌ها روی بازه‌های رسمی تومانِ صحیح‌اند", allInt);

    const q = pricingService.quote(db0, [{ categoryId: catA.id, qty: 3 }], 2, 0);
    check(
      "quote — زیرجمع = نرخ × تعداد × ساعت",
      q.subtotal === 50_000 * 3 * 2 && q.total === q.subtotal && q.discount === 0
    );
  }

  /* ================= C/D: جریمه تأخیر (مسیر خالص lateBreakdown) ================= */
  const items5: RentalItem[] = [
    { categoryId: catA.id, code: "A", name: "ساده", qty: 5, returnedQty: 0, hourlyRate: 50_000, deposit: 0 },
  ];
  const T = Date.now();
  const S = db0.settings; // grace=5 ، multiplier=2

  const b0 = pricingService.lateBreakdown(S, items5, T, T);
  check("بدون دیرکرد — همه صفر", b0.totalLateMinutes === 0 && b0.chargeableMinutes === 0 && b0.lateFee === 0);

  const b4 = pricingService.lateBreakdown(S, items5, T, T + 4 * M);
  check("4 دقیقه دیرکرد — داخل مهلت، جریمه صفر", b4.totalLateMinutes === 4 && b4.chargeableMinutes === 0 && b4.lateFee === 0);

  const b5 = pricingService.lateBreakdown(S, items5, T, T + 5 * M);
  check("دقیقاً 5 دقیقه (مرز مهلت) — رایگان", b5.totalLateMinutes === 5 && b5.chargeableMinutes === 0 && b5.lateFee === 0);

  const b6 = pricingService.lateBreakdown(S, items5, T, T + 6 * M);
  check(
    "6 دقیقه → 1 دقیقه قابل محاسبه",
    b6.chargeableMinutes === 1 && b6.lateFee === Math.round(1 * ((5 * 50_000) / 60) * 2),
    `fee=${b6.lateFee}`
  );

  const b12 = pricingService.lateBreakdown(S, items5, T, T + 12 * M);
  check(
    "C — 12 دقیقه واقعی → 5 بخشوده → 7 قابل محاسبه",
    b12.totalLateMinutes === 12 && b12.graceMinutes === 5 && b12.chargeableMinutes === 7,
    `${b12.totalLateMinutes}/${b12.graceMinutes}/${b12.chargeableMinutes}`
  );
  check(
    "D — 7 × نرخ دقیقه‌ای × 2 × 5 دوچرخه",
    b12.lateFee === Math.round(7 * ((5 * 50_000) / 60) * 2), // 58,333
    `fee=${b12.lateFee}`
  );

  const items1: RentalItem[] = [{ ...items5[0], qty: 1 }];
  const b12x1 = pricingService.lateBreakdown(S, items1, T, T + 12 * M);
  check(
    "همان 7 دقیقه با 1 دوچرخه — جریمه یک‌پنجم می‌شود",
    b12x1.lateFee === Math.round(7 * (50_000 / 60) * 2),
    `fee=${b12x1.lateFee}`
  );

  /* ================= E: پرداخت کامل → مانده صفر ================= */
  const c3 = mkCustomer();
  const rE = create(c3.id, [{ categoryId: catA.id, qty: 1 }], 5.6, Date.now(), 0); // 50,000×5.6 = 280,000
  check("E — ساخت: نهایی 280,000", rE.total === 280_000);
  paymentService.addPayment({ rentalId: rE.id, kind: "RENT", amount: 280_000, accountId: "acc-cash", note: "" });
  check("E — پرداخت کامل → مانده صفر", paymentService.remainingFor(storage.getDB(), rE) === 0);

  /* ================= F: 280,000 + جریمه 40,000 − 200,000 = 120,000 ================= */
  const c4 = mkCustomer();
  // سررسید = 28.5 دقیقه قبل از الان → دیرکرد واقعی 29 دقیقه → قابل محاسبه 24 → جریمه 40,000
  const rF = create(c4.id, [{ categoryId: catA.id, qty: 1 }], 5.6, Date.now() - (5.6 * H + 28.5 * M), 0);
  check("F — ساخت: نهایی 280,000", rF.total === 280_000);
  paymentService.addPayment({ rentalId: rF.id, kind: "RENT", amount: 200_000, accountId: "acc-cash", note: "پرداخت جزئی" });
  check("F — پرداخت جزئی: مانده قبل از برگشت 80,000", paymentService.remainingFor(storage.getDB(), rF) === 80_000);

  const resF = returnAll(rF.id, [{ categoryId: catA.id, qty: 1 }]);
  const rF2 = storage.getDB().rentals.find((r) => r.id === rF.id);
  if (!rF2) throw new Error("rental F missing");
  check(
    "F — 29 دقیقه دیرکرد: 5 بخشوده، 24 قابل محاسبه، جریمه 40,000",
    rF2.lateFee === 40_000 && resF.lateFee === 40_000,
    `lateFee=${rF2.lateFee}`
  );
  check(
    "F — مبلغ نهایی = 280,000 + 40,000 = 320,000",
    rF2.total === 320_000 && rF2.subtotal - rF2.discount + rF2.lateFee === rF2.total
  );
  check(
    "F — مانده = 320,000 − 200,000 = 120,000",
    paymentService.remainingFor(storage.getDB(), rF2) === 120_000
  );

  /* ================= G/H/I: ساعت‌های پاداش = مجموع(تعداد × مدت) ================= */
  const cG = mkCustomer();
  const rG = create(cG.id, [{ categoryId: catA.id, qty: 5 }], 1, Date.now() - 1.5 * H, 0);
  check("G — قبل از تکمیل، پاداش صفر است (هنگام ساخت اضافه نمی‌شود)", custHours(cG.id) === 0);
  returnAll(rG.id, [{ categoryId: catA.id, qty: 5 }]);
  check("G — 5 دوچرخه × 1 ساعت → 5 ساعت پاداش", custHours(cG.id) === 5, `hours=${custHours(cG.id)}`);
  check("G — با نصاب 4، تخفیف فعال می‌شود", custHours(cG.id) >= threshold);

  const cH = mkCustomer();
  const rH = create(cH.id, [{ categoryId: catB.id, qty: 3 }], 2, Date.now() - 2.5 * H, 0);
  returnAll(rH.id, [{ categoryId: catB.id, qty: 3 }]);
  check("H — 3 دوچرخه × 2 ساعت → 6 ساعت پاداش", custHours(cH.id) === 6, `hours=${custHours(cH.id)}`);

  /*
    I — مدل اجاره یک «مدت» مشترک برای همه دسته‌ها دارد؛ سناریوی مرجع
    (2×ساده×1h + 3×دنده‌ای×2h = 8h) با دو اجاره پیاپی همان مشتری آزموده می‌شود:
    فرمول Σ(تعداد × مدت) باید بین اجاره‌ها و دسته‌ها انباشته شود.
  */
  const cI = mkCustomer();
  const rI1 = create(cI.id, [{ categoryId: catA.id, qty: 2 }], 1, Date.now() - 1.5 * H, 0);
  returnAll(rI1.id, [{ categoryId: catA.id, qty: 2 }]);
  check("I-1 — 2×ساده×1h → 2 ساعت", custHours(cI.id) === 2, `hours=${custHours(cI.id)}`);
  const rI2 = create(cI.id, [{ categoryId: catB.id, qty: 3 }], 2, Date.now() - 2.5 * H, 0);
  returnAll(rI2.id, [{ categoryId: catB.id, qty: 3 }]);
  check("I-2 — + 3×دنده‌ای×2h → مجموع 8 ساعت", custHours(cI.id) === 8, `hours=${custHours(cI.id)}`);

  /* ================= consumeReward بدون واجد‌شرطی — بی‌اثر ================= */
  const cJ = mkCustomer(); // صفر ساعت
  const rJ = create(cJ.id, [{ categoryId: catA.id, qty: 1 }], 1, Date.now() - 1.5 * H, 0, true);
  check(
    "مصرف پاداش بدون استحقاق — تخفیف صفر و شمارنده دست‌نخورده",
    rJ.discount === 0 && custHours(cJ.id) === 0
  );
  returnAll(rJ.id, [{ categoryId: catA.id, qty: 1 }]);

  /* ------------------------------ گزارش ------------------------------ */
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    // eslint-disable-next-line no-console
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
  if (failed.length > 0) {
    throw new Error(`Money-formula tests failed: ${failed.map((f) => f.name).join(", ")}`);
  }
}

await main();

export {};
