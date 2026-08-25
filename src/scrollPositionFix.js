/*
 * Preserve the user's visual document position across editor mode changes.
 *
 * Edit and Save replace the scrollable DOM surface (viewer <-> textarea),
 * while toolbar actions usually keep the same surface. We capture all three
 * possible scroll owners before React handles the click and restore them
 * after the render. Window/document scroll is included because some layouts
 * can temporarily move the browser viewport when focus changes.
 */

let savedWorkspaceScrollTop = null;
let savedTextareaScrollTop = null;
let savedWindowScrollY = null;
let restoreTimers = [];

const clearRestoreTimers = () => {
  restoreTimers.forEach((timer) => clearTimeout(timer));
  restoreTimers = [];
};

const getTextarea = () => document.querySelector("textarea");

const getEditorWorkspace = () => {
  const textarea = getTextarea();

  if (textarea) {
    const candidate = textarea.parentElement?.parentElement;
    if (candidate) return candidate;
  }

  const viewer = document.getElementById("print-container");
  if (!viewer) return null;

  let node = viewer.parentElement;

  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);

    if (
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }

    node = node.parentElement;
  }

  return null;
};

const capturePosition = () => {
  const workspace = getEditorWorkspace();
  const textarea = getTextarea();

  savedWorkspaceScrollTop = workspace?.scrollTop ?? null;
  savedTextareaScrollTop = textarea?.scrollTop ?? null;
  savedWindowScrollY = window.scrollY;

  return (
    savedWorkspaceScrollTop !== null ||
    savedTextareaScrollTop !== null ||
    savedWindowScrollY !== null
  );
};

const clampScroll = (value, element) => {
  if (value === null || value === undefined || !element) return;

  element.scrollTop = Math.min(
    Math.max(0, value),
    Math.max(0, element.scrollHeight - element.clientHeight)
  );
};

const restorePosition = () => {
  const workspace = getEditorWorkspace();
  const textarea = getTextarea();

  /*
   * Restore window/document scrolling first. This prevents the browser's
   * focus/DOM replacement from leaving the viewport at y=0.
   */
  if (savedWindowScrollY !== null) {
    window.scrollTo(0, savedWindowScrollY);

    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = savedWindowScrollY;
    }
  }

  /*
   * The same numeric document position is intentionally transferred between
   * the viewer workspace and textarea. This is what makes Edit and Save feel
   * like a mode switch rather than navigation to a new page.
   */
  if (textarea && savedTextareaScrollTop !== null) {
    clampScroll(savedTextareaScrollTop, textarea);
  }

  if (workspace && savedWorkspaceScrollTop !== null) {
    clampScroll(savedWorkspaceScrollTop, workspace);
  } else if (workspace && savedTextareaScrollTop !== null) {
    clampScroll(savedTextareaScrollTop, workspace);
  } else if (textarea && savedWorkspaceScrollTop !== null) {
    clampScroll(savedWorkspaceScrollTop, textarea);
  }
};

const scheduleRestore = () => {
  clearRestoreTimers();

  /*
   * The first restore happens on the next paint, before the user can perceive
   * the newly mounted surface. Later restores cover React's commit and any
   * asynchronous Save/state update without continuously fighting scrolling.
   */
  requestAnimationFrame(restorePosition);

  [0, 16, 40, 80, 140, 240, 400].forEach((delay) => {
    restoreTimers.push(
      setTimeout(() => {
        requestAnimationFrame(restorePosition);
      }, delay)
    );
  });
};

const isEditorToolbarButton = (button) => {
  const title = button?.getAttribute("title")?.trim().toLowerCase();

  return [
    "bold",
    "italic",
    "heading",
    "bulleted list",
    "numbered list",
    "quote",
    "code",
    "link"
  ].includes(title);
};

const preventTextareaFocusScroll = () => {
  if (window.__archiwikiPreventTextareaFocusScroll) return;

  const nativeFocus = HTMLTextAreaElement.prototype.focus;

  HTMLTextAreaElement.prototype.focus = function (options) {
    if (options === undefined) {
      return nativeFocus.call(this, { preventScroll: true });
    }

    return nativeFocus.call(this, options);
  };

  window.__archiwikiPreventTextareaFocusScroll = true;
};

const bind = () => {
  const root = document.getElementById("root");
  if (!root) return;

  preventTextareaFocusScroll();

  root.addEventListener(
    "pointerdown",
    (event) => {
      const button = event.target.closest?.("button");
      if (!button) return;

      const label = button.textContent
        ?.replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const isEditOrSave =
        label === "edit" || label === "save";

      if (!isEditOrSave && !isEditorToolbarButton(button)) return;

      /* Capture BEFORE React's click handler changes isEditing/DOM. */
      if (capturePosition()) {
        scheduleRestore();
      }
    },
    true
  );
};

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
}
