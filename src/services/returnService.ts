/**
 * برگشت دوچرخه — کامل یا نسبی
 * برگشت زودهنگام: دوچرخه همان لحظه (با قانون گردش تنظیمات) آزاد می‌شود،
 * نه اینکه تا پایان برنامه‌ریزی‌شده بلوکه بماند.
 * جریمه تأخیر فقط از pricingService می‌آید — منطق تکراری nowhere.
 */
import type { Rental } from "../domain/models";
import { mutate } from "../storage/storage";
import { faNum, money } from "../utils/format";
import { auditService } from "./auditService";
import { authService, requirePerm } from "./authService";
import { paymentService } from "./paymentService";
import { pricingService } from "./pricingService";

export interface ReturnInput {
  rentalId: string;
  /** تعداد برگشتی به‌تفکیک دسته */
  returns: Array<{ categoryId: string; qty: number }>;
  paymentAmount: number;
  accountId: string;
}

export interface ReturnResult {
  rental: Rental;
  full: boolean;
  lateFee: number;
  releasedCount: number;
}

export const returnService = {
  processReturn(input: ReturnInput): ReturnResult {
    const me = authService.requireUser();
    requirePerm(me, "return.process");

    const returns = input.returns.filter((r) => r.qty > 0);
    if (returns.length === 0) throw new Error("تعداد برگشتی را مشخص کنید");

    return mutate((draft) => {
      const rental = draft.rentals.find((r) => r.id === input.rentalId);
      if (!rental) throw new Error("اجاره پیدا نشد");
      if (rental.status !== "ACTIVE" && rental.status !== "PARTIAL") {
        throw new Error("این اجاره در جریان نیست و قابل برگشت نیست");
      }

      const now = Date.now();
      const early = now < rental.plannedEndAt;
      let released = 0;

      for (const ret of returns) {
        const item = rental.items.find((i) => i.categoryId === ret.categoryId);
        if (!item) throw new Error("دسته در این اجاره وجود ندارد");
        const outstanding = item.qty - item.returnedQty;
        if (ret.qty > outstanding) {
          throw new Error(
            `از «${item.name}» فقط ${faNum(outstanding)} دستگاه بیرون است`
          );
        }
        // آزادسازی دقیقاً همان تعداد — با قانون گردش
        const bikes = draft.bikes.filter((b) => b.rentalId === rental.id && b.categoryId === ret.categoryId);
        if (bikes.length < ret.qty) {
          throw new Error("سازگاری موجودی به هم خورده است — با مدیر بررسی کنید");
        }
        const releaseAt = pricingService.releaseAt(draft, early, now);
        for (const bike of bikes.slice(0, ret.qty)) {
          bike.status = "AVAILABLE";
          bike.rentalId = null;
          bike.availableAt = releaseAt;
          released++;
        }
        item.returnedQty += ret.qty;
      }

      const full = rental.items.every((i) => i.returnedQty >= i.qty);
      let lateFee = 0;

      if (full) {
        rental.actualEndAt = now;
        lateFee = pricingService.lateFeeFor(draft.settings, rental.items, rental.plannedEndAt, now);
        rental.lateFee = lateFee;
        rental.total = rental.subtotal - rental.discount + lateFee;
        rental.status = "COMPLETED";
        // اگر از قبل کامل پرداخت شده باشد، مستقیم تسویه می‌شود
        if (paymentService.paidFor(draft, rental.id) >= rental.total) {
          rental.status = "SETTLED";
        }
      } else {
        rental.status = "PARTIAL";
      }

      if (input.paymentAmount > 0) {
        paymentService.applyPayment(draft, {
          rentalId: rental.id,
          kind: "RENT",
          amount: input.paymentAmount,
          accountId: input.accountId,
          note: full ? "دریافت هنگام تسویه" : "دریافت هنگام برگشت نسبی",
        });
      }

      const detail = [
        `اجاره #${faNum(rental.number)}`,
        returns
          .map((r) => {
            const item = rental.items.find((i) => i.categoryId === r.categoryId);
            return `${faNum(r.qty)} × ${item?.name ?? ""}`;
          })
          .join("، "),
        full ? "برگشت کامل" : "برگشت نسبی",
        lateFee > 0 ? `جریمه تأخیر ${money(lateFee)}` : early ? "زودهنگام" : "به‌موقع",
      ].join(" — ");

      authService.withActor(draft, (d) =>
        auditService.log(d, "برگشت اجاره", "rental", rental.id, detail)
      );

      return { rental, full, lateFee, releasedCount: released };
    });
  },

  /** منظورکردن ودیعه به مانده + بازگشت باقی آن — تسویه یک‌ضرب */
  settleWithDeposit(rentalId: string): Rental {
    const me = authService.requireUser();
    requirePerm(me, "return.process");
    return mutate((draft) => {
      const rental = draft.rentals.find((r) => r.id === rentalId);
      if (!rental) throw new Error("اجاره پیدا نشد");
      if (rental.status !== "COMPLETED" && rental.status !== "PARTIAL" && rental.status !== "ACTIVE") {
        throw new Error("این اجاره قابل تسویه با ودیعه نیست");
      }
      const held = paymentService.depositHeldFor(draft, rentalId);
      if (held <= 0) throw new Error("ودیعه‌ای نزد فروشگاه نیست");
      const remaining = paymentService.remainingFor(draft, rental);
      if (remaining <= 0) throw new Error("مانده‌ای برای تسویه وجود ندارد");

      const applied = Math.min(held, remaining);
      const cashAccount = draft.settings.accounts.find((a) => a.id === "acc-cash") ?? draft.settings.accounts[0];
      paymentService.applyPayment(draft, {
        rentalId,
        kind: "DEPOSIT_APPLY",
        amount: applied,
        accountId: cashAccount.id,
        note: "منظورکردن ودیعه به مانده اجاره",
      });
      const rest = held - applied;
      if (rest > 0) {
        paymentService.applyPayment(draft, {
          rentalId,
          kind: "DEPOSIT_REFUND",
          amount: rest,
          accountId: cashAccount.id,
          note: "بازگشت باقی ودیعه به مشتری",
        });
      }
      if (rental.status === "COMPLETED") {
        const newRemaining = paymentService.remainingFor(draft, rental);
        if (newRemaining <= 0) rental.status = "SETTLED";
      }
      authService.withActor(draft, (d) =>
        auditService.log(d, "تسویه با ودیعه", "rental", rentalId, `اجاره #${faNum(rental.number)} — ${money(applied)} از ودیعه منظور شد`)
      );
      return rental;
    });
  },

  refundDeposit(rentalId: string, amount: number, accountId: string): void {
    const me = authService.requireUser();
    requirePerm(me, "return.process");
    mutate((draft) => {
      paymentService.applyPayment(draft, {
        rentalId,
        kind: "DEPOSIT_REFUND",
        amount,
        accountId,
        note: "بازگشت ودیعه به مشتری",
      });
      const rental = draft.rentals.find((r) => r.id === rentalId);
      authService.withActor(draft, (d) =>
        auditService.log(d, "بازگشت ودیعه", "payment", rentalId, `اجاره #${faNum(rental?.number ?? 0)} — ${money(amount)}`)
      );
    });
  },
};
