/** گزارش‌ها — فقط مدیر؛ خواندن خالص از snapshot بدون هیچ تغییری */
import type { DB, Rental } from "../domain/models";
import { startOfDay } from "../utils/format";

export interface RangeReport {
  start: number;
  end: number;
  revenue: number;
  rentCollected: number;
  depositsIn: number;
  depositsOut: number;
  rentalCount: number;
  completedCount: number;
  settledCount: number;
  cancelledCount: number;
  activeNow: number;
  lateFees: number;
  discounts: number;
  expenses: number;
  net: number;
  byCategory: Array<{ code: string; name: string; units: number; revenue: number }>;
  topCustomers: Array<{ id: string; name: string; amount: number; count: number }>;
  daily: Array<{ day: number; label: string; revenue: number; rentals: number }>;
  recentRentals: Rental[];
}

const DAY = 86_400_000;
const dayFmt = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "numeric" });

export const reportService = {
  build(db: DB, start: number, end: number): RangeReport {
    const inRange = (t: number | null) => t !== null && t >= start && t < end;

    const pays = db.payments.filter((p) => inRange(p.createdAt));
    const rentCollected = pays
      .filter((p) => p.kind === "RENT" || p.kind === "CORRECTION" || p.kind === "DEPOSIT_APPLY")
      .reduce((s, p) => s + p.amount, 0);
    const depositsIn = pays.filter((p) => p.kind === "DEPOSIT").reduce((s, p) => s + p.amount, 0);
    const depositsOut = pays
      .filter((p) => p.kind === "DEPOSIT_REFUND")
      .reduce((s, p) => s + p.amount, 0);

    const created = db.rentals.filter((r) => inRange(r.createdAt));
    const completed = db.rentals.filter((r) => inRange(r.actualEndAt));
    const cancelled = db.rentals.filter((r) => inRange(r.cancelledAt));
    const activeNow = db.rentals.filter(
      (r) => r.status === "ACTIVE" || r.status === "PARTIAL"
    ).length;

    const lateFees = completed.reduce((s, r) => s + r.lateFee, 0);
    const discounts = created.reduce((s, r) => s + r.discount, 0);
    const expenses = db.expenses.filter((e) => inRange(e.at)).reduce((s, e) => s + e.amount, 0);

    const catMap = new Map<string, { code: string; name: string; units: number; revenue: number }>();
    for (const r of created) {
      for (const it of r.items) {
        const cur = catMap.get(it.categoryId) ?? { code: it.code, name: it.name, units: 0, revenue: 0 };
        cur.units += it.qty;
        cur.revenue += it.hourlyRate * it.qty * r.hours;
        catMap.set(it.categoryId, cur);
      }
    }

    const custMap = new Map<string, { name: string; amount: number; count: number }>();
    for (const p of pays.filter((p) => p.kind === "RENT" || p.kind === "CORRECTION" || p.kind === "DEPOSIT_APPLY")) {
      const r = db.rentals.find((x) => x.id === p.rentalId);
      if (!r) continue;
      const c = db.customers.find((x) => x.id === r.customerId);
      if (!c) continue;
      const cur = custMap.get(c.id) ?? { name: c.name, amount: 0, count: 0 };
      cur.amount += p.amount;
      custMap.set(c.id, cur);
    }
    for (const r of created) {
      const cur = custMap.get(r.customerId);
      if (cur) cur.count += 1;
    }

    const days: RangeReport["daily"] = [];
    const spanDays = Math.max(1, Math.round((end - start) / DAY));
    for (let i = 0; i < spanDays && i < 31; i++) {
      const d0 = start + i * DAY;
      const d1 = d0 + DAY;
      const rev = db.payments
        .filter(
          (p) =>
            (p.kind === "RENT" || p.kind === "CORRECTION" || p.kind === "DEPOSIT_APPLY") &&
            p.createdAt >= d0 &&
            p.createdAt < d1
        )
        .reduce((s, p) => s + p.amount, 0);
      const cnt = db.rentals.filter((r) => r.createdAt >= d0 && r.createdAt < d1).length;
      days.push({ day: d0, label: dayFmt.format(new Date(d0)), revenue: rev, rentals: cnt });
    }

    return {
      start,
      end,
      revenue: rentCollected,
      rentCollected,
      depositsIn,
      depositsOut,
      rentalCount: created.length,
      completedCount: completed.filter((r) => r.status !== "CANCELLED").length,
      settledCount: completed.filter((r) => r.status === "SETTLED").length,
      cancelledCount: cancelled.length,
      activeNow,
      lateFees,
      discounts,
      expenses,
      net: rentCollected - expenses,
      byCategory: [...catMap.values()].sort((a, b) => b.revenue - a.revenue),
      topCustomers: [...custMap.entries()]
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
      daily: days,
      recentRentals: [...db.rentals]
        .filter((r) => inRange(r.createdAt))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8),
    };
  },

  todayRange(): [number, number] {
    const s = startOfDay(Date.now());
    return [s, s + DAY];
  },
  yesterdayRange(): [number, number] {
    const s = startOfDay(Date.now()) - DAY;
    return [s, s + DAY];
  },
  last7Range(): [number, number] {
    return [startOfDay(Date.now()) - 6 * DAY, startOfDay(Date.now()) + DAY];
  },
  thisMonthRange(): [number, number] {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    const s = d.getTime();
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    return [s, e];
  },
};
