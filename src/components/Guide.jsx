import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, RefreshCw } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { marked } from "marked";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function Guide({ theme = "beige" }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const dark = theme === "charcoal";
  const wiki = theme === "wikipedia";

  const pageClass = dark
    ? "bg-neutral-900 text-neutral-100"
    : wiki
      ? "bg-[#F8F9FA] text-[#202122]"
      : "bg-[#F5F2EB] text-neutral-800";

  const cardClass = dark
    ? "bg-neutral-950 border-neutral-700"
    : wiki
      ? "bg-white border-neutral-300"
      : "bg-white border-[#D8CDBA]";

  const mutedClass = dark
    ? "text-neutral-400"
    : "text-neutral-500";

  const loadGuide = async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const snapshot = await getDoc(doc(db, "adminContent", "help"));

      if (snapshot.exists()) {
        setContent(snapshot.data()?.content || "");
      } else {
        setContent("");
      }
    } catch (err) {
      console.error("Failed to load Guide:", err);
      setError(err?.message || "Unable to load the Guide.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuide();
  }, [user]);

  /*
   * ArchiWiki's custom underline syntax is:
   *
   * ++underlined text++
   *
   * We temporarily replace it with placeholders BEFORE Markdown parsing.
   *
   * This is important because replacing it after parsing would also modify
   * examples contained inside fenced code blocks.
   */
  const renderedContent = useMemo(() => {
    if (!content.trim()) return "";

    const underlineTokens = [];

    const markdownWithTokens = content.replace(
      /\+\+([^+\n]+)\+\+/g,
      (_, text) => {
        const token = `ARCHIWIKI_UNDERLINE_TOKEN_${underlineTokens.length}_END`;
        underlineTokens.push(text);
        return token;
      }
    );

    

    let html = marked.parse(markdownWithTokens, {
      gfm: true,
      breaks: false,
    });
    html = html.replace(
  /<table>([\s\S]*?)<\/table>/g,
  '<div class="table-scroll-wrapper"><table>$1</table></div>'
);

    underlineTokens.forEach((text, index) => {
      const token = `ARCHIWIKI_UNDERLINE_TOKEN_${index}_END`;
      html = html.replace(
        new RegExp(token, "g"),
        `<u class="archiwiki-underline">${text}</u>`
      );
    });

    return html;
  }, [content]);

  return (
    <div
      className={`h-full min-h-0 overflow-y-auto ${pageClass}`}
    >
      <style>{`
        .archiwiki-guide {
          font-family: Montserrat, system-ui, sans-serif;
          font-size: 0.95rem;
          line-height: 1.75;
        }

        /* ---------------------------------------------
           HEADINGS
           --------------------------------------------- */

        .archiwiki-guide h1,
        .archiwiki-guide h2,
        .archiwiki-guide h3,
        .archiwiki-guide h4,
        .archiwiki-guide h5,
        .archiwiki-guide h6 {
          font-family: Montserrat, system-ui, sans-serif;
          font-weight: 700;
          line-height: 1.3;
          letter-spacing: -0.01em;
        }

        .archiwiki-guide h1 {
          font-size: 1.8rem;
          margin-top: 0;
          margin-bottom: 1.25rem;
        }

        .archiwiki-guide h2 {
          font-size: 1.5rem;
          margin-top: 2.25rem;
          margin-bottom: 0.9rem;
        }

        .archiwiki-guide h3 {
          font-size: 1.25rem;
          margin-top: 1.8rem;
          margin-bottom: 0.75rem;
        }

        .archiwiki-guide h4 {
          font-size: 1.1rem;
          margin-top: 1.5rem;
          margin-bottom: 0.65rem;
        }

        .archiwiki-guide h5,
        .archiwiki-guide h6 {
          font-size: 1rem;
          margin-top: 1.35rem;
          margin-bottom: 0.6rem;
        }

        /* ---------------------------------------------
           PARAGRAPHS
           --------------------------------------------- */

        .archiwiki-guide p {
          margin: 0 0 1.15rem;
        }

        .archiwiki-guide p:last-child {
          margin-bottom: 0;
        }

        /* ---------------------------------------------
           BOLD / ITALIC
           --------------------------------------------- */

        .archiwiki-guide strong {
          font-weight: 700;
        }

        .archiwiki-guide em {
          font-style: italic;
        }

        /* ---------------------------------------------
           CUSTOM UNDERLINE
           ++text++
           --------------------------------------------- */

        .archiwiki-guide .archiwiki-underline {
          text-decoration-line: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 2px;
        }

        /* ---------------------------------------------
           LINKS
           --------------------------------------------- */

        .archiwiki-guide a {
          color: ${dark ? "#93c5fd" : "#2E8B57"};
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 2px;
          cursor: pointer;
        }

        .archiwiki-guide a:hover {
          color: ${dark ? "#bfdbfe" : "#246B45"};
        }

        /* ---------------------------------------------
           LISTS
           --------------------------------------------- */

        .archiwiki-guide ul,
        .archiwiki-guide ol {
          margin-top: 0;
          margin-bottom: 1.15rem;
          padding-left: 1.75rem;
        }

        .archiwiki-guide ul {
          list-style-type: disc;
        }

        .archiwiki-guide ol {
          list-style-type: decimal;
        }

        .archiwiki-guide li {
          margin: 0.3rem 0;
          padding-left: 0.15rem;
        }

        .archiwiki-guide li > ul,
        .archiwiki-guide li > ol {
          margin-top: 0.3rem;
          margin-bottom: 0.3rem;
        }

        /* ---------------------------------------------
           BLOCKQUOTES
           --------------------------------------------- */

        .archiwiki-guide blockquote {
          margin: 1.25rem 0;
          padding: 0.5rem 1rem;
          border-left: 4px solid ${dark ? "#525252" : "#a3a3a3"};
          color: ${dark ? "#a3a3a3" : "#737373"};
          font-style: italic;
        }

        .archiwiki-guide blockquote p {
          margin-bottom: 0;
        }

        /* ---------------------------------------------
           INLINE CODE
           --------------------------------------------- */

        .archiwiki-guide code {
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            "Liberation Mono",
            monospace;

          font-size: 0.9em;
          padding: 0.12rem 0.35rem;
          border-radius: 0.4rem;

          background: ${dark
            ? "rgba(255, 255, 255, 0.10)"
            : "rgba(0, 0, 0, 0.06)"};

          color: inherit;
        }

        /* ---------------------------------------------
           FENCED CODE BLOCKS
           --------------------------------------------- */

        .archiwiki-guide pre {
          margin: 1.25rem 0;
          padding: 1rem;
          overflow-x: auto;
          border-radius: 0.5rem;

          background: ${dark
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.055)"};

          border: 1px solid ${dark ? "#3f3f46" : "#e5e5e5"};

          line-height: 1.55;
        }

        .archiwiki-guide pre code {
          display: block;
          padding: 0;
          background: transparent;
          border-radius: 0;
          font-size: 0.86rem;
          white-space: pre;
        }

        /* ---------------------------------------------
           HORIZONTAL RULES
           --------------------------------------------- */

        .archiwiki-guide hr {
          display: block;
          width: 100%;
          height: 1px;
          margin: 2rem 0;

          border: 0;
          border-top: 1px solid
            ${dark ? "#525252" : "#d4d4d4"};
        }

        /* ---------------------------------------------
           TABLES
           --------------------------------------------- */

           

/* ---------------------------------------------
   TABLES
   --------------------------------------------- */

.archiwiki-guide .table-scroll-wrapper {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  margin: 1.25rem 0;
}

.archiwiki-guide .table-scroll-wrapper table {
  width: max-content;
  min-width: 100%;
  max-width: none;
  border-collapse: collapse;
  table-layout: auto;
}

.archiwiki-guide .table-scroll-wrapper th,
.archiwiki-guide .table-scroll-wrapper td {
  padding: 0.5rem 0.75rem;
  border: 1px solid
    ${dark ? "#525252" : "#d4d4d4"};
  vertical-align: top;
  max-width: 400px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.archiwiki-guide .table-scroll-wrapper th {
  font-weight: 700;
  background: ${dark
    ? "rgba(255, 255, 255, 0.06)"
    : "rgba(0, 0, 0, 0.04)"};
}

/* Table alignment */

.archiwiki-guide .table-scroll-wrapper th[align="left"],
.archiwiki-guide .table-scroll-wrapper td[align="left"],
.archiwiki-guide .table-scroll-wrapper th[style*="text-align: left"],
.archiwiki-guide .table-scroll-wrapper td[style*="text-align: left"] {
  text-align: left;
}

.archiwiki-guide .table-scroll-wrapper th[align="center"],
.archiwiki-guide .table-scroll-wrapper td[align="center"],
.archiwiki-guide .table-scroll-wrapper th[style*="text-align: center"],
.archiwiki-guide .table-scroll-wrapper td[style*="text-align: center"] {
  text-align: center;
}

.archiwiki-guide .table-scroll-wrapper th[align="right"],
.archiwiki-guide .table-scroll-wrapper td[align="right"],
.archiwiki-guide .table-scroll-wrapper th[style*="text-align: right"],
.archiwiki-guide .table-scroll-wrapper td[style*="text-align: right"] {
  text-align: right;
}

/* ---------------------------------------------
   CHECKBOXES
   --------------------------------------------- */

.archiwiki-guide input[type="checkbox"] {
  pointer-events: none;
  cursor: default;

  appearance: none;
  -webkit-appearance: none;

  width: 0.9em;
  height: 0.9em;

  margin: 0 0.45em 0 0;

  vertical-align: -0.08em;
  flex: 0 0 auto;

  border: 1.5px solid #000000;
  border-radius: 2px;

  background-color: transparent;

  position: relative;
  opacity: 1;
}

.archiwiki-guide input[type="checkbox"]:checked {
  background-color: #000000;
  border-color: #000000;
}

.archiwiki-guide input[type="checkbox"]:checked::after {
  content: "";

  position: absolute;

  left: 0.2em;
  top: 0.02em;

  width: 0.28em;
  height: 0.55em;

  border: solid #ffffff;
  border-width: 0 1.5px 1.5px 0;

  transform: rotate(45deg);
}

.archiwiki-guide li:has(input[type="checkbox"]) {
  list-style-type: none;
  padding-left: 0;
}
  
        /* ---------------------------------------------
           IMAGES
           --------------------------------------------- */

        .archiwiki-guide img {
          display: block;
          max-width: 100%;
          height: auto;
          margin: 1.25rem 0;
        }

        /* ---------------------------------------------
           MOBILE
           --------------------------------------------- */

        @media (max-width: 639px) {
          .archiwiki-guide {
            font-size: 0.92rem;
          }

          .archiwiki-guide h1 {
            font-size: 1.55rem;
          }

          .archiwiki-guide h2 {
            font-size: 1.35rem;
          }

          .archiwiki-guide h3 {
            font-size: 1.15rem;
          }

          .archiwiki-guide pre {
            max-width: 100%;
            padding: 0.8rem;
          }

        }
      `}</style>

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded border text-xs ${
              dark
                ? "border-neutral-700 hover:bg-neutral-800"
                : "border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <button
            type="button"
            onClick={loadGuide}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded border text-xs ${
              dark
                ? "border-neutral-700 hover:bg-neutral-800"
                : "border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        <div className="mt-10 flex items-center gap-3">
          <BookOpen size={22} strokeWidth={1.5} />

          <h1 className="text-2xl font-medium tracking-wide">
            Guide
          </h1>
        </div>

        <p className={`mt-2 text-sm ${mutedClass}`}>
          How to use ArchiWiki, including Markdown syntax and workflows.
        </p>

        <article
          className={`mt-8 rounded border ${
            cardClass
          }`}
        >
          {loading ? (
            <div className="p-5 sm:p-8">
              <p className={`text-sm ${mutedClass}`}>
                Loading Guide…
              </p>
            </div>
          ) : error ? (
            <div className="p-5 sm:p-8">
              <p className="text-sm text-red-600">
                {error}
              </p>
            </div>
          ) : content.trim() ? (
            <div
              className="archiwiki-guide p-5 sm:p-8"
              dangerouslySetInnerHTML={{
                __html: renderedContent,
              }}
            />
          ) : (
            <div
              className={`p-5 sm:p-8 text-sm leading-7 ${mutedClass}`}
            >
              The Guide has not been published yet.
            </div>
          )}
        </article>
      </div>
    </div>
  );
}