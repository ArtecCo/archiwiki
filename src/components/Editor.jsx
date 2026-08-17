import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import html2pdf from "html2pdf.js";
import {
  Eye,
  Edit,
  Save,
  BookOpen,
  Download,
  AlertTriangle,
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
import { acquireLock, releaseLock } from "../firebase";

export default function Editor({
  note,
  onSaveNote,
  notesPool = [],
  userId,
  fontSize,
  setFontSize,
  onNavigateToNote,
  theme = "beige"
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [lockStatus, setLockStatus] = useState({
    success: true,
    lockedBy: null
  });

  const [wikiSuggest, setWikiSuggest] = useState(null);

  const textareaRef = useRef(null);
  const sessionToken = useRef(
    Math.random().toString(36).substring(2)
  ).current;

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

  /*
   * ---------------------------------------------------------
   * NOTE INITIALIZATION
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!note) return;

    setTitle(note.title || "");
    setBody(note.body || "");
    setIsEditing(false);
    setWikiSuggest(null);

    checkAndAcquireLock();

    return () => {
      releaseLock(note.id, sessionToken);
    };
  }, [note?.id]);

  /*
   * ---------------------------------------------------------
   * LOCK HEARTBEAT
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!note || !isEditing) return;

    const interval = setInterval(() => {
      acquireLock(
        note.id,
        userId,
        sessionToken
      );
    }, 60000);

    return () => clearInterval(interval);
  }, [note?.id, isEditing, userId]);

  const checkAndAcquireLock = async () => {
    if (!note) return;

    try {
      const res = await acquireLock(
        note.id,
        userId,
        sessionToken
      );

      setLockStatus(res);

      if (!res.success) {
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Lock error:", err);

      setLockStatus({
        success: false,
        lockedBy: "another session"
      });

      setIsEditing(false);
    }
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
   * html2pdf.js creates and downloads the PDF directly.
   */

  const triggerPdfDownload = async () => {
    if (!note) return;

    const pdfContainer =
      document.createElement("div");

    pdfContainer.style.position =
      "fixed";

    pdfContainer.style.left =
      "-100000px";

    pdfContainer.style.top = "0";

    pdfContainer.style.width =
      "794px";

    pdfContainer.style.background =
      "white";

    pdfContainer.style.color =
      "#202122";

    pdfContainer.style.padding =
      "60px";

    pdfContainer.style.boxSizing =
      "border-box";

    pdfContainer.innerHTML = `
      <div
        style="
          font-family: Georgia, 'Times New Roman', serif;
          color: #202122;
          background: white;
          width: 100%;
          line-height: 1.7;
          font-size: ${fontSize}px;
        "
      >
        <h1
          style="
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 32px;
            line-height: 1.25;
            margin: 0 0 30px;
            padding-bottom: 14px;
            border-bottom: 1px solid #d4d4d4;
            color: #202122;
          "
        >
          ${escapeHtml(title || "Untitled Note")}
        </h1>

        <div
          style="
            font-family: Georgia, 'Times New Roman', serif;
            color: #202122;
          "
        >
          ${parseWikiLinks(body)}
        </div>
      </div>
    `;

    document.body.appendChild(
      pdfContainer
    );

    const options = {
      margin: [15, 15, 15, 15],

      filename:
        `${sanitizeFilename(
          title || "Untitled Note"
        )}.pdf`,

      image: {
        type: "jpeg",
        quality: 0.98
      },

      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
      },

      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait"
      },

      pagebreak: {
        mode: [
          "avoid-all",
          "css",
          "legacy"
        ]
      }
    };

    try {
      await html2pdf()
        .set(options)
        .from(pdfContainer)
        .save();
    } catch (err) {
      console.error(
        "PDF export error:",
        err
      );

      alert(
        "Unable to export the manuscript as PDF."
      );
    } finally {
      document.body.removeChild(
        pdfContainer
      );
    }
  };

  const escapeHtml = (value = "") => {
    return String(value)
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
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
          Select a manuscript or
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
        className={`flex items-center justify-between border-b ${colors.border} px-6 py-3 ${colors.toolbar}`}
      >
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span className="font-serif italic font-medium">
            Scribe
          </span>

          <span>&gt;</span>

          <span className="font-semibold">
            {note.title ||
              "Untitled"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Font size */}

          <div className="flex items-center gap-2 text-xs">
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

            {lockStatus.success ? (
              <button
                onClick={async () => {
                  if (isEditing) {
                    await onSaveNote(
                      note.id,
                      title,
                      body
                    );
                  }

                  setIsEditing(
                    !isEditing
                  );
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
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-200 text-neutral-700 rounded text-xs font-semibold">
                <AlertTriangle
                  size={12}
                />
                Read-Only
              </div>
            )}
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- */}
      {/* LOCK NOTIFICATION                                  */}
      {/* -------------------------------------------------- */}

      {!lockStatus.success && (
        <div
          className={`${colors.notification} ${colors.notificationText} text-xs px-6 py-2 border-b ${colors.border} flex items-center gap-2`}
        >
          <AlertTriangle
            size={14}
          />

          <span>
            This manuscript is
            currently being written
            on another active device
            by user [
            {lockStatus.lockedBy}
            ]. Access is temporarily
            restricted to Read Only.
          </span>
        </div>
      )}

      {/* -------------------------------------------------- */}
      {/* WORKING DESK                                       */}
      {/* -------------------------------------------------- */}

      <div className="flex-1 flex overflow-hidden">
        {/* ------------------------------------------------ */}
        {/* MAIN WORKSPACE                                   */}
        {/* ------------------------------------------------ */}

        <div
          className="flex-1 flex flex-col p-8 overflow-y-auto"
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
              className="flex-1 prose max-w-2xl mx-auto font-serif leading-loose"
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
          className={`w-56 border-l ${colors.border} ${colors.sidebar} p-4 flex flex-col gap-4 text-xs font-sans`}
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
    </div>
  );
}
