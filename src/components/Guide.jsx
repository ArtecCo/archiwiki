import React, { useEffect, useState } from "react";
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

  return (
    <div className={`min-h-screen ${pageClass}`}>
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
          <h1 className="text-2xl font-medium tracking-wide">Guide</h1>
        </div>

        <p className={`mt-2 text-sm ${mutedClass}`}>
          How to use ArchiWiki, including Markdown syntax and workflows.
        </p>

        <article
          className={`mt-8 rounded border p-5 sm:p-8 overflow-x-auto ${
            cardClass
          }`}
        >
          {loading ? (
            <p className={`text-sm ${mutedClass}`}>Loading Guide…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : content.trim() ? (
            <div
              className="prose prose-sm max-w-none
                prose-headings:font-semibold
                prose-p:leading-7
                prose-li:leading-7
                prose-pre:overflow-x-auto"
              dangerouslySetInnerHTML={{
                __html: marked.parse(content)
              }}
            />
          ) : (
            <div className={`text-sm leading-7 ${mutedClass}`}>
              The Guide has not been published yet.
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
