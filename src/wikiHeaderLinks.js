const slugify = (value) =>
  decodeURIComponent(String(value || ""))
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getNoteItems = () =>
  Array.from(document.querySelectorAll("[data-archiwiki-note-id]"));

const findNoteItem = (title) => {
  const wanted = String(title || "").trim().toLowerCase();
  if (!wanted) return null;

  return getNoteItems().find((item) =>
    String(item.dataset.archiwikiNoteTitle || "").trim().toLowerCase() === wanted
  );
};

const highlightHeading = (heading) => {
  if (!heading) return;
  heading.classList.remove("archiwiki-anchor-highlight");
  void heading.offsetWidth;
  heading.classList.add("archiwiki-anchor-highlight");
  window.setTimeout(() => heading.classList.remove("archiwiki-anchor-highlight"), 1100);
};

const findHeading = (root, target) => {
  const wanted = slugify(target);
  return Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6")).find(
    (heading) => slugify(heading.id || heading.textContent) === wanted
  );
};

const finishPendingHeaderJump = () => {
  const pending = sessionStorage.getItem("archiwiki-pending-header");
  if (!pending) return;

  const [noteId, ...parts] = pending.split("::");
  const header = parts.join("::");
  const currentNote = document.querySelector(`[data-active-note-id="${CSS.escape(noteId)}"]`);
  const root = document.getElementById("print-container");

  if (!root || (currentNote && currentNote.dataset.activeNoteId !== noteId)) return;

  const heading = findHeading(root, header);
  if (!heading) return;

  sessionStorage.removeItem("archiwiki-pending-header");
  heading.scrollIntoView({ behavior: "smooth", block: "start" });
  highlightHeading(heading);
};

const enhanceCrossNoteHeaders = () => {
  const root = document.getElementById("print-container");
  if (!root) return;

  root.querySelectorAll(".wiki-link-missing").forEach((element) => {
    if (element.dataset.headerLinkBound === "true") return;

    const raw = element.textContent.trim();
    const separator = raw.indexOf("#");
    if (separator <= 0 || separator === raw.length - 1) return;

    const noteTitle = raw.slice(0, separator).trim();
    const header = raw.slice(separator + 1).trim();
    const noteItem = findNoteItem(noteTitle);
    if (!noteItem) return;

    element.dataset.headerLinkBound = "true";
    element.classList.add("underline", "cursor-pointer", "font-semibold");
    element.title = `Open ${noteTitle} → ${header}`;

    element.addEventListener("click", (event) => {
      event.preventDefault();
      sessionStorage.setItem(
        "archiwiki-pending-header",
        `${noteItem.dataset.archiwikiNoteId}::${header}`
      );
      noteItem.click();
    });
  });
};

const buildStructure = (container, root) => {
  const headings = Array.from(
    root.querySelectorAll(".wiki-content > div h1, .wiki-content > div h2, .wiki-content > div h3, .wiki-content > div h4, .wiki-content > div h5, .wiki-content > div h6")
  );

  container.innerHTML = "";
  if (!headings.length) {
    container.innerHTML = '<p class="text-neutral-400 italic">No headings in this note.</p>';
    return;
  }

  const list = document.createElement("div");
  list.className = "space-y-0.5";
  const stack = [{ level: 0, list }];

  headings.forEach((heading) => {
    const level = Number(heading.tagName.slice(1));
    while (stack.length > 1 && level < stack[stack.length - 1].level) stack.pop();

    const parent = stack[stack.length - 1].list;
    const item = document.createElement("div");
    item.className = "group";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "w-full text-left py-1 px-2 rounded hover:bg-neutral-200/70 transition-colors truncate";
    button.style.paddingLeft = `${Math.max(0, level - 1) * 10 + 8}px`;
    button.textContent = heading.textContent.trim();
    button.title = heading.textContent.trim();

    button.addEventListener("click", () => {
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
      highlightHeading(heading);
    });

    item.appendChild(button);
    parent.appendChild(item);

    const childList = document.createElement("div");
    childList.className = "space-y-0.5";
    item.appendChild(childList);
    stack.push({ level, list: childList });
  });

  container.appendChild(list);
};

const enhanceStructurePanel = () => {
  const panel = Array.from(document.querySelectorAll("#root .border-l"))
    .find((element) => element.querySelector("h4")?.textContent.includes("Backlinks"));
  if (!panel) return;

  let tabs = panel.querySelector(".archiwiki-sidebar-tabs");
  if (!tabs) {
    const heading = panel.querySelector("h4");
    if (!heading) return;

    const header = document.createElement("div");
    header.className = "archiwiki-sidebar-tabs border-b border-neutral-200 pb-2";
    header.innerHTML = `
      <div class="flex items-center gap-1">
        <button type="button" data-tab="backlinks" class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Backlinks</button>
        <button type="button" data-tab="structure" class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-neutral-400">Structure</button>
      </div>
    `;

    const content = document.createElement("div");
    content.className = "archiwiki-structure-content hidden flex-1 overflow-y-auto";

    const backlinksContent = document.createElement("div");
    backlinksContent.className = "archiwiki-backlinks-content flex-1 overflow-y-auto space-y-2";

    while (heading.nextSibling) {
      const node = heading.nextSibling;
      if (node.classList?.contains("archiwiki-sidebar-tabs")) break;
      backlinksContent.appendChild(node);
    }

    heading.remove();
    panel.insertBefore(header, panel.firstChild);
    panel.appendChild(backlinksContent);
    panel.appendChild(content);

    const buttons = header.querySelectorAll("button");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const isStructure = button.dataset.tab === "structure";
        buttons.forEach((b) => {
          b.classList.toggle("bg-neutral-200/70", b === button);
          b.classList.toggle("text-neutral-500", b !== button);
        });
        backlinksContent.classList.toggle("hidden", isStructure);
        content.classList.toggle("hidden", !isStructure);
        if (isStructure) buildStructure(content, document.getElementById("print-container"));
      });
    });

    tabs = header;
  }

  const structureContent = panel.querySelector(".archiwiki-structure-content");
  if (structureContent && !structureContent.classList.contains("hidden")) {
    buildStructure(structureContent, document.getElementById("print-container"));
  }
};

const enhanceNoteElements = () => {
  document.querySelectorAll(".archiwiki-sidebar-item").forEach((item) => {
    const fileIcon = item.querySelector("svg");
    const title = item.querySelector("span.truncate")?.textContent?.trim();
    if (!title || !fileIcon) return;
    if (item.closest(".archiwiki-sidebar-tabs")) return;

    if (!item.dataset.archiwikiNoteId && item.onclick) return;
  });
};

let observer;
const start = () => {
  if (typeof document === "undefined") return;

  enhanceCrossNoteHeaders();
  enhanceStructurePanel();
  finishPendingHeaderJump();

  const root = document.getElementById("root");
  if (!root || observer) return;
  observer = new MutationObserver(() => {
    enhanceCrossNoteHeaders();
    enhanceStructurePanel();
    finishPendingHeaderJump();
  });
  observer.observe(root, { childList: true, subtree: true });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
