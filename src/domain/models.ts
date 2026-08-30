/** دامین مدل‌ها — تمام موجودیت‌های کسب‌وکار فروشگاه اجاره دوچرخه */

export type Role = "MANAGER" | "SELLER";

export interface User {
  id: string;
  name: string;
  username: string;
  passHash: string;
  role: Role;
  active: boolean;
  createdAt: number;
}

export interface SessionInfo {
  userId: string;
  loginAt: number;
}

export interface Category {
  id: string;
  /** کد دسته — مثل A یا B — شناسه دسته است نه دوچرخه فیزیکی */
  code: string;
  name: string;
  hourlyRate: number;
  deposit: number;
  active: boolean;
  createdAt: number;
}

export type BikePhysicalStatus =
  | "AVAILABLE"
  | "RENTED"
  | "MAINTENANCE"
  | "OUT_OF_SERVICE";

export interface Bike {
  id: string;
  serial: string;
  categoryId: string;
  status: BikePhysicalStatus;
  rentalId: string | null;
  maintenanceId: string | null;
  /** زودترین زمانی که دوچرخه دوباره قابل اجاره می‌شود (قانون گردش پس از برگشت زودهنگام) */
  availableAt: number;
  note: string;
  createdAt: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  idNumber: string;
  note: string;
  createdAt: number;
}

export type RentalStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PARTIAL"
  | "SETTLED"
  | "COMPLETED"
  | "CANCELLED";

export interface RentalItem {
  categoryId: string;
  code: string;
  name: string;
  qty: number;
  returnedQty: number;
  hourlyRate: number;
  deposit: number;
}

export interface Rental {
  id: string;
  number: number;
  customerId: string;
  items: RentalItem[];
  startAt: number;
  hours: number;
  plannedEndAt: number;
  actualEndAt: number | null;
  subtotal: number;
  discount: number;
  lateFee: number;
  depositTotal: number;
  total: number;
  status: RentalStatus;
  note: string;
  cancelledAt: number | null;
  cancelReason: string;
  createdBy: string;
  createdAt: number;
}

export type PaymentKind =
  | "RENT"
  | "DEPOSIT"
  | "DEPOSIT_REFUND"
  | "DEPOSIT_APPLY"
  | "CORRECTION";

export interface Payment {
  id: string;
  rentalId: string | null;
  kind: PaymentKind;
  /** مبلغ — برای اصلاحات می‌تواند منفی باشد */
  amount: number;
  accountId: string;
  note: string;
  operatorId: string;
  createdAt: number;
}

export type MaintenanceStatus = "OPEN" | "DONE";

export interface MaintenanceRecord {
  id: string;
  bikeId: string;
  serial: string;
  categoryId: string;
  reason: string;
  note: string;
  cost: number;
  startedAt: number;
  endedAt: number | null;
  status: MaintenanceStatus;
  byId: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  accountId: string;
  note: string;
  byId: string;
  at: number;
}

export interface AuditEntry {
  id: string;
  at: number;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
}

export interface PaymentAccount {
  id: string;
  name: string;
  kind: string;
  active: boolean;
}

export interface DurationOption {
  hours: number;
  label: string;
}

export interface Settings {
  storeName: string;
  currency: string;
  graceMinutes: number;
  releaseDelayMinutes: number;
  lateMultiplier: number;
  durations: DurationOption[];
  accounts: PaymentAccount[];
}

export interface DB {
  rev: number;
  seq: { rental: number };
  users: User[];
  categories: Category[];
  bikes: Bike[];
  customers: Customer[];
  rentals: Rental[];
  payments: Payment[];
  maintenances: MaintenanceRecord[];
  expenses: Expense[];
  audit: AuditEntry[];
  settings: Settings;
}
