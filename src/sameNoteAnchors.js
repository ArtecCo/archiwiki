const normalizeAnchor = (value) =>
  decodeURIComponent(String(value || ""))
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const getHeadingText = (heading) =>
  String(heading.textContent || "")
    .replace(/\s+/g, " ")
    .trim();

const convertWikiHeadingLinks = (root) => {
  const containers = root.querySelectorAll(".wiki-content");

  containers.forEach((container) => {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest("pre, code, a")) return NodeFilter.FILTER_REJECT;
          return /\[\[#[^\]]+\]\]/.test(node.nodeValue || "")
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    textNodes.forEach((textNode) => {
      const text = textNode.nodeValue || "";
      const regex = /\[\[#([^\]|]+)(?:\|([^\]]+))?\]\]/g;
      let lastIndex = 0;
      let match;
      const fragment = document.createDocumentFragment();
      let changed = false;

      while ((match = regex.exec(text))) {
        changed = true;
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));

        const link = document.createElement("a");
        link.href = `#${normalizeAnchor(match[1])}`;
        link.textContent = (match[2] || match[1]).trim();
        link.className = "same-note-anchor text-green-600 italic";
        link.dataset.sameNoteAnchor = "true";
        fragment.appendChild(link);

        lastIndex = regex.lastIndex;
      }

      if (!changed) return;

      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      textNode.parentNode.replaceChild(fragment, textNode);
    });
  });
};

const enhanceSameNoteAnchors = () => {
  const root = document.getElementById("root");
  if (!root) return;

  const headings = Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const used = new Map();
  const byAnchor = new Map();

  headings.forEach((heading) => {
    const text = getHeadingText(heading);
    if (!text) return;

    const existing = heading.getAttribute("id");
    const base = normalizeAnchor(existing || text) || "heading";
    const count = used.get(base) || 0;
    used.set(base, count + 1);

    if (!existing) heading.id = count === 0 ? base : `${base}-${count + 1}`;

    const finalId = heading.id;
    byAnchor.set(normalizeAnchor(finalId), heading);
    byAnchor.set(normalizeAnchor(text), heading);
  });

  convertWikiHeadingLinks(root);

  root.querySelectorAll('a[href^="#"]').forEach((link) => {
    const rawTarget = link.getAttribute("href");
    if (!rawTarget || rawTarget === "#") return;

    let target;
    try { target = decodeURIComponent(rawTarget.slice(1)); }
    catch { target = rawTarget.slice(1); }

    const heading = byAnchor.get(normalizeAnchor(target));
    if (!heading) return;

    const resolvedId = heading.id;
    if (resolvedId && link.getAttribute("href") !== `#${resolvedId}`) {
      link.setAttribute("href", `#${resolvedId}`);
    }

    link.classList.add("text-green-600", "italic");

    if (link.dataset.sameNoteAnchorBound === "true") return;
    link.dataset.sameNoteAnchorBound = "true";

    link.addEventListener("click", (event) => {
      event.preventDefault();
      heading.scrollIntoView({ behavior: "smooth", block: "start" });

      heading.classList.remove("archiwiki-anchor-highlight");
      void heading.offsetWidth;
      heading.classList.add("archiwiki-anchor-highlight");
      window.setTimeout(() => heading.classList.remove("archiwiki-anchor-highlight"), 1100);

      if (resolvedId) {
        window.history.replaceState(null, "", `#${encodeURIComponent(resolvedId)}`);
      }
    });
  });
};

const injectHighlightStyle = () => {
  if (document.getElementById("archiwiki-anchor-highlight-style")) return;

  const style = document.createElement("style");
  style.id = "archiwiki-anchor-highlight-style";
  style.textContent = `
    @keyframes archiwikiAnchorPulse {
      0%, 100% { background-color: transparent; }
      25%, 65% { background-color: rgba(34, 197, 94, 0.24); }
    }

    .archiwiki-anchor-highlight {
      animation: archiwikiAnchorPulse 1s ease-in-out;
      border-radius: 0.2rem;
    }

    @media (prefers-reduced-motion: reduce) {
      .archiwiki-anchor-highlight {
        animation: none;
        background-color: rgba(34, 197, 94, 0.24);
      }
    }
  `;
  document.head.appendChild(style);
};

let observer;

const startSameNoteAnchors = () => {
  if (typeof document === "undefined") return;

  injectHighlightStyle();
  enhanceSameNoteAnchors();

  const root = document.getElementById("root");
  if (!root || observer) return;

  observer = new MutationObserver(() => enhanceSameNoteAnchors());
  observer.observe(root, { childList: true, subtree: true });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startSameNoteAnchors, { once: true });
} else {
  startSameNoteAnchors();
}
