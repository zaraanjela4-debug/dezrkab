/**
 * موتور قیمت‌گذاری مرکزی — تنها منبع محاسبه اجاره، جریمه تأخیر و گردش
 * هیچ صفحه‌ای منطق قیمت را برای خودش کپی نمی‌کند؛ همه از اینجا می‌خوانند.
 */
import type { DB, Rental, RentalItem, Settings } from "../domain/models";
import { getDB } from "../storage/storage";

export interface QuoteLine {
  categoryId: string;
  code: string;
  name: string;
  qty: number;
  hourlyRate: number;
  lineTotal: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  total: number;
}

export interface ReturnPreview {
  early: boolean;
  lateMinutes: number;
  lateFee: number;
}

export const pricingService = {
  quote(
    db: DB,
    items: Array<{ categoryId: string; qty: number }>,
    hours: number,
    discount: number
  ): Quote {
    const lines: QuoteLine[] = [];
    for (const it of items) {
      if (it.qty <= 0) continue;
      const cat = db.categories.find((c) => c.id === it.categoryId);
      if (!cat) throw new Error("دسته دوچرخه پیدا نشد");
      lines.push({
        categoryId: cat.id,
        code: cat.code,
        name: cat.name,
        qty: it.qty,
        hourlyRate: cat.hourlyRate,
        lineTotal: cat.hourlyRate * it.qty * hours,
      });
    }
    if (lines.length === 0) throw new Error("حداقل یک دسته دوچرخه انتخاب کنید");
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const disc = Math.min(Math.max(0, discount), subtotal);
    return { lines, subtotal, discount: disc, total: subtotal - disc };
  },

  /** جریمه تأخیر: هر ساعت تأخیر مازاد بر مهلت، با ضریب تنظیمی روی نرخ ساعتی */
  lateFeeFor(
    settings: Settings,
    items: RentalItem[],
    plannedEndAt: number,
    actualEndAt: number
  ): number {
    const graceMs = settings.graceMinutes * 60_000;
    const delayMs = actualEndAt - plannedEndAt - graceMs;
    if (delayMs <= 0) return 0;
    const lateHours = Math.ceil(delayMs / 3_600_000);
    const hourlyBase = items.reduce((s, i) => s + i.hourlyRate * i.qty, 0);
    return Math.round(lateHours * hourlyBase * settings.lateMultiplier);
  },

  /** پیش‌نمایش لحظه‌ای وضعیت برگشت همین حالا */
  previewReturn(db: DB, rental: Rental, now: number = Date.now()): ReturnPreview {
    const graceMs = db.settings.graceMinutes * 60_000;
    if (now <= rental.plannedEndAt + graceMs) {
      return { early: now < rental.plannedEndAt, lateMinutes: 0, lateFee: 0 };
    }
    const lateMinutes = Math.ceil((now - rental.plannedEndAt - graceMs) / 60_000);
    const lateFee = this.lateFeeFor(db.settings, rental.items, rental.plannedEndAt, now);
    return { early: false, lateMinutes, lateFee };
  },

  /** زمان آزادسازی دوچرخه بعد از برگشت — قانون گردش تنظیمات */
  releaseAt(db: DB, returnedEarly: boolean, now: number = Date.now()): number {
    return returnedEarly ? now + db.settings.releaseDelayMinutes * 60_000 : now;
  },

  activeSettings(): Settings {
    return getDB().settings;
  },
};
