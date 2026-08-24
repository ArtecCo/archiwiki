/* Additive scroll-position preservation. Does not modify Editor.jsx. */

/*
 * Important:
 * Do NOT continuously restore scroll position with a MutationObserver.
 * React mutates the DOM while the user types, and restoring on every
 * mutation makes the textarea jump back to the position where Edit was hit.
 *
 * We only capture/restore around the two deliberate mode transitions:
 * View -> Edit and Edit -> Save -> View.
 */

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

      if (
        (style.overflowY === "auto" ||
          style.overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight
      ) {
        return node;
      }

      node = node.parentElement;
    }
  }

  return null;
};

const getNoteKey = () => {
  const viewerTitle = document
    .querySelector("#print-container h1")
    ?.textContent
    ?.trim();

  const editorTitle = document
    .querySelector('input[placeholder="Title your note"]')
    ?.value
    ?.trim();

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

  clearTimeout(restoreTimer);

  const apply = () => {
    const current = getScrollContainer();

    if (!current || getNoteKey() !== savedNoteKey) return;

    current.scrollTop = Math.min(
      target,
      Math.max(0, current.scrollHeight - current.clientHeight)
    );
  };

  // React needs to finish replacing the viewer/editor before the
  // saved scroll position can be applied.
  apply();
  requestAnimationFrame(apply);

  restoreTimer = setTimeout(apply, 100);
};

const bind = () => {
  const root = document.getElementById("root");

  if (!root) return;

  root.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest?.("button");

      if (!button) return;

      const label = button.textContent
        ?.replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      if (label !== "edit" && label !== "save") return;

      /*
       * Capture immediately before the mode transition.
       * After this point the user is free to scroll and type;
       * nothing will overwrite or restore this value until the
       * next deliberate Edit/Save transition.
       */
      savePosition();

      requestAnimationFrame(restorePosition);
      setTimeout(restorePosition, 0);
      setTimeout(restorePosition, 100);
      setTimeout(restorePosition, 250);
    },
    true
  );
};

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, {
      once: true
    });
  } else {
    bind();
  }
}
