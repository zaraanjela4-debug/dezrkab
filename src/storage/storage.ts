/**
 * لایه ذخیره‌سازی — قابل تعویض
 * UI → Services → Business Logic → Repository/Storage → Local Persistence
 * امروز: LocalStorageAdapter — فردا: هر بک‌اند واقعی بدون تغییر منطق کسب‌وکار
 *
 * نکته مهم: سه کلید کاملاً مجزا:
 *  - کلید DB: رکوردهای تجاری (هرگز منطق تکراری اینجا نیست، فقط داده)
 *  - کلید Session: نشست ورود
 *  - کلید Prefs: ترجیحات ظاهری UI
 */
import { useSyncExternalStore } from "react";
import type {
  Bike,
  Category,
  Customer,
  DB,
  Payment,
  Rental,
  SessionInfo,
} from "../domain/models";
import { hashPassword } from "../utils/hash";

export interface StorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

const localAdapter: StorageAdapter = {
  read(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* حافظه پر — داده در حافظه موقت باقی می‌ماند */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

let adapter: StorageAdapter = localAdapter;

/** برای اتصال بک‌اند واقعی در آینده، فقط همین تابع صدا زده می‌شود */
export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next;
}

export const KEYS = {
  db: "pedal.db.v1",
  session: "pedal.session.v1",
  prefs: "pedal.prefs.v1",
} as const;

/* ------------------------------ داده اولیه ------------------------------ */

const H = 3_600_000;
const M = 60_000;

function seedDB(): DB {
  const now = Date.now();
  const yesterday = now - 26 * H;

  const catDefs: Array<[string, string, number, number, number]> = [
    ["A", "ساده", 50_000, 200_000, 10],
    ["B", "دنده‌ای", 70_000, 300_000, 5],
    ["C", "بچه‌گانه", 40_000, 150_000, 8],
    ["D", "سه‌چرخه", 35_000, 100_000, 3],
    ["E", "دو نفره", 90_000, 400_000, 2],
  ];

  const categories: Category[] = catDefs.map(([code, name, rate, dep], i) => ({
    id: `cat-${code}`,
    code,
    name,
    hourlyRate: rate,
    deposit: dep,
    active: true,
    createdAt: now - 90 * 24 * H + i,
  }));

  const bikes: Bike[] = [];
  for (const [code, , , , count] of catDefs) {
    for (let i = 1; i <= count; i++) {
      bikes.push({
        id: `bike-${code}-${i}`,
        serial: `${code}-${String(i).padStart(2, "0")}`,
        categoryId: `cat-${code}`,
        status: "AVAILABLE",
        rentalId: null,
        maintenanceId: null,
        availableAt: 0,
        note: "",
        createdAt: now - 90 * 24 * H,
      });
    }
  }

  const customers: Customer[] = [
    { id: "cus-1", name: "علی رضایی", phone: "09121234567", idNumber: "0012345678", note: "مشتری ثابت", createdAt: now - 40 * 24 * H },
    { id: "cus-2", name: "مریم احمدی", phone: "09351112233", idNumber: "0098765432", note: "", createdAt: now - 21 * 24 * H },
    { id: "cus-3", name: "حسین کریمی", phone: "09191234987", idNumber: "0055443322", note: "", createdAt: now - 12 * 24 * H },
    { id: "cus-4", name: "نرگس موسوی", phone: "09021119876", idNumber: "", note: "", createdAt: now - 6 * 24 * H },
    { id: "cus-5", name: "رضا قاسمی", phone: "09123334455", idNumber: "0011223344", note: "دوچرخه بچه‌گانه می‌خواهد", createdAt: now - 2 * 24 * H },
  ];

  const rentals: Rental[] = [
    {
      id: "ren-1001",
      number: 1001,
      customerId: "cus-1",
      items: [
        { categoryId: "cat-A", code: "A", name: "ساده", qty: 1, returnedQty: 1, hourlyRate: 50_000, deposit: 200_000 },
      ],
      startAt: yesterday,
      hours: 2,
      plannedEndAt: yesterday + 2 * H,
      actualEndAt: yesterday + 2 * H + 5 * M,
      subtotal: 100_000,
      discount: 0,
      lateFee: 0,
      depositTotal: 200_000,
      total: 100_000,
      status: "SETTLED",
      note: "",
      cancelledAt: null,
      cancelReason: "",
      createdBy: "usr-seller",
      createdAt: yesterday,
    },
    {
      id: "ren-1002",
      number: 1002,
      customerId: "cus-2",
      items: [
        { categoryId: "cat-B", code: "B", name: "دنده‌ای", qty: 1, returnedQty: 0, hourlyRate: 70_000, deposit: 300_000 },
        { categoryId: "cat-C", code: "C", name: "بچه‌گانه", qty: 1, returnedQty: 0, hourlyRate: 40_000, deposit: 150_000 },
      ],
      startAt: now - 3 * H,
      hours: 2,
      plannedEndAt: now - 1 * H,
      actualEndAt: null,
      subtotal: 220_000,
      discount: 0,
      lateFee: 0,
      depositTotal: 450_000,
      total: 220_000,
      status: "ACTIVE",
      note: "",
      cancelledAt: null,
      cancelReason: "",
      createdBy: "usr-seller",
      createdAt: now - 3 * H,
    },
    {
      id: "ren-1003",
      number: 1003,
      customerId: "cus-3",
      items: [
        { categoryId: "cat-A", code: "A", name: "ساده", qty: 2, returnedQty: 0, hourlyRate: 50_000, deposit: 200_000 },
      ],
      startAt: now - 40 * M,
      hours: 2,
      plannedEndAt: now + 80 * M,
      actualEndAt: null,
      subtotal: 200_000,
      discount: 0,
      lateFee: 0,
      depositTotal: 400_000,
      total: 200_000,
      status: "ACTIVE",
      note: "پارک لاله",
      cancelledAt: null,
      cancelReason: "",
      createdBy: "usr-seller",
      createdAt: now - 40 * M,
    },
  ];

  const payments: Payment[] = [
    { id: "pay-1", rentalId: "ren-1001", kind: "DEPOSIT", amount: 200_000, accountId: "acc-cash", note: "ودیعه نقدی", operatorId: "usr-seller", createdAt: yesterday },
    { id: "pay-2", rentalId: "ren-1001", kind: "RENT", amount: 100_000, accountId: "acc-pos", note: "", operatorId: "usr-seller", createdAt: yesterday + 2 * H + 4 * M },
    { id: "pay-3", rentalId: "ren-1001", kind: "DEPOSIT_REFUND", amount: 200_000, accountId: "acc-cash", note: "بازگشت ودیعه هنگام تسویه", operatorId: "usr-seller", createdAt: yesterday + 2 * H + 5 * M },
    { id: "pay-4", rentalId: "ren-1002", kind: "DEPOSIT", amount: 450_000, accountId: "acc-cash", note: "", operatorId: "usr-seller", createdAt: now - 3 * H },
    { id: "pay-5", rentalId: "ren-1003", kind: "DEPOSIT", amount: 400_000, accountId: "acc-pos", note: "", operatorId: "usr-seller", createdAt: now - 40 * M },
  ];

  const markRented = (serial: string, rentalId: string) => {
    const b = bikes.find((x) => x.serial === serial);
    if (b) {
      b.status = "RENTED";
      b.rentalId = rentalId;
    }
  };
  markRented("B-01", "ren-1002");
  markRented("C-01", "ren-1002");
  markRented("A-01", "ren-1003");
  markRented("A-02", "ren-1003");

  const d1 = bikes.find((b) => b.serial === "D-01");
  if (d1) {
    d1.status = "MAINTENANCE";
    d1.maintenanceId = "mnt-1";
  }
  const c8 = bikes.find((b) => b.serial === "C-08");
  if (c8) {
    c8.status = "OUT_OF_SERVICE";
    c8.note = "خروج موقت از سرویس";
  }

  return {
    rev: 1,
    seq: { rental: 1004 },
    users: [
      { id: "usr-manager", name: "امیر تهرانی", username: "manager", passHash: hashPassword("1234"), role: "MANAGER", active: true, createdAt: now - 90 * 24 * H },
      { id: "usr-seller", name: "سارا محمدی", username: "seller", passHash: hashPassword("1234"), role: "SELLER", active: true, createdAt: now - 60 * 24 * H },
    ],
    categories,
    bikes,
    customers,
    rentals,
    payments,
    maintenances: [
      { id: "mnt-1", bikeId: "bike-D-1", serial: "D-01", categoryId: "cat-D", reason: "پنچری چرخ عقب و سرویس زنجیر", note: "", cost: 0, startedAt: now - 2 * H, endedAt: null, status: "OPEN", byId: "usr-manager" },
    ],
    expenses: [
      { id: "exp-1", title: "روغن زنجیر و لوازم یدکی", amount: 350_000, accountId: "acc-cash", note: "", byId: "usr-manager", at: yesterday + 3 * H },
      { id: "exp-2", title: "قبض برق مغازه", amount: 780_000, accountId: "acc-card", note: "", byId: "usr-manager", at: now - 3 * 24 * H },
      { id: "exp-3", title: "کرایه حمل دوچرخه جدید", amount: 120_000, accountId: "acc-cash", note: "", byId: "usr-manager", at: now - 5 * H },
    ],
    audit: [
      { id: "aud-1", at: now - 40 * M, actorId: "usr-seller", actorName: "سارا محمدی", action: "ایجاد اجاره", entity: "rental", entityId: "ren-1003", details: "اجاره #۱۰۰۳ — ۲ × ساده برای حسین کریمی" },
      { id: "aud-2", at: now - 2 * H, actorId: "usr-manager", actorName: "امیر تهرانی", action: "شروع تعمیرات", entity: "maintenance", entityId: "mnt-1", details: "D-01 — پنچری چرخ عقب و سرویس زنجیر" },
      { id: "aud-3", at: now - 26 * H, actorId: "usr-seller", actorName: "سارا محمدی", action: "تسویه اجاره", entity: "rental", entityId: "ren-1001", details: "اجاره #۱۰۰۱ تکمیل و تسویه شد" },
    ],
    settings: {
      storeName: "دوچرخه‌سرای پدال",
      currency: "تومان",
      graceMinutes: 15,
      releaseDelayMinutes: 10,
      lateMultiplier: 1.5,
      durations: [
        { hours: 1, label: "۱ ساعته" },
        { hours: 2, label: "۲ ساعته" },
        { hours: 3, label: "۳ ساعته" },
        { hours: 4, label: "۴ ساعته" },
        { hours: 6, label: "نیم‌روز" },
        { hours: 12, label: "۱۲ ساعته" },
        { hours: 24, label: "تمام‌روز" },
      ],
      accounts: [
        { id: "acc-pos", name: "دستگاه کارت‌خوان", kind: "POS", active: true },
        { id: "acc-cash", name: "صندوق نقدی", kind: "CASH", active: true },
        { id: "acc-card", name: "کارت به کارت", kind: "TRANSFER", active: true },
      ],
    },
  };
}

/* --------------------------- store با snapshot --------------------------- */

function loadDB(): DB {
  const raw = adapter.read(KEYS.db);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DB;
      if (parsed && typeof parsed.rev === "number" && Array.isArray(parsed.rentals)) {
        return parsed;
      }
    } catch {
      /* داده خراب — بازسازی */
    }
  }
  const fresh = seedDB();
  adapter.write(KEYS.db, JSON.stringify(fresh));
  return fresh;
}

