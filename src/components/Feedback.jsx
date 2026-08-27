import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Plus,
  RefreshCw
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const makeFeedbackId = () => {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);

  const random = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `FB-${stamp}-${random}`;
};

const formatTimestamp = (value) => {
  if (!value) return "—";

  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
  } catch {
    return "—";
  }
};

export default function Feedback({ theme = "beige" }) {
  const { user } = useAuth();

  const [components, setComponents] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [componentsLoading, setComponentsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [componentId, setComponentId] = useState("");
  const [feedback, setFeedback] = useState("");

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

  const inputClass = dark
    ? "bg-neutral-900 border-neutral-700 text-neutral-100"
    : "bg-white border-neutral-300 text-neutral-900";

  const mutedClass = dark ? "text-neutral-400" : "text-neutral-500";

  const loadComponents = async () => {
    setComponentsLoading(true);

    try {
      const snapshot = await getDocs(collection(db, "helpComponents"));

      const items = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.active !== false)
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""))
        );

      setComponents(items);

      if (!componentId && items.length) {
        setComponentId(items[0].id);
      }
    } catch (err) {
      console.error("Failed to load feedback components:", err);
      setError(err?.message || "Unable to load components.");
    } finally {
      setComponentsLoading(false);
    }
  };

  const loadFeedback = async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const snapshot = await getDocs(
        query(collection(db, "feedback"), where("userId", "==", user.uid))
      );

      const items = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      setFeedbackItems(items);
    } catch (err) {
      console.error("Failed to load feedback:", err);
      setError(err?.message || "Unable to load feedback.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComponents();
  }, []);

  useEffect(() => {
    loadFeedback();
  }, [user]);

  const submitFeedback = async (event) => {
    event.preventDefault();

    if (!user || submitting) return;

    if (!componentId || !feedback.trim()) {
      setError("Please select a component and enter your feedback.");
      return;
    }

    const component = components.find((item) => item.id === componentId);

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const feedbackId = makeFeedbackId();

      await addDoc(collection(db, "feedback"), {
        feedbackId,
        componentId,
        componentName: component?.name || "",
        message: feedback.trim(),
        userId: user.uid,
        userEmail: user.email || "",
        status: "submitted",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setFeedback("");
      setShowCreate(false);
      setMessage(`Feedback ${feedbackId} submitted.`);
      await loadFeedback();
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      setError(err?.message || "Unable to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  const loadComments = async (feedbackId) => {
    setCommentsLoading((current) => ({
      ...current,
      [feedbackId]: true
    }));

    try {
      const snapshot = await getDocs(
        collection(db, "feedback", feedbackId, "comments")
      );

      const items = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return aTime - bTime;
        });

      setComments((current) => ({
        ...current,
        [feedbackId]: items
      }));
    } catch (err) {
      console.error("Failed to load feedback comments:", err);
      setError(err?.message || "Unable to load comments.");
    } finally {
      setCommentsLoading((current) => ({
        ...current,
        [feedbackId]: false
      }));
    }
  };

  const toggleFeedback = async (feedbackId) => {
    const next = expanded === feedbackId ? null : feedbackId;
    setExpanded(next);

    if (next) {
      await loadComments(next);
    }
  };

  const statusClass = (status) => {
    if (status === "accepted") {
      return dark
        ? "bg-green-950 text-green-300"
        : "bg-green-50 text-green-700";
    }

    if (status === "declined") {
      return dark
        ? "bg-red-950 text-red-300"
        : "bg-red-50 text-red-700";
    }

    return dark
      ? "bg-amber-950 text-amber-300"
      : "bg-amber-50 text-amber-700";
  };

  return (
    <div className={`min-h-screen ${pageClass}`}>
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
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

        <div className="mt-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <MessageSquare size={22} strokeWidth={1.5} />
              <h1 className="text-2xl font-medium tracking-wide">
                Feedback
              </h1>
            </div>
            <p className={`mt-2 text-sm ${mutedClass}`}>
              Share suggestions and track your feedback.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadFeedback}
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

            <button
              type="button"
              onClick={() => {
                setShowCreate((value) => !value);
                setError("");
                setMessage("");
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-neutral-900 text-white text-xs hover:bg-neutral-800"
            >
              <Plus size={14} />
              New feedback
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-3 rounded border border-red-200 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 p-3 rounded border border-neutral-200 bg-white text-sm">
            {message}
          </div>
        )}

        {showCreate && (
          <form
            onSubmit={submitFeedback}
            className={`mt-6 rounded border p-5 sm:p-6 ${cardClass}`}
          >
            <h2 className="font-semibold">Submit feedback</h2>

            <label className="block mt-5">
              <span className="block text-xs font-semibold mb-2">
                Component
              </span>

              <select
                value={componentId}
                onChange={(e) => setComponentId(e.target.value)}
                disabled={componentsLoading}
                className={`w-full rounded border px-3 py-2 text-sm ${inputClass}`}
              >
                <option value="">
                  {componentsLoading
                    ? "Loading components…"
                    : "Select component"}
                </option>

                {components.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block mt-4">
              <span className="block text-xs font-semibold mb-2">
                Feedback
              </span>

              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={7}
                className={`w-full rounded border px-3 py-2 text-sm resize-y ${inputClass}`}
                placeholder="Tell us what you think..."
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className={`px-3 py-2 rounded border text-xs ${
                  dark
                    ? "border-neutral-700 hover:bg-neutral-800"
                    : "border-neutral-300 hover:bg-neutral-100"
                }`}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting || componentsLoading}
                className="px-4 py-2 rounded bg-neutral-900 text-white text-xs disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit feedback"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 space-y-3">
          {loading ? (
            <div className={`rounded border p-6 ${cardClass}`}>
              <p className={`text-sm ${mutedClass}`}>
                Loading feedback…
              </p>
            </div>
          ) : feedbackItems.length === 0 ? (
            <div className={`rounded border p-8 text-center ${cardClass}`}>
              <MessageSquare
                size={30}
                strokeWidth={1.25}
                className={`mx-auto ${mutedClass}`}
              />
              <h2 className="mt-4 font-semibold">No feedback yet</h2>
              <p className={`mt-2 text-sm ${mutedClass}`}>
                Your submitted feedback will appear here.
              </p>
            </div>
          ) : (
            feedbackItems.map((item) => {
              const isOpen = expanded === item.id;

              return (
                <div
                  key={item.id}
                  className={`rounded border overflow-hidden ${cardClass}`}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs">
                            {item.feedbackId || item.id}
                          </span>

                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide ${statusClass(
                              item.status
                            )}`}
                          >
                            {item.status || "submitted"}
                          </span>
                        </div>

                        <p className={`mt-2 text-xs ${mutedClass}`}>
                          {item.componentName || "Unknown component"}
                          {" · "}
                          {formatTimestamp(item.createdAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleFeedback(item.id)}
                        className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs ${
                          dark
                            ? "border-neutral-700 hover:bg-neutral-800"
                            : "border-neutral-300 hover:bg-neutral-100"
                        }`}
                      >
                        {isOpen ? (
                          <>
                            Hide
                            <ChevronUp size={13} />
                          </>
                        ) : (
                          <>
                            View
                            <ChevronDown size={13} />
                          </>
                        )}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mt-5 pt-5 border-t border-neutral-200">
                        <div className="text-sm leading-7 whitespace-pre-wrap">
                          {item.message}
                        </div>

                        <div className="mt-6">
                          <h3 className="text-xs font-semibold uppercase tracking-wider">
                            Admin comments
                          </h3>

                          {commentsLoading[item.id] ? (
                            <p className={`mt-3 text-sm ${mutedClass}`}>
                              Loading comments…
                            </p>
                          ) : comments[item.id]?.length ? (
                            <div className="mt-3 space-y-3">
                              {comments[item.id].map((comment) => (
                                <div
                                  key={comment.id}
                                  className="rounded border border-neutral-200 p-3"
                                >
                                  <p className="text-sm whitespace-pre-wrap">
                                    {comment.text}
                                  </p>
                                  <p
                                    className={`mt-2 text-[10px] ${mutedClass}`}
                                  >
                                    Admin ·{" "}
                                    {formatTimestamp(comment.createdAt)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className={`mt-3 text-sm ${mutedClass}`}>
                              No admin comments yet.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
