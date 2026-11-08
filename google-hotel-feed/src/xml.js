// Minimal XML handling for Google's Query messages, so the worker has no dependencies.
// Cloudflare Workers have no DOMParser; Google's queries are small and flat, so tag
// extraction is enough.

function decode(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// Text of every <name>...</name> (namespace prefixes ignored).
function all(xml, name) {
  const re = new RegExp("<(?:\\w+:)?" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?" + name + "\\s*>", "g");
  return [...xml.matchAll(re)].map((m) => m[1]);
}

function first(xml, name) {
  const found = all(xml, name)[0];
  return found === undefined ? null : found;
}

function int(text) {
  return text !== null && /^\s*\d+\s*$/.test(text) ? parseInt(text, 10) : null;
}

// Reads the parts of a Live Query this property cares about.
//   <Query><Checkin>2026-06-01</Checkin><Nights>3</Nights>
//     <DeadlineMs>1500</DeadlineMs>
//     <PropertyList><Property>sarihills_main</Property></PropertyList>
//     <Context><Occupancy>2</Occupancy>...</Context></Query>
// A date-range query (<FirstDate>/<LastDate> with one or more <Nights>) is expanded into
// every check-in date in the range.
export function parseQuery(xml) {
  const body = xml.replace(/<\?xml[\s\S]*?\?>/, "").replace(/<!--[\s\S]*?-->/g, "");
  const query = first(body, "Query");
  if (query === null) throw new Error("No <Query> element");

  const lists = all(query, "PropertyList");
  const properties = (lists.length ? lists.flatMap((list) => all(list, "Property")) : all(query, "Property")).map(decode);

  const context = first(query, "Context") || "";
  const adults = int(first(context, "NumAdults"));
  const children = all(context, "Child").length + (context.match(/<(?:\w+:)?Child\b[^>]*\/>/g) || []).length;
  const occupancy = int(first(context, "Occupancy")) ?? (adults !== null ? adults + children : null);

  return {
    checkin: first(query, "Checkin") !== null ? decode(first(query, "Checkin")) : null,
    firstDate: first(query, "FirstDate") !== null ? decode(first(query, "FirstDate")) : null,
    lastDate: first(query, "LastDate") !== null ? decode(first(query, "LastDate")) : null,
    nights: all(query, "Nights").map((n) => int(n)).filter((n) => n !== null),
    deadlineMs: int(first(query, "DeadlineMs")),
    properties,
    occupancy,
  };
}

function money(amount, config) {
  return 'currency="' + escapeXml(config.currency) + '">' + amount.toFixed(config.decimals);
}

// One <Result> per itinerary. Element order follows Google's Transaction schema.
export function buildTransaction(results, config, now = new Date()) {
  const timestamp = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const id = "sarihills-" + now.getTime().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<Transaction timestamp="' + timestamp + '" id="' + id + '">'];

  for (const r of results) {
    lines.push("  <Result>");
    lines.push("    <Property>" + escapeXml(config.propertyId) + "</Property>");
    lines.push("    <Checkin>" + r.checkin + "</Checkin>");
    lines.push("    <Nights>" + r.nights + "</Nights>");
    if (r.unavailable) {
      lines.push("    <Unavailable>");
      lines.push("      <NoVacancy/>");
      lines.push("    </Unavailable>");
    } else {
      lines.push("    <Baserate " + money(r.base, config) + "</Baserate>");
      lines.push("    <Tax " + money(r.tax, config) + "</Tax>");
      lines.push("    <OtherFees " + money(r.fees, config) + "</OtherFees>");
      if (r.occupancy) lines.push("    <Occupancy>" + r.occupancy + "</Occupancy>");
    }
    lines.push("  </Result>");
  }

  lines.push("</Transaction>");
  return lines.join("\n") + "\n";
}
