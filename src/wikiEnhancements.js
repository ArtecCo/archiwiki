/*
 * Safe additive enhancements. This module deliberately leaves Editor.jsx,
 * PDF generation, storage and existing wiki-link rendering untouched.
 */

const WIKI_CAPTURE_RE = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/;
const WIKI_PLACEHOLDER_RE = /WIKILINKPLACEHOLDER(\d+)WIKILINKPLACEHOLDER/g;
const originalReplace = String.prototype.replace;
const capturedWikiLinks = [];
let patched = false;

const slugify = (value) =>
  decodeURIComponent(String(value || "")).trim().toLowerCase()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

const escapeAttr = (value) => String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeText = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const isWikiCaptureRegex = (regex) => regex instanceof RegExp && regex.source === WIKI_CAPTURE_RE.source;
const isWikiPlaceholderRegex = (regex) => regex instanceof RegExp && regex.source === WIKI_PLACEHOLDER_RE.source;

const patchWikiRenderer = () => {
  if (patched) return;
  patched = true;
  String.prototype.replace = function (searchValue, replaceValue) {
    if (isWikiCaptureRegex(searchValue) && typeof replaceValue === "function") {
      capturedWikiLinks.length = 0;
      return originalReplace.call(this, searchValue, function (match, target, label, offset, source) {
        capturedWikiLinks.push({ target: String(target || "").trim(), label: String(label || target || "").trim() });
        return replaceValue.call(this, match, target, label, offset, source);
      });
    }
    if (isWikiPlaceholderRegex(searchValue) && typeof replaceValue === "function") {
      return originalReplace.call(this, searchValue, function (match, index, offset, source) {
        const result = replaceValue.call(this, match, index, offset, source);
        const item = capturedWikiLinks[Number(index)];
        if (!item || !item.target.includes("#")) return result;
        const hash = item.target.indexOf("#");
        const noteTitle = item.target.slice(0, hash).trim();
        const header = item.target.slice(hash + 1).trim();
        if (!noteTitle || !header) return result;
        return `\n<span class="wiki-link archiwiki-header-wiki-link underline cursor-pointer font-semibold" data-archiwiki-note-title="${escapeAttr(noteTitle)}" data-archiwiki-header="${escapeAttr(header)}" title="Open ${escapeAttr(noteTitle)} → ${escapeAttr(header)}">${escapeText(item.label)}</span>\n`;
      });
    }
    return originalReplace.call(this, searchValue, replaceValue);
  };
};

const findSidebarNote = (title) => {
  const wanted = String(title || "").trim().toLowerCase();
  return Array.from(document.querySelectorAll(".archiwiki-sidebar-item")).find((item) => {
    const span = item.querySelector("span.truncate");
    return span?.textContent?.trim().toLowerCase() === wanted && item.querySelector("svg");
  }) || null;
};

const highlightHeading = (heading) => {
  if (!heading) return;
  heading.classList.remove("archiwiki-anchor-highlight");
  void heading.offsetWidth;
  heading.classList.add("archiwiki-anchor-highlight");
  window.setTimeout(() => heading.classList.remove("archiwiki-anchor-highlight"), 1100);
};

const findHeading = (root, target) => {
  const wanted = slugify(target);
  return Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6")).find((heading) => slugify(heading.id || heading.textContent) === wanted);
};

const navigateCrossNoteHeader = (link) => {
  const noteTitle = link.dataset.archiwikiNoteTitle;
  const header = link.dataset.archiwikiHeader;
  const noteItem = findSidebarNote(noteTitle);
  if (!noteItem) return;
  sessionStorage.setItem("archiwiki-pending-header", JSON.stringify({ noteTitle, header }));
  noteItem.click();
};

const finishPendingHeaderJump = () => {
  const raw = sessionStorage.getItem("archiwiki-pending-header");
  if (!raw) return;
  let pending;
  try { pending = JSON.parse(raw); } catch { sessionStorage.removeItem("archiwiki-pending-header"); return; }
  const root = document.getElementById("print-container");
  const title = root?.querySelector("h1")?.textContent?.trim();
  if (!root || !title || title.toLowerCase() !== pending.noteTitle.toLowerCase()) return;
  const heading = findHeading(root, pending.header);
  if (!heading) return;
  sessionStorage.removeItem("archiwiki-pending-header");
  heading.scrollIntoView({ behavior: "smooth", block: "start" });
  highlightHeading(heading);
};

