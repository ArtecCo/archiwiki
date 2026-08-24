import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import { jsPDF } from "jspdf";
import {
  Edit,
  Save,
  BookOpen,
  Download,
  FileText,
  X,
  Bold,
  Italic,
  Heading,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Trash2
} from "lucide-react";

export default function Editor({
  note,
  newNoteId,
  onSaveNote,
  onDeleteNote,
  notesPool = [],
  fontSize,
  setFontSize,
  onNavigateToNote,
  onCloseNote,
  articleCount = 0,
  folderCount = 0,
  subfolderCount = 0,
  writingSince = "",
  breadcrumb = "",
  theme = "beige",
  mobileReaderPanel = "article"
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [wikiSuggest, setWikiSuggest] = useState(null);
  const [pdfError, setPdfError] = useState(false);

  const textareaRef = useRef(null);
  const fontSizeInitializedRef = useRef(false);

  /*
   * ---------------------------------------------------------
   * RESPONSIVE DEFAULT FONT SIZE
   * ---------------------------------------------------------
   *
   * Laptop / desktop: 15px
   * Phone: 14px
   *
   * This only establishes the initial default. Existing
   * font-size controls continue to work normally afterward.
   */

  useEffect(() => {
    if (fontSizeInitializedRef.current) return;

    fontSizeInitializedRef.current = true;

    if (typeof window === "undefined") return;

    const isPhone = window.matchMedia(
      "(max-width: 639px)"
    ).matches;

    setFontSize?.(isPhone ? 14 : 15);
  }, [setFontSize]);

  /*
   * ---------------------------------------------------------
   * THEME
   * ---------------------------------------------------------
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
    status: "bg-[#EAE5DB]",
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
    status: "bg-[#FFFFFF]",
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

  const colors =
    themeClasses[theme] || themeClasses.beige;

  const dialogTheme = {
    beige:
      "bg-[#F5F2EB] border-[#D8CDBA] text-[#202122]",
    wikipedia:
      "bg-[#F8F9FA] border-neutral-300 text-[#202122]",
    charcoal:
      "bg-neutral-900 border-neutral-700 text-neutral-100"
  }[theme] || "bg-white border-neutral-200 text-[#202122]";

  const currentHour = new Date().getHours();

  const greeting =
    currentHour < 12
      ? "Good morning!"
      : currentHour < 18
      ? "Good afternoon!"
      : "Good evening!";

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
   */

  const replaceSelection = (
    before,
    after = before
  ) => {
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
  const wikiLinks = [];

  // Protect [[wikilinks]] before marked parses the Markdown.
  const protectedMarkdown = String(rawMarkdown || "").replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_, target, label) => {
      const index = wikiLinks.length;

      wikiLinks.push({
        target: target.trim(),
        label: (label || target).trim()
      });

      return `WIKILINKPLACEHOLDER${index}WIKILINKPLACEHOLDER`;
    }
  );

  // Now Markdown can safely parse the rest of the document.
let renderedHtml = marked.parse(protectedMarkdown, {
  breaks: true
});

  // Turn the protected placeholders back into wiki links.
  renderedHtml = renderedHtml.replace(
    /WIKILINKPLACEHOLDER(\d+)WIKILINKPLACEHOLDER/g,
    (_, index) => {
      const wikiLink = wikiLinks[Number(index)];

      if (!wikiLink) return "";

      const matchNote = notesPool.find(
        (n) =>
          n.title?.trim().toLowerCase() ===
          wikiLink.target.toLowerCase()
      );

      if (!matchNote) {
        return `
          <span class="wiki-link-missing">
            ${wikiLink.label}
          </span>
        `;
      }

      return `
        <span
          class="wiki-link underline cursor-pointer font-semibold"
          data-note-id="${matchNote.id}"
        >
          ${wikiLink.label}
        </span>
      `;
    }
  );

  return renderedHtml;
};

  const handleHtmlClick = (e) => {
  const target = e.target.closest?.(".wiki-link");

  if (!target) return;

  e.preventDefault();

  const targetId = target.getAttribute("data-note-id");

  if (targetId) {
    onNavigateToNote(targetId);
  }
};

  /*
   * ---------------------------------------------------------
   * PDF DOWNLOAD
   * ---------------------------------------------------------
   */

  const triggerPdfDownload = () => {
    if (!note) return;

    try {
      const metrics = calculateMetrics();

      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait"
      });

      const pageWidth =
        pdf.internal.pageSize.getWidth();

      const pageHeight =
        pdf.internal.pageSize.getHeight();

      const marginLeft = 18;
      const marginRight = 18;
      const top = 18;
      const bottom = 18;

      const contentWidth =
        pageWidth -
        marginLeft -
        marginRight;

      const footerY =
        pageHeight - 10;

      const bodyBottom =
        pageHeight -
        bottom -
        10;

      let y = top;
      let pageNumber = 1;

      const palette = {
        text: [34, 34, 34],
        muted: [105, 105, 105],
        accent: [64, 94, 122],
        rule: [205, 205, 205],
        soft: [246, 246, 246],
        quote: [248, 248, 248]
      };

      /*
       * -----------------------------------------------------
       * PDF UTILITY HELPERS
       * -----------------------------------------------------
       */

      const clean = (value) =>
        String(value || "")
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n")
          .replace(/\u00a0/g, " ");

      /*
       * Insert zero-width break opportunities into extremely
       * long tokens such as URLs, hashes and long code strings.
       *
       * This does not visibly alter the exported text, but
       * gives jsPDF safe places where a line can break.
       */
      const addSoftBreaks = (
        value,
        maxTokenLength = 42
      ) => {
        return String(value || "")
          .split(/(\s+)/)
          .map((part) => {
            if (
              /\s/.test(part) ||
              part.length <= maxTokenLength
            ) {
              return part;
            }

            let result = "";

            for (
              let i = 0;
              i < part.length;
              i += 1
            ) {
              result += part[i];

              if (
                (i + 1) % maxTokenLength === 0 &&
                i + 1 < part.length
              ) {
                result += "\u200B";
              }
            }

            return result;
          })
          .join("");
      };

      const plainInline = (value) =>
        clean(value)
          .replace(
            /!\[([^\]]*)\]\([^)]+\)/g,
            "$1"
          )
          .replace(
            /\[([^\]]+)\]\([^)]+\)/g,
            "$1"
          )
          .replace(
            /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
            (_, target, label) =>
              label || target
          )
          .replace(
            /`([^`]+)`/g,
            "$1"
          )
          .replace(
            /\*\*\*(.*?)\*\*\*/g,
            "$1"
          )
          .replace(
            /___(.*?)___/g,
            "$1"
          )
          .replace(
            /\*\*(.*?)\*\*/g,
            "$1"
          )
          .replace(
            /__(.*?)__/g,
            "$1"
          )
          .replace(
            /(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g,
            "$1"
          )
          .replace(
            /(?<!_)_(?!_)(.*?)_(?!_)/g,
            "$1"
          )
          .trim();

      const wrap = (
        value,
        size,
        font = "times",
        style = "normal",
        width = contentWidth
      ) => {
        const prepared = addSoftBreaks(
          plainInline(value)
        );

        pdf.setFont(font, style);
        pdf.setFontSize(size);

        return pdf.splitTextToSize(
          prepared || " ",
          width
        );
      };

      const wrapRaw = (
        value,
        size,
        font = "times",
        style = "normal",
        width = contentWidth
      ) => {
        const prepared = addSoftBreaks(
          clean(value)
        );

        pdf.setFont(font, style);
        pdf.setFontSize(size);

        return pdf.splitTextToSize(
          prepared || " ",
          width
        );
      };

      const rule = (
        yy = y,
        width = contentWidth
      ) => {
        pdf.setDrawColor(...palette.rule);
        pdf.setLineWidth(0.25);
        pdf.line(
          marginLeft,
          yy,
          marginLeft + width,
          yy
        );
      };

      /*
       * -----------------------------------------------------
       * PDF FOOTER
       * -----------------------------------------------------
       */

      const pageFooter = () => {
        pdf.setDrawColor(...palette.rule);
        pdf.setLineWidth(0.2);

        pdf.line(
          marginLeft,
          pageHeight - 14,
          pageWidth - marginRight,
          pageHeight - 14
        );

        const websiteUrl =
          typeof window !== "undefined"
            ? window.location.origin
            : "";

        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(7.5);

        pdf.setTextColor(
          ...palette.accent
        );

        const websiteName =
          "ArchiWiki";

        pdf.textWithLink(
          websiteName,
          marginLeft,
          footerY,
          {
            url:
              websiteUrl ||
              "https://localhost"
          }
        );

        const linkWidth =
          pdf.getTextWidth(
            websiteName
          );

        pdf.setDrawColor(
          ...palette.accent
        );

        pdf.setLineWidth(0.15);

        pdf.line(
          marginLeft,
          footerY + 0.8,
          marginLeft + linkWidth,
          footerY + 0.8
        );

        pdf.setTextColor(
          ...palette.muted
        );

        pdf.text(
          String(pageNumber),
          pageWidth - marginRight,
          footerY,
          {
            align: "right"
          }
        );
      };

      const newPage = () => {
        pageFooter();

        pdf.addPage();

        pageNumber += 1;

        y = top;
      };

      const ensure = (height) => {
        if (
          y + height >
          bodyBottom
        ) {
          newPage();
          return true;
        }

        return false;
      };

      const drawWrapped = (
        lines,
        x,
        yy,
        size,
        font,
        style,
        lineHeight
      ) => {
        pdf.setFont(
          font,
          style
        );

        pdf.setFontSize(size);

        pdf.setTextColor(
          ...palette.text
        );

        lines.forEach(
          (line, index) => {
            pdf.text(
              line,
              x,
              yy +
                index *
                  lineHeight +
                size * 0.35
            );
          }
        );

        return (
          lines.length *
          lineHeight
        );
      };

      /*
       * -----------------------------------------------------
       * PDF BLOCK RENDERERS
       * -----------------------------------------------------
       */

      const addParagraph = (
        value
      ) => {
        const text =
          plainInline(value);

        if (!text) {
          y += 2.5;
          return;
        }

        const size = 11;
        const lineHeight = 5.8;

        const lines = wrap(
          text,
          size,
          "times",
          "normal"
        );

        if (
          lines.length > 1 &&
          y +
            lineHeight * 2 >
            bodyBottom
        ) {
          newPage();
        }

        const height =
          drawWrapped(
            lines,
            marginLeft,
            y,
            size,
            "times",
            "normal",
            lineHeight
          );

        y += height + 4;
      };

      const addHeading = (
        value,
        level
      ) => {
        const sizes = {
          1: 16,
          2: 13.5,
          3: 12,
          4: 11,
          5: 10.5,
          6: 10
        };

        const size =
          sizes[level] || 10;

        const lineHeight =
          level <= 2
            ? 6.5
            : 5.8;

        const lines = wrap(
          value,
          size,
          "times",
          "bold"
        );

        const required =
          lines.length *
            lineHeight +
          (level <= 2 ? 8 : 4);

        if (
          y + required >
          bodyBottom
        ) {
          newPage();
        }

        y +=
          level === 1
            ? 3
            : 5;

        const height =
          drawWrapped(
            lines,
            marginLeft,
            y,
            size,
            "times",
            "bold",
            lineHeight
          );

        y += height + 3;

        if (level <= 2) {
          rule(
            y,
            level === 1
              ? contentWidth
              : contentWidth * 0.55
          );

          y += 4.5;
        }
      };

      const addListItem = (
        value,
        ordered,
        number,
        level
      ) => {
        const indent =
          Math.min(level, 4) *
          5;

        const marker = ordered
          ? `${number}.`
          : "•";

        const size = 11;
        const lineHeight = 5.6;

        const textWidth =
          contentWidth -
          indent -
          7;

        const lines = wrap(
          value,
          size,
          "times",
          "normal",
          textWidth
        );

        if (
          y + lineHeight >
          bodyBottom
        ) {
          newPage();
        }

        pdf.setFont(
          "times",
          "normal"
        );

        pdf.setFontSize(size);

        pdf.setTextColor(
          ...palette.text
        );

        pdf.text(
          marker,
          marginLeft +
            indent,
          y + 3.5
        );

        lines.forEach(
          (l, idx) => {
            pdf.text(
              l,
              marginLeft +
                indent +
                7,
              y +
                idx *
                  lineHeight +
                3.5
            );
          }
        );

        y +=
          lines.length *
            lineHeight +
          2;
      };

      const addQuote = (
        values
      ) => {
        const text = values
          .map((line) =>
            line.replace(
              /^>\s?/,
              ""
            )
          )
          .join(" ");

        const size = 10;
        const lineHeight = 5.2;

        const lines = wrap(
          text,
          size,
          "times",
          "italic",
          contentWidth - 12
        );

        const boxHeight =
          lines.length *
            lineHeight +
          6;

        if (
          y + boxHeight >
          bodyBottom
        ) {
          newPage();
        }

        pdf.setFillColor(
          ...palette.quote
        );

        pdf.roundedRect(
          marginLeft,
          y,
          contentWidth,
          boxHeight,
          1,
          1,
          "F"
        );

        pdf.setDrawColor(
          ...palette.accent
        );

        pdf.setLineWidth(0.8);

        pdf.line(
          marginLeft + 1,
          y + 1,
          marginLeft + 1,
          y +
            boxHeight -
            1
        );

        pdf.setFont(
          "times",
          "italic"
        );

        pdf.setFontSize(size);

        pdf.setTextColor(
          ...palette.text
        );

        lines.forEach(
          (l, idx) => {
            pdf.text(
              l,
              marginLeft + 6,
              y +
                3 +
                idx *
                  lineHeight +
                size * 0.35
            );
          }
        );

        y += boxHeight + 5;
      };

      const addCode = (
        code
      ) => {
        const size = 8.5;
        const lineHeight = 4.5;

        const allLines =
          wrapRaw(
            clean(code).trim() ||
              " ",
            size,
            "courier",
            "normal",
            contentWidth - 10
          );

        let index = 0;

        while (
          index <
          allLines.length
        ) {
          const available =
            Math.max(
              1,
              Math.floor(
                (bodyBottom -
                  y -
                  6) /
                  lineHeight
              )
            );

          if (
            available <= 1
          ) {
            newPage();
            continue;
          }

          const chunk =
            allLines.slice(
              index,
              index +
                available
            );

          const boxHeight =
            chunk.length *
              lineHeight +
            6;

          pdf.setFillColor(
            ...palette.soft
          );

          pdf.roundedRect(
            marginLeft,
            y,
            contentWidth,
            boxHeight,
            1,
            1,
            "F"
          );

          pdf.setFont(
            "courier",
            "normal"
          );

          pdf.setFontSize(size);

          pdf.setTextColor(
            ...palette.text
          );

          chunk.forEach(
            (l, idx) => {
              pdf.text(
                l,
                marginLeft + 5,
                y +
                  3 +
                  idx *
                    lineHeight +
                  size * 0.35
              );
            }
          );

          y +=
            boxHeight + 5;

          index +=
            chunk.length;

          if (
            index <
            allLines.length
          ) {
            newPage();
          }
        }
      };

      const addTable = (
        rows
      ) => {
        if (!rows.length)
          return;

        const cells = rows.map(
          (row) =>
            row
              .trim()
              .replace(
                /^\||\|$/g,
                ""
              )
              .split("|")
              .map((cell) =>
                plainInline(
                  cell.trim()
                )
              )
        );

        const columnCount =
          Math.max(
            ...cells.map(
              (row) =>
                row.length
            )
          );

        const normalized =
          cells.map(
            (row) => {
              const copy = [
                ...row
              ];

              while (
                copy.length <
                columnCount
              ) {
                copy.push("");
              }

              return copy;
            }
          );

        if (
          normalized.length >=
            2 &&
          normalized[1].every(
            (cell) =>
              /^:?-{3,}:?$/.test(
                cell
              )
          )
        ) {
          normalized.splice(
            1,
            1
          );
        }

        if (
          !normalized.length
        )
          return;

        const columnWidth =
          contentWidth /
          columnCount;

        const cellPadding = 2.5;
        const fontSize = 8.5;
        const lineHeight = 4.5;

        let rowIndex = 0;

        while (
          rowIndex <
          normalized.length
        ) {
          const row =
            normalized[
              rowIndex
            ];

          const cellLines =
            row.map(
              (cell) =>
                pdf.splitTextToSize(
                  addSoftBreaks(
                    cell ||
                      " "
                  ),
                  Math.max(
                    10,
                    columnWidth -
                      cellPadding *
                        2
                  )
                )
            );

          const rowHeight =
            Math.max(
              ...cellLines.map(
                (lines) =>
                  lines.length *
                    lineHeight +
                  cellPadding *
                    2
              )
            );

          if (
            y + rowHeight >
            bodyBottom
          ) {
            newPage();
          }

          if (
            rowIndex === 0
          ) {
            pdf.setFillColor(
              ...palette.soft
            );

            pdf.rect(
              marginLeft,
              y,
              contentWidth,
              rowHeight,
              "F"
            );
          }

          pdf.setDrawColor(
            ...palette.rule
          );

          pdf.setLineWidth(0.2);

          for (
            let column = 0;
            column <
            columnCount;
            column += 1
          ) {
            const x =
              marginLeft +
              column *
                columnWidth;

            pdf.rect(
              x,
              y,
              columnWidth,
              rowHeight
            );

            pdf.setFont(
              "helvetica",
              rowIndex === 0
                ? "bold"
                : "normal"
            );

            pdf.setFontSize(
              fontSize
            );

            pdf.setTextColor(
              ...palette.text
            );

            cellLines[
              column
            ].forEach(
              (l, idx) => {
                pdf.text(
                  l,
                  x +
                    cellPadding,
                  y +
                    cellPadding +
                    idx *
                      lineHeight +
                    fontSize *
                      0.35
                );
              }
            );
          }

          y += rowHeight;

          rowIndex += 1;
        }

        y += 5;
      };

      /*
       * -----------------------------------------------------
       * MARKDOWN PARSER
       * -----------------------------------------------------
       */

      const renderMarkdown = (
        markdown
      ) => {
        const lines =
          clean(markdown).split(
            "\n"
          );

        let index = 0;

        while (
          index <
          lines.length
        ) {
          const raw =
            lines[index];

          const line =
            raw.trim();

          if (!line) {
            y += 2.5;
            index += 1;
            continue;
          }

          if (
            line.startsWith(
              "```"
            )
          ) {
            const code = [];

            index += 1;

            while (
              index <
                lines.length &&
              !lines[
                index
              ]
                .trim()
                .startsWith(
                  "```"
                )
            ) {
              code.push(
                lines[index]
              );

              index += 1;
            }

            if (
              index <
              lines.length
            ) {
              index += 1;
            }

            addCode(
              code.join("\n")
            );

            continue;
          }

          if (
            line.includes("|") &&
            index + 1 <
              lines.length &&
            /^\s*\|?\s*:?-{3,}/.test(
              lines[index + 1]
            )
          ) {
            const rows = [];

            while (
              index <
                lines.length &&
              lines[
                index
              ]
                .trim()
                .includes("|")
            ) {
              rows.push(
                lines[index]
              );

              index += 1;
            }

            addTable(rows);

            continue;
          }

          const heading =
            line.match(
              /^(#{1,6})\s+(.+)$/
            );

          if (heading) {
            addHeading(
              heading[2],
              heading[1].length
            );

            index += 1;
            continue;
          }

          if (
            line.startsWith(">")
          ) {
            const values = [];

            while (
              index <
                lines.length &&
              lines[
                index
              ]
                .trim()
                .startsWith(">")
            ) {
              values.push(
                lines[index]
              );

              index += 1;
            }

            addQuote(values);

            continue;
          }

          const unordered =
            raw.match(
              /^(\s*)[-*+]\s+(.+)$/
            );

          if (unordered) {
            const level =
              Math.floor(
                unordered[1]
                  .length / 2
              );

            addListItem(
              unordered[2],
              false,
              0,
              level
            );

            index += 1;
            continue;
          }

          const ordered =
            raw.match(
              /^(\s*)(\d+)[.)]\s+(.+)$/
            );

          if (ordered) {
            const level =
              Math.floor(
                ordered[1]
                  .length / 2
              );

            addListItem(
              ordered[3],
              true,
              Number(
                ordered[2]
              ),
              level
            );

            index += 1;
            continue;
          }

          if (
            /^(\*\s*){3,}$/.test(
              line
            ) ||
            /^(-\s*){3,}$/.test(
              line
            ) ||
            /^(_\s*){3,}$/.test(
              line
            )
          ) {
            if (
              y + 5 >
              bodyBottom
            ) {
              newPage();
            }

            rule();

            y += 5;

            index += 1;

            continue;
          }

          const paragraph = [
            line
          ];

          index += 1;

          while (
            index <
            lines.length
          ) {
            const nextRaw =
              lines[index];

            const next =
              nextRaw.trim();

            if (!next) break;

            if (
              /^#{1,6}\s+/.test(
                next
              )
            )
              break;

            if (
              /^```/.test(next)
            )
              break;

            if (
              /^>/.test(next)
            )
              break;

            if (
              /^(\s*)[-*+]\s+/.test(
                nextRaw
              )
            )
              break;

            if (
              /^(\s*)\d+[.)]\s+/.test(
                nextRaw
              )
            )
              break;

            if (
              next.includes("|") &&
              index + 1 <
                lines.length &&
              /^\s*\|?\s*:?-{3,}/.test(
                lines[index + 1]
              )
            ) {
              break;
            }

            paragraph.push(
              next
            );

            index += 1;
          }

          addParagraph(
            paragraph.join(" ")
          );
        }
      };

      /*
       * -----------------------------------------------------
       * PDF BREADCRUMB
       * -----------------------------------------------------
       *
       * IMPORTANT:
       * The breadcrumb intentionally includes the article
       * title as its final item.
       *
       * It replaces the old standalone "ArchiWiki" line
       * above the article title.
       */

      const pdfBreadcrumb =
        [
          articleBreadcrumb,
          title ||
            "Untitled Note"
        ]
          .filter(Boolean)
          .join(" > ");

      if (pdfBreadcrumb) {
        pdf.setFont(
          "helvetica",
          "normal"
        );

        pdf.setFontSize(8);

        pdf.setTextColor(
          ...palette.muted
        );

        const breadcrumbLines =
          pdf.splitTextToSize(
            addSoftBreaks(
              pdfBreadcrumb
            ),
            contentWidth
          );

        breadcrumbLines.forEach(
          (bLine, i) => {
            pdf.text(
              bLine,
              marginLeft,
              y +
                i * 4.2 +
                2.8
            );
          }
        );

        y +=
          breadcrumbLines.length *
            4.2 +
          5;
      }

      /*
       * -----------------------------------------------------
       * TITLE
       * -----------------------------------------------------
       */

      const titleLines = wrap(
        title ||
          "Untitled Note",
        18,
        "times",
        "bold"
      );

      const titleLineHeight = 7.5;

      ensure(
        titleLines.length *
          titleLineHeight +
          10
      );

      const titleHeight =
        drawWrapped(
          titleLines,
          marginLeft,
          y,
          18,
          "times",
          "bold",
          titleLineHeight
        );

      y += titleHeight + 4;

      rule(y);

      y += 5;

      /*
       * -----------------------------------------------------
       * METADATA GRID
       * -----------------------------------------------------
       */

      const metadata = [
        `${metrics.words.toLocaleString()} Words`,
        `${metrics.characters.toLocaleString()} Characters`,
        `${metrics.paragraphs} Paragraphs`,
        `${metrics.headings} Headings`,
        `${metrics.wikiLinks} Wiki links`,
        `Updated: ${updatedAtText}`
      ];

      const columns = 3;
      const rows = 2;
      const columnGap = 6;

      const cellWidth =
        (contentWidth -
          columnGap *
            (columns - 1)) /
        columns;

      const metadataRowHeight = 5.5;

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(8);

      pdf.setTextColor(
        ...palette.muted
      );

      for (
        let row = 0;
        row < rows;
        row += 1
      ) {
        for (
          let column = 0;
          column < columns;
          column += 1
        ) {
          const index =
            row * columns +
            column;

          const x =
            marginLeft +
            column *
              (cellWidth +
                columnGap);

          pdf.text(
            metadata[index],
            x,
            y +
              row *
                metadataRowHeight +
              3
          );
        }
      }

      y +=
        rows *
          metadataRowHeight +
        4;

      rule(y);

      y += 6;

      /*
       * -----------------------------------------------------
       * BODY
       * -----------------------------------------------------
       */

      renderMarkdown(body);

      /*
       * Final footer.
       */

      pageFooter();

      pdf.save(
        `${sanitizeFilename(
          title ||
            "Untitled Note"
        )}.pdf`
      );
    } catch (err) {
      console.error(
        "PDF export error:",
        err
      );

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
    const raw = String(
      body || ""
    );

    const words = raw.trim()
      ? raw
          .trim()
          .split(/\s+/)
          .length
      : 0;

    const characters =
      raw.length;

    const paragraphs = raw
      .split(/\n\s*\n/)
      .map((part) =>
        part.trim()
      )
      .filter(Boolean)
      .length;

    const headings = (
      raw.match(
        /^#{1,6}\s+.+$/gm
      ) || []
    ).length;

    const wikiLinks = (
      raw.match(
        /\[\[[^\]]+\]\]/g
      ) || []
    ).length;

    return {
      words,
      characters,
      paragraphs,
      headings,
      wikiLinks
    };
  };

  const {
    words,
    characters,
    paragraphs,
    headings,
    wikiLinks
  } = calculateMetrics();

  const formatUpdatedAt = (
    value
  ) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "Unknown";
    }

    let timestamp = Number(
      value
    );

    if (
      !Number.isFinite(
        timestamp
      )
    ) {
      return "Unknown";
    }

    if (
      timestamp <
      1_000_000_000_000
    ) {
      timestamp *= 1000;
    }

    const date =
      new Date(timestamp);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "Unknown";
    }

    return date.toLocaleString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }
    );
  };

  const updatedAtText =
    formatUpdatedAt(
      note?.updatedAt
    );

  /*
   * ---------------------------------------------------------
   * BREADCRUMB
   * ---------------------------------------------------------
   *
   * This is the canonical folder breadcrumb.
   *
   * Example:
   * ArchiWiki > Projects > Website > Research
   *
   * The PDF separately appends the article title to this
   * so its final breadcrumb becomes:
   *
   * ArchiWiki > Projects > Website > Research > Article
   * ---------------------------------------------------------
   */

  const formatArticleBreadcrumb = (
    value
  ) => {
    const parts = String(
      value || ""
    )
      .split("/")
      .map((part) =>
        part.trim()
      )
      .filter(Boolean)
      .filter(
        (part) =>
          part.toLowerCase() !==
            "root" &&
          part.toLowerCase() !==
            "archiwiki"
      );

    return [
      "ArchiWiki",
      ...parts
    ].join(" > ");
  };

  const articleBreadcrumb =
    formatArticleBreadcrumb(
      breadcrumb
    );

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

  const mobileHeadings = String(body || "")
    .split("\n")
    .map((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) return null;
      return {
        level: match[1].length,
        text: match[2].trim()
      };
    })
    .filter(Boolean);

  const mobilePanel =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches &&
    mobileReaderPanel !== "article";

  if (mobilePanel && mobileReaderPanel === "structure") {
    return (
      <div className={`h-full overflow-y-auto px-4 py-5 ${colors.page}`}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">
            Structure
          </h2>
          {mobileHeadings.length > 0 ? (
            <div className="space-y-1">
              {mobileHeadings.map((heading, index) => (
                <button
                  key={`${heading.text}-${index}`}
                  type="button"
                  onClick={() => {
                    document
                      .getElementById("print-container")
                      ?.querySelectorAll("h1,h2,h3,h4,h5,h6")
                      ?.[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={`w-full text-left py-2 rounded px-2 ${colors.buttonHover}`}
                  style={{ paddingLeft: `${8 + (heading.level - 1) * 14}px` }}
                >
                  <span className="text-xs text-neutral-400 mr-2">
                    H{heading.level}
                  </span>
                  <span className="text-sm">{heading.text}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className={`text-sm italic ${colors.muted}`}>
              No headings in this article yet.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (mobilePanel && mobileReaderPanel === "links") {
    return (
      <div className={`h-full overflow-y-auto px-4 py-5 ${colors.page}`}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">
            Backlinks ({backlinks.length})
          </h2>
          {backlinks.length > 0 ? (
            <div className="space-y-2">
              {backlinks.map((backlink) => (
                <button
                  key={backlink.id}
                  type="button"
                  onClick={() => onNavigateToNote(backlink.id)}
                  className={`w-full text-left p-3 border ${colors.border} ${colors.card} rounded ${colors.buttonHover}`}
                >
                  <p className={`font-semibold truncate ${theme === "charcoal" ? "text-neutral-100" : "text-neutral-900"}`}>
                    {backlink.title}
                  </p>
                  <p className="text-[10px] text-neutral-500 truncate mt-1">
                    {backlink.body}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className={`text-sm italic ${colors.muted}`}>
              No connections link here yet.
            </p>
          )}
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * NO NOTE SELECTED
   * ---------------------------------------------------------
   */

  if (!note) {
    return (
      <div
        className={`h-full w-full flex items-center justify-center ${colors.page} px-6 py-12`}
        style={{
          fontFamily:
            "Montserrat, sans-serif"
        }}
      >
        <div className="w-full max-w-2xl text-center">
          <BookOpen
            size={34}
            strokeWidth={1}
            className="mx-auto mb-6 text-neutral-400"
          />

          <h1 className="text-3xl md:text-4xl font-medium tracking-wide mb-3">
            {greeting}
          </h1>

          <p
            className={`text-sm md:text-base italic leading-relaxed max-w-md mx-auto ${colors.muted}`}
          >
            Glimpse of your digital brain
          </p>

          <div className="mt-12 flex items-center justify-center">
            <div className="flex items-center">
              <div className="px-6 md:px-10 text-center">
                <div className="text-2xl md:text-3xl font-medium">
                  {articleCount}
                </div>

                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  Articles
                </div>
              </div>

              <div
                className={`h-10 w-px ${colors.border}`}
              />

              <div className="px-6 md:px-10 text-center">
                <div className="text-2xl md:text-3xl font-medium">
                  {folderCount}
                </div>

                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  Folders
                </div>
              </div>

              <div
                className={`h-10 w-px ${colors.border}`}
              />

              <div className="px-6 md:px-10 text-center">
                <div className="text-2xl md:text-3xl font-medium">
                  {subfolderCount}
                </div>

                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">
                  Subfolders
                </div>
              </div>
            </div>
          </div>

          {writingSince && (
            <p className="mt-10 text-[10px] uppercase tracking-[0.2em] text-neutral-400">
              Writing since{" "}
              {writingSince}
            </p>
          )}
        </div>
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
    className={`relative flex-1 min-h-0 flex flex-col h-full overflow-hidden ${colors.page}`}
    style={{
      fontFamily: "Montserrat, sans-serif",
      height: "100%",
      minHeight: 0,
      maxHeight: "100dvh"
    }}
  >
{/* -------------------------------------------------- */}
{/* EDITOR CONTEXT MENU                                */}
{/* -------------------------------------------------- */}

<div
  className={`shrink-0 border-b ${colors.border} ${colors.toolbar}`}
>
  <div
    className="
      flex flex-col
      md:flex-row md:items-center
      md:justify-between
      px-4 py-2.5
      md:px-6 md:py-2
    "
  >
    {/* ----------------------------------------------- */}
{/* BREADCRUMB                                      */}
{/* ----------------------------------------------- */}

<div className="min-w-0 flex-1 overflow-hidden">
  <div
    className="
      min-w-0
      flex items-center gap-2
      text-xs text-neutral-500
      overflow-x-auto
      whitespace-nowrap
      scrollbar-none
    "
  >
    <span className="font-medium shrink-0">
      {articleBreadcrumb}
    </span>

    <span className="shrink-0">
      &gt;
    </span>

    <span
      className={`font-medium shrink-0 ${
        theme === "charcoal"
          ? "text-neutral-100"
          : "text-neutral-700"
      }`}
    >
      {note.title || "Untitled"}
    </span>
  </div>
</div>

    {/* ----------------------------------------------- */}
    {/* ACTIONS                                         */}
    {/* ----------------------------------------------- */}

    <div
      className="
        flex items-center
        gap-2
        mt-2
        pt-2
        border-t
        md:mt-0
        md:pt-0
        md:border-t-0
        shrink-0
        w-full
        md:w-auto
      "
    >
      {/* Font size */}

      <div
        className="
          flex items-center gap-1.5 text-xs
          mr-auto
          md:mr-0
        "
      >
        <span className="hidden sm:inline">
          Size:
        </span>

        <input
          type="range"
          min="12"
          max="24"
          value={Number(fontSize) || 15}
          onChange={(e) =>
            setFontSize(
              parseInt(e.target.value, 10)
            )
          }
          className="
            w-16 sm:w-20
            bg-neutral-200
            h-1
            rounded-lg
            cursor-pointer
          "
          style={{
            accentColor:
              theme === "charcoal"
                ? "#F5F5F5"
                : "#171717"
          }}
          aria-label="Font size"
        />

        <span className="w-8 text-right">
          {Number(fontSize) || 15}px
        </span>
      </div>

      {/* PDF */}

      <button
        onClick={triggerPdfDownload}
        title="Download PDF"
        className={`
          p-1.5
          ${colors.buttonHover}
          rounded
          ${theme === "charcoal" ? "text-neutral-200" : "text-neutral-600"}
          flex items-center gap-1
          text-xs
          shrink-0
        `}
      >
        <Download size={14} />

        <span className="hidden sm:inline">
          PDF
        </span>
      </button>

      {/* Delete — only visible while editing */}

      {isEditing && (
        <button
          type="button"
          onClick={() => onDeleteNote(note.id)}
          title="Delete article"
          aria-label="Delete article"
          className="
            p-1.5
            rounded
            text-red-600
            hover:bg-red-50
            transition-colors
            flex items-center gap-1
            text-xs
            shrink-0
          "
        >
          <Trash2 size={14} />

          <span className="hidden sm:inline">
            Delete
          </span>
        </button>
      )}

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
        className="
          py-1.5
          px-3
          bg-neutral-900
          hover:bg-neutral-800
          text-white
          rounded
          text-xs
          font-semibold
          flex
          items-center
          gap-1.5
          transition-colors
          shrink-0
        "
      >
        {isEditing ? (
          <>
            <Save size={12} />
            <span>Save</span>
          </>
        ) : (
          <>
            <Edit size={12} />
            <span>Edit</span>
          </>
        )}
      </button>

      {/* Close */}

      <button
        type="button"
        onClick={onCloseNote}
        title="Close article"
        aria-label="Close article"
        className={`
          p-1.5
          ${colors.buttonHover}
          rounded
          text-neutral-500
          hover:text-neutral-800
          transition-colors
          shrink-0
        `}
      >
        <X size={16} />
      </button>
    </div>
  </div>
</div>

    {/* -------------------------------------------------- */}
    {/* WORKING DESK                                       */}
    {/* -------------------------------------------------- */}

    <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden pb-0">

      {/* ------------------------------------------------ */}
      {/* MAIN WORKSPACE                                   */}
      {/* ------------------------------------------------ */}

      <div
        className="flex-1 min-h-0 min-w-0 flex flex-col p-8 max-md:p-4 overflow-y-auto overflow-x-hidden"
        style={{
          fontSize: `${Number(fontSize || 15)}px`
        }}
      >
        {isEditing ? (
          <div className="flex-1 min-h-0 flex flex-col gap-4 relative">

            {/* TITLE */}

            <input
              type="text"
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="Title your note"
              className={`w-full min-w-0 bg-transparent border-b ${colors.border} pb-2 focus:outline-none focus:border-neutral-800 font-bold text-2xl tracking-wide placeholder-neutral-300`}
            />

            {/* MARKDOWN TOOLBAR */}

            <div
              className={`flex items-center gap-1 border-b ${colors.border} pb-2 overflow-x-auto shrink-0`}
            >
              <button
                type="button"
                title="Bold"
                onClick={() =>
                  replaceSelection("**", "**")
                }
                className={`p-1.5 shrink-0 ${colors.buttonHover} rounded text-neutral-600`}
              >
                <Bold size={14} />
              </button>

              <button
                type="button"
                title="Italic"
                onClick={() =>
                  replaceSelection("*", "*")
                }
                className={`p-1.5 shrink-0 ${colors.buttonHover} rounded text-neutral-600`}
              >
                <Italic size={14} />
              </button>

              <button
                type="button"
                title="Heading"
                onClick={applyHeading}
                className={`p-1.5 shrink-0 ${colors.buttonHover} rounded text-neutral-600`}
              >
                <Heading size={14} />
              </button>

              <button
                type="button"
                title="Bulleted list"
                onClick={() => applyList(false)}
                className={`p-1.5 shrink-0 ${colors.buttonHover} rounded text-neutral-600`}
              >
                <List size={14} />
              </button>

              <button
                type="button"
                title="Numbered list"
                onClick={() => applyList(true)}
                className={`p-1.5 shrink-0 ${colors.buttonHover} rounded text-neutral-600`}
              >
                <ListOrdered size={14} />
              </button>

              <button
                type="button"
                title="Quote"
                onClick={() =>
                  replaceSelection("> ", "")
                }
                className={`p-1.5 shrink-0 ${colors.buttonHover} rounded text-neutral-600`}
              >
                <Quote size={14} />
              </button>

              <button
                type="button"
                title="Code"
                onClick={applyCode}
                className={`p-1.5 shrink-0 ${colors.buttonHover} rounded text-neutral-600`}
              >
                <Code size={14} />
              </button>

              <button
                type="button"
                title="Link"
                onClick={applyLink}
                className={`p-1.5 shrink-0 ${colors.buttonHover} rounded text-neutral-600`}
              >
                <LinkIcon size={14} />
              </button>
            </div>

            {/* BODY */}

            <textarea
              ref={textareaRef}
              value={body}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              wrap="soft"
              placeholder="Write your thoughts... Type '[[' to link pages."
              className={`flex-1 min-h-0 min-w-0 w-full bg-transparent resize-none focus:outline-none font-mono focus:ring-0 leading-relaxed whitespace-pre-wrap break-words ${colors.input}`}
              style={{
                overflowX: "hidden",
                overflowY: "auto",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                whiteSpace: "pre-wrap"
              }}
            />

            {/* WIKI AUTOCOMPLETE */}

            {wikiSuggest && (
              <div
                className={`absolute z-50 ${colors.dropdown} border ${colors.border} rounded shadow-lg p-1 w-64 max-w-[calc(100vw-2rem)] max-h-48 overflow-y-auto text-xs`}
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
                        insertWikiLink(item.title)
                      }
                      className={`px-3 py-1.5 cursor-pointer rounded flex items-center gap-1.5 ${
                        idx === wikiSuggest.index
                          ? `${colors.active} font-semibold`
                          : colors.hover
                      }`}
                    >
                      <FileText size={12} />

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
            className="min-w-0 w-full"
            onClick={handleHtmlClick}
          >
            <div
              className="wiki-content w-full max-w-4xl mr-auto font-serif leading-loose text-left"
              style={{
                minWidth: 0,
                maxWidth: "100%",
                overflowWrap: "anywhere",
                wordBreak: "break-word"
              }}
            >
              <h1 className="max-w-full text-2xl font-bold border-b border-neutral-300 pb-3 mb-5 tracking-wide break-words">
                {title || "Untitled Note"}
              </h1>

              <div
                className={`min-w-0 max-w-full ${
                  theme === "charcoal"
                    ? "text-neutral-100"
                    : "text-neutral-800"
                }`}
                style={{
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  whiteSpace: "normal"
                }}
                dangerouslySetInnerHTML={{
                  __html: parseWikiLinks(body)
                }}
              />
            </div>

            <style>
              {`
                #print-container,
                #print-container * {
                  min-width: 0;
                  max-width: 100%;
                  overflow-wrap: anywhere;
                  word-break: break-word;
                }

                #print-container pre,
                #print-container code {
                  white-space: pre-wrap;
                  overflow-wrap: anywhere;
                  word-break: break-word;
                  max-width: 100%;
                }

                #print-container table {
                  width: 100%;
                  max-width: 100%;
                  table-layout: fixed;
                  overflow-wrap: anywhere;
                  word-break: break-word;
                }

                #print-container td,
                #print-container th {
                  overflow-wrap: anywhere;
                  word-break: break-word;
                }

                #print-container img {
                  max-width: 100%;
                  height: auto;
                }

                #print-container a {
                  overflow-wrap: anywhere;
                  word-break: break-word;
                }
              `}
            </style>
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
            backlinks.map((backlink) => (
              <div
                key={backlink.id}
                onClick={() =>
                  onNavigateToNote(backlink.id)
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
            ))
          ) : (
            <p className="text-neutral-400 italic">
              No connections link here yet.
            </p>
          )}
        </div>
      </div>
    </div>

    {/* -------------------------------------------------- */}
{/* STATUS BAR                                         */}
{/* -------------------------------------------------- */}

<div
  className={`
    fixed md:absolute
    bottom-0 left-0 right-0
    z-40
    shrink-0
    border-t ${colors.border}
    ${colors.status}
    font-sans text-[11px] text-neutral-500
  `}
  style={{
    paddingBottom:
      "env(safe-area-inset-bottom)"
  }}
>
  <div className="w-full overflow-x-auto">
    <div
      className="
        min-w-max
        px-4 py-2.5
        md:px-6 md:py-1.5
        flex items-center justify-between
        gap-8
        whitespace-nowrap
      "
    >
      <div className="flex gap-4">
        <span>
          Words:{" "}
          <strong>{words}</strong>
        </span>

        <span>
          Characters:{" "}
          <strong>{characters}</strong>
        </span>

        <span>
          Paragraphs:{" "}
          <strong>{paragraphs}</strong>
        </span>

        <span>
          Headings:{" "}
          <strong>{headings}</strong>
        </span>

        <span>
          Wiki Links:{" "}
          <strong>{wikiLinks}</strong>
        </span>
      </div>

      <div className="flex gap-4">
        <span>
          Updated:{" "}
          <strong>{updatedAtText}</strong>
        </span>

        <span>
          Status:{" "}
          <strong>
            Encrypted AES-256
          </strong>
        </span>
      </div>
    </div>
  </div>
</div>

    {/* -------------------------------------------------- */}
    {/* PDF ERROR DIALOG                                   */}
    {/* -------------------------------------------------- */}

    {pdfError && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-error-title"
      >
        <div
          className={`w-full max-w-sm rounded border p-5 shadow-xl ${dialogTheme}`}
        >
          <h2
            id="pdf-error-title"
            className="text-base font-semibold"
          >
            PDF export failed
          </h2>

          <p className="mt-2 text-sm text-neutral-500">
            The PDF could not be created. Please try again.
          </p>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setPdfError(false)}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
