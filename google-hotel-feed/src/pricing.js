// Port of stayQuote() in js/script.js. Keep the two in step.

const DAY_MS = 86400000;

export function parseDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return null;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return formatDate(date) === iso ? date : null; // rejects 2026-02-30
}

export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

// Same day of a later month, or that month's last day if it is shorter (31 Jan to 28 Feb).
export function addMonths(date, months) {
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, Math.min(date.getUTCDate(), lastDay)));
}

// Total price for one room, all taxes included, exactly as the site's date check shows it.
export function stayTotal(checkin, nights, rates) {
  const start = parseDate(checkin);
  const end = addDays(start, nights);
  let months = 0;

  while (addMonths(start, months + 1) <= end) months++;

  if (months === 0) {
    if (nights >= rates.monthlyFromNights) return rates.monthly;
    return nights * (nights >= 7 ? rates.weekly : rates.nightly);
  }

  const extraNights = Math.round((end - addMonths(start, months)) / DAY_MS);
  return months * rates.monthly + extraNights * rates.extraNight;
}

// Splits a tax-inclusive total into the Baserate / Tax / OtherFees Google wants.
export function priceBreakdown(total, config) {
  const factor = 10 ** config.decimals;
  const round = (n) => Math.round(n * factor) / factor;
  const fees = round(config.otherFees);
  const beforeFees = total - fees;
  const base = round(beforeFees / (1 + config.includedTaxRate));
  return { base, tax: round(beforeFees - base), fees };
}
