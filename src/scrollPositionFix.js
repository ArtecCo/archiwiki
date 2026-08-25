/*
 * Preserve the editor's actual document position across Edit, toolbar
 * mutations, and Save without producing a visible scroll-to-top flash.
 *
 * There are two different scroll owners:
 *   - reading mode: the main editor workspace
 *   - editing mode: the textarea itself
 *
 * We intentionally capture only around deliberate editor actions. We do not
 * observe mutations or continuously force scrollTop, so normal typing and
 * scrolling remain completely native.
 */

let savedScrollTop = null;
let savedNoteKey = null;
let savedScrollOwner = null;
let restoreTimers = [];

const clearRestoreTimers = () => {
  restoreTimers.forEach((timer) => clearTimeout(timer));
  restoreTimers = [];
};

const getTextarea = () => document.querySelector("textarea");

const getEditorWorkspace = () => {
  const textarea = getTextarea();

  if (textarea) {
    const workspace = textarea.parentElement?.parentElement;
    if (workspace) return workspace;
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

const getNoteKey = () => {
  const hashNote = new URLSearchParams(
    window.location.hash.replace(/^#/, "")
  ).get("note");

  const viewerTitle = document
    .querySelector("#print-container h1")
    ?.textContent
    ?.trim();

  const editorTitle = document
    .querySelector('input[placeholder="Title your note"]')
    ?.value
    ?.trim();

  return String(
    hashNote || viewerTitle || editorTitle || ""
  ).toLowerCase();
};

const capturePosition = () => {
  const textarea = getTextarea();
  const workspace = getEditorWorkspace();
  const key = getNoteKey();

  if (!key) return false;

  savedNoteKey = key;

  if (textarea) {
    savedScrollOwner = "textarea";
    savedScrollTop = textarea.scrollTop;
  } else if (workspace) {
    savedScrollOwner = "workspace";
    savedScrollTop = workspace.scrollTop;
  } else {
    savedScrollOwner = null;
    savedScrollTop = null;
  }

  return savedScrollTop !== null;
};

const restorePosition = () => {
  if (
    !savedNoteKey ||
    savedScrollTop === null ||
    !savedScrollOwner
  ) {
    return;
  }

  if (getNoteKey() !== savedNoteKey) return;

  const textarea = getTextarea();
  const workspace = getEditorWorkspace();

  /*
   * The important detail is that the saved value follows the semantic
   * document position, not the old DOM element. Therefore:
   *
   *   viewer -> Edit: workspace position becomes textarea position
   *   editing -> toolbar: textarea position stays textarea position
   *   editing -> Save: textarea position becomes workspace position
   */
  const target = Math.max(0, savedScrollTop);

  if (textarea && savedScrollOwner === "textarea") {
    textarea.scrollTop = Math.min(
      target,
      Math.max(0, textarea.scrollHeight - textarea.clientHeight)
    );
  } else if (!textarea && workspace && savedScrollOwner === "workspace") {
    workspace.scrollTop = Math.min(
      target,
      Math.max(0, workspace.scrollHeight - workspace.clientHeight)
    );
  } else if (textarea && savedScrollOwner === "workspace") {
    /* Entering Edit: the document's scrollable surface changes. */
    textarea.scrollTop = Math.min(
      target,
      Math.max(0, textarea.scrollHeight - textarea.clientHeight)
    );
  } else if (!textarea && workspace && savedScrollOwner === "textarea") {
    /* Saving: the document's scrollable surface changes back. */
    workspace.scrollTop = Math.min(
      target,
      Math.max(0, workspace.scrollHeight - workspace.clientHeight)
    );
  }
};

const scheduleRestore = () => {
  clearRestoreTimers();

  /*
   * A single-frame restore removes the visible flash. The short follow-ups
   * cover React's commit plus the Firestore-backed Save update without
   * continuously fighting the browser.
   */
  requestAnimationFrame(restorePosition);

  [0, 50, 120].forEach((delay) => {
    restoreTimers.push(
      setTimeout(() => requestAnimationFrame(restorePosition), delay)
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

      /* Capture before React's onClick/onPointer processing changes the DOM. */
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
