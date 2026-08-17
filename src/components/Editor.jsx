import React, { useState, useEffect, useRef } from "react";
import { marked } from "marked";
import { Eye, Edit, Save, BookOpen, Download, AlertTriangle, FileText } from "lucide-react";
import { acquireLock, releaseLock } from "../firebase";

export default function Editor({
  note,
  onSaveNote,
  notesPool, // All decrypted notes in the system for wiki-link detection
  userId,
  fontSize,
  setFontSize,
  onNavigateToNote
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lockStatus, setLockStatus] = useState({ success: true, lockedBy: null });
  const [wikiSuggest, setWikiSuggest] = useState(null); // { query, list: [], index: 0, pos: { top: 0, left: 0 } }
  
  const textareaRef = useRef(null);
  const sessionToken = useRef(Math.random().toString(36).substring(2)).current;

  // Initialize values when selecting a new note
  useEffect(() => {
    if (note) {
      setTitle(note.title || "");
      setBody(note.body || "");
      setIsEditing(false);
      checkAndAcquireLock();
    }
    return () => {
      if (note) releaseLock(note.id, sessionToken);
    };
  }, [note?.id]);

  // Maintain heartbeat to keep lock fresh (every 60 seconds)
  useEffect(() => {
    if (!note || !isEditing) return;
    const interval = setInterval(() => {
      acquireLock(note.id, userId, sessionToken);
    }, 60000);
    return () => clearInterval(interval);
  }, [note?.id, isEditing]);

  const checkAndAcquireLock = async () => {
    const res = await acquireLock(note.id, userId, sessionToken);
    setLockStatus(res);
    if (!res.success) {
      setIsEditing(false); // Force read-only mode if locked elsewhere
    }
  };

  const handleTextareaChange = (e) => {
    const value = e.target.value;
    setBody(value);
    checkForWikiTrigger(e);
  };

  // Watch for [[ trigger to supply Obsidian autocomplete options
  const checkForWikiTrigger = (e) => {
    const selectionEnd = e.target.selectionEnd;
    const textBeforeCursor = e.target.value.substring(0, selectionEnd);
    const lastOpenIndex = textBeforeCursor.lastIndexOf("[[");

    if (lastOpenIndex !== -1 && lastOpenIndex >= textBeforeCursor.lastIndexOf("]]")) {
      const query = textBeforeCursor.substring(lastOpenIndex + 2);
      const candidates = notesPool.filter(n => 
        n.id !== note.id && 
        n.title.toLowerCase().startsWith(query.toLowerCase())
      );
      
      if (candidates.length > 0) {
        // Simple mock position calculation for suggestion menu
        const coords = getCaretCoordinates(e.target, lastOpenIndex);
        setWikiSuggest({
          query,
          list: candidates,
          index: 0,
          pos: { top: coords.top + 24, left: coords.left }
        });
        return;
      }
    }
    setWikiSuggest(null);
  };

  // Key handlers inside autocomplete panel
  const handleKeyDown = (e) => {
    if (wikiSuggest) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setWikiSuggest(prev => ({ ...prev, index: (prev.index + 1) % prev.list.length }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setWikiSuggest(prev => ({ ...prev, index: (prev.index - 1 + prev.list.length) % prev.list.length }));
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertWikiLink(wikiSuggest.list[wikiSuggest.index].title);
      } else if (e.key === "Escape") {
        setWikiSuggest(null);
      }
    }
  };

  const insertWikiLink = (linkedTitle) => {
    const cursor = textareaRef.current.selectionEnd;
    const beforeText = body.substring(0, cursor);
    const lastOpenIndex = beforeText.lastIndexOf("[[");
    const afterText = body.substring(cursor);

    const updatedBody = beforeText.substring(0, lastOpenIndex) + `[[${linkedTitle}]]` + afterText;
    setBody(updatedBody);
    setWikiSuggest(null);
    textareaRef.current.focus();
  };

  // Generate simple character-level visual coordinate offsets
  const getCaretCoordinates = (element, pos) => {
    const { offsetLeft, offsetTop } = element;
    return { top: offsetTop, left: offsetLeft + 20 };
  };

  // Generate stats calculations
  const calculateMetrics = () => {
    const words = body.trim() ? body.trim().split(/\s+/).length : 0;
    const lines = body.split("\n").length;
    const headers = (body.match(/^#{1,6}\s+/gm) || []).length;
    const readingTime = Math.ceil(words / 200); // 200 words per minute average
    return { words, lines, headers, readingTime };
  };

  // Parse custom [[Wiki Links]] into inline clickable buttons
  const parseWikiLinks = (rawMarkdown) => {
    const renderedHtml = marked.parse(rawMarkdown);
    return renderedHtml.replace(/\[\[(.*?)\]\]/g, (match, title) => {
      const matchNote = notesPool.find(n => n.title.trim().toLowerCase() === title.trim().toLowerCase());
      if (matchNote) {
        return `<span class="wiki-link underline cursor-pointer text-neutral-900 font-semibold" data-note-id="${matchNote.id}">${title}</span>`;
      }
      return `<span class="text-neutral-400 line-through">${title}</span>`;
    });
  };

  const handleHtmlClick = (e) => {
    const target = e.target;
    if (target.classList.contains("wiki-link")) {
      const targetId = target.getAttribute("data-note-id");
      if (targetId) onNavigateToNote(targetId);
    }
  };

  // Export current note strictly formatted as a clean PDF via native print rules
  const triggerPdfPrint = () => {
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        body * { display: none; }
        #print-container, #print-container * { display: block !important; }
        #print-container { position: absolute; left: 0; top: 0; width: 100%; font-family: 'Georgia', serif; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  const { words, lines, headers, readingTime } = calculateMetrics();

  // Find backlink notes referencing current note
  const backlinks = notesPool.filter(n => n.id !== note?.id && n.body?.includes(`[[${note?.title}]]`));

  if (!note) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F5F2EB] text-[#202122] font-serif p-12">
        <BookOpen size={48} className="stroke-1 text-neutral-400 mb-4" />
        <p className="text-xl italic">Select a manuscript or folder to begin editing.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F5F2EB] text-[#202122]">
      {/* Editor Context Menu */}
      <div className="flex items-center justify-between border-b border-neutral-300 px-6 py-3 bg-neutral-100/50">
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <span className="font-serif italic font-medium">Scribe</span>
          <span>&gt;</span>
          <span className="font-semibold">{note.title || "Untitled"}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Custom font sizing adjuster */}
          <div className="flex items-center gap-2 text-xs">
            <span>Size:</span>
            <input 
              type="range" 
              min="14" 
              max="24" 
              value={fontSize} 
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-20 accent-neutral-900 bg-neutral-200 h-1 rounded-lg cursor-pointer"
            />
            <span className="w-8">{fontSize}px</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={triggerPdfPrint}
              title="Print / Save PDF"
              className="p-1.5 hover:bg-neutral-200 rounded text-neutral-600 flex items-center gap-1 text-xs"
            >
              <Download size={14} /> PDF
            </button>

            {lockStatus.success ? (
              <button
                onClick={() => {
                  if (isEditing) {
                    onSaveNote(note.id, title, body);
                  }
                  setIsEditing(!isEditing);
                }}
                className="py-1 px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {isEditing ? <><Save size={12} /> Save</> : <><Edit size={12} /> Edit</>}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-200 text-neutral-700 rounded text-xs font-semibold">
                <AlertTriangle size={12} /> Read-Only
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Concurrent User Locked Notification */}
      {!lockStatus.success && (
        <div className="bg-neutral-200 text-neutral-800 text-xs px-6 py-2 border-b border-neutral-300 flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>This manuscript is currently being written on another active device by user [{lockStatus.lockedBy}]. Access is temporarily restricted to Read Only.</span>
        </div>
      )}

      {/* Working Desk layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Workspace Frame */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto" style={{ fontSize: `${fontSize}px` }}>
          {isEditing ? (
            <div className="flex-1 flex flex-col gap-4 relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title your note"
                className="w-full bg-transparent border-b border-neutral-300 pb-2 focus:outline-none focus:border-neutral-800 font-serif font-bold text-2xl tracking-wide placeholder-neutral-300"
              />
              <textarea
                ref={textareaRef}
                value={body}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Write your thoughts... Type '[[' to link pages."
                className="flex-1 w-full bg-transparent resize-none focus:outline-none font-mono focus:ring-0 leading-relaxed text-neutral-800"
              />

              {/* Wiki-link autocomplete dropdown list */}
              {wikiSuggest && (
                <div 
                  className="absolute z-50 bg-white border border-neutral-300 rounded shadow-lg p-1 w-64 max-h-48 overflow-y-auto text-xs font-sans"
                  style={{ top: `${wikiSuggest.pos.top}px`, left: `${wikiSuggest.pos.left}px` }}
                >
                  <p className="px-2 py-1 text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Connect note</p>
                  {wikiSuggest.list.map((item, idx) => (
                    <div
                      key={item.id}
                      onClick={() => insertWikiLink(item.title)}
                      className={`px-3 py-1.5 cursor-pointer rounded flex items-center gap-1.5 ${
                        idx === wikiSuggest.index ? "bg-neutral-100 font-semibold" : "hover:bg-neutral-50"
                      }`}
                    >
                      <FileText size={12} />
                      <span className="truncate">{item.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Clean Reading Mode with Georgia font & subtle system margins
            <div 
              id="print-container"
              className="flex-1 prose max-w-2xl mx-auto font-serif leading-loose"
              onClick={handleHtmlClick}
            >
              <h1 className="text-3xl font-bold border-b border-neutral-300 pb-4 mb-6 tracking-wide">{title || "Untitled Note"}</h1>
              <div 
                className="text-neutral-800"
                dangerouslySetInnerHTML={{ __html: parseWikiLinks(body) }} 
              />
            </div>
          )}
        </div>

        {/* Backlink panel sidebar */}
        <div className="w-56 border-l border-neutral-300 bg-neutral-100/30 p-4 flex flex-col gap-4 text-xs font-sans">
          <h4 className="font-bold uppercase tracking-wider text-neutral-500 text-[10px]">Backlinks ({backlinks.length})</h4>
          <div className="flex-1 overflow-y-auto space-y-2">
            {backlinks.length > 0 ? (
              backlinks.map(b => (
                <div 
                  key={b.id} 
                  onClick={() => onNavigateToNote(b.id)}
                  className="p-2 border border-neutral-200 hover:border-neutral-400 bg-white rounded cursor-pointer transition-colors"
                >
                  <p className="font-semibold text-neutral-900 truncate">{b.title}</p>
                  <p className="text-[10px] text-neutral-500 truncate">{b.body}</p>
                </div>
              ))
            ) : (
              <p className="text-neutral-400 italic">No connections link here yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Editor Status Bar */}
      <div className="border-t border-neutral-300 bg-neutral-100/80 px-6 py-1.5 flex justify-between items-center text-[11px] font-sans text-neutral-500">
        <div className="flex gap-4">
          <span>Words: <strong>{words}</strong></span>
          <span>Lines: <strong>{lines}</strong></span>
          <span>Headers: <strong>{headers}</strong></span>
        </div>
        <div className="flex gap-4">
          <span>Read Time: ~<strong>{readingTime} min</strong></span>
          <span>Status: <strong className="text-neutral-700">Encrypted AES-256</strong></span>
        </div>
      </div>
    </div>
  );
}
