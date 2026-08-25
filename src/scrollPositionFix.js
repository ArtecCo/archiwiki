/*
 * Preserve the editor workspace scroll position across React renders that
 * replace the viewer/textarea, including toolbar actions and Save.
 *
 * The workspace owns the page scroll. The textarea owns its own text scroll
 * while editing, so both are tracked independently.
 */

let savedWorkspaceScrollTop = null;
let savedTextareaScrollTop = null;
let savedNoteKey = null;
let restoreTimer = null;

const getEditorWorkspace = () => {
  const textarea = document.querySelector("textarea");
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

const getTextarea = () => document.querySelector("textarea");

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

const savePosition = () => {
  const workspace = getEditorWorkspace();
  const textarea = getTextarea();
  const key = getNoteKey();

  if (!key) return;

  savedNoteKey = key;
  savedWorkspaceScrollTop = workspace?.scrollTop ?? null;
  savedTextareaScrollTop = textarea?.scrollTop ?? null;
};

const restorePosition = () => {
  if (!savedNoteKey) return;

  const key = getNoteKey();
  if (!key || key !== savedNoteKey) return;

  const workspaceTarget = savedWorkspaceScrollTop;
  const textareaTarget = savedTextareaScrollTop;

  clearTimeout(restoreTimer);

  const apply = () => {
    if (getNoteKey() !== savedNoteKey) return;

    const workspace = getEditorWorkspace();
    const textarea = getTextarea();

    if (workspace && workspaceTarget !== null) {
      workspace.scrollTop = Math.min(
        workspaceTarget,
        Math.max(0, workspace.scrollHeight - workspace.clientHeight)
      );
    }

    if (textarea && textareaTarget !== null) {
      textarea.scrollTop = Math.min(
        textareaTarget,
        Math.max(0, textarea.scrollHeight - textarea.clientHeight)
      );
    }
  };

  apply();
  requestAnimationFrame(apply);
  requestAnimationFrame(() => requestAnimationFrame(apply));
  restoreTimer = setTimeout(apply, 120);
};

const isEditorToolbarButton = (button) => {
  if (!button) return false;

  const title = button.getAttribute("title")?.trim().toLowerCase();
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

const bind = () => {
  const root = document.getElementById("root");
  if (!root) return;

  root.addEventListener(
    "pointerdown",
    (event) => {
      const button = event.target.closest?.("button");
      if (!button) return;

      const label = button.textContent
        ?.replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const isEditOrSave = label === "edit" || label === "save";
      const isToolbar = isEditorToolbarButton(button);

      if (!isEditOrSave && !isToolbar) return;

      /* Capture before React's handler runs. */
      savePosition();

      // Restore after React has completed its state update and DOM replacement.
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
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
}
