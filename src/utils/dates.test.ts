/**
 * تست خودکار L3 — اعتبارسنجی بازه دلخواه گزارش (validateCustomRange)
 * =====================================================================
 * پوشش: بازه معتبر چندروزه، هم‌روز، from > to، شروع/پایانِ جاافتاده،
 *       تاریخ بدشکل، تاریخ غیرممکن (۳۰ فوریه)، مرز ماه، مرز سال، سال کبیسه.
 *
 * اجرا:  npx tsx src/utils/dates.test.ts
 * این فایل هرگز از باندل محصول import نمی‌شود.
 */
import { parseDateInput, validateCustomRange } from "./format";

const DAY = 86_400_000;

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail = ""): void {
  results.push({ name, ok, detail });
}

function midnight(y: number, m1: number, d: number): number {
  return new Date(y, m1 - 1, d, 0, 0, 0, 0).getTime();
}

/* ------------------------------ parseDateInput ------------------------------ */
check(
  "P1 — تاریخ معتبر به نیمه‌شب محلی تبدیل می‌شود",
  parseDateInput("2024-12-31") === midnight(2024, 12, 31)
);
check("P2 — قالب اشتباه (اسلش) رد می‌شود", parseDateInput("2024/03/01") === null);
check("P3 — متن آزاد رد می‌شود", parseDateInput("abc") === null);
check("P4 — رشته خالی رد می‌شود", parseDateInput("") === null);
check("P5 — تاریخ غیرممکن ۳۰ فوریه رد می‌شود (بدون غلتیدن به اسفند)", parseDateInput("2024-02-30") === null);
check("P6 — ۲۹ فوریه کبیسه پذیرفته می‌شود", parseDateInput("2024-02-29") === midnight(2024, 2, 29));
check("P7 — ۲۹ فوریه غیرکبیسه رد می‌شود", parseDateInput("2023-02-29") === null);
check("P8 — ماه ۱۳ رد می‌شود", parseDateInput("2024-13-01") === null);

/* ---------------------------- validateCustomRange ---------------------------- */

/* بازه معتبر چندروزه */
{
  const r = validateCustomRange("2024-03-01", "2024-03-10");
  check(
    "R1 — بازه معتبر ۱۰ روزه",
    r.ok && r.start === midnight(2024, 3, 1) && r.end - r.start === 10 * DAY,
    `ok=${r.ok} span=${(r.end - r.start) / DAY}d`
  );
  check("R1b — پایان نیمه‌باز = نیمه‌شب روز بعد از «تا»", r.end === midnight(2024, 3, 11));
}

/* بازه هم‌روز — معتبر و دقیقاً یک روز */
{
  const r = validateCustomRange("2024-06-15", "2024-06-15");
  check("R2 — بازه هم‌روز معتبر است", r.ok && r.end - r.start === DAY, `ok=${r.ok} reason=${r.reason}`);
}

/* شروع بعد از پایان */
{
  const r = validateCustomRange("2024-03-10", "2024-03-01");
  check(
    "R3 — شروع بعد از پایان رد می‌شود",
    !r.ok && r.reason.includes("بعد از") && r.field === "from",
    `reason=${r.reason}`
  );
}

/* شروع جاافتاده */
{
  const r = validateCustomRange("", "2024-03-10");
  check("R4 — شروع جاافتاده", !r.ok && r.reason.includes("شروع") && r.field === "from", `reason=${r.reason}`);
}

/* پایان جاافتاده */
{
  const r = validateCustomRange("2024-03-01", "");
  check("R5 — پایان جاافتاده", !r.ok && r.reason.includes("پایان") && r.field === "to", `reason=${r.reason}`);
}

/* تاریخ بدشکل در شروع */
{
  const r = validateCustomRange("1403/01/01", "2024-03-10");
  check("R6 — شروع بدشکل", !r.ok && r.field === "from" && r.reason.includes("شروع"));
}

/* تاریخ بدشکل در پایان */
{
  const r = validateCustomRange("2024-03-01", "not-a-date");
  check("R7 — پایان بدشکل", !r.ok && r.field === "to" && r.reason.includes("پایان"));
}

/* تاریخ غیرممکن */
{
  const r = validateCustomRange("2024-02-01", "2024-02-30");
  check("R8 — ۳۰ فوریه به‌عنوان پایان رد می‌شود", !r.ok && r.field === "to");
}

/* مرز ماه */
{
  const r = validateCustomRange("2024-01-31", "2024-02-01");
  check("R9 — مرز ماه (۱۱ بهمن → ۱۲ بهمن)", r.ok && r.end - r.start === 2 * DAY, `span=${(r.end - r.start) / DAY}d`);
}

/* مرز سال */
{
  const r = validateCustomRange("2023-12-31", "2024-01-01");
  check("R10 — مرز سال میلادی", r.ok && r.end - r.start === 2 * DAY && r.start === midnight(2023, 12, 31));
}

/* سال کبیسه — اسفند ۹۹ روزه */
{
  const r = validateCustomRange("2024-02-29", "2024-03-01");
  check("R11 — کبیسه: ۲۹ فوریه → ۱ مارس", r.ok && r.end - r.start === 2 * DAY);
}

/* ------------------------------ گزارش ------------------------------ */
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  // eslint-disable-next-line no-console
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
// eslint-disable-next-line no-console
console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
if (failed.length > 0) {
  throw new Error(`Date-range validation tests failed: ${failed.map((f) => f.name).join(", ")}`);
}
