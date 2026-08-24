/* Additive scroll-position preservation. Does not modify Editor.jsx. */

let savedScrollTop = null;
let savedNoteKey = null;
let restoreTimer = null;

const getScrollContainer = () => {
  const textarea = document.querySelector("textarea");
  if (textarea && textarea.offsetParent !== null) return textarea;

  const viewer = document.getElementById("print-container");
  if (viewer) {
    let node = viewer.parentElement;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
  }

  return null;
};

const getNoteKey = () => {
  const viewerTitle = document.querySelector("#print-container h1")?.textContent?.trim();
  const editorTitle = document.querySelector("input[placeholder=\"Title your note\"]")?.value?.trim();
  return (viewerTitle || editorTitle || "").toLowerCase();
};

const savePosition = () => {
  const container = getScrollContainer();
  const key = getNoteKey();
  if (!container || !key) return;
  savedScrollTop = container.scrollTop;
  savedNoteKey = key;
};

const restorePosition = () => {
  if (savedScrollTop === null || !savedNoteKey) return;

  const container = getScrollContainer();
  const key = getNoteKey();
  if (!container || key !== savedNoteKey) return;

  const target = savedScrollTop;
  container.scrollTop = target;

  clearTimeout(restoreTimer);
  restoreTimer = setTimeout(() => {
    const current = getScrollContainer();
    if (current && getNoteKey() === savedNoteKey) {
      current.scrollTop = target;
    }
  }, 50);
};

const bind = () => {
  const root = document.getElementById("root");
  if (!root) return;

  root.addEventListener("click", (event) => {
    const button = event.target.closest?.("button");
    if (!button) return;

    const label = button.textContent?.replace(/\s+/g, " ").trim().toLowerCase();
    if (label === "edit" || label === "save") {
      savePosition();
      requestAnimationFrame(restorePosition);
      setTimeout(restorePosition, 0);
      setTimeout(restorePosition, 100);
      setTimeout(restorePosition, 250);
    }
  }, true);

  const observer = new MutationObserver(() => {
    if (savedScrollTop !== null) restorePosition();
  });
  observer.observe(root, { childList: true, subtree: true });
};

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
}