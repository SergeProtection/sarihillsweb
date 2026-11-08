# Sari Hills price feed (Google Hotel Center, Live Query / pull)

A Cloudflare Worker that answers Google Hotel Center's Live Query: Google POSTs a `<Query>`
(check-in, length of stay, guests), the worker prices it with the same rules as the site's date
check and returns a `<Transaction>`. No dependencies and no build step.

Separate from the static site: GitHub Pages serves this folder too, which is harmless (the code
holds nothing secret, only the public rates), but nothing on the site uses it.

```
src/config.js     property id, rates, tax split, limits, optional availability URL
src/pricing.js    port of stayQuote() from ../js/script.js
src/xml.js        Query parsing and Transaction building
src/worker.js     HTTP handler (export default { fetch })
test/             node --test, including a parity check against ../js/script.js
feeds/hotel_list.xml   Hotel List feed to upload in Hotel Center
wrangler.toml     Cloudflare deploy config
```

## Run, test, deploy

```sh
cd google-hotel-feed
npm test                 # Node 18+; no install needed
npx wrangler dev         # local endpoint at http://localhost:8787
curl -X POST http://localhost:8787 -H "Content-Type: application/xml" \
  -d '<Query><Checkin>2026-12-01</Checkin><Nights>3</Nights><PropertyList><Property>sarihills_main</Property></PropertyList><Context><Occupancy>2</Occupancy></Context></Query>'
npx wrangler login && npx wrangler deploy   # gives https://sarihills-price-feed.<account>.workers.dev
```

The free Workers plan (100,000 requests/day) is plenty. To serve it from `feed.sarihills.com`
instead, uncomment the route in `wrangler.toml`; that needs the domain's DNS on Cloudflare (it is
at IONOS today), so the `workers.dev` URL is the simpler choice.

## Example response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Transaction timestamp="2026-11-08T10:00:00Z" id="sarihills-mh7k2x-4f9a1c">
  <Result>
    <Property>sarihills_main</Property>
    <Checkin>2026-12-01</Checkin>
    <Nights>3</Nights>
    <Baserate currency="IDR">1500000</Baserate>
    <Tax currency="IDR">0</Tax>
    <OtherFees currency="IDR">0</OtherFees>
    <Occupancy>2</Occupancy>
  </Result>
</Transaction>
```

## How it prices

- Same rules as the rate cards: IDR 500,000/night, 450,000/night from 7 nights, 11,000,000 per
  calendar month, 370,000 per night past the last whole month; a 28+ night stay that is not yet
  a calendar month costs one month. A test fails if this drifts from `js/script.js`, so a rate
  change there means changing `src/config.js` too (and the JSON-LD and llms.txt, as usual).
- The site's prices include all taxes. By default the feed sends the whole price as `Baserate`
  with `Tax` 0, so Google shows exactly the site's total on every surface (best for Price
  Accuracy). `includedTaxRate` splits an included tax out without changing the total.
- Per room for up to two guests: a query for 3+ guests gets no result.
- Only check-ins from today to 365 days ahead, 1-365 nights, and only `sarihills_main`.
- Date-range queries (`FirstDate`/`LastDate` + several `Nights`) are expanded, up to 500
  itineraries.

## Availability (optional)

With `availabilityUrl` empty, every date is priced. Set it to the site's `AVAILABILITY_URL` (the
Apps Script in the bookings sheet) and, for queries of up to 10 itineraries, the worker asks the
sheet first: booked stays get `<Unavailable><NoVacancy/></Unavailable>`, and a stay the sheet does
not answer for in time is left out rather than shown at a price that might not be bookable.
Apps Script is often slower than Google's `DeadlineMs`, so test the latency before turning it on.

## Still to do

1. **Hotel Center**: link the account to the Sari Hills Business Profile, ask Google for Live
   Query (pull) access, upload `feeds/hotel_list.xml`, register the worker URL as the query
   endpoint.
2. **Verify against Google's reference** (developers.google.com/hotels/hotel-prices/xml-reference),
   which could not be fetched when this was written: the `Result` element order, whether
   `Occupancy` should be echoed, the decimal format for IDR, the Hotel List schema, and the Query
   fields read in `src/xml.js`. Then run Hotel Center's XML validator against the live endpoint.
3. **Landing page**: Google builds the booking link from a landing-page template set in Hotel
   Center (not from the Transaction). The site has no `/book` page; a template like
   `https://sarihills.com/?checkin=(CHECKINYEAR)-(CHECKINMONTH)-(CHECKINDAY)&nights=(LENGTH)#rates`
   plus a few lines in `js/script.js` that fill `#availability-checkin`/`#availability-checkout`
   from those parameters (and run the check) would land guests on their quote.

## Corrections to the original handover document

- `<Currency>` and `<URL>` are not `Result` children: currency is the `currency` attribute on
  `Baserate`/`Tax`/`OtherFees`, and the link comes from the landing-page template.
- The sample Hotel List used made-up coordinates (-8.3405, 115.0925, in north Bali); the real
  ones are -8.8219867, 115.1852096.
- The site's prices are IDR, tax-inclusive, not USD plus 10%.
