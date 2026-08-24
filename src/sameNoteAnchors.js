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

    if (!existing) {
      heading.id = count === 0 ? base : `${base}-${count + 1}`;
    }

    const finalId = heading.id;
    byAnchor.set(normalizeAnchor(finalId), heading);
    byAnchor.set(normalizeAnchor(text), heading);
  });

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

    const resolvedId = heading.id;
    if (resolvedId && link.getAttribute("href") !== `#${resolvedId}`) {
      link.setAttribute("href", `#${resolvedId}`);
    }

    if (link.dataset.sameNoteAnchorBound === "true") return;
    link.dataset.sameNoteAnchorBound = "true";

    link.addEventListener("click", (event) => {
      event.preventDefault();
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
      if (resolvedId) {
        window.history.replaceState(null, "", `#${encodeURIComponent(resolvedId)}`);
      }
    });
  });
};

let observer;

const startSameNoteAnchors = () => {
  if (typeof document === "undefined") return;

  enhanceSameNoteAnchors();

  const root = document.getElementById("root");
  if (!root || observer) return;

  observer = new MutationObserver(() => {
    enhanceSameNoteAnchors();
  });

  observer.observe(root, {
    childList: true,
    subtree: true
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startSameNoteAnchors, { once: true });
} else {
  startSameNoteAnchors();
}
