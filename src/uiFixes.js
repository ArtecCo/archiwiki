/* Additive UI fixes: no editor/PDF/storage code is replaced. */

const normalize = (value) => String(value || "").trim().toLowerCase();

const slug = (value) => normalize(value)
  .replace(/[^\w\s-]/g, "")
  .replace(/\s+/g, "-")
  .replace(/-+/g, "-");

const injectScrollbarStyles = () => {
  if (document.getElementById("archiwiki-thin-scrollbar-fix")) return;

  const style = document.createElement("style");
  style.id = "archiwiki-thin-scrollbar-fix";
  style.textContent = `
    textarea,
    #print-container,
    #print-container .wiki-content,
    .wiki-content {
      scrollbar-width: thin;
      scrollbar-color: #000 transparent;
    }
    textarea::-webkit-scrollbar,
    #print-container::-webkit-scrollbar,
    #print-container .wiki-content::-webkit-scrollbar,
    .wiki-content::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    textarea::-webkit-scrollbar-track,
    #print-container::-webkit-scrollbar-track,
    #print-container .wiki-content::-webkit-scrollbar-track,
    .wiki-content::-webkit-scrollbar-track {
      background: transparent;
    }
    textarea::-webkit-scrollbar-thumb,
    #print-container::-webkit-scrollbar-thumb,
    #print-container .wiki-content::-webkit-scrollbar-thumb,
    .wiki-content::-webkit-scrollbar-thumb {
      background: #000;
      border-radius: 999px;
      min-height: 22px;
    }
    textarea::-webkit-scrollbar-thumb:hover,
    #print-container::-webkit-scrollbar-thumb:hover,
    #print-container .wiki-content::-webkit-scrollbar-thumb:hover,
    .wiki-content::-webkit-scrollbar-thumb:hover {
      background: #000;
    }
  `;
  document.head.appendChild(style);
};

const tightenViewerSpacing = () => {
  const viewer = document.getElementById("print-container");
  if (!viewer) return;

  const workspace = viewer.parentElement;
  if (workspace && !workspace.classList.contains("archiwiki-viewer-workspace")) {
    workspace.classList.add("archiwiki-viewer-workspace");
  }

  const content = viewer.querySelector(".wiki-content");
  const title = content?.querySelector(":scope > h1");
  if (title) title.classList.add("archiwiki-viewer-title");
};

const injectViewerSpacingStyles = () => {
  if (document.getElementById("archiwiki-viewer-spacing-fix")) return;

  const style = document.createElement("style");
  style.id = "archiwiki-viewer-spacing-fix";
  style.textContent = `
    /* The viewer sits directly below the breadcrumb toolbar. */
    .archiwiki-viewer-workspace {
      padding-top: 1rem !important;
    }

    .archiwiki-viewer-title {
      margin-top: 0.5rem !important;
    }
  `;
  document.head.appendChild(style);
};

const getStructureSource = () => {
  const editor = document.querySelector("textarea");
  if (editor && editor.offsetParent !== null) return { type: "markdown", value: editor.value };

  const viewer = document.getElementById("print-container");
  if (viewer) return { type: "viewer", root: viewer };
  return null;
};

const collectHeadings = (source) => {
  if (source.type === "markdown") {
    const used = new Map();
    return String(source.value || "").split(/\r?\n/).map((line) => {
      const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (!match) return null;
      const title = match[2].trim();
      const base = slug(title) || "heading";
      const count = used.get(base) || 0;
      used.set(base, count + 1);
      return { level: match[1].length, title, id: count ? `${base}-${count + 1}` : base };
    }).filter(Boolean);
  }

  // In view mode the note title is rendered separately as the first H1.
  // Structure must start with the note's actual markdown headings, just like Edit mode.
  const contentRoot = source.root.querySelector(".wiki-content") || source.root;
  return Array.from(contentRoot.querySelectorAll("h1,h2,h3,h4,h5,h6"))
    .map((heading) => ({
      level: Number(heading.tagName.slice(1)),
      title: heading.textContent.replace(/\s+/g, " ").trim(),
      element: heading
    }))
    .filter((item) => item.title);
};

