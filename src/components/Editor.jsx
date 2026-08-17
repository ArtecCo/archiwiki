import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import { jsPDF } from "jspdf";
import {
  Eye,
  Edit,
  Save,
  BookOpen,
  Download,
  FileText,
  Bold,
  Italic,
  Heading,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon
} from "lucide-react";

export default function Editor({
  note,
  newNoteId,
  onSaveNote,
  notesPool = [],
  fontSize,
  setFontSize,
  onNavigateToNote,
  theme = "beige"
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [wikiSuggest, setWikiSuggest] = useState(null);
  const [pdfError, setPdfError] = useState(false);

  const textareaRef = useRef(null);

  /*
   * ---------------------------------------------------------
   * THEME
   * ---------------------------------------------------------
   *
   * These deliberately use the same existing color language
   * from the original editor.
   */

  const themeClasses = {
    beige: {
      page: "bg-[#F5F2EB] text-[#202122]",
      toolbar: "bg-neutral-100/50",
      input: "text-neutral-800",
      sidebar: "bg-neutral-100/30",
      card: "bg-white",
      dropdown: "bg-white",
      hover: "hover:bg-neutral-100",
      active: "bg-neutral-100",
      muted: "text-neutral-500",
      border: "border-neutral-300",
      buttonHover: "hover:bg-neutral-200",
      status: "bg-neutral-100/80",
      notification: "bg-neutral-200",
      notificationText: "text-neutral-800"
    },

    wikipedia: {
      page: "bg-[#F8F9FA] text-[#202122]",
      toolbar: "bg-neutral-100/50",
      input: "text-[#202122]",
      sidebar: "bg-neutral-100/30",
      card: "bg-white",
      dropdown: "bg-white",
      hover: "hover:bg-neutral-100",
      active: "bg-neutral-100",
      muted: "text-neutral-500",
      border: "border-neutral-300",
      buttonHover: "hover:bg-neutral-200",
      status: "bg-neutral-100/80",
      notification: "bg-neutral-200",
      notificationText: "text-neutral-800"
    },

    charcoal: {
      page: "bg-neutral-900 text-neutral-100",
      toolbar: "bg-neutral-900",
      input: "text-neutral-100",
      sidebar: "bg-neutral-900",
      card: "bg-neutral-800",
      dropdown: "bg-neutral-800",
      hover: "hover:bg-neutral-800",
      active: "bg-neutral-800",
      muted: "text-neutral-400",
      border: "border-neutral-700",
      buttonHover: "hover:bg-neutral-800",
      status: "bg-neutral-900",
      notification: "bg-neutral-800",
      notificationText: "text-neutral-100"
    }
  };

  const colors = themeClasses[theme] || themeClasses.beige;
  const dialogTheme = {
    beige: "bg-[#F5F2EB] border-[#D8CDBA] text-[#202122]",
    wikipedia: "bg-[#F8F9FA] border-neutral-300 text-[#202122]",
    charcoal: "bg-neutral-900 border-neutral-700 text-neutral-100"
  }[theme] || "bg-white border-neutral-200 text-[#202122]";

  /*
   * ---------------------------------------------------------
   * NOTE INITIALIZATION
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!note) return;

    setTitle(note.title || "");
    setBody(note.body || "");
    setWikiSuggest(null);
    setIsEditing(false);
  }, [note?.id]);

useEffect(() => {
  if (!note || newNoteId !== note.id) return;

  setIsEditing(true);

  requestAnimationFrame(() => {
    textareaRef.current?.focus();
  });
}, [note?.id, newNoteId]);

const enterEditMode = () => {
  if (!note) return;

  setIsEditing(true);

  requestAnimationFrame(() => {
    textareaRef.current?.focus();
  });
};

  /*
   * ---------------------------------------------------------
   * TEXT EDITING
   * ---------------------------------------------------------
   */

  const handleTextareaChange = (e) => {
    const value = e.target.value;

    setBody(value);
    checkForWikiTrigger(e);
  };

  /*
   * ---------------------------------------------------------
   * WIKI LINK AUTOCOMPLETE
   * ---------------------------------------------------------
   */

  const checkForWikiTrigger = (e) => {
    const selectionEnd = e.target.selectionEnd;

    const textBeforeCursor =
      e.target.value.substring(0, selectionEnd);

    const lastOpenIndex =
      textBeforeCursor.lastIndexOf("[[");

    const lastCloseIndex =
      textBeforeCursor.lastIndexOf("]]");

    if (
      lastOpenIndex !== -1 &&
      lastOpenIndex >= lastCloseIndex
    ) {
      const query =
        textBeforeCursor.substring(lastOpenIndex + 2);

      const candidates = notesPool.filter(
        (n) =>
          n.id !== note?.id &&
          n.title
            ?.toLowerCase()
            .startsWith(query.toLowerCase())
      );

      if (candidates.length > 0) {
        const coords = getCaretCoordinates(
          e.target,
          lastOpenIndex
        );

        setWikiSuggest({
          query,
          list: candidates,
          index: 0,
          pos: {
            top: coords.top + 24,
            left: coords.left
          }
        });

        return;
      }
    }

    setWikiSuggest(null);
  };

  const handleKeyDown = (e) => {
    if (!wikiSuggest) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();

      setWikiSuggest((prev) => ({
        ...prev,
        index:
          (prev.index + 1) %
          prev.list.length
      }));
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();

      setWikiSuggest((prev) => ({
        ...prev,
        index:
          (prev.index - 1 + prev.list.length) %
          prev.list.length
      }));
    }

    if (e.key === "Enter") {
      e.preventDefault();

      insertWikiLink(
        wikiSuggest.list[wikiSuggest.index].title
      );
    }

    if (e.key === "Escape") {
      setWikiSuggest(null);
    }
  };

  const insertWikiLink = (linkedTitle) => {
    if (!textareaRef.current) return;

    const cursor =
      textareaRef.current.selectionEnd;

    const beforeText =
      body.substring(0, cursor);

    const lastOpenIndex =
      beforeText.lastIndexOf("[[");

    const afterText =
      body.substring(cursor);

    const updatedBody =
      beforeText.substring(0, lastOpenIndex) +
      `[[${linkedTitle}]]` +
      afterText;

    setBody(updatedBody);
    setWikiSuggest(null);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();

      const newPosition =
        lastOpenIndex +
        linkedTitle.length +
        4;

      textareaRef.current?.setSelectionRange(
        newPosition,
        newPosition
      );
    });
  };

  const getCaretCoordinates = (element) => {
    return {
      top: element.offsetTop,
      left: element.offsetLeft + 20
    };
  };

  /*
   * ---------------------------------------------------------
   * EDITOR TOOLBAR
   * ---------------------------------------------------------
   *
   * This does not introduce a new visual style.
   * It simply inserts Markdown into the existing textarea.
   */

  const replaceSelection = (before, after = before) => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected = body.substring(start, end);

    const replacement =
      before + selected + after;

    const updated =
      body.substring(0, start) +
      replacement +
      body.substring(end);

    setBody(updated);

    requestAnimationFrame(() => {
      textarea.focus();

      const selectionStart =
        start + before.length;

      const selectionEnd =
        selectionStart + selected.length;

      textarea.setSelectionRange(
        selectionStart,
        selectionEnd
      );
    });
  };

  const insertAtCursor = (text) => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const updated =
      body.substring(0, start) +
      text +
      body.substring(end);

    setBody(updated);

    requestAnimationFrame(() => {
      textarea.focus();

      const position =
        start + text.length;

      textarea.setSelectionRange(
        position,
        position
      );
    });
  };

  const applyHeading = () => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected =
      body.substring(start, end);

    const replacement = selected
      ? selected
          .split("\n")
          .map((line) =>
            line.startsWith("# ")
              ? line
              : `## ${line}`
          )
          .join("\n")
      : "## Heading";

    const updated =
      body.substring(0, start) +
      replacement +
      body.substring(end);

    setBody(updated);

    requestAnimationFrame(() => {
      textarea.focus();
    });
  };

  const applyList = (ordered = false) => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected =
      body.substring(start, end);

    const lines = selected
      ? selected.split("\n")
      : ["List item"];

    const formatted = lines
      .map((line, index) => {
        if (ordered) {
          return `${index + 1}. ${line}`;
        }

        return `- ${line}`;
      })
      .join("\n");

    const updated =
      body.substring(0, start) +
      formatted +
      body.substring(end);

    setBody(updated);

    requestAnimationFrame(() => {
      textarea.focus();
    });
  };

  const applyCode = () => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected =
      body.substring(start, end);

    if (selected.includes("\n")) {
      replaceSelection(
        "```\n",
        "\n```"
      );
    } else {
      replaceSelection("`", "`");
    }
  };

  const applyLink = () => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected =
      body.substring(start, end);

    if (selected) {
      replaceSelection("[", "](https://)");
    } else {
      insertAtCursor(
        "[link text](https://)"
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * MARKDOWN / WIKI RENDERING
   * ---------------------------------------------------------
   */

  const parseWikiLinks = (rawMarkdown) => {
    const renderedHtml =
      marked.parse(rawMarkdown || "");

    return renderedHtml.replace(
      /\[\[(.*?)\]\]/g,
      (match, linkedTitle) => {
        const matchNote =
          notesPool.find(
            (n) =>
              n.title
                ?.trim()
                .toLowerCase() ===
              linkedTitle
                ?.trim()
                .toLowerCase()
          );

        if (matchNote) {
          return `
            <span
              class="wiki-link underline cursor-pointer font-semibold"
              data-note-id="${matchNote.id}"
            >
              ${linkedTitle}
            </span>
          `;
        }

        return `
          <span class="text-neutral-400 line-through">
            ${linkedTitle}
          </span>
        `;
      }
    );
  };

  const handleHtmlClick = (e) => {
    const target = e.target;

    if (
      target.classList.contains(
        "wiki-link"
      )
    ) {
      const targetId =
        target.getAttribute(
          "data-note-id"
        );

      if (targetId) {
        onNavigateToNote(targetId);
      }
    }
  };

  /*
   * ---------------------------------------------------------
   * DIRECT PDF DOWNLOAD
   * ---------------------------------------------------------
   *
   * No browser print dialog.
   * No "Save as PDF" page.
   *
   * jsPDF writes the document directly, without capturing any UI elements.
   */

  const triggerPdfDownload = () => {
    if (!note) return;

    try {
      const metrics = calculateMetrics();
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const contentWidth = pageWidth - margin * 2;
      const footerTop = pageHeight - 22;
      let cursorY = 24;

      const addFooter = (pageNumber) => {
        pdf.setDrawColor(210, 210, 210);
        pdf.line(margin, footerTop - 5, pageWidth - margin, footerTop - 5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(90, 90, 90);
        pdf.text(`Words: ${metrics.words}  •  Lines: ${metrics.lines}  •  Headers: ${metrics.headers}`, margin, footerTop);
        pdf.text(`Read time: ~${metrics.readingTime} min  •  Page ${pageNumber}`, pageWidth - margin, footerTop, { align: "right" });
      };

      pdf.setFont("times", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(32, 33, 34);
      const titleLines = pdf.splitTextToSize(title || "Untitled Note", contentWidth);
      pdf.text(titleLines, margin, cursorY);
      cursorY += titleLines.length * 9 + 5;
      pdf.setDrawColor(210, 210, 210);
      pdf.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 9;

      pdf.setFont("times", "normal");
      pdf.setFontSize(Math.max(10, Math.min(14, fontSize * 0.7)));
      const plainText = body
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\[\[([^\]]+)\]\]/g, "$1")
        .replace(/^[#>*\-+]\s*/gm, "")
        .replace(/`{1,3}/g, "")
        .replace(/\*{1,3}|_{1,3}/g, "");
      const contentLines = pdf.splitTextToSize(plainText || " ", contentWidth);
      const lineHeight = 6;
      let pageNumber = 1;

      contentLines.forEach((line) => {
        if (cursorY + lineHeight > footerTop - 9) {
          addFooter(pageNumber);
          pdf.addPage();
          pageNumber += 1;
          cursorY = 24;
        }
        pdf.text(line, margin, cursorY);
        cursorY += lineHeight;
      });

      addFooter(pageNumber);
      pdf.save(`${sanitizeFilename(title || "Untitled Note")}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      setPdfError(true);
    }
  };

  const sanitizeFilename = (
    value
  ) => {
    return String(value)
      .replace(
        /[<>:"/\\|?*]/g,
        "_"
      )
      .trim()
      .substring(0, 150) ||
      "Untitled Note";
  };

  /*
   * ---------------------------------------------------------
   * METRICS
   * ---------------------------------------------------------
   */

  const calculateMetrics = () => {
    const words =
      body.trim()
        ? body
            .trim()
            .split(/\s+/)
            .length
        : 0;

    const lines =
      body.split("\n").length;

    const headers =
      (
        body.match(
          /^#{1,6}\s+/gm
        ) || []
      ).length;

    const readingTime =
      Math.ceil(words / 200);

    return {
      words,
      lines,
      headers,
      readingTime
    };
  };

  const {
    words,
    lines,
    headers,
    readingTime
  } = calculateMetrics();

  /*
   * ---------------------------------------------------------
   * BACKLINKS
   * ---------------------------------------------------------
   */

  const backlinks =
    notesPool.filter(
      (n) =>
        n.id !== note?.id &&
        n.body?.includes(
          `[[${note?.title}]]`
        )
    );

  /*
   * ---------------------------------------------------------
   * NO NOTE SELECTED
   * ---------------------------------------------------------
   */

  if (!note) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center ${colors.page} font-serif p-12`}
      >
        <BookOpen
          size={48}
          className="stroke-1 text-neutral-400 mb-4"
        />

        <p className="text-xl italic">
          Select an article or
          folder to begin editing.
        </p>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * EDITOR
   * ---------------------------------------------------------
   */

  return (
    <div
      className={`flex-1 flex flex-col h-full ${colors.page}`}
    >
      {/* -------------------------------------------------- */}
      {/* EDITOR CONTEXT MENU                                */}
      {/* -------------------------------------------------- */}

      <div
        className={`flex items-center justify-between gap-3 border-b ${colors.border} px-6 py-3 max-md:px-3 ${colors.toolbar}`}
      >
        <div className="flex items-center gap-2 text-xs font-sans text-neutral-500">
          <span className="font-medium">
            ArchiWiki
          </span>

          <span>&gt;</span>

          <span className="font-medium text-neutral-700">
            {note.title ||
              "Untitled"}
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Font size */}

          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span>Size:</span>

            <input
              type="range"
              min="14"
              max="24"
              value={fontSize}
              onChange={(e) =>
                setFontSize(
                  parseInt(
                    e.target.value,
                    10
                  )
                )
              }
              className="w-20 accent-neutral-900 bg-neutral-200 h-1 rounded-lg cursor-pointer"
            />

            <span className="w-8">
              {fontSize}px
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* PDF */}

            <button
              onClick={
                triggerPdfDownload
              }
              title="Download PDF"
              className={`p-1.5 ${colors.buttonHover} rounded text-neutral-600 flex items-center gap-1 text-xs`}
            >
              <Download size={14} />
              PDF
            </button>

            {/* Edit / Save */}

  <button
    onClick={async () => {
      if (isEditing) {
        await onSaveNote(
          note.id,
          title,
          body
        );

        setIsEditing(false);
      } else {
        enterEditMode();
      }
    }}
    className="py-1 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
  >
    {isEditing ? (
      <>
        <Save size={12} />
        Save
      </>
    ) : (
      <>
        <Edit size={12} />
        Edit
      </>
    )}
  </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* WORKING DESK                                       */}
      {/* -------------------------------------------------- */}

      <div className="flex-1 flex overflow-hidden">
        {/* ------------------------------------------------ */}
        {/* MAIN WORKSPACE                                   */}
        {/* ------------------------------------------------ */}

        <div
          className="flex-1 min-w-0 flex flex-col p-8 max-md:p-4 overflow-y-auto"
          style={{
            fontSize: `${fontSize}px`
          }}
        >
          {isEditing ? (
            <div className="flex-1 flex flex-col gap-4 relative">

              {/* TITLE */}

              <input
                type="text"
                value={title}
                onChange={(e) =>
                  setTitle(
                    e.target.value
                  )
                }
                placeholder="Title your note"
                className={`w-full bg-transparent border-b ${colors.border} pb-2 focus:outline-none focus:border-neutral-800 font-serif font-bold text-2xl tracking-wide placeholder-neutral-300`}
              />

              {/* ------------------------------------------------ */}
              {/* MARKDOWN TOOLBAR                                 */}
              {/* ------------------------------------------------ */}

              <div
                className={`flex items-center gap-1 border-b ${colors.border} pb-2`}
              >
                <button
                  type="button"
                  title="Bold"
                  onClick={() =>
                    replaceSelection(
                      "**",
                      "**"
                    )
                  }
                  className={`p-1.5 ${colors.buttonHover} rounded text-neutral-600`}
                >
                  <Bold
                    size={14}
                  />
                </button>

                <button
                  type="button"
                  title="Italic"
                  onClick={() =>
                    replaceSelection(
                      "*",
                      "*"
                    )
                  }
                  className={`p-1.5 ${colors.buttonHover} rounded text-neutral-600`}
                >
                  <Italic
                    size={14}
                  />
                </button>

                <button
                  type="button"
                  title="Heading"
                  onClick={
                    applyHeading
                  }
                  className={`p-1.5 ${colors.buttonHover} rounded text-neutral-600`}
                >
                  <Heading
                    size={14}
                  />
                </button>

                <button
                  type="button"
                  title="Bulleted list"
                  onClick={() =>
                    applyList(false)
                  }
                  className={`p-1.5 ${colors.buttonHover} rounded text-neutral-600`}
                >
                  <List
                    size={14}
                  />
                </button>

                <button
                  type="button"
                  title="Numbered list"
                  onClick={() =>
                    applyList(true)
                  }
                  className={`p-1.5 ${colors.buttonHover} rounded text-neutral-600`}
                >
                  <ListOrdered
                    size={14}
                  />
                </button>

                <button
                  type="button"
                  title="Quote"
                  onClick={() =>
                    replaceSelection(
                      "> ",
                      ""
                    )
                  }
                  className={`p-1.5 ${colors.buttonHover} rounded text-neutral-600`}
                >
                  <Quote
                    size={14}
                  />
                </button>

                <button
                  type="button"
                  title="Code"
                  onClick={applyCode}
                  className={`p-1.5 ${colors.buttonHover} rounded text-neutral-600`}
                >
                  <Code
                    size={14}
                  />
                </button>

                <button
                  type="button"
                  title="Link"
                  onClick={applyLink}
                  className={`p-1.5 ${colors.buttonHover} rounded text-neutral-600`}
                >
                  <LinkIcon
                    size={14}
                  />
                </button>
              </div>

              {/* BODY */}

              <textarea
                ref={textareaRef}
                value={body}
                onChange={
                  handleTextareaChange
                }
                onKeyDown={
                  handleKeyDown
                }
                placeholder="Write your thoughts... Type '[[' to link pages."
                className={`flex-1 w-full bg-transparent resize-none focus:outline-none font-mono focus:ring-0 leading-relaxed ${colors.input}`}
              />

              {/* ------------------------------------------------ */}
              {/* WIKI AUTOCOMPLETE                                */}
              {/* ------------------------------------------------ */}

              {wikiSuggest && (
                <div
                  className={`absolute z-50 ${colors.dropdown} border ${colors.border} rounded shadow-lg p-1 w-64 max-h-48 overflow-y-auto text-xs font-sans`}
                  style={{
                    top: `${wikiSuggest.pos.top}px`,
                    left: `${wikiSuggest.pos.left}px`
                  }}
                >
                  <p className="px-2 py-1 text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
                    Connect note
                  </p>

                  {wikiSuggest.list.map(
                    (item, idx) => (
                      <div
                        key={item.id}
                        onClick={() =>
                          insertWikiLink(
                            item.title
                          )
                        }
                        className={`px-3 py-1.5 cursor-pointer rounded flex items-center gap-1.5 ${
                          idx ===
                          wikiSuggest.index
                            ? `${colors.active} font-semibold`
                            : colors.hover
                        }`}
                      >
                        <FileText
                          size={12}
                        />

                        <span className="truncate">
                          {item.title}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ------------------------------------------------ */
            /* READING MODE                                    */
            /* ------------------------------------------------ */

            <div
              id="print-container"
              className="flex-1 prose max-w-4xl mr-auto font-serif leading-loose text-left"
              onClick={
                handleHtmlClick
              }
            >
              <h1 className="text-3xl font-bold border-b border-neutral-300 pb-4 mb-6 tracking-wide">
                {title ||
                  "Untitled Note"}
              </h1>

              <div
                className={
                  theme === "charcoal"
                    ? "text-neutral-100"
                    : "text-neutral-800"
                }
                dangerouslySetInnerHTML={{
                  __html:
                    parseWikiLinks(
                      body
                    )
                }}
              />
            </div>
          )}
        </div>

        {/* -------------------------------------------------- */}
        {/* BACKLINK PANEL                                    */}
        {/* -------------------------------------------------- */}

        <div
          className={`w-56 border-l ${colors.border} ${colors.sidebar} p-4 flex flex-col gap-4 text-xs font-sans max-lg:hidden`}
        >
          <h4 className="font-bold uppercase tracking-wider text-neutral-500 text-[10px]">
            Backlinks ({backlinks.length})
          </h4>

          <div className="flex-1 overflow-y-auto space-y-2">
            {backlinks.length > 0 ? (
              backlinks.map(
                (backlink) => (
                  <div
                    key={backlink.id}
                    onClick={() =>
                      onNavigateToNote(
                        backlink.id
                      )
                    }
                    className={`p-2 border ${colors.border} ${colors.card} rounded cursor-pointer transition-colors ${colors.buttonHover}`}
                  >
                    <p
                      className={`font-semibold truncate ${
                        theme === "charcoal"
                          ? "text-neutral-100"
                          : "text-neutral-900"
                      }`}
                    >
                      {backlink.title}
                    </p>

                    <p className="text-[10px] text-neutral-500 truncate">
                      {backlink.body}
                    </p>
                  </div>
                )
              )
            ) : (
              <p className="text-neutral-400 italic">
                No connections link
                here yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* STATUS BAR                                         */}
      {/* -------------------------------------------------- */}

      <div
        className={`border-t ${colors.border} ${colors.status} px-6 py-1.5 flex justify-between items-center text-[11px] font-sans text-neutral-500`}
      >
        <div className="flex gap-4">
          <span>
            Words:{" "}
            <strong>
              {words}
            </strong>
          </span>

          <span>
            Lines:{" "}
            <strong>
              {lines}
            </strong>
          </span>

          <span>
            Headers:{" "}
            <strong>
              {headers}
            </strong>
          </span>
        </div>

        <div className="flex gap-4">
          <span>
            Read Time: ~
            <strong>
              {readingTime} min
            </strong>
          </span>

          <span>
            Status:{" "}
            <strong
              className={
                theme === "charcoal"
                  ? "text-neutral-100"
                  : "text-neutral-700"
              }
            >
              Encrypted AES-256
            </strong>
          </span>
        </div>
      </div>

      {pdfError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="pdf-error-title">
          <div className={`w-full max-w-sm rounded border p-5 shadow-xl ${dialogTheme}`}>
            <h2 id="pdf-error-title" className="text-base font-semibold">PDF export failed</h2>
            <p className="mt-2 text-sm text-neutral-500">The PDF could not be created. Please try again.</p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => setPdfError(false)} className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
