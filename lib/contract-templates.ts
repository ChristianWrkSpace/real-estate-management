/**
 * docx template engine — string-replaces [BRACKET] placeholders inside
 * a .docx file while preserving every formatting bit.
 *
 * A .docx is a zip archive; the prose lives in word/document.xml. Word
 * sometimes splits a string across multiple <w:t> runs (e.g. after a
 * spell-check edit), so we (1) collapse adjacent <w:t> inside the same
 * <w:r> if they exist, then (2) do bracket-aware text replacement.
 *
 * If a placeholder still spans multiple <w:r> tags after collapsing, we
 * fall back to a "lenient" pass that strips tags between brackets — it
 * may lose intra-bracket formatting (rare) but never corrupts the doc.
 */

import JSZip from "jszip";

export type ReplacementMap = Record<string, string>;

const DOC_XML = "word/document.xml";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Collapse same-formatting adjacent <w:t> runs. Word often emits
 *   <w:r><w:t>[RES</w:t><w:t>IDENT 1 FULL NAME]</w:t></w:r>
 * for placeholders that survived a spell-check; we rejoin them.
 */
function collapseAdjacentRuns(xml: string): string {
  return xml.replace(
    /(<w:t[^>]*>)([\s\S]*?)<\/w:t>\s*(<w:t[^>]*>)([\s\S]*?)<\/w:t>/g,
    (_, openA, textA, _openB, textB) => `${openA}${textA}${textB}</w:t>`
  );
}

/**
 * Lenient bracket replacement — strips XML tags inside a bracket pair
 * so a split placeholder like
 *   "[RES</w:t><w:t>IDENT 1 FULL NAME]"
 * collapses to "[RESIDENT 1 FULL NAME]" before matching.
 */
function lenientBracketReplace(xml: string, replacements: ReplacementMap): string {
  // Walk every bracketed token in the rendered text; rebuild XML with
  // tags stripped only inside the brackets, then apply the replacement.
  return xml.replace(/\[[\s\S]{0,160}?\]/g, (match) => {
    const stripped = match.replace(/<[^>]+>/g, "");
    const repl = replacements[stripped];
    if (repl == null) return match;
    return escapeXml(repl);
  });
}

export async function fillDocxTemplate(
  templateBytes: ArrayBuffer | Uint8Array | Buffer,
  replacements: ReplacementMap
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(templateBytes);
  const file = zip.file(DOC_XML);
  if (!file) {
    throw new Error("Template is not a valid .docx — word/document.xml not found");
  }

  let xml = await file.async("string");
  xml = collapseAdjacentRuns(xml);

  // Pass 1: literal replacement (handles same-run placeholders)
  for (const [token, value] of Object.entries(replacements)) {
    const safe = escapeXml(value);
    xml = xml.replace(new RegExp(escapeRegex(token), "g"), safe);
  }

  // Pass 2: lenient (handles split-run placeholders)
  xml = lenientBracketReplace(xml, replacements);

  zip.file(DOC_XML, xml);

  // Also patch the header/footer XMLs if they exist (often contain
  // landlord email etc.)
  const auxFiles = Object.keys(zip.files).filter(
    (k) => k.startsWith("word/header") || k.startsWith("word/footer")
  );
  for (const k of auxFiles) {
    const f = zip.file(k);
    if (!f) continue;
    let auxXml = await f.async("string");
    auxXml = collapseAdjacentRuns(auxXml);
    for (const [token, value] of Object.entries(replacements)) {
      auxXml = auxXml.replace(
        new RegExp(escapeRegex(token), "g"),
        escapeXml(value)
      );
    }
    auxXml = lenientBracketReplace(auxXml, replacements);
    zip.file(k, auxXml);
  }

  return await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Inspect a docx and pull every [BRACKET] placeholder it still
 * contains. Useful for the template registry + the UI's "fields you
 * still need to fill" preview.
 */
export async function extractPlaceholders(
  templateBytes: ArrayBuffer | Uint8Array | Buffer
): Promise<string[]> {
  const zip = await JSZip.loadAsync(templateBytes);
  const file = zip.file(DOC_XML);
  if (!file) return [];
  const xml = await file.async("string");
  const plain = xml.replace(/<[^>]+>/g, " ");
  const matches = plain.match(/\[[A-Z][A-Z0-9 _#&,/.]+\]/g) ?? [];
  return [...new Set(matches)];
}
