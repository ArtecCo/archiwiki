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

const getViewerScroller = (heading) => {
  let node = heading?.parentElement;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    if (
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) return node;
    node = node.parentElement;
  }
  return null;
};

const scrollToHeading = (heading) => {
  if (!heading) return;
  const scroller = getViewerScroller(heading);

  if (scroller) {
    const scrollerRect = scroller.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    scroller.scrollTo({
      top: Math.max(
        0,
        scroller.scrollTop + (headingRect.top - scrollerRect.top) - 16
      ),
      behavior: "smooth"
    });
  } else {
    heading.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  heading.classList.remove("archiwiki-anchor-highlight");
  void heading.offsetWidth;
  heading.classList.add("archiwiki-anchor-highlight");
  window.setTimeout(
    () => heading.classList.remove("archiwiki-anchor-highlight"),
    1100
  );
};

/*
 * ArchiWiki underline syntax: ++text++
 * This is deliberately not applied inside code or links.
 */
const convertUnderlineSyntax = (root) => {
  root.querySelectorAll(".wiki-content").forEach((container) => {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || parent.closest("pre, code, a, u")) {
            return NodeFilter.FILTER_REJECT;
          }
          return /\+\+[^+\n]+\+\+/.test(node.nodeValue || "")
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
      const regex = /\+\+([^+\n]+)\+\+/g;
      let lastIndex = 0;
      let match;
      let changed = false;
      const fragment = document.createDocumentFragment();

      while ((match = regex.exec(text))) {
        changed = true;
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, match.index))
        );

        const underline = document.createElement("u");
        underline.textContent = match[1];
        fragment.appendChild(underline);
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

  const headings = Array.from(
    root.querySelectorAll(
      "#print-container h1, #print-container h2, #print-container h3, #print-container h4, #print-container h5, #print-container h6"
    )
  );

  const used = new Map();
  const byAnchor = new Map();

  headings.forEach((heading) => {
    const text = getHeadingText(heading);
    if (!text) return;

    const existing = heading.getAttribute("id");
    const base = normalizeAnchor(existing || text) || "heading";
    const count = used.get(base) || 0;
    used.set(base, count + 1);

    if (!existing) {
      heading.id = count === 0 ? base : `${base}-${count + 1}`;
    }

    byAnchor.set(normalizeAnchor(heading.id), heading);
    byAnchor.set(normalizeAnchor(text), heading);
  });

  /* Same-note links are standard Markdown only: [SMON](#SMON). */
  root.querySelectorAll('a[href^="#"]').forEach((link) => {
    const rawTarget = link.getAttribute("href");
    if (!rawTarget || rawTarget === "#") return;

    let target;
    try {
      target = decodeURIComponent(rawTarget.slice(1));
    } catch {
      target = rawTarget.slice(1);
    }

    const heading = byAnchor.get(normalizeAnchor(target));
    if (!heading) return;

    if (heading.id) link.setAttribute("href", `#${heading.id}`);
    link.classList.add("same-note-anchor");
    link.style.cursor = "pointer";
    link.style.pointerEvents = "auto";
  });

  convertUnderlineSyntax(root);
};

const bindSameNoteLinkClicks = () => {
  const root = document.getElementById("root");
  if (!root || root.dataset.sameNoteClickBound === "true") return;
  root.dataset.sameNoteClickBound = "true";

  root.addEventListener("click", (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    if (!link || !root.contains(link)) return;

    const href = link.getAttribute("href");
    if (!href || href === "#") return;

    const target = normalizeAnchor(href.slice(1));
    const headings = root.querySelectorAll(
      "#print-container h1, #print-container h2, #print-container h3, #print-container h4, #print-container h5, #print-container h6"
    );

    const heading = Array.from(headings).find(
      (candidate) =>
        normalizeAnchor(candidate.id) === target ||
        normalizeAnchor(getHeadingText(candidate)) === target
    );

    if (!heading) return;
    event.preventDefault();
    event.stopPropagation();
    scrollToHeading(heading);
  });
};

const injectHighlightStyle = () => {
  if (document.getElementById("archiwiki-anchor-highlight-style")) return;

  const style = document.createElement("style");
  style.id = "archiwiki-anchor-highlight-style";
  style.textContent = `
    .same-note-anchor::before {
      content: "#";
    }
    @keyframes archiwikiAnchorPulse {
      0%, 100% { background-color: transparent; }
      25%, 65% { background-color: rgba(34, 197, 94, 0.24); }
    }
    .archiwiki-anchor-highlight {
      animation: archiwikiAnchorPulse 1s ease-in-out;
      border-radius: 0.2rem;
      scroll-margin-top: 16px;
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

  const root = document.getElementById("root");
  if (!root) return;

  bindSameNoteLinkClicks();
  enhanceSameNoteAnchors();

  if (observer) return;
  observer = new MutationObserver(() => enhanceSameNoteAnchors());
  observer.observe(root, { childList: true, subtree: true });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startSameNoteAnchors, { once: true });
} else {
  startSameNoteAnchors();
}
