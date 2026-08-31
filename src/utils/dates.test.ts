/**
 * آزمون مستقل موتور تقویم جلالی و اعتبارسنجی بازه — خارج از باندل محصول.
 * اجرا: npx tsx src/utils/dates.test.ts
 *
 * آزمون‌های کبیسه «سازگاری‌محور» هستند: انتظارِ سالِ خاصی hard-code نمی‌شود،
 * بلکه درستیِ متقابلِ isJalaliLeap / jalaliMonthLength / jalaliToTime
 * و عبور دقیق از مرز اسفند→فروردین سنجیده می‌شود تا روی هر موتور Intl درست بمانند.
 */
import {
  addJalaliMonths,
  isJalaliLeap,
  jalaliMonthLength,
  jalaliParts,
  jalaliToTime,
  jalaliWeekStart,
  startOfDay,
  validateCustomRange,
} from "./format";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean): void {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`);
  }
}

const DAY = 86_400_000;
const NOON = DAY / 2;

console.log("── تبدیل رفت‌وبرگشت جلالی ↔ مهر زمانی ──");
for (const [jy, jm, jd] of [
  [1404, 1, 1],
  [1404, 6, 31],
  [1404, 7, 1],
  [1404, 11, 30],
  [1404, 12, 29],
  [1399, 5, 15],
  [1410, 10, 8],
] as Array<[number, number, number]>) {
  const t = jalaliToTime(jy, jm, jd);
  const p = jalaliParts(t);
  check(
    `جلالی ${jy}/${jm}/${jd} رفت‌وبرگشت دقیق`,
    p.jy === jy && p.jm === jm && p.jd === jd
  );
  /* نیمه‌شب محلی بودن */
  const d = new Date(t);
  check(
    `جلالی ${jy}/${jm}/${jd} نیمه‌شب محلی است`,
    d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0
  );
}

console.log("── طول ماه‌ها و مرز ماه ──");
check("فروردین ۳۱ روز", jalaliMonthLength(1404, 1) === 31);
check("شهریور ۳۱ روز", jalaliMonthLength(1404, 6) === 31);
check("مهر ۳۰ روز", jalaliMonthLength(1404, 7) === 30);
check("بهمن ۳۰ روز", jalaliMonthLength(1404, 11) === 30);
const es12 = jalaliMonthLength(1404, 12);
check("اسفند ۲۹ یا ۳۰ روز", es12 === 29 || es12 === 30);

{
  const endMehr = jalaliToTime(1404, 6, 31) + DAY + NOON;
  const p = jalaliParts(endMehr);
  check("فردای ۳۱ شهریور = ۱ مهر", p.jy === 1404 && p.jm === 7 && p.jd === 1);
}

console.log("── کبیسه و مرز سال ──");
for (const jy of [1399, 1400, 1403, 1404, 1408]) {
  const len = jalaliMonthLength(jy, 12);
  const leap = isJalaliLeap(jy);
  check(
    `اسفند ${jy}: طول و کبیسه هم‌خوان (${len} روز)`,
    (leap && len === 30) || (!leap && len === 29)
  );
  const nextDay = jalaliParts(jalaliToTime(jy, 12, len) + DAY + NOON);
  check(
    `فردای ${jy}/12/${len} = ۱ فروردین ${jy + 1}`,
    nextDay.jy === jy + 1 && nextDay.jm === 1 && nextDay.jd === 1
  );
}
{
  /* اگر ۱۴۰۳ کبیسه است، ۳۰ اسفندِ آن روزِ واقعی است */
  if (isJalaliLeap(1403)) {
    const p = jalaliParts(jalaliToTime(1403, 12, 30));
    check("۳۰ اسفند ۱۴۰۳ (کبیسه) قابل نمایش", p.jy === 1403 && p.jm === 12 && p.jd === 30);
  } else {
    check("۱۴۰۳ کبیسه نیست (موتور جاری)", !isJalaliLeap(1403));
  }
}

console.log("── جابه‌جایی ماه ──");
{
  const a = jalaliParts(addJalaliMonths(jalaliToTime(1404, 12, 10), 1));
  check("اسفند ۱۴۰۴ + یک ماه = فروردین ۱۴۰۵", a.jy === 1405 && a.jm === 1 && a.jd === 1);
  const b = jalaliParts(addJalaliMonths(jalaliToTime(1405, 1, 10), -1));
  check("فروردین ۱۴۰۵ − یک ماه = دی ۱۴۰۴", b.jy === 1404 && b.jm === 12 && b.jd === 1);
  const c = jalaliParts(addJalaliMonths(jalaliToTime(1404, 7, 15), 14));
  check("مهر ۱۴۰۴ + چهارده ماه = آذر ۱۴۰۵", c.jy === 1405 && c.jm === 9 && c.jd === 1);
}

console.log("── هفته ایرانی از شنبه ──");
{
  const now = Date.now();
  const ws = jalaliWeekStart(now);
  check("شروع هفته ≤ امروز", ws <= startOfDay(now));
  check("شروع هفته شنبه است", new Date(ws).getDay() === 6);
  check("شروع هفته کمتر از ۷ روز قبل", startOfDay(now) - ws < 7 * DAY);
  check("شروع هفته نیمه‌شب است", new Date(ws).getHours() === 0);
}

console.log("── عبور از نیمه‌شب ──");
{
  const late = jalaliToTime(1404, 7, 10) + 23 * 3_600_000 + 59 * 60_000; // ۲۳:۵۹
  const p1 = jalaliParts(late);
  const p2 = jalaliParts(late + 60_000); // ۰۰:۰۰ فردا
  check("۲۳:۵۹ همان روز", p1.jy === 1404 && p1.jm === 7 && p1.jd === 10);
  check("۰۰:۰۰ روز بعد", p2.jy === 1404 && p2.jm === 7 && p2.jd === 11);
}

console.log("── اعتبارسنجی بازه دلخواه ──");
{
  const d1 = jalaliToTime(1404, 7, 1);
  const d2 = jalaliToTime(1404, 7, 15);
  const v = validateCustomRange(d1, d2);
  check("بازه معتبر پذیرفته می‌شود", v.ok);
  check("طول بازه دقیقاً ۱۵ روز", v.end - v.start === 15 * DAY);

  const same = validateCustomRange(d1, d1);
  check("روزِ تنها = بازه یک‌روزه", same.ok && same.end - same.start === DAY);

  const rev = validateCustomRange(d2, d1);
  check("شروع بعد از پایان رد می‌شود", !rev.ok && rev.field === "from");
  check("جایگزینی بی‌صدا انجام نمی‌شود", rev.start === 0 && rev.end === 0);

  check("فقدان شروع رد می‌شود", !validateCustomRange(null, d2).ok);
  check("فقدان پایان رد می‌شود", !validateCustomRange(d1, null).ok);

  /* بازه روی مرز سال — طول دقیق با اسفندِ جاری (کبیسه یا عادی) */
  const y1 = jalaliToTime(1403, 12, 25);
  const y2 = jalaliToTime(1404, 1, 5);
  const vy = validateCustomRange(y1, y2);
  const es1403 = jalaliMonthLength(1403, 12);
  const expectedDays = es1403 - 25 + 1 + 5;
  check(
    `بازه مرز سال دقیق (${expectedDays} روز)`,
    vy.ok && vy.end - vy.start === expectedDays * DAY
  );
}

console.log("");
console.log(`نتیجه: ${pass} موفق، ${fail} ناموفق`);
if (fail > 0) throw new Error(`${fail} آزمون جلالی ناموفق بود`);

export {};