const renderStructure = () => {
  const container = document.querySelector(".archiwiki-structure-content");
  if (!container) return;

  const source = getStructureSource();
  if (!source) return;

  const headings = collectHeadings(source);
  container.innerHTML = "";

  if (!headings.length) {
    container.innerHTML = '<p class="text-neutral-400 italic px-2 py-1">No headings in this note.</p>';
    return;
  }

  const list = document.createElement("div");
  list.className = "space-y-0.5 py-1";

  headings.forEach((item, index) => {
    const wrap = document.createElement("div");
    wrap.className = "flex items-stretch min-h-[26px]";
    wrap.style.paddingLeft = `${Math.max(0, item.level - 1) * 10}px`;

    const guide = document.createElement("span");
    guide.className = "w-3 shrink-0 border-l border-neutral-300/80";
    if (index === headings.length - 1) guide.className += " border-l-transparent";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "flex-1 min-w-0 text-left px-2 py-1 rounded hover:bg-neutral-200/70 transition-colors truncate";
    button.textContent = item.title;
    button.title = item.title;

    button.addEventListener("click", () => {
      if (item.element) {
        item.element.scrollIntoView({ behavior: "smooth", block: "start" });
        item.element.classList.remove("archiwiki-anchor-highlight");
        void item.element.offsetWidth;
        item.element.classList.add("archiwiki-anchor-highlight");
        setTimeout(() => item.element?.classList.remove("archiwiki-anchor-highlight"), 1100);
        return;
      }

      const editor = document.querySelector("textarea");
      if (!editor) return;
      const lines = editor.value.split(/\r?\n/);
      const targetLine = lines.findIndex((line) => {
        const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
        return m && m[2].trim() === item.title;
      });
      if (targetLine < 0) return;
      const before = lines.slice(0, targetLine).join("\n");
      const position = before.length + (targetLine ? 1 : 0);
      editor.focus();
      editor.setSelectionRange(position, position);
      editor.scrollTop = Math.max(0, (targetLine / Math.max(lines.length, 1)) * editor.scrollHeight - editor.clientHeight / 3);
    });

    wrap.append(guide, button);
    list.appendChild(wrap);
  });

  container.appendChild(list);
};

const isCollapsedFolderHeader = (element) =>
  !!element?.querySelector("svg.lucide-chevron-right");

const findActiveNote = () => {
  const candidates = Array.from(document.querySelectorAll(".archiwiki-sidebar-item"));
  return candidates.find((item) => {
    if (!item.querySelector("svg.lucide-file-text")) return false;
    return /bg-\[#[^\]]+\]|bg-neutral-200|bg-neutral-800/.test(item.className);
  }) || null;
};

const restoreCurrentFolder = () => {
  const activeNote = findActiveNote();
  if (!activeNote) return false;

  let node = activeNote.parentElement;
  let opened = false;

  while (node && node.id !== "root") {
    const header = node.firstElementChild;
    if (header && isCollapsedFolderHeader(header)) {
      header.click();
      opened = true;
      break;
    }
    node = node.parentElement;
  }

  return opened;
};

const startUiFixes = () => {
  if (typeof document === "undefined") return;
  injectScrollbarStyles();
  injectViewerSpacingStyles();

  let scheduled = false;
  let restoreAttempts = 0;
  let lastStructureSignature = "";

  const refresh = () => {
    scheduled = false;
    tightenViewerSpacing();
    renderStructure();

    const opened = restoreCurrentFolder();
    if (opened) {
      restoreAttempts = 0;
    } else if (restoreAttempts < 12) {
      restoreAttempts += 1;
      setTimeout(() => schedule(), 80);
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  };

  schedule();
  const root = document.getElementById("root");
  if (root) {
    const observer = new MutationObserver(() => {
      const editor = document.querySelector("textarea");
      const viewer = document.getElementById("print-container");
      const structure = editor?.value || viewer?.innerText || "";
      const signature = `${structure.length}:${structure.slice(0, 300)}:${editor ? "edit" : "view"}`;

      if (signature !== lastStructureSignature) {
        lastStructureSignature = signature;
        schedule();
      } else {
        // Sidebar/folder rendering can change without changing note content.
        schedule();
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startUiFixes, { once: true });
} else {
  startUiFixes();
}