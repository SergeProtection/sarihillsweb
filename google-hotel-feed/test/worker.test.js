import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONFIG } from "../src/config.js";
import { handleQuery } from "../src/worker.js";
import { stayTotal, formatDate, addDays, parseDate } from "../src/pricing.js";
import worker from "../src/worker.js";

const NOW = new Date("2026-11-08T10:00:00Z");
const query = (inner) => '<?xml version="1.0" encoding="UTF-8"?>\n<Query>' + inner + "</Query>";

test("prices a single live query", async () => {
  const xml = await handleQuery(query(
    "<Checkin>2026-12-01</Checkin><Nights>3</Nights><PropertyList><Property>sarihills_main</Property></PropertyList>" +
    "<Context><Occupancy>2</Occupancy><OccupancyDetails><NumAdults>2</NumAdults></OccupancyDetails></Context>"
  ), CONFIG, NOW);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<Transaction timestamp="2026-11-08T10:00:00Z" id="sarihills-[a-z0-9-]+">/);
  assert.match(xml, /<Result>\s*<Property>sarihills_main<\/Property>\s*<Checkin>2026-12-01<\/Checkin>\s*<Nights>3<\/Nights>\s*<Baserate currency="IDR">1500000<\/Baserate>\s*<Tax currency="IDR">0<\/Tax>\s*<OtherFees currency="IDR">0<\/OtherFees>\s*<Occupancy>2<\/Occupancy>\s*<\/Result>/);
});

test("weekly and monthly rates", () => {
  assert.equal(stayTotal("2026-12-01", 7, CONFIG.rates), 7 * 450000);
  assert.equal(stayTotal("2027-02-01", 28, CONFIG.rates), 11000000); // exactly February
  assert.equal(stayTotal("2026-12-01", 28, CONFIG.rates), 11000000); // 28 nights, not yet a month
  assert.equal(stayTotal("2026-12-01", 35, CONFIG.rates), 11000000 + 4 * 370000); // Dec 1 - Jan 5
});

test("matches the site's own stayQuote for every stay up to 100 nights", () => {
  const src = readFileSync(new URL("../../js/script.js", import.meta.url), "utf8");
  const block = src.slice(src.indexOf("const NIGHTLY_RATE"), src.indexOf("function describeQuote"));
  const siteQuote = new Function(block.replace(/^const AVAILABILITY_URL.*$/m, "") + "\nreturn stayQuote;")();
  for (const start of ["2026-11-30", "2027-01-31", "2027-02-28", "2027-06-15"]) {
    for (let n = 1; n <= 100; n++) {
      const checkout = formatDate(addDays(parseDate(start), n));
      assert.equal(stayTotal(start, n, CONFIG.rates), siteQuote(start, checkout).total, start + " +" + n);
    }
  }
});

test("splits an included tax without changing the total", async () => {
  const xml = await handleQuery(query("<Checkin>2026-12-01</Checkin><Nights>1</Nights>"), { ...CONFIG, includedTaxRate: 0.1 }, NOW);
  assert.match(xml, /<Baserate currency="IDR">454545<\/Baserate>\s*<Tax currency="IDR">45455<\/Tax>/);
});

test("expands a date-range query", async () => {
  const xml = await handleQuery(query("<FirstDate>2026-12-01</FirstDate><LastDate>2026-12-03</LastDate><Nights>1</Nights><Nights>2</Nights>"), CONFIG, NOW);
  assert.equal((xml.match(/<Result>/g) || []).length, 6);
});

test("returns no results for other properties, past dates, too many guests", async () => {
  for (const inner of [
    "<Checkin>2026-12-01</Checkin><Nights>1</Nights><PropertyList><Property>other</Property></PropertyList>",
    "<Checkin>2026-11-01</Checkin><Nights>1</Nights>",
    "<Checkin>2028-01-01</Checkin><Nights>1</Nights>",
    "<Checkin>2026-12-01</Checkin><Nights>1</Nights><Context><Occupancy>3</Occupancy></Context>",
    "<Checkin>2026-02-30</Checkin><Nights>1</Nights>",
  ]) {
    const xml = await handleQuery(query(inner), CONFIG, NOW);
    assert.doesNotMatch(xml, /<Result>/, inner);
  }
});

test("marks booked dates unavailable and skips unanswered ones", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes("checkin=2026-12-01")) return new Response('{"available":false}');
    throw new Error("timeout");
  };
  try {
    const config = { ...CONFIG, availabilityUrl: "https://example.test/exec" };
    const booked = await handleQuery(query("<Checkin>2026-12-01</Checkin><Nights>2</Nights>"), config, NOW);
    assert.match(booked, /<Nights>2<\/Nights>\s*<Unavailable>\s*<NoVacancy\/>\s*<\/Unavailable>/);
    const unknown = await handleQuery(query("<Checkin>2026-12-05</Checkin><Nights>2</Nights>"), config, NOW);
    assert.doesNotMatch(unknown, /<Result>/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("HTTP handler", async () => {
  const ok = await worker.fetch(new Request("https://x/", { method: "POST", body: query("<Checkin>2027-01-10</Checkin><Nights>1</Nights>") }));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.equal((await worker.fetch(new Request("https://x/", { method: "POST", body: "<nope/>" }))).status, 400);
  assert.equal((await worker.fetch(new Request("https://x/"))).status, 405);
});
