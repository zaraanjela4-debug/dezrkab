/** احراز هویت داخلی + دسترسی‌ها — نشست پایدار، بدون رمز خام در state */
import type { DB, Role, User } from "../domain/models";
import { getDB, mutate, sessionStore } from "../storage/storage";
import { hashPassword, verifyPassword } from "../utils/hash";
import { auditService } from "./auditService";

export type Perm =
  | "rental.create"
  | "return.process"
  | "payment.receive"
  | "payment.correct"
  | "customer.manage"
  | "inventory.manage"
  | "maintenance.manage"
  | "expense.manage"
  | "reports.view"
  | "settings.manage"
  | "users.manage"
  | "bikes.service";

const MANAGER_PERMS: Perm[] = [
  "rental.create",
  "return.process",
  "payment.receive",
  "payment.correct",
  "customer.manage",
  "inventory.manage",
  "maintenance.manage",
  "expense.manage",
  "reports.view",
  "settings.manage",
  "users.manage",
  "bikes.service",
];

const SELLER_PERMS: Perm[] = [
  "rental.create",
  "return.process",
  "payment.receive",
  "customer.manage",
];

const GRANTS: Record<Role, Perm[]> = {
  MANAGER: MANAGER_PERMS,
  SELLER: SELLER_PERMS,
};

export function can(user: User | null, perm: Perm): boolean {
  return !!user && GRANTS[user.role].includes(perm);
}

export function requirePerm(user: User | null, perm: Perm): void {
  if (!can(user, perm)) {
    throw new Error("دسترسی کافی برای این عملیات ندارید");
  }
}

export const authService = {
  login(username: string, password: string): User {
    const u = (username || "").trim().toLowerCase();
    const user = getDB().users.find(
      (x) => x.username.toLowerCase() === u && x.active
    );
    if (!user || !verifyPassword(password, user.passHash)) {
      throw new Error("نام کاربری یا رمز عبور نادرست است");
    }
    sessionStore.write({ userId: user.id, loginAt: Date.now() });
    const actorId = user.id;
    mutate((draft) => {
      draft.__actor = actorId;
      auditService.log(draft, "ورود به سامانه", "auth", user.id, `${user.name} وارد شد`);
      delete draft.__actor;
    });
    return user;
  },

  logout(): void {
    sessionStore.clear();
  },

  /** اگر نشست به کاربر غیرفعال/حذف‌شده اشاره کند، غیرمعتبر است */
  currentUser(): User | null {
    const s = sessionStore.read();
    if (!s) return null;
    const user = getDB().users.find((u) => u.id === s.userId && u.active);
    if (!user) {
      sessionStore.clear();
      return null;
    }
    return user;
  },

  requireUser(): User {
    const u = this.currentUser();
    if (!u) throw new Error("ابتدا وارد سامانه شوید");
    return u;
  },

  actorId(): string {
    return this.currentUser()?.id ?? "system";
  },

  withActor<T>(draft: DB, fn: (draft: DB) => T): T {
    draft.__actor = this.actorId();
    try {
      return fn(draft);
    } finally {
      delete draft.__actor;
    }
  },

  addUser(input: {
    name: string;
    username: string;
    password: string;
    role: Role;
  }): User {
    const me = this.requireUser();
    requirePerm(me, "users.manage");
    const name = input.name.trim();
    const username = input.username.trim().toLowerCase();
    if (!name || !username) throw new Error("نام و نام کاربری الزامی است");
    if (input.password.length < 4) throw new Error("رمز عبور حداقل ۴ کاراکتر باشد");
    return mutate((draft) => {
      if (draft.users.some((u) => u.username.toLowerCase() === username)) {
        throw new Error("این نام کاربری قبلاً ثبت شده است");
      }
      const user: User = {
        id: `usr-${Date.now().toString(36)}`,
        name,
        username,
        passHash: hashPassword(input.password),
        role: input.role,
        active: true,
        createdAt: Date.now(),
      };
      draft.users.push(user);
      this.withActor(draft, (d) =>
        auditService.log(d, "افزودن کاربر", "user", user.id, `${name} — ${input.role === "MANAGER" ? "مدیر" : "فروشنده"}`)
      );
      return user;
    });
  },

  setUserActive(userId: string, active: boolean): void {
    const me = this.requireUser();
    requirePerm(me, "users.manage");
    mutate((draft) => {
      const target = draft.users.find((u) => u.id === userId);
      if (!target) throw new Error("کاربر پیدا نشد");
      if (target.role === "MANAGER") {
        const activeManagers = draft.users.filter(
          (u) => u.role === "MANAGER" && u.active
        ).length;
        if (!active && activeManagers <= 1) {
          throw new Error("حداقل یک مدیر فعال باید وجود داشته باشد");
        }
      }
      if (target.id === me.id && !active) {
        throw new Error("نمی‌توانید حساب خود را غیرفعال کنید");
      }
      target.active = active;
      this.withActor(draft, (d) =>
        auditService.log(d, active ? "فعال‌سازی کاربر" : "غیرفعال‌سازی کاربر", "user", userId, target.name)
      );
    });
  },

  resetPassword(userId: string, newPassword: string): void {
    const me = this.requireUser();
    requirePerm(me, "users.manage");
    if (newPassword.length < 4) throw new Error("رمز عبور حداقل ۴ کاراکتر باشد");
    mutate((draft) => {
      const target = draft.users.find((u) => u.id === userId);
      if (!target) throw new Error("کاربر پیدا نشد");
      target.passHash = hashPassword(newPassword);
      this.withActor(draft, (d) =>
        auditService.log(d, "تغییر رمز عبور", "user", userId, `رمز ${target.name} بازنشانی شد`)
      );
    });
  },
};
