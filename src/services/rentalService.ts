/**
 * اجاره حضوری — قلب سامانه
 * اعتبارسنجی و commit داخل همان mutate اتمیک انجام می‌شود؛
 * دو درخواست همزمان هرگز نمی‌توانند موجودی را منفی کنند (oversell ممنوع).
 */
import type { Rental, RentalStatus } from "../domain/models";
import { mutate } from "../storage/storage";
import { faNum, uid } from "../utils/format";
import { auditService } from "./auditService";
import { authService, requirePerm } from "./authService";
import { availabilityService } from "./availabilityService";
import { paymentService } from "./paymentService";
import { pricingService } from "./pricingService";

export const STATUS_LABEL: Record<RentalStatus, string> = {
  DRAFT: "پیش‌نویس",
  ACTIVE: "فعال",
  PARTIAL: "برگشت نسبی",
  SETTLED: "تسویه‌شده",
  COMPLETED: "تکمیل‌شده",
  CANCELLED: "لغوشده",
};

export interface CreateRentalInput {
  customerId: string;
  items: Array<{ categoryId: string; qty: number }>;
  hours: number;
  startAt: number;
  discount: number;
  note: string;
  depositAmount: number;
  accountId: string;
}

export const rentalService = {
  createRental(input: CreateRentalInput): Rental {
    const me = authService.requireUser();
    requirePerm(me, "rental.create");

    const items = input.items.filter((i) => i.qty > 0);
    if (items.length === 0) throw new Error("حداقل یک دوچرخه انتخاب کنید");
    if (!Number.isFinite(input.hours) || input.hours <= 0) {
      throw new Error("مدت اجاره نامعتبر است");
    }

    return mutate((draft) => {
      const customer = draft.customers.find((c) => c.id === input.customerId);
      if (!customer) throw new Error("مشتری را انتخاب یا ثبت کنید");
      for (const c of draft.categories) {
        if (!c.active && items.some((i) => i.categoryId === c.id)) {
          throw new Error(`دسته «${c.name}» غیرفعال است`);
        }
      }

      // بررسی موجودی قبل از هر تغییری — تراکنش یا کامل انجام می‌شود یا اصلاً
      for (const it of items) {
        const cat = draft.categories.find((c) => c.id === it.categoryId);
        if (!cat) throw new Error("دسته دوچرخه پیدا نشد");
        const avail = availabilityService.availableCount(draft, it.categoryId);
        if (it.qty > avail) {
          throw new Error(
            avail === 0
              ? `«${cat.name}» در حال حاضر موجود نیست`
              : `موجودی «${cat.name}» کافی نیست — فقط ${faNum(avail)} دستگاه موجود است`
          );
        }
      }

      const quote = pricingService.quote(draft, items, input.hours, input.discount);
      const now = Date.now();
      const rental: Rental = {
        id: uid(),
        number: draft.seq.rental++,
        customerId: customer.id,
        items: quote.lines.map((l) => ({
          categoryId: l.categoryId,
          code: l.code,
          name: l.name,
          qty: l.qty,
          returnedQty: 0,
          hourlyRate: l.hourlyRate,
          deposit: l.deposit,
        })),
        startAt: input.startAt || now,
        hours: input.hours,
        plannedEndAt: (input.startAt || now) + input.hours * 3_600_000,
        actualEndAt: null,
        subtotal: quote.subtotal,
        discount: quote.discount,
        lateFee: 0,
        depositTotal: quote.depositTotal,
        total: quote.total,
        status: "ACTIVE",
        note: input.note.trim(),
        cancelledAt: null,
        cancelReason: "",
        createdBy: me.id,
        createdAt: now,
      };

      // تخصیص دوچرخه‌های فیزیکی — به‌ترتیب شماره، از موجودهای آزاد
      for (const it of items) {
        const free = draft.bikes
          .filter(
            (b) =>
              b.categoryId === it.categoryId &&
              b.status === "AVAILABLE" &&
              b.availableAt <= now
          )
          .sort((a, b) => a.serial.localeCompare(b.serial))
          .slice(0, it.qty);
        if (free.length < it.qty) {
          throw new Error("هم‌زمانی تراکنش — موجودی کافی نیست، دوباره تلاش کنید");
        }
        for (const bike of free) {
          bike.status = "RENTED";
          bike.rentalId = rental.id;
        }
      }

      draft.rentals.unshift(rental);

      if (input.depositAmount > 0) {
        paymentService.applyPayment(draft, {
          rentalId: rental.id,
          kind: "DEPOSIT",
          amount: input.depositAmount,
          accountId: input.accountId,
          note: "ودیعه هنگام اجاره",
        });
      }

      authService.withActor(draft, (d) =>
        auditService.log(
          d,
          "ایجاد اجاره",
          "rental",
          rental.id,
          `اجاره #${faNum(rental.number)} — ${rental.items
            .map((i) => `${faNum(i.qty)} × ${i.name}`)
            .join("، ")} برای ${customer.name}`
        )
      );
      return rental;
    });
  },

  /** لغو اجاره — موجودی آزاد می‌شود، رکورد برای همیشه حفظ می‌شود */
  cancelRental(rentalId: string, reason: string): Rental {
    const me = authService.requireUser();
    requirePerm(me, "rental.create");
    return mutate((draft) => {
      const rental = draft.rentals.find((r) => r.id === rentalId);
      if (!rental) throw new Error("اجاره پیدا نشد");
      if (rental.status !== "ACTIVE") {
        throw new Error("فقط اجاره فعال قابل لغو است");
      }
      for (const bike of draft.bikes) {
        if (bike.rentalId === rental.id) {
          bike.status = "AVAILABLE";
          bike.rentalId = null;
          bike.availableAt = 0;
        }
      }
      rental.status = "CANCELLED";
      rental.cancelledAt = Date.now();
      rental.cancelReason = reason.trim();
      authService.withActor(draft, (d) =>
        auditService.log(
          d,
          "لغو اجاره",
          "rental",
          rental.id,
          `اجاره #${faNum(rental.number)} لغو شد${reason.trim() ? ` — دلیل: ${reason.trim()}` : ""}`
        )
      );
      return rental;
    });
  },

  byNumber(dbRentalNumber: number) {
    return dbRentalNumber;
  },
};
