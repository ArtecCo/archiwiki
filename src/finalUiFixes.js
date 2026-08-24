/* Additive scrollbar styling. Folder restoration is handled by Sidebar.jsx React state. */

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

    /* The viewer's outer workspace is the original scroll container.
       Keep it as-is and give it the same custom scrollbar. */
    .archiwiki-editor-viewer-scroll {
      scrollbar-width: thin;
      scrollbar-color: #000 transparent;
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

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installSharedScrollbars, { once: true });
  } else {
    installSharedScrollbars();
  }
}
