// Everything the price feed knows about Sari Hills. The rates MUST match the rate cards in
// index.html and the constants in js/script.js: Google compares the price it shows with the
// price on the landing page (Price Accuracy), and a mismatch gets the listing demoted.

export const CONFIG = {
  // The <Id> used in the Hotel List feed (feeds/hotel_list.xml) and in Hotel Center.
  propertyId: "sarihills_main",

  currency: "IDR",
  decimals: 0, // IDR is quoted in whole rupiah on the site

  // Per room for up to two guests, all taxes and charges included (see #rates).
  rates: {
    nightly: 500000, // 1-6 nights, per night
    weekly: 450000, // 7+ nights, per night
    monthly: 11000000, // per calendar month
    extraNight: 370000, // each night past the last whole month
    monthlyFromNights: 28, // a stay this long that is not yet a calendar month costs one month
  },

  // The site's prices already include tax. With includedTaxRate 0 the feed reports the whole
  // price as Baserate and Tax 0, so every Google surface shows exactly the site's total.
  // Set it (e.g. 0.10 for PB1) only if you want Google to see the tax split out; Baserate + Tax
  // still adds up to the site's total.
  includedTaxRate: 0,
  otherFees: 0,

  maxGuestsPerRoom: 2,
  minNights: 1,
  maxNights: 365,
  maxAdvanceDays: 365, // the site's date picker allows check-in up to 12 months ahead

  // Optional: the same Google Apps Script the site's date check uses. It answers
  // {"available": true|false} for ?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD. Leave it empty to
  // price every date without checking the bookings sheet.
  availabilityUrl: "",
  // Time Google gives us is in the query's <DeadlineMs>; this is the fallback.
  defaultDeadlineMs: 4000,
};
