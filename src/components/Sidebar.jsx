import React, { useEffect, useState } from "react";
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
  theme = "beige",
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

  const themeClasses = {
    beige: {
      shell: "border-[#E6E1D3] bg-[#EFEADF] text-neutral-700",
      brand: "border-[#E6E1D3]",
      brandText: "text-neutral-900",
      itemHover: "hover:bg-[#E8E1D2]",
      activeItem: "bg-[#E2D9C8] font-medium text-neutral-900",
      idleItem: "text-neutral-600",
      folderText: "text-neutral-800",
      folderFill: "fill-[#E2D9C8]",
      button: "border-[#D8CDBA] hover:bg-[#E8E1D2]",
      primaryButton: "bg-neutral-900 text-neutral-100 hover:bg-neutral-800",
      input: "bg-[#F5F2EB] border-[#D8CDBA] focus:ring-neutral-400",
      divider: "border-[#E6E1D3]",
      menu: "bg-[#F5F2EB] border-[#D8CDBA]",
      menuText: "text-neutral-700"
    },
    wikipedia: {
      shell: "border-neutral-200 bg-neutral-50 text-neutral-700",
      brand: "border-neutral-200",
      brandText: "text-neutral-900",
      itemHover: "hover:bg-neutral-100",
      activeItem: "bg-neutral-200/70 font-medium text-neutral-900",
      idleItem: "text-neutral-600",
      folderText: "text-neutral-800",
      folderFill: "fill-neutral-200",
      button: "border-neutral-300 hover:bg-neutral-100",
      primaryButton: "bg-neutral-900 text-neutral-100 hover:bg-neutral-800",
      input: "bg-white border-neutral-200 focus:ring-neutral-400",
      divider: "border-neutral-100",
      menu: "bg-white border-neutral-200",
      menuText: "text-neutral-700"
    },
    charcoal: {
      shell: "border-neutral-800 bg-neutral-950 text-neutral-300",
      brand: "border-neutral-800",
      brandText: "text-neutral-100",
      itemHover: "hover:bg-neutral-800",
      activeItem: "bg-neutral-800/80 font-medium text-neutral-100",
      idleItem: "text-neutral-400",
      folderText: "text-neutral-200",
      folderFill: "fill-transparent",
      button: "border-neutral-700 hover:bg-neutral-800",
      primaryButton: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
      input: "bg-neutral-900 border-neutral-800 focus:ring-neutral-500",
      divider: "border-neutral-800",
      menu: "bg-neutral-900 border-neutral-800",
      menuText: "text-neutral-200"
    }
  };

  const colors = themeClasses[theme] || themeClasses.beige;


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
    // A nested folder is also inside each ancestor's drop zone. Prevent the
    // event from bubbling so the note is moved only to the folder it was
    // dropped on, rather than being moved again to a parent folder.
    e.stopPropagation();

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
          className={`group flex items-center justify-between py-1 px-2 ${colors.itemHover} rounded cursor-pointer border border-transparent`}
          onClick={() => toggleFolder(folderId)}
          onContextMenu={(e) =>
            showContextMenu(e, folderId)
          }
          draggable
          onDragStart={(e) =>
            handleDragStart(e, folderId, "folder")
          }
        >
          <div className={`flex items-center gap-1.5 ${colors.folderText} min-w-0`}>
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
              className={`text-neutral-500 ${colors.folderFill} shrink-0`}
            />

            <span className="text-sm font-medium truncate max-w-[130px]">
              {currentFolder.name}
            </span>
          </div>

          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedFolders((prev) => ({
                  ...prev,
                  [folderId]: true
                }));
                onCreateNote(folderId);
              }}
              title="New note in folder"
              className={`p-1 ${colors.itemHover} rounded text-neutral-500`}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Folder Children */}

        {isExpanded && (
          <div className={`border-l ${colors.divider} ml-3.5 my-0.5`}>
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
                className={`group flex items-center justify-between gap-2 py-1 px-3 ml-2 ${colors.itemHover} rounded cursor-pointer text-sm ${
                  activeNoteId === note.id
                    ? colors.activeItem
                    : colors.idleItem
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

  const folderIds = new Set(folders.map((folder) => folder.id));
  const rootNotes = notes.filter(
    (note) => !note.folderId || !folderIds.has(note.folderId)
  );

  const searchTerm = searchQuery.trim().toLowerCase();

const filteredNotes = notes.filter((note) =>
  note.title?.toLowerCase().includes(searchTerm) ||
  note.body?.toLowerCase().includes(searchTerm)
);

const filteredFolders = folders.filter((folder) =>
  folder.name?.toLowerCase().includes(searchTerm)
);

  // -----------------------------
  // Render
  // -----------------------------

  return (
    <div
      className={`w-64 h-full flex flex-col border-r select-none ${colors.shell}`}
      onClick={closeContextMenu}
    >
      {/* Brand */}

      <div className={`p-4 border-b ${colors.brand}`}>
        <h2 className={`text-lg font-semibold tracking-wider font-archi ${colors.brandText}`}>
          ArchiWiki
        </h2>
      </div>

      {/* Directory Actions */}

      <div className="p-3 flex gap-2">
        <button
          type="button"
          onClick={() =>
            onCreateFolder(null)
          }
          className={`flex-1 py-1 px-2 flex items-center justify-center gap-1.5 text-xs font-medium border rounded ${colors.button}`}
        >
          <Folder size={12} />
          + Folder
        </button>

        <button
          type="button"
          onClick={() =>
            onCreateNote(null)
          }
          className={`flex-1 py-1 px-2 flex items-center justify-center gap-1.5 text-xs font-medium rounded ${colors.primaryButton}`}
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
          className={`w-full text-xs pl-8 pr-3 py-1.5 border rounded focus:outline-none focus:ring-1 ${colors.input}`}
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
                  className={`group flex items-center justify-between gap-2 py-1 px-3 ${colors.itemHover} rounded cursor-pointer text-sm ${
                    activeNoteId === note.id
                      ? colors.activeItem
                      : colors.idleItem
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
              <div className={`mt-4 border-t ${colors.divider} pt-2`}>
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
                    className={`group flex items-center justify-between gap-2 py-1 px-3 ${colors.itemHover} rounded cursor-pointer text-sm ${
                      activeNoteId === note.id
                        ? colors.activeItem
                        : colors.idleItem
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
          className={`fixed z-50 border shadow-lg rounded py-1 w-40 text-xs ${colors.menu}`}
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
            className={`w-full text-left px-3 py-1.5 ${colors.itemHover} flex items-center gap-1.5 ${colors.menuText}`}
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
            className={`w-full text-left px-3 py-1.5 ${colors.itemHover} ${colors.menuText} flex items-center gap-1.5`}
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
            className={`w-full text-left px-3 py-1.5 ${colors.itemHover} flex items-center gap-1.5 ${colors.menuText}`}
          >
            <Folder size={11} />
            Create Subfolder
          </button>
        </div>
      )}
    </div>
  );
}
