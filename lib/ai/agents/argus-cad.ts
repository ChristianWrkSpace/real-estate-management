/**
 * Argus-CAD — Webb County Appraisal District scraper + parser.
 *
 * Webb County uses the True Automation PropAccess portal at
 *   https://propaccess.trueautomation.com/clientdb/?cid=125  (cid=125 = Webb)
 *
 * The portal has a public search endpoint and detail page. Account
 * numbers and addresses both work as lookups.
 *
 * This module is intentionally defensive:
 *   - All network calls go through a single fetchHtml() with a custom
 *     user-agent identifying PropMan OS, a short timeout, and a single
 *     retry. Never crawls — only one search + one detail page per call.
 *   - HTML extraction is done in two passes: a fast regex pre-pass to
 *     pull the obvious numeric fields, then the FAST AI tier (Haiku)
 *     to fill in anything the regex missed and verify the numbers.
 *   - If the portal is unreachable, the function returns a clear
 *     unavailable status. It never throws.
 *   - A WEBB_CAD_DRY_RUN=true env flag returns deterministic synthetic
 *     data without hitting the network — useful for local dev and
 *     tests when you don't want to pound a public site.
 */

import { runFastAgent } from "@/lib/ai/orchestrator";

const PORTAL_BASE = "https://propaccess.trueautomation.com/clientdb";
const WEBB_CID = "125";
const USER_AGENT =
  "PropMan-OS-ArgusCAD/1.0 (single-owner property dashboard; contact: frizzhasit@gmail.com)";

export type CadLookupInput =
  | { kind: "account"; account: string }
  | { kind: "address"; street: string; zip: string };

export type CadParseResult = {
  status: "ok" | "unavailable" | "not_found" | "parse_failed";
  tax_year: number | null;
  assessed_market_value: number | null;
  assessed_taxable_value: number | null;
  tax_levy_current_year: number | null;
  protest_deadline: string | null; // YYYY-MM-DD
  cad_account_number: string | null;
  source_url: string | null;
  raw_excerpt: string | null;
  parsed_by_model: string | null;
  parse_cost_usd: number;
  notes: string[];
  fetched_at: string;
};

const ZERO_RESULT: Omit<CadParseResult, "status" | "notes" | "fetched_at"> = {
  tax_year: null,
  assessed_market_value: null,
  assessed_taxable_value: null,
  tax_levy_current_year: null,
  protest_deadline: null,
  cad_account_number: null,
  source_url: null,
  raw_excerpt: null,
  parsed_by_model: null,
  parse_cost_usd: 0,
};

