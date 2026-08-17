import React, {
  useState,
  useEffect,
  useRef,
  useCallback
} from "react";

import { marked } from "marked";

import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Link,
  Undo2,
  Redo2,
  Eye,
  Edit3,
  Save,
  Download,
  AlertTriangle,
  FileText,
  BookOpen,
  Clock,
  Check,
  MoreHorizontal
} from "lucide-react";

import {
  acquireLock,
  releaseLock
} from "../firebase";


export default function Editor({
  note,
  onSaveNote,
  notesPool,
  userId,
  fontSize,
  setFontSize,
  onNavigateToNote
}) {

  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [lockStatus, setLockStatus] = useState({
    success: true,
    lockedBy: null
  });

  const [wikiSuggest, setWikiSuggest] = useState(null);

  const [saveStatus, setSaveStatus] = useState("saved");

  const textareaRef = useRef(null);

  const sessionToken = useRef(
    Math.random().toString(36).substring(2)
  ).current;


  /* --------------------------------------------------
     NOTE INITIALIZATION
  -------------------------------------------------- */

  useEffect(() => {
    if (!note) return;

    setTitle(note.title || "");
    setBody(note.body || "");
    setIsEditing(false);
    setIsPreview(false);
    setSaveStatus("saved");

    checkAndAcquireLock();

    return () => {
      releaseLock(note.id, sessionToken);
    };
  }, [note?.id]);


  /* --------------------------------------------------
     LOCK HEARTBEAT
  -------------------------------------------------- */

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

  }, [
    note?.id,
    isEditing,
    userId
  ]);


  const checkAndAcquireLock = async () => {

    if (!note) return;

    const res = await acquireLock(
      note.id,
      userId,
      sessionToken
    );

    setLockStatus(res);

    if (!res.success) {
      setIsEditing(false);
    }
  };


  /* --------------------------------------------------
     SAVE
  -------------------------------------------------- */

  const saveCurrentNote = useCallback(async () => {

    if (!note) return;

    try {

      setSaveStatus("saving");

      await onSaveNote(
        note.id,
        title,
        body
      );

      setSaveStatus("saved");

    } catch (error) {

      console.error(
        "Failed to save note:",
        error
      );

      setSaveStatus("error");

    }

  }, [
    note,
    title,
    body,
    onSaveNote
  ]);


  /* --------------------------------------------------
     TEXTAREA HELPERS
  -------------------------------------------------- */

  const replaceSelection = (
    before,
    after = before,
    fallback = "text"
  ) => {

    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected =
      body.substring(start, end) ||
      fallback;

    const updated =
      body.substring(0, start) +
      before +
      selected +
      after +
      body.substring(end);

    setBody(updated);
    setSaveStatus("unsaved");

    requestAnimationFrame(() => {

      textarea.focus();

      const cursor =
        start +
        before.length +
        selected.length +
        after.length;

      textarea.setSelectionRange(
        start + before.length,
        cursor - after.length
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
    setSaveStatus("unsaved");

    requestAnimationFrame(() => {

      textarea.focus();

      const cursor =
        start + text.length;

      textarea.setSelectionRange(
        cursor,
        cursor
      );

    });
  };


  /* --------------------------------------------------
     FORMATTING
  -------------------------------------------------- */

  const formatBold = () =>
    replaceSelection("**", "**", "bold text");

  const formatItalic = () =>
    replaceSelection("*", "*", "italic text");

  const formatStrike = () =>
    replaceSelection("~~", "~~", "strikethrough");

  const formatCode = () =>
    replaceSelection("`", "`", "code");

  const formatQuote = () => {

    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected =
      body.substring(start, end) ||
      "Quote";

    const formatted =
      selected
        .split("\n")
        .map(line => `> ${line}`)
        .join("\n");

    const updated =
      body.substring(0, start) +
      formatted +
      body.substring(end);

    setBody(updated);
    setSaveStatus("unsaved");
  };


  const formatList = (ordered = false) => {

    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected =
      body.substring(start, end) ||
      "List item";

    const formatted =
      selected
        .split("\n")
        .map((line, index) =>
          ordered
            ? `${index + 1}. ${line}`
            : `- ${line}`
        )
        .join("\n");

    setBody(
      body.substring(0, start) +
      formatted +
      body.substring(end)
    );

    setSaveStatus("unsaved");
  };


  const formatHeading = (level) => {

    const textarea = textareaRef.current;

    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const selected =
      body.substring(start, end) ||
      "Heading";

    const prefix =
      "#".repeat(level) + " ";

    const formatted =
      selected
        .split("\n")
        .map(line =>
          `${prefix}${line.replace(/^#{1,6}\s+/, "")}`
        )
        .join("\n");

    setBody(
      body.substring(0, start) +
      formatted +
      body.substring(end)
    );

    setSaveStatus("unsaved");
  };


  const insertLink = () => {

    const url = window.prompt(
      "Enter URL:",
      "https://"
    );

    if (!url) return;

    const textarea = textareaRef.current;

    const selected =
      textarea &&
      body.substring(
        textarea.selectionStart,
        textarea.selectionEnd
      );

    const label =
      selected || "link";

    insertAtCursor(
      `[${label}](${url})`
    );
  };


  const insertDivider = () => {
    insertAtCursor("\n\n---\n\n");
  };


  /* --------------------------------------------------
     UNDO / REDO
  -------------------------------------------------- */

  const undo = () => {

    document.execCommand(
      "undo"
    );

    textareaRef.current?.focus();
  };


  const redo = () => {

    document.execCommand(
      "redo"
    );

    textareaRef.current?.focus();
  };


  /* --------------------------------------------------
     WIKI LINK AUTOCOMPLETE
  -------------------------------------------------- */

  const checkForWikiTrigger = (e) => {

    const selectionEnd =
      e.target.selectionEnd;

    const textBeforeCursor =
      e.target.value.substring(
        0,
        selectionEnd
      );

    const lastOpenIndex =
      textBeforeCursor.lastIndexOf("[[");

    if (
      lastOpenIndex !== -1 &&
      lastOpenIndex >=
        textBeforeCursor.lastIndexOf("]]")
    ) {

      const query =
        textBeforeCursor.substring(
          lastOpenIndex + 2
        );

      const candidates =
        notesPool.filter(n =>
          n.id !== note?.id &&
          n.title
            ?.toLowerCase()
            .startsWith(
              query.toLowerCase()
            )
        );

      if (candidates.length > 0) {

        setWikiSuggest({
          query,
          list: candidates,
          index: 0
        });

        return;
      }
    }

    setWikiSuggest(null);
  };


  const insertWikiLink = (linkedTitle) => {

    const textarea =
      textareaRef.current;

    if (!textarea) return;

    const cursor =
      textarea.selectionEnd;

    const beforeText =
      body.substring(0, cursor);

    const lastOpenIndex =
      beforeText.lastIndexOf("[[");

    const afterText =
      body.substring(cursor);

    const updatedBody =
      beforeText.substring(
        0,
        lastOpenIndex
      ) +
      `[[${linkedTitle}]]` +
      afterText;

    setBody(updatedBody);
    setSaveStatus("unsaved");
    setWikiSuggest(null);

    requestAnimationFrame(() => {
      textarea.focus();
    });
  };


  const handleKeyDown = (e) => {

    if (wikiSuggest) {

      if (e.key === "ArrowDown") {

        e.preventDefault();

        setWikiSuggest(prev => ({
          ...prev,
          index:
            (prev.index + 1) %
            prev.list.length
        }));

        return;
      }

      if (e.key === "ArrowUp") {

        e.preventDefault();

        setWikiSuggest(prev => ({
          ...prev,
          index:
            (prev.index - 1 +
              prev.list.length) %
            prev.list.length
        }));

        return;
      }

      if (e.key === "Enter") {

        e.preventDefault();

        insertWikiLink(
          wikiSuggest
            .list[
              wikiSuggest.index
            ].title
        );

        return;
      }

      if (e.key === "Escape") {

        e.preventDefault();

        setWikiSuggest(null);

        return;
      }
    }


    /* Keyboard shortcuts */

    if (
      (e.ctrlKey || e.metaKey) &&
      e.key === "b"
    ) {

      e.preventDefault();
      formatBold();

      return;
    }

    if (
      (e.ctrlKey || e.metaKey) &&
      e.key === "i"
    ) {

      e.preventDefault();
      formatItalic();

      return;
    }

    if (
      (e.ctrlKey || e.metaKey) &&
      e.key === "s"
    ) {

      e.preventDefault();
      saveCurrentNote();

      return;
    }
  };


  /* --------------------------------------------------
     MARKDOWN RENDERING
  -------------------------------------------------- */

  const parseWikiLinks = (
    rawMarkdown
  ) => {

    const renderedHtml =
      marked.parse(
        rawMarkdown || ""
      );

    return renderedHtml.replace(
      /\[\[(.*?)\]\]/g,
      (match, linkedTitle) => {

        const matchNote =
          notesPool.find(
            n =>
              n.title
                ?.trim()
                .toLowerCase() ===
              linkedTitle
                .trim()
                .toLowerCase()
          );

        if (matchNote) {

          return `
            <span
              class="wiki-link"
              data-note-id="${matchNote.id}"
            >
              ${linkedTitle}
            </span>
          `;
        }

        return `
          <span class="wiki-link-missing">
            ${linkedTitle}
          </span>
        `;
      }
    );
  };


  const handleHtmlClick = (e) => {

    const target =
      e.target;

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


  /* --------------------------------------------------
     METRICS
  -------------------------------------------------- */

  const words =
    body.trim()
      ? body.trim().split(/\s+/).length
      : 0;

  const characters =
    body.length;

  const readingTime =
    Math.max(
      1,
      Math.ceil(words / 200)
    );


  /* --------------------------------------------------
     PDF
  -------------------------------------------------- */

  const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

  const triggerPdfPrint = () => {
  if (!note) return;

  const renderedContent = parseWikiLinks(body);

  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    alert("Please allow pop-ups to export the PDF.");
    return;
  }

  printWindow.document.open();

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(title || "Untitled Note")}</title>

        <style>
          @page {
            size: A4;
            margin: 22mm 20mm 22mm 20mm;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: white;
            color: #202122;
          }

          body {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 12pt;
            line-height: 1.75;
          }

          .document {
            width: 100%;
            max-width: 100%;
          }

          h1 {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 28pt;
            line-height: 1.2;
            margin: 0 0 24px;
            padding-bottom: 12px;
            border-bottom: 1px solid #d4d4d4;
            color: #171717;
          }

          h2 {
            font-size: 20pt;
            margin-top: 28px;
            margin-bottom: 12px;
          }

          h3 {
            font-size: 16pt;
            margin-top: 24px;
            margin-bottom: 10px;
          }

          p {
            margin: 0 0 14px;
          }

          ul,
          ol {
            margin: 12px 0 16px 28px;
          }

          li {
            margin-bottom: 5px;
          }

          blockquote {
            margin: 18px 0;
            padding: 8px 18px;
            border-left: 4px solid #a3a3a3;
            color: #525252;
          }

          code {
            font-family: "SFMono-Regular", Consolas, monospace;
            font-size: 0.9em;
            background: #f5f5f5;
            padding: 2px 5px;
            border-radius: 3px;
          }

          pre {
            background: #f5f5f5;
            padding: 14px;
            border-radius: 6px;
            overflow-wrap: break-word;
            white-space: pre-wrap;
          }

          pre code {
            background: transparent;
            padding: 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 18px 0;
          }

          th,
          td {
            border: 1px solid #d4d4d4;
            padding: 7px 10px;
            text-align: left;
          }

          th {
            background: #f5f5f5;
          }

          a {
            color: #202122;
            text-decoration: underline;
          }

          img {
            max-width: 100%;
            height: auto;
          }

          .wiki-link {
            color: #202122;
            font-weight: 600;
            text-decoration: underline;
          }

          .document-footer {
            margin-top: 40px;
            padding-top: 10px;
            border-top: 1px solid #e5e5e5;
            color: #737373;
            font-family: Arial, sans-serif;
            font-size: 8pt;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }

            .document {
              break-inside: auto;
            }

            h1,
            h2,
            h3 {
              break-after: avoid;
            }

            pre,
            blockquote,
            table {
              break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        <main class="document">
          <h1>${escapeHtml(title || "Untitled Note")}</h1>

          <div class="content">
            ${renderedContent}
          </div>

          <div class="document-footer">
            Exported from Scribe
          </div>
        </main>
      </body>
    </html>
  `);

  printWindow.document.close();

  // Wait until the new document has actually rendered.
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();

      // Give the browser time to finish the print operation.
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 300);
  };
};


  /* --------------------------------------------------
     NO NOTE SELECTED
  -------------------------------------------------- */

  if (!note) {

    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-cream-100 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 p-12">

        <div className="w-20 h-20 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-center mb-6">

          <BookOpen
            size={34}
            strokeWidth={1.5}
            className="text-violet-400"
          />

        </div>

        <h2 className="text-xl font-semibold mb-2">
          Your writing space
        </h2>

        <p className="text-sm text-neutral-400 text-center max-w-sm">
          Select a manuscript from the sidebar,
          or create a new note to start writing.
        </p>

      </div>
    );
  }


  return (
    <div className="flex-1 flex flex-col h-full bg-cream-100 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200">

      {/* ================================================
          TOP BAR
      ================================================= */}

      <div className="h-14 shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/90 backdrop-blur flex items-center justify-between px-5">

        <div className="flex items-center gap-3 min-w-0">

          <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">

            <FileText
              size={15}
              className="text-violet-500"
            />

          </div>

          <div className="min-w-0">

            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">
              Manuscript
            </div>

            <div className="text-sm font-semibold truncate max-w-[300px]">
              {title || "Untitled"}
            </div>

          </div>

        </div>


        <div className="flex items-center gap-2">

          {/* Font Size */}

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800">

            <span className="text-[10px] text-neutral-400">
              Aa
            </span>

            <input
              type="range"
              min="14"
              max="24"
              value={fontSize}
              onChange={(e) =>
                setFontSize(
                  Number(e.target.value)
                )
              }
              className="w-20 accent-violet-500"
            />

            <span className="text-[10px] w-7 text-right">
              {fontSize}
            </span>

          </div>


          {/* Preview */}

          <button
            type="button"
            onClick={() =>
              setIsPreview(!isPreview)
            }
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition"
            title={
              isPreview
                ? "Edit"
                : "Preview"
            }
          >

            {isPreview ? (
              <Edit3 size={15} />
            ) : (
              <Eye size={15} />
            )}

          </button>


          {/* PDF */}

          <button
            type="button"
            onClick={triggerPdfPrint}
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 transition"
            title="Print / Save PDF"
          >

            <Download size={15} />

          </button>


          {/* Save / Edit */}

          {lockStatus.success ? (

            <button
              type="button"
              onClick={async () => {

                if (isEditing) {
                  await saveCurrentNote();
                  setIsEditing(false);
                } else {
                  setIsEditing(true);
                }

              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold shadow-sm transition"
            >

              {isEditing ? (
                <>
                  <Save size={14} />
                  Save
                </>
              ) : (
                <>
                  <Edit3 size={14} />
                  Edit
                </>
              )}

            </button>

          ) : (

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-medium">

              <AlertTriangle size={13} />

              Read-only

            </div>
          )}

        </div>

      </div>


      {/* ================================================
          LOCK WARNING
      ================================================= */}

      {!lockStatus.success && (

        <div className="px-5 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">

          <AlertTriangle size={14} />

          This manuscript is being edited on another device.
          You are currently in read-only mode.

        </div>
      )}


      {/* ================================================
          EDITOR / READING AREA
      ================================================= */}

      <div className="flex-1 flex overflow-hidden">


        {/* MAIN WRITING AREA */}

        <div className="flex-1 overflow-y-auto">

          <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-12 py-8">


            {isEditing && !isPreview && (

              /* TOOLBAR */

              <div className="sticky top-0 z-30 mb-5">

                <div className="flex flex-wrap items-center gap-1 p-2 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur border border-neutral-200 dark:border-neutral-800 shadow-sm">

                  <ToolbarButton
                    icon={<Bold size={15} />}
                    title="Bold"
                    onClick={formatBold}
                  />

                  <ToolbarButton
                    icon={<Italic size={15} />}
                    title="Italic"
                    onClick={formatItalic}
                  />

                  <ToolbarButton
                    icon={<Strikethrough size={15} />}
                    title="Strikethrough"
                    onClick={formatStrike}
                  />


                  <ToolbarDivider />


                  <ToolbarButton
                    icon={<Heading1 size={15} />}
                    title="Heading 1"
                    onClick={() =>
                      formatHeading(1)
                    }
                  />

                  <ToolbarButton
                    icon={<Heading2 size={15} />}
                    title="Heading 2"
                    onClick={() =>
                      formatHeading(2)
                    }
                  />

                  <ToolbarButton
                    icon={<Heading3 size={15} />}
                    title="Heading 3"
                    onClick={() =>
                      formatHeading(3)
                    }
                  />


                  <ToolbarDivider />


                  <ToolbarButton
                    icon={<List size={15} />}
                    title="Bullet list"
                    onClick={() =>
                      formatList(false)
                    }
                  />

                  <ToolbarButton
                    icon={<ListOrdered size={15} />}
                    title="Numbered list"
                    onClick={() =>
                      formatList(true)
                    }
                  />

                  <ToolbarButton
                    icon={<Quote size={15} />}
                    title="Quote"
                    onClick={formatQuote}
                  />

                  <ToolbarButton
                    icon={<Code size={15} />}
                    title="Inline code"
                    onClick={formatCode}
                  />


                  <ToolbarDivider />


                  <ToolbarButton
                    icon={<Link size={15} />}
                    title="Insert link"
                    onClick={insertLink}
                  />

                  <ToolbarButton
                    icon={<Minus size={15} />}
                    title="Horizontal divider"
                    onClick={insertDivider}
                  />


                  <div className="flex-1" />


                  <ToolbarButton
                    icon={<Undo2 size={15} />}
                    title="Undo"
                    onClick={undo}
                  />

                  <ToolbarButton
                    icon={<Redo2 size={15} />}
                    title="Redo"
                    onClick={redo}
                  />

                </div>

              </div>
            )}


            {/* ========================================
                PAPER
            ========================================= */}

            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm min-h-[calc(100vh-180px)] overflow-hidden">


              {/* TITLE */}

              <div className="px-7 sm:px-12 pt-10">

                {isEditing && !isPreview ? (

                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setSaveStatus("unsaved");
                    }}
                    placeholder="Untitled manuscript"
                    className="w-full bg-transparent border-0 outline-none text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 placeholder-neutral-300 dark:placeholder-neutral-700"
                  />

                ) : (

                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                    {title || "Untitled manuscript"}
                  </h1>

                )}

                <div className="mt-5 h-px bg-neutral-100 dark:bg-neutral-800" />

              </div>


              {/* CONTENT */}

              <div
                className="px-7 sm:px-12 py-8"
                style={{
                  fontSize: `${fontSize}px`
                }}
              >

                {isEditing && !isPreview ? (

                  <div className="relative">

                    <textarea
                      ref={textareaRef}
                      value={body}
                      onChange={(e) => {

                        setBody(e.target.value);
                        setSaveStatus("unsaved");
                        checkForWikiTrigger(e);

                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Start writing...

Use the toolbar above to format your manuscript.

Type [[ to link another manuscript."
                      className="w-full min-h-[55vh] bg-transparent border-0 outline-none resize-none text-neutral-700 dark:text-neutral-300 leading-[1.9] placeholder:text-neutral-300 dark:placeholder:text-neutral-700 font-normal"
                      spellCheck="true"
                    />


                    {/* Wiki autocomplete */}

                    {wikiSuggest && (

                      <div className="absolute left-0 top-8 z-50 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow-xl overflow-hidden">

                        <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-neutral-400 border-b border-neutral-100 dark:border-neutral-800">

                          Link manuscript

                        </div>

                        {wikiSuggest.list.map(
                          (item, index) => (

                            <button
                              type="button"
                              key={item.id}
                              onClick={() =>
                                insertWikiLink(
                                  item.title
                                )
                              }
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                                index ===
                                wikiSuggest.index
                                  ? "bg-violet-50 dark:bg-violet-950/30"
                                  : ""
                              }`}
                            >

                              <FileText
                                size={13}
                                className="text-violet-500"
                              />

                              <span className="truncate">
                                {item.title}
                              </span>

                            </button>
                          )
                        )}

                      </div>
                    )}

                  </div>

                ) : (

                  <article
                    className="prose prose-neutral dark:prose-invert max-w-none leading-[1.9]"
                    onClick={handleHtmlClick}
                    dangerouslySetInnerHTML={{
                      __html:
                        parseWikiLinks(body)
                    }}
                  />

                )}

              </div>

            </div>

          </div>

        </div>


        {/* ================================================
            RIGHT SIDEBAR
        ================================================= */}

        <aside className="hidden xl:flex w-64 shrink-0 border-l border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/40 flex-col">

          <div className="p-5">

            <div className="flex items-center gap-2 mb-5">

              <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">

                <MoreHorizontal
                  size={14}
                  className="text-violet-500"
                />

              </div>

              <span className="text-xs font-semibold">
                Manuscript info
              </span>

            </div>


            {/* Statistics */}

            <div className="space-y-2">

              <StatRow
                label="Words"
                value={words}
              />

              <StatRow
                label="Characters"
                value={characters}
              />

              <StatRow
                label="Reading time"
                value={`~${readingTime} min`}
              />

            </div>

          </div>


          {/* BACKLINKS */}

          <div className="flex-1 border-t border-neutral-200 dark:border-neutral-800 p-5 overflow-y-auto">

            <div className="flex items-center justify-between mb-4">

              <span className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">
                Backlinks
              </span>

              <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                {notesPool.filter(
                  n =>
                    n.id !== note.id &&
                    n.body?.includes(
                      `[[${note.title}]]`
                    )
                ).length}
              </span>

            </div>


            <div className="space-y-2">

              {notesPool
                .filter(
                  n =>
                    n.id !== note.id &&
                    n.body?.includes(
                      `[[${note.title}]]`
                    )
                )
                .map(backlink => (

                  <button
                    type="button"
                    key={backlink.id}
                    onClick={() =>
                      onNavigateToNote(
                        backlink.id
                      )
                    }
                    className="w-full text-left p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-violet-300 dark:hover:border-violet-800 transition"
                  >

                    <div className="flex items-center gap-2">

                      <FileText
                        size={13}
                        className="text-violet-400"
                      />

                      <span className="text-xs font-semibold truncate">
                        {backlink.title}
                      </span>

                    </div>

                    <p className="text-[10px] text-neutral-400 mt-1 line-clamp-2">
                      {backlink.body}
                    </p>

                  </button>

                ))}


              {notesPool.filter(
                n =>
                  n.id !== note.id &&
                  n.body?.includes(
                    `[[${note.title}]]`
                  )
              ).length === 0 && (

                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  No other manuscripts link to this page yet.
                </p>

              )}

            </div>

          </div>

        </aside>

      </div>


      {/* ================================================
          STATUS BAR
      ================================================= */}

      <div className="h-9 shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/90 flex items-center justify-between px-5 text-[10px] text-neutral-400">

        <div className="flex items-center gap-4">

          <span>
            {words} words
          </span>

          <span>
            {characters} characters
          </span>

          <span className="hidden sm:inline">
            ~{readingTime} min read
          </span>

        </div>


        <div className="flex items-center gap-2">

          {saveStatus === "saving" && (
            <>
              <Clock size={11} />
              Saving...
            </>
          )}

          {saveStatus === "saved" && (
            <>
              <Check
                size={11}
                className="text-emerald-500"
              />
              Saved
            </>
          )}

          {saveStatus === "unsaved" && (
            <span className="text-amber-500">
              Unsaved changes
            </span>
          )}

          {saveStatus === "error" && (
            <span className="text-red-500">
              Save failed
            </span>
          )}

          <span className="ml-2 text-neutral-300 dark:text-neutral-700">
            •
          </span>

          <span>
            AES-256 encrypted
          </span>

        </div>

      </div>

    </div>
  );
}


/* ======================================================
   SMALL COMPONENTS
====================================================== */

function ToolbarButton({
  icon,
  title,
  onClick
}) {

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition"
    >
      {icon}
    </button>
  );
}


function ToolbarDivider() {

  return (
    <div className="h-5 w-px bg-neutral-200 dark:bg-neutral-700 mx-1" />
  );
}


function StatRow({
  label,
  value
}) {

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60">

      <span className="text-[11px] text-neutral-400">
        {label}
      </span>

      <span className="text-xs font-semibold">
        {value}
      </span>

    </div>
  );
}
