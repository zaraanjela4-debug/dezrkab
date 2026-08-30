/** تنظیمات سامانه — فقط مدیر؛ هیچ مقدار قابل‌تنظیمی hard-code نیست */
import type { DurationOption, PaymentAccount, Settings } from "../domain/models";
import { mutate, resetToSeed } from "../storage/storage";
import { uid } from "../utils/format";
import { auditService } from "./auditService";
import { authService, requirePerm } from "./authService";

export const settingsService = {
  updateGeneral(patch: Partial<Pick<Settings, "storeName" | "currency" | "graceMinutes" | "releaseDelayMinutes" | "lateMultiplier">>): void {
    requirePerm(authService.requireUser(), "settings.manage");
    mutate((draft) => {
      if (patch.storeName !== undefined) {
        if (!patch.storeName.trim()) throw new Error("نام فروشگاه نمی‌تواند خالی باشد");
        draft.settings.storeName = patch.storeName.trim();
      }
      if (patch.graceMinutes !== undefined) {
        if (patch.graceMinutes < 0) throw new Error("مهلت تأخیر نامعتبر است");
        draft.settings.graceMinutes = patch.graceMinutes;
      }
      if (patch.releaseDelayMinutes !== undefined) {
        if (patch.releaseDelayMinutes < 0) throw new Error("زمان گردش نامعتبر است");
        draft.settings.releaseDelayMinutes = patch.releaseDelayMinutes;
      }
      if (patch.lateMultiplier !== undefined) {
        if (patch.lateMultiplier < 1 || patch.lateMultiplier > 5) {
          throw new Error("ضریب جریمه باید بین ۱ تا ۵ باشد");
        }
        draft.settings.lateMultiplier = patch.lateMultiplier;
      }
      authService.withActor(draft, (d) =>
        auditService.log(d, "تغییر تنظیمات", "settings", "general", "تنظیمات عمومی به‌روزرسانی شد")
      );
    });
  },

  setDurations(durations: DurationOption[]): void {
    requirePerm(authService.requireUser(), "settings.manage");
    if (durations.length === 0) throw new Error("حداقل یک بازه زمانی لازم است");
    mutate((draft) => {
      draft.settings.durations = [...durations].sort((a, b) => a.hours - b.hours);
      authService.withActor(draft, (d) =>
        auditService.log(d, "تغییر بازه‌های اجاره", "settings", "durations", durations.map((x) => x.label).join("، "))
      );
    });
  },

  addAccount(name: string, kind: string): PaymentAccount {
    requirePerm(authService.requireUser(), "settings.manage");
    const trimmed = name.trim();
    if (!trimmed) throw new Error("نام حساب پرداخت الزامی است");
    return mutate((draft) => {
      if (draft.settings.accounts.some((a) => a.name === trimmed)) {
        throw new Error("حسابی با این نام وجود دارد");
      }
      const acc: PaymentAccount = { id: uid(), name: trimmed, kind, active: true };
      draft.settings.accounts.push(acc);
      authService.withActor(draft, (d) =>
        auditService.log(d, "افزودن حساب پرداخت", "account", acc.id, trimmed)
      );
      return acc;
    });
  },

  toggleAccount(id: string): void {
    requirePerm(authService.requireUser(), "settings.manage");
    mutate((draft) => {
      const acc = draft.settings.accounts.find((a) => a.id === id);
      if (!acc) throw new Error("حساب پیدا نشد");
      acc.active = !acc.active;
      authService.withActor(draft, (d) =>
        auditService.log(d, acc.active ? "فعال‌سازی حساب پرداخت" : "غیرفعال‌سازی حساب پرداخت", "account", id, acc.name)
      );
    });
  },

  /** بازنشانی داده‌های نمایشی (خطرناک) */
  resetDemoData(): void {
    requirePerm(authService.requireUser(), "settings.manage");
    resetToSeed();
  },
};
