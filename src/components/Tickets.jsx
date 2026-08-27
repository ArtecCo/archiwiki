import React, { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, RefreshCw, Ticket } from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const TICKET_STATUSES = [
  ["open", "Open"],
  ["in_progress", "In progress"],
  ["resolved", "Resolved"],
  ["closed", "Closed"]
];

const makeTicketId = () => {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);

  const random = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `AW-${stamp}-${random}`;
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

export default function Tickets({ theme = "beige" }) {
  const { user } = useAuth();

  const [components, setComponents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [componentsLoading, setComponentsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState("issue");
  const [componentId, setComponentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

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
      console.error("Failed to load ticket components:", err);
      setError(err?.message || "Unable to load components.");
    } finally {
      setComponentsLoading(false);
    }
  };

  const loadTickets = async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const snapshot = await getDocs(
        query(collection(db, "issues"), where("userId", "==", user.uid))
      );

      const items = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.type !== "feedback")
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      setTickets(items);
    } catch (err) {
      console.error("Failed to load tickets:", err);
      setError(err?.message || "Unable to load tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComponents();
  }, []);

  useEffect(() => {
    loadTickets();
  }, [user]);

  const submitTicket = async (event) => {
    event.preventDefault();

    if (!user || submitting) return;

    if (!componentId || !title.trim() || !description.trim()) {
      setError("Please select a component and complete all fields.");
      return;
    }

    const component = components.find((item) => item.id === componentId);

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const ticketId = makeTicketId();

      const reference = await addDoc(collection(db, "issues"), {
        issueId: ticketId,
        type,
        title: title.trim(),
        description: description.trim(),
        componentId,
        componentName: component?.name || "",
        userId: user.uid,
        userEmail: user.email || "",
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await updateDoc(doc(db, "issues", reference.id), {
        issueId: ticketId
      });

      setTitle("");
      setDescription("");
      setType("issue");
      setShowCreate(false);
      setMessage(`Ticket ${ticketId} submitted.`);
      await loadTickets();
    } catch (err) {
      console.error("Failed to submit ticket:", err);
      setError(err?.message || "Unable to submit ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  const loadComments = async (ticketId) => {
    setCommentsLoading((current) => ({
      ...current,
      [ticketId]: true
    }));

    try {
      const snapshot = await getDocs(
        collection(db, "issues", ticketId, "comments")
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
        [ticketId]: items
      }));
    } catch (err) {
      console.error("Failed to load ticket comments:", err);
      setError(err?.message || "Unable to load comments.");
    } finally {
      setCommentsLoading((current) => ({
        ...current,
        [ticketId]: false
      }));
    }
  };

  const toggleTicket = async (ticketId) => {
    const next = expanded === ticketId ? null : ticketId;
    setExpanded(next);

    if (next) {
      await loadComments(next);
    }
  };

  const statusLabel = (status) =>
    TICKET_STATUSES.find(([value]) => value === status)?.[1] ||
    "Open";

  const statusClass = (status) => {
    if (status === "closed" || status === "resolved") {
      return dark
        ? "bg-neutral-800 text-neutral-300"
        : "bg-neutral-100 text-neutral-600";
    }

    if (status === "in_progress") {
      return dark
        ? "bg-amber-950 text-amber-300"
        : "bg-amber-50 text-amber-700";
    }

    return dark
      ? "bg-blue-950 text-blue-300"
      : "bg-blue-50 text-blue-700";
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
              <Ticket size={22} strokeWidth={1.5} />
              <h1 className="text-2xl font-medium tracking-wide">Tickets</h1>
            </div>
            <p className={`mt-2 text-sm ${mutedClass}`}>
              Create and track your support tickets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadTickets}
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
              New ticket
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
            onSubmit={submitTicket}
            className={`mt-6 rounded border p-5 sm:p-6 ${cardClass}`}
          >
            <h2 className="font-semibold">Create ticket</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <label className="block">
                <span className="block text-xs font-semibold mb-2">
                  Type
                </span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={`w-full rounded border px-3 py-2 text-sm ${inputClass}`}
                >
                  <option value="issue">Issue</option>
                  <option value="feature">Feature request</option>
                </select>
              </label>

              <label className="block">
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
            </div>

            <label className="block mt-4">
              <span className="block text-xs font-semibold mb-2">
                Title
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full rounded border px-3 py-2 text-sm ${inputClass}`}
                placeholder="Short description"
              />
            </label>

            <label className="block mt-4">
              <span className="block text-xs font-semibold mb-2">
                Message
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={7}
                className={`w-full rounded border px-3 py-2 text-sm resize-y ${inputClass}`}
                placeholder="Describe the issue or feature request..."
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
                {submitting ? "Submitting…" : "Submit ticket"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 space-y-3">
          {loading ? (
            <div className={`rounded border p-6 ${cardClass}`}>
              <p className={`text-sm ${mutedClass}`}>Loading tickets…</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className={`rounded border p-8 text-center ${cardClass}`}>
              <Ticket
                size={30}
                strokeWidth={1.25}
                className={`mx-auto ${mutedClass}`}
              />
              <h2 className="mt-4 font-semibold">No tickets yet</h2>
              <p className={`mt-2 text-sm ${mutedClass}`}>
                Create a ticket when you need help or want to request a feature.
              </p>
            </div>
          ) : (
            tickets.map((ticket) => {
              const isOpen = expanded === ticket.id;

              return (
                <div
                  key={ticket.id}
                  className={`rounded border overflow-hidden ${cardClass}`}
                >
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs">
                            {ticket.issueId || ticket.id}
                          </span>

                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide ${statusClass(
                              ticket.status
                            )}`}
                          >
                            {statusLabel(ticket.status)}
                          </span>
                        </div>

                        <h2 className="mt-2 font-semibold">
                          {ticket.title || "Untitled ticket"}
                        </h2>

                        <p className={`mt-1 text-xs ${mutedClass}`}>
                          {ticket.componentName || "Unknown component"}
                          {" · "}
                          {ticket.type === "feature"
                            ? "Feature request"
                            : "Issue"}
                          {" · "}
                          {formatTimestamp(ticket.createdAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleTicket(ticket.id)}
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
                          {ticket.description}
                        </div>

                        <div className="mt-6">
                          <h3 className="text-xs font-semibold uppercase tracking-wider">
                            Admin comments
                          </h3>

                          {commentsLoading[ticket.id] ? (
                            <p className={`mt-3 text-sm ${mutedClass}`}>
                              Loading comments…
                            </p>
                          ) : comments[ticket.id]?.length ? (
                            <div className="mt-3 space-y-3">
                              {comments[ticket.id].map((comment) => (
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
