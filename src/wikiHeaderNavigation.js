export const ARCHIWIKI_HEADER_NAV_EVENT = "archiwiki-header-nav";

export function parseWikiTarget(target) {
  const raw = String(target || "").trim();
  const hash = raw.indexOf("#");
  if (hash <= 0) return { note: raw, header: "" };
  return { note: raw.slice(0, hash).trim(), header: raw.slice(hash + 1).trim() };
}

export function slugifyHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function makeUniqueHeaderId(text, used) {
  const base = slugifyHeader(text) || "heading";
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

export function getNoteStructure(markdown) {
  const used = new Set();
  return String(markdown || "")
    .split(/\r?\n/)
    .map((line) => line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/))
    .filter(Boolean)
    .map((match) => ({
      level: match[1].length,
      title: match[2].trim(),
      id: makeUniqueHeaderId(match[2], used)
    }));
}

export function navigateToNoteHeader(note, header) {
  window.dispatchEvent(new CustomEvent(ARCHIWIKI_HEADER_NAV_EVENT, {
    detail: { note, header }
  }));
}
