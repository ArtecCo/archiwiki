/* Additive scrollbar styling. Folder restoration is handled by Sidebar.jsx React state. */

const installSharedScrollbars = () => {
  if (document.getElementById("archiwiki-shared-scrollbar-fix")) return;

  const style = document.createElement("style");
  style.id = "archiwiki-shared-scrollbar-fix";
  style.textContent = `
    textarea,
    .archiwiki-editor-viewer-scroll,
    .archiwiki-editor-viewer-scroll .wiki-content {
      scrollbar-width: thin;
      scrollbar-color: #000 transparent;
    }

    textarea::-webkit-scrollbar,
    .archiwiki-editor-viewer-scroll::-webkit-scrollbar,
    .archiwiki-editor-viewer-scroll .wiki-content::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }

    textarea::-webkit-scrollbar-track,
    .archiwiki-editor-viewer-scroll::-webkit-scrollbar-track,
    .archiwiki-editor-viewer-scroll .wiki-content::-webkit-scrollbar-track {
      background: transparent;
    }

    textarea::-webkit-scrollbar-thumb,
    .archiwiki-editor-viewer-scroll::-webkit-scrollbar-thumb,
    .archiwiki-editor-viewer-scroll .wiki-content::-webkit-scrollbar-thumb {
      background: #000;
      border-radius: 999px;
      min-height: 20px;
    }

    textarea::-webkit-scrollbar-thumb:hover,
    .archiwiki-editor-viewer-scroll::-webkit-scrollbar-thumb:hover,
    .archiwiki-editor-viewer-scroll .wiki-content::-webkit-scrollbar-thumb:hover {
      background: #000;
    }

    textarea[data-archiwiki-dark="true"],
    .archiwiki-editor-viewer-scroll[data-archiwiki-dark="true"],
    .archiwiki-editor-viewer-scroll[data-archiwiki-dark="true"] .wiki-content {
      scrollbar-color: #fff transparent;
    }

    textarea[data-archiwiki-dark="true"]::-webkit-scrollbar-thumb,
    .archiwiki-editor-viewer-scroll[data-archiwiki-dark="true"]::-webkit-scrollbar-thumb,
    .archiwiki-editor-viewer-scroll[data-archiwiki-dark="true"] .wiki-content::-webkit-scrollbar-thumb,
    textarea[data-archiwiki-dark="true"]::-webkit-scrollbar-thumb:hover,
    .archiwiki-editor-viewer-scroll[data-archiwiki-dark="true"]::-webkit-scrollbar-thumb:hover,
    .archiwiki-editor-viewer-scroll[data-archiwiki-dark="true"] .wiki-content::-webkit-scrollbar-thumb:hover {
      background: #fff;
    }
  `;
  document.head.appendChild(style);
};

const isDarkTheme = (element) => {
  let node = element;
  while (node && node !== document.body) {
    if (node.classList?.contains("bg-neutral-900")) return true;
    node = node.parentElement;
  }
  return false;
};

const markScrollers = () => {
  const textarea = document.querySelector("textarea");
  if (textarea) {
    textarea.classList.add("archiwiki-editor-viewer-scroll");
    textarea.dataset.archiwikiDark = isDarkTheme(textarea) ? "true" : "false";
  }

  const viewer = document.getElementById("print-container");
  if (viewer) {
    let node = viewer;
    let scroller = null;

    while (node && node !== document.body) {
      const styles = window.getComputedStyle(node);
      if (styles.overflowY === "auto" || styles.overflowY === "scroll") {
        scroller = node;
        break;
      }
      node = node.parentElement;
    }

    if (scroller) {
      scroller.classList.add("archiwiki-editor-viewer-scroll");
      scroller.dataset.archiwikiDark = isDarkTheme(scroller) ? "true" : "false";
    }
  }
};

const startFinalUiFixes = () => {
  if (typeof document === "undefined") return;
  installSharedScrollbars();

  let timer = null;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(markScrollers, 40);
  };

  schedule();
  const root = document.getElementById("root");
  if (!root) return;
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true, attributes: true });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startFinalUiFixes, { once: true });
} else {
  startFinalUiFixes();
}
