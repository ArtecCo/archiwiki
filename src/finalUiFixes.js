/* Final additive UI fixes. Keeps Editor.jsx and PDF implementation untouched. */

const installSharedScrollbars = () => {
  if (document.getElementById("archiwiki-shared-scrollbar-fix")) return;

  const style = document.createElement("style");
  style.id = "archiwiki-shared-scrollbar-fix";
  style.textContent = `
    textarea,
    #print-container,
    .archiwiki-editor-viewer-scroll,
    .archiwiki-editor-viewer-scroll .wiki-content {
      scrollbar-width: thin;
      scrollbar-color: #000 transparent;
    }

    textarea::-webkit-scrollbar,
    #print-container::-webkit-scrollbar,
    .archiwiki-editor-viewer-scroll::-webkit-scrollbar,
    .archiwiki-editor-viewer-scroll .wiki-content::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }

    textarea::-webkit-scrollbar-track,
    #print-container::-webkit-scrollbar-track,
    .archiwiki-editor-viewer-scroll::-webkit-scrollbar-track,
    .archiwiki-editor-viewer-scroll .wiki-content::-webkit-scrollbar-track {
      background: transparent;
    }

    textarea::-webkit-scrollbar-thumb,
    #print-container::-webkit-scrollbar-thumb,
    .archiwiki-editor-viewer-scroll::-webkit-scrollbar-thumb,
    .archiwiki-editor-viewer-scroll .wiki-content::-webkit-scrollbar-thumb {
      background: #000;
      border-radius: 999px;
      min-height: 20px;
    }

    textarea::-webkit-scrollbar-thumb:hover,
    #print-container::-webkit-scrollbar-thumb:hover,
    .archiwiki-editor-viewer-scroll::-webkit-scrollbar-thumb:hover,
    .archiwiki-editor-viewer-scroll .wiki-content::-webkit-scrollbar-thumb:hover {
      background: #000;
    }

    /* Force the viewer itself to use the same scrollbar rather than
       inheriting the outer workspace's native scrollbar. */
    #print-container {
      overflow-y: auto !important;
      overflow-x: hidden !important;
      height: 100% !important;
    }

    .dark textarea,
    .dark #print-container,
    .dark .archiwiki-editor-viewer-scroll,
    .dark .archiwiki-editor-viewer-scroll .wiki-content {
      scrollbar-color: #fff transparent;
    }

    .dark textarea::-webkit-scrollbar-thumb,
    .dark #print-container::-webkit-scrollbar-thumb,
    .dark .archiwiki-editor-viewer-scroll::-webkit-scrollbar-thumb,
    .dark .archiwiki-editor-viewer-scroll .wiki-content::-webkit-scrollbar-thumb,
    .dark textarea::-webkit-scrollbar-thumb:hover,
    .dark #print-container::-webkit-scrollbar-thumb:hover,
    .dark .archiwiki-editor-viewer-scroll::-webkit-scrollbar-thumb:hover,
    .dark .archiwiki-editor-viewer-scroll .wiki-content::-webkit-scrollbar-thumb:hover {
      background: #fff;
    }
  `;
  document.head.appendChild(style);
};

const markActualWorkspaceScroller = () => {
  const viewer = document.getElementById("print-container");
  if (!viewer) return;

  let node = viewer.parentElement;
  while (node && node !== document.body) {
    const styles = window.getComputedStyle(node);
    if (styles.overflowY === "auto" || styles.overflowY === "scroll") {
      node.classList.add("archiwiki-editor-viewer-scroll");
      return;
    }
    node = node.parentElement;
  }
};

const getBreadcrumbParts = () => {
  const candidates = Array.from(document.querySelectorAll("#root span, #root div"));
  const breadcrumb = candidates.find((element) => {
    const text = element.textContent?.replace(/\s+/g, " ").trim();
    return text && /^ArchiWiki\s*>/.test(text) && text.includes(">");
  });
  if (!breadcrumb) return [];
  return breadcrumb.textContent.split(">").map((part) => part.trim()).filter(Boolean).slice(1, -1);
};

const folderHeaderName = (header) => {
  const span = header?.querySelector("span.truncate");
  return span?.textContent?.replace(/\s+/g, " ").trim() || "";
};

const findFolderHeader = (scope, name) => Array.from((scope || document).querySelectorAll(".archiwiki-sidebar-item")).find((header) => {
  const hasFolderChevron = header.querySelector("svg.lucide-chevron-right") || header.querySelector("svg.lucide-chevron-down");
  return hasFolderChevron && folderHeaderName(header).toLowerCase() === name.toLowerCase();
}) || null;

const restoreFolderPath = async () => {
  const parts = getBreadcrumbParts();
  if (!parts.length) return;
  let scope = document;
  for (const part of parts) {
    const header = findFolderHeader(scope, part);
    if (!header) return;
    const chevronRight = header.querySelector("svg.lucide-chevron-right");
    if (chevronRight) {
      header.click();
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    scope = header.parentElement || scope;
  }
};

const startFinalUiFixes = () => {
  if (typeof document === "undefined") return;
  installSharedScrollbars();
  let timer = null;
  let lastPath = "";

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      markActualWorkspaceScroller();
      const path = getBreadcrumbParts().join("/");
      if (path && path !== lastPath) {
        lastPath = path;
        restoreFolderPath();
      }
    }, 80);
  };

  schedule();
  const root = document.getElementById("root");
  if (!root) return;
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startFinalUiFixes, { once: true });
else startFinalUiFixes();