function emptyResult(
  status: CadParseResult["status"],
  notes: string[] = []
): CadParseResult {
  return {
    status,
    ...ZERO_RESULT,
    notes,
    fetched_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchHtml — single-request HTTP with timeout + identity + retry
// ─────────────────────────────────────────────────────────────────────────────

async function fetchHtml(url: string, timeoutMs = 12_000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Regex first pass — cheap, deterministic, no API cost
// ─────────────────────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseUsd(s: string | undefined | null): number | null {
  if (!s) return null;
  const clean = s.replace(/[$,]/g, "").trim();
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function regexExtract(text: string) {
  // True Automation labels are usually: "Market Value", "Assessed", "Appraised",
  // "Taxable Value", "Total Levy", "Protest Deadline". We grab anything that
  // looks like "<label>: $X,XXX,XXX" or "<label> X,XXX,XXX".
  const grab = (label: RegExp): string | null => {
    const re = new RegExp(
      `${label.source}[^$0-9-]{0,40}([$]?\\s*-?\\s*[0-9][0-9,]*(?:\\.[0-9]{1,2})?)`,
      "i"
    );
    return text.match(re)?.[1]?.trim() ?? null;
  };
  const grabDate = (label: RegExp): string | null => {
    const re = new RegExp(
      `${label.source}[^0-9]{0,40}([0-9]{1,2}/[0-9]{1,2}/[0-9]{2,4})`,
      "i"
    );
    return text.match(re)?.[1] ?? null;
  };

  const marketRaw =
    grab(/market\s*value/) ?? grab(/appraised\s*value/) ?? grab(/total\s*value/);
  const taxableRaw =
    grab(/taxable\s*value/) ?? grab(/assessed\s*value/) ?? grab(/net\s*taxable/);
  const levyRaw =
    grab(/total\s*tax(?:es)?(?:\s*due)?/) ??
    grab(/total\s*levy/) ??
    grab(/current\s*year\s*tax(?:es)?/);
  const protestRaw =
    grabDate(/protest\s*deadline/) ?? grabDate(/notice\s*of\s*protest/);
  const accountMatch =
    text.match(/account\s*(?:#|no\.?|number)?\s*[:\-]?\s*([A-Z0-9-]{4,})/i)?.[1] ??
    text.match(/property\s*id\s*[:\-]?\s*([A-Z0-9-]{4,})/i)?.[1] ??
    null;
  const taxYear =
    Number(text.match(/(20[2-9][0-9])\s*tax\s*year/i)?.[1]) ||
    Number(text.match(/tax\s*year\s*[:\-]?\s*(20[2-9][0-9])/i)?.[1]) ||
    null;

  return {
    market_value: parseUsd(marketRaw),
    taxable_value: parseUsd(taxableRaw),
    tax_levy: parseUsd(levyRaw),
    protest_deadline_raw: protestRaw,
    account: accountMatch,
    tax_year: taxYear,
  };
}

function normalizeDate(input: string | null): string | null {
  if (!input) return null;
  const m = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const [, mo, day, yr] = m;
  const year = yr.length === 2 ? 2000 + Number(yr) : Number(yr);
  const iso = new Date(year, Number(mo) - 1, Number(day));
  if (Number.isNaN(iso.getTime())) return null;
  return iso.toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// AI second pass — fills gaps from raw text via Haiku
// ─────────────────────────────────────────────────────────────────────────────

type AiTaxExtract = {
  tax_year: number | null;
  assessed_market_value: number | null;
  assessed_taxable_value: number | null;
  tax_levy_current_year: number | null;
  protest_deadline: string | null;
};

async function aiRefine(text: string): Promise<{
  result: AiTaxExtract | null;
  model: string;
  costUsd: number;
}> {
  const truncated = text.slice(0, 8_000);

  const result = await runFastAgent<AiTaxExtract>({
    agent: "argus-cad",
    task: "extract_tax_fields_from_html_text",
    systemPrompt: `You read raw text scraped from a Texas county appraisal district website (Webb CAD via True Automation).
Extract ONLY these fields and return JSON — no prose, no fences.
Schema:
{
  "tax_year": integer | null,
  "assessed_market_value": number | null,      // USD, no $ or commas
  "assessed_taxable_value": number | null,     // USD
  "tax_levy_current_year": number | null,      // USD, total current year tax owed
  "protest_deadline": "YYYY-MM-DD" | null
}
If a value is not present or ambiguous in the text, use null. Never invent numbers.`,
    userPrompt: truncated,
    maxTokens: 300,
  });

  return {
    result: result.parsed ?? null,
    model: result.model,
    costUsd: result.costUsd,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run synthetic data — for local dev / when WEBB_CAD_DRY_RUN=true
// ─────────────────────────────────────────────────────────────────────────────

function dryRunResult(): CadParseResult {
  const year = new Date().getFullYear();
  return {
    status: "ok",
    tax_year: year,
    assessed_market_value: 312_500,
    assessed_taxable_value: 287_300,
    tax_levy_current_year: 7_410.55,
    protest_deadline: `${year}-05-31`,
    cad_account_number: "R0XXXXXX",
    source_url: `${PORTAL_BASE}/?cid=${WEBB_CID}#dryrun`,
    raw_excerpt: "[dry-run] synthetic Webb CAD response — no live fetch performed",
    parsed_by_model: "n/a (dry-run)",
    parse_cost_usd: 0,
    notes: ["WEBB_CAD_DRY_RUN=true — returning deterministic synthetic data"],
    fetched_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchWebbCountyAppraisal(
  input: CadLookupInput
): Promise<CadParseResult> {
  if (process.env.WEBB_CAD_DRY_RUN === "true") {
    return dryRunResult();
  }

  const notes: string[] = [];

  // Build the search URL. True Automation accepts:
  //   - account-number search: ?cid=125&prop_id=R0xxxxxx
  //   - text search: ?cid=125&searchtext=<address>
  let searchUrl: string;
  if (input.kind === "account") {
    searchUrl = `${PORTAL_BASE}/SearchResults.aspx?cid=${WEBB_CID}&prop_id=${encodeURIComponent(
      input.account
    )}`;
  } else {
    const q = `${input.street} ${input.zip}`.trim();
    searchUrl = `${PORTAL_BASE}/SearchResults.aspx?cid=${WEBB_CID}&searchtext=${encodeURIComponent(
      q
    )}`;
  }

  const searchHtml = await fetchHtml(searchUrl);
  if (!searchHtml) {
    return emptyResult("unavailable", [
      `Could not reach Webb CAD portal at ${searchUrl}`,
    ]);
  }

  // True Automation links each result to a detail page. We try to find the
  // first /clientdb/Property.aspx?... link in the response.
  const detailMatch = searchHtml.match(
    /href="(\/clientdb\/Property\.aspx\?[^"]+)"/i
  );
  const detailUrl = detailMatch
    ? `https://propaccess.trueautomation.com${detailMatch[1]}`
    : null;

  let html = searchHtml;
  let sourceUrl = searchUrl;

  if (detailUrl) {
    const detailHtml = await fetchHtml(detailUrl);
    if (detailHtml) {
      html = detailHtml;
      sourceUrl = detailUrl;
    } else {
      notes.push("Detail page fetch failed; falling back to search-result text");
    }
  } else {
    notes.push("No detail-page link found in search results");
  }

  const text = stripTags(html);

  if (text.length < 200) {
    return emptyResult("not_found", [
      ...notes,
      "Page returned but body was too short to contain assessment data",
    ]);
  }

  // Pass 1 — regex
  const regex = regexExtract(text);

  // Pass 2 — AI, only if regex left gaps
  let model: string | null = null;
  let costUsd = 0;
  let ai: AiTaxExtract | null = null;
  const regexMissing =
    !regex.market_value ||
    !regex.taxable_value ||
    !regex.tax_levy ||
    !regex.protest_deadline_raw;

  if (regexMissing) {
    try {
      const refined = await aiRefine(text);
      ai = refined.result;
      model = refined.model;
      costUsd = refined.costUsd;
      if (!ai) notes.push("AI refinement returned no structured output");
    } catch (err) {
      notes.push(`AI refinement failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  const final: CadParseResult = {
    status: "ok",
    tax_year: regex.tax_year ?? ai?.tax_year ?? null,
    assessed_market_value: regex.market_value ?? ai?.assessed_market_value ?? null,
    assessed_taxable_value: regex.taxable_value ?? ai?.assessed_taxable_value ?? null,
    tax_levy_current_year: regex.tax_levy ?? ai?.tax_levy_current_year ?? null,
    protest_deadline:
      normalizeDate(regex.protest_deadline_raw) ?? ai?.protest_deadline ?? null,
    cad_account_number: regex.account ?? null,
    source_url: sourceUrl,
    raw_excerpt: text.slice(0, 1_500),
    parsed_by_model: model,
    parse_cost_usd: costUsd,
    notes,
    fetched_at: new Date().toISOString(),
  };

  const filledFields = [
    final.assessed_market_value,
    final.assessed_taxable_value,
    final.tax_levy_current_year,
    final.protest_deadline,
  ].filter((v) => v != null).length;

  if (filledFields === 0) {
    final.status = "parse_failed";
    final.notes.push("Page fetched but none of the four required fields could be parsed");
  }

  return final;
}