let state: DB = loadDB();
const listeners = new Set<() => void>();

export function getDB(): DB {
  return state;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * تنها درگاه تغییر داده.
 * چون JS تک‌رشته‌ای است، «اعتبارسنجی + commit» داخل این تابع اتمیک است:
 * دو عملیات همزمان هرگز نمی‌توانند موجودی را منفی کنند — تراکنش نامعتبر
 * قبل از commit رد می‌شود.
 */
export function mutate<T>(fn: (draft: DB) => T): T {
  const draft: DB = JSON.parse(JSON.stringify(state)) as DB;
  const result = fn(draft);
  draft.rev = state.rev + 1;
  state = draft;
  adapter.write(KEYS.db, JSON.stringify(state));
  listeners.forEach((l) => l());
  return result;
}

export function resetToSeed(): void {
  state = seedDB();
  adapter.write(KEYS.db, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB);
}

/* ------------------------- نشست (جدا از داده تجاری) ------------------------ */

export const sessionStore = {
  read(): SessionInfo | null {
    const raw = adapter.read(KEYS.session);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as SessionInfo;
      return s && s.userId ? s : null;
    } catch {
      return null;
    }
  },
  write(s: SessionInfo): void {
    adapter.write(KEYS.session, JSON.stringify(s));
  },
  clear(): void {
    adapter.remove(KEYS.session);
  },
};

/* ---------------------- ترجیحات UI (جدا از داده تجاری) --------------------- */

export const prefsStore = {
  read<T>(key: string, fallback: T): T {
    const raw = adapter.read(`${KEYS.prefs}.${key}`);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  write(key: string, value: unknown): void {
    adapter.write(`${KEYS.prefs}.${key}`, JSON.stringify(value));
  },
};