const wireCrossNoteHeaders = () => {
  document.querySelectorAll(".archiwiki-header-wiki-link").forEach((link) => {
    if (link.dataset.archiwikiHeaderBound === "true") return;
    link.dataset.archiwikiHeaderBound = "true";
    link.addEventListener("click", (event) => {
      event.preventDefault(); event.stopPropagation(); navigateCrossNoteHeader(link);
    });
  });
};

const getStructureHeadings = (root) => {
  const used = new Set();
  return Array.from(root.querySelectorAll("h2, h3, h4, h5, h6")).map((heading) => {
    const title = heading.textContent.replace(/\s+/g, " ").trim();
    const base = slugify(title) || "heading";
    let id = base; let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id); if (!heading.id) heading.id = id;
    return { heading, title, level: Number(heading.tagName.slice(1)) };
  });
};

const buildTree = (container, root) => {
  if (!container) return;
  container.innerHTML = "";
  if (!root) {
    container.innerHTML = '<p class="text-neutral-400 italic">No headings in this note.</p>';
    return;
  }

  const headings = getStructureHeadings(root);
  if (!headings.length) {
    container.innerHTML = '<p class="text-neutral-400 italic">No headings in this note.</p>';
    return;
  }

  const list = document.createElement("div");
  list.className = "space-y-0.5";
  headings.forEach(({ heading, title, level }, index) => {
    const rowWrap = document.createElement("div");
    rowWrap.className = "flex items-stretch";
    rowWrap.style.paddingLeft = `${Math.max(0, level - 2) * 12}px`;

    const guide = document.createElement("div");
    guide.className = "w-3 shrink-0 border-l border-neutral-300/80";
    if (index === headings.length - 1) guide.className += " border-l-transparent";

    const row = document.createElement("button");
    row.type = "button";
    row.className = "block flex-1 min-w-0 text-left py-1 px-2 rounded hover:bg-neutral-200/70 transition-colors truncate";
    row.textContent = title;
    row.title = title;
    row.addEventListener("click", () => { heading.scrollIntoView({ behavior: "smooth", block: "start" }); highlightHeading(heading); });
    rowWrap.append(guide, row);
    list.appendChild(rowWrap);
  });
  container.appendChild(list);
};

const findBacklinksPanel = () => Array.from(document.querySelectorAll("#root .border-l")).find((element) => element.textContent.includes("Backlinks ("));

const refreshStructure = () => {
  const panel = findBacklinksPanel();
  const structure = panel?.querySelector(".archiwiki-structure-content");
  if (!structure) return;
  buildTree(structure, document.getElementById("print-container"));
};

const enhanceBacklinksPanel = () => {
  const panel = findBacklinksPanel();
  if (!panel) return;
  if (panel.dataset.archiwikiStructureReady === "true") {
    refreshStructure();
    return;
  }

  const heading = panel.querySelector("h4");
  const content = panel.querySelector("h4 + div");
  if (!heading || !content) return;
  panel.dataset.archiwikiStructureReady = "true";

  const tabs = document.createElement("div");
  tabs.className = "flex items-center gap-1 border-b border-neutral-200 pb-2";
  const structureButton = document.createElement("button");
  const backlinksButton = document.createElement("button");
  const structure = document.createElement("div");
  structure.className = "archiwiki-structure-content flex-1 overflow-y-auto";

  structureButton.type = backlinksButton.type = "button";
  structureButton.textContent = "Structure";
  backlinksButton.textContent = "Backlinks";
  const active = "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-200/70";
  const inactive = "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-neutral-400";
  structureButton.className = active;
  backlinksButton.className = inactive;

  tabs.append(structureButton, backlinksButton);
  panel.insertBefore(tabs, heading);
  heading.classList.add("hidden");

  structureButton.addEventListener("click", () => {
    structureButton.className = active;
    backlinksButton.className = inactive;
    content.classList.add("hidden");
    structure.classList.remove("hidden");
    refreshStructure();
  });

  backlinksButton.addEventListener("click", () => {
    backlinksButton.className = active;
    structureButton.className = inactive;
    structure.classList.add("hidden");
    content.classList.remove("hidden");
  });

  panel.appendChild(structure);
  content.classList.add("hidden");
  refreshStructure();
};

let scheduled = false;
const runEnhancements = () => {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    wireCrossNoteHeaders();
    finishPendingHeaderJump();
    enhanceBacklinksPanel();
    refreshStructure();
  });
};

const start = () => {
  patchWikiRenderer();
  runEnhancements();
  const root = document.getElementById("root");
  if (!root) return;
  const observer = new MutationObserver(runEnhancements);
  observer.observe(root, { childList: true, subtree: true });
};

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}
