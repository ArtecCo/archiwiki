import React, { useState } from "react";
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Search
} from "lucide-react";

export default function Sidebar({
  folders,
  notes,
  activeNoteId,
  onSelectNote,
  onCreateFolder,
  onCreateNote,
  onRenameFolder,
  onDeleteFolder,
  onMoveItem,
  onDeleteNote
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState({});
  const [contextMenu, setContextMenu] = useState(null);

  const toggleFolder = (id) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // -----------------------------
  // Drag and Drop
  // -----------------------------

  const handleDragStart = (e, id, type) => {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ id, type })
    );
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetFolderId) => {
    e.preventDefault();

    try {
      const data = JSON.parse(
        e.dataTransfer.getData("text/plain")
      );

      onMoveItem(
        data.id,
        data.type,
        targetFolderId
      );
    } catch (err) {
      console.error("Drop parsed incorrectly", err);
    }
  };

  // -----------------------------
  // Context Menu
  // -----------------------------

  const showContextMenu = (e, folderId) => {
    e.preventDefault();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      folderId
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // -----------------------------
  // Delete Note
  // -----------------------------

  const handleDeleteNote = (e, noteId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!noteId) return;

    onDeleteNote(noteId);
  };

  // -----------------------------
  // Recursive Folder Renderer
  // -----------------------------

  const renderFolderNode = (folderId, level = 0) => {
    const currentFolder = folders.find(
      (f) => f.id === folderId
    );

    if (!currentFolder) return null;

    const childFolders = folders.filter(
      (f) => f.parentId === folderId
    );

    const childNotes = notes.filter(
      (n) => n.folderId === folderId
    );

    const isExpanded = !!expandedFolders[folderId];

    return (
      <div
        key={folderId}
        style={{
          paddingLeft: `${level * 8}px`
        }}
        className="select-none"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, folderId)}
      >
        {/* Folder Header */}

        <div
          className="group flex items-center justify-between py-1 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer border border-transparent"
          onClick={() => toggleFolder(folderId)}
          onContextMenu={(e) =>
            showContextMenu(e, folderId)
          }
          draggable
          onDragStart={(e) =>
            handleDragStart(e, folderId, "folder")
          }
        >
          <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200 min-w-0">
            {isExpanded ? (
              <ChevronDown
                size={14}
                className="text-neutral-400 shrink-0"
              />
            ) : (
              <ChevronRight
                size={14}
                className="text-neutral-400 shrink-0"
              />
            )}

            <Folder
              size={14}
              className="text-neutral-500 fill-neutral-200 dark:fill-transparent shrink-0"
            />

            <span className="text-sm font-medium truncate max-w-[130px]">
              {currentFolder.name}
            </span>
          </div>

          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateNote(folderId);
              }}
              title="New note in folder"
              className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-neutral-500"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Folder Children */}

        {isExpanded && (
          <div className="border-l border-neutral-200 dark:border-neutral-800 ml-3.5 my-0.5">
            {childFolders.map((child) =>
              renderFolderNode(
                child.id,
                level + 1
              )
            )}

            {childNotes.map((note) => (
              <div
                key={note.id}
                draggable
                onDragStart={(e) =>
                  handleDragStart(
                    e,
                    note.id,
                    "note"
                  )
                }
                onClick={() =>
                  onSelectNote(note.id)
                }
                className={`group flex items-center justify-between gap-2 py-1 px-3 ml-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer text-sm ${
                  activeNoteId === note.id
                    ? "bg-neutral-200/70 dark:bg-neutral-800/80 font-medium text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate min-w-0">
                  <FileText
                    size={13}
                    className="text-neutral-400 shrink-0"
                  />

                  <span className="truncate">
                    {note.title || "Untitled"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) =>
                    handleDeleteNote(
                      e,
                      note.id
                    )
                  }
                  title="Delete note"
                  aria-label="Delete note"
                  className="shrink-0 p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // -----------------------------
  // Root Data
  // -----------------------------

  const rootFolders = folders.filter(
    (f) => !f.parentId
  );

  const rootNotes = notes.filter(
    (n) => !n.folderId
  );

  const filteredNotes = notes.filter((n) => {
    const query = searchQuery.toLowerCase();

    return (
      n.title?.toLowerCase().includes(query) ||
      n.body?.toLowerCase().includes(query)
    );
  });

  // -----------------------------
  // Render
  // -----------------------------

  return (
    <div
      className="w-64 h-full flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 select-none text-neutral-700 dark:text-neutral-300"
      onClick={closeContextMenu}
    >
      {/* Brand */}

      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-lg font-semibold tracking-wider font-serif text-neutral-900 dark:text-neutral-100">
          SCRIBE
        </h2>
      </div>

      {/* Directory Actions */}

      <div className="p-3 flex gap-2">
        <button
          type="button"
          onClick={() =>
            onCreateFolder(null)
          }
          className="flex-1 py-1 px-2 flex items-center justify-center gap-1.5 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <Folder size={12} />
          + Folder
        </button>

        <button
          type="button"
          onClick={() =>
            onCreateNote(null)
          }
          className="flex-1 py-1 px-2 flex items-center justify-center gap-1.5 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded hover:bg-neutral-800 dark:hover:bg-neutral-200"
        >
          <FileText size={12} />
          + Note
        </button>
      </div>

      {/* Search */}

      <div className="px-3 pb-2 relative">
        <span className="absolute left-5 top-2 text-neutral-400">
          <Search size={13} />
        </span>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) =>
            setSearchQuery(e.target.value)
          }
          placeholder="Search encrypted notes..."
          className="w-full text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
      </div>

      {/* Directory Tree */}

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {searchQuery ? (
          <div>
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 px-2 mb-2">
              Search Results
            </h3>

            {filteredNotes.length === 0 ? (
              <p className="text-xs text-neutral-400 px-3 py-2">
                No notes found.
              </p>
            ) : (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() =>
                    onSelectNote(note.id)
                  }
                  className={`group flex items-center justify-between gap-2 py-1 px-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer text-sm ${
                    activeNoteId === note.id
                      ? "bg-neutral-200/70 dark:bg-neutral-800/80 font-medium text-neutral-900 dark:text-neutral-100"
                      : "text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate min-w-0">
                    <FileText
                      size={13}
                      className="shrink-0"
                    />

                    <span className="truncate">
                      {note.title || "Untitled"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) =>
                      handleDeleteNote(
                        e,
                        note.id
                      )
                    }
                    title="Delete note"
                    aria-label="Delete note"
                    className="shrink-0 p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {rootFolders.map((folder) =>
              renderFolderNode(folder.id)
            )}

            {/* Root Notes */}

            {rootNotes.length > 0 && (
              <div className="mt-4 border-t border-neutral-100 dark:border-neutral-800 pt-2">
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 px-2 mb-1.5">
                  Unsorted Notes
                </h3>

                {rootNotes.map((note) => (
                  <div
                    key={note.id}
                    draggable
                    onDragStart={(e) =>
                      handleDragStart(
                        e,
                        note.id,
                        "note"
                      )
                    }
                    onClick={() =>
                      onSelectNote(note.id)
                    }
                    className={`group flex items-center justify-between gap-2 py-1 px-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer text-sm ${
                      activeNoteId === note.id
                        ? "bg-neutral-200/70 dark:bg-neutral-800/80 font-medium text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate min-w-0">
                      <FileText
                        size={13}
                        className="text-neutral-400 shrink-0"
                      />

                      <span className="truncate">
                        {note.title || "Untitled"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) =>
                        handleDeleteNote(
                          e,
                          note.id
                        )
                      }
                      title="Delete note"
                      aria-label="Delete note"
                      className="shrink-0 p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Folder Context Menu */}

      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg rounded py-1 w-40 text-xs"
          style={{
            top: contextMenu.y,
            left: contextMenu.x
          }}
          onClick={(e) =>
            e.stopPropagation()
          }
        >
          <button
            type="button"
            onClick={() => {
              onRenameFolder(
                contextMenu.folderId
              );
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Edit2 size={11} />
            Rename Folder
          </button>

          <button
            type="button"
            onClick={() => {
              onDeleteFolder(
                contextMenu.folderId
              );
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5"
          >
            <Trash2 size={11} />
            Delete Recursively
          </button>

          <button
            type="button"
            onClick={() => {
              onCreateFolder(
                contextMenu.folderId
              );
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Folder size={11} />
            Create Subfolder
          </button>
        </div>
      )}
    </div>
  );
}
