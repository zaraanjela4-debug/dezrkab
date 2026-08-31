/** هزینه‌های فروشگاه — تاریخچه هرگز حذف نمی‌شود */
import type { Expense } from "../domain/models";
import { mutate } from "../storage/storage";
import { money, uid } from "../utils/format";
import { auditService } from "./auditService";
import { authService, requirePerm } from "./authService";

export const expenseService = {
  add(input: { title: string; amount: number; accountId: string; note: string }): Expense {
    requirePerm(authService.requireUser(), "expense.manage");
    const title = input.title.trim();
    if (!title) throw new Error("عنوان هزینه الزامی است");
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("مبلغ هزینه باید بزرگ‌تر از صفر باشد");
    }
    return mutate((draft) => {
      const account = draft.settings.accounts.find((a) => a.id === input.accountId);
      if (!account) throw new Error("حساب پرداخت را انتخاب کنید");
      const expense: Expense = {
        id: uid(),
        title,
        amount: Math.round(input.amount),
        accountId: account.id,
        note: input.note.trim(),
        byId: authService.actorId(),
        at: Date.now(),
      };
      draft.expenses.unshift(expense);
      auditService.log(draft, "ثبت هزینه", "expense", expense.id, `${title} — ${money(expense.amount)}`);
      return expense;
    });
  },
};
