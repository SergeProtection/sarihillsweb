// Google Hotel Center Live Query (pull) endpoint for Sari Hills.
// Google POSTs a <Query>; we answer with a <Transaction> holding one <Result> per itinerary.
// Runs on Cloudflare Workers as is (export default { fetch }); the fetch handler uses only
// web-standard Request/Response, so it also runs on Vercel Edge, Deno or Node 18+.

import { CONFIG } from "./config.js";
import { parseQuery, buildTransaction } from "./xml.js";
import { parseDate, formatDate, addDays, stayTotal, priceBreakdown } from "./pricing.js";

const MAX_ITINERARIES = 500;

// Every (checkin, nights) pair the query asks about that we can price.
export function itineraries(query, config, today) {
  if (query.properties.length && !query.properties.includes(config.propertyId)) return [];
  if (query.occupancy && query.occupancy > config.maxGuestsPerRoom) return []; // one room sleeps two

  const lengths = [...new Set(query.nights)].filter((n) => n >= config.minNights && n <= config.maxNights);
  let dates = [];

  if (query.checkin) {
    dates = [query.checkin];
  } else if (query.firstDate && query.lastDate) {
    const from = parseDate(query.firstDate);
    const to = parseDate(query.lastDate);
    for (let d = from; from && to && d <= to && dates.length < 366; d = addDays(d, 1)) dates.push(formatDate(d));
  }

  const lastCheckin = addDays(today, config.maxAdvanceDays);
  const out = [];

  for (const checkin of dates) {
    const date = parseDate(checkin);
    if (!date || date < today || date > lastCheckin) continue;
    for (const nights of lengths) {
      if (out.length >= MAX_ITINERARIES) return out;
      out.push({ checkin, nights });
    }
  }
  return out;
}

// Asks the bookings sheet whether the stay is free. Returns true, false or null (no answer).
async function isAvailable(config, checkin, nights, signal) {
  if (!config.availabilityUrl) return true;
  const checkout = formatDate(addDays(parseDate(checkin), nights));
  try {
    const response = await fetch(config.availabilityUrl + "?checkin=" + checkin + "&checkout=" + checkout, { signal, redirect: "follow" });
    const result = await response.json();
    return typeof result.available === "boolean" ? result.available : null;
  } catch {
    return null;
  }
}

export async function handleQuery(xml, config = CONFIG, now = new Date()) {
  const query = parseQuery(xml);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const wanted = itineraries(query, config, today);

  // Leave a margin under Google's deadline for the response itself.
  const budget = Math.max(500, (query.deadlineMs || config.defaultDeadlineMs) - 300);
  const signal = AbortSignal.timeout(budget);
  const checks = config.availabilityUrl && wanted.length <= 10
    ? await Promise.all(wanted.map((it) => isAvailable(config, it.checkin, it.nights, signal)))
    : wanted.map(() => (config.availabilityUrl ? null : true)); // big range queries: don't hammer the sheet

  const results = [];
  wanted.forEach((it, i) => {
    if (checks[i] === false) {
      results.push({ ...it, unavailable: true });
    } else if (checks[i] === true) {
      const { base, tax, fees } = priceBreakdown(stayTotal(it.checkin, it.nights, config.rates), config);
      results.push({ ...it, base, tax, fees, occupancy: query.occupancy });
    }
    // null (sheet did not answer): send nothing rather than a price we can't stand behind.
  });

  return buildTransaction(results, config, now);
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("Sari Hills price feed. POST a Google Hotel Live Query.\n", { status: 405, headers: { Allow: "POST" } });
    }
    try {
      const xml = await handleQuery(await request.text());
      return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
    } catch (err) {
      return new Response("Bad query: " + err.message + "\n", { status: 400, headers: { "Content-Type": "text/plain" } });
    }
  },
};
