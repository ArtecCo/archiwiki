import React, { useState } from "react";
import { Folder, FileText, ChevronRight, ChevronDown, Plus, Trash2, Edit2, Search } from "lucide-react";

export default function Sidebar({
  folders,
  notes,
  activeNoteId,
  onSelectNote,
  onCreateFolder,
  onCreateNote,
  onRenameFolder,
  onDeleteFolder,
  onMoveItem, // (itemId, itemType, targetFolderId)
  onDeleteNote
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState({});
  const [contextMenu, setContextMenu] = useState(null); // { x, y, folderId }

  const toggleFolder = (id) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Drag and Drop implementation details
  const handleDragStart = (e, id, type) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ id, type }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetFolderId) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      onMoveItem(data.id, data.type, targetFolderId);
    } catch (err) {
      console.error("Drop parsed incorrectly", err);
    }
  };

  const showContextMenu = (e, folderId) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      folderId
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Render Folders Recursively
  const renderFolderNode = (folderId, level = 0) => {
    const currentFolder = folders.find(f => f.id === folderId);
    if (!currentFolder) return null;

    const childFolders = folders.filter(f => f.parentId === folderId);
    const childNotes = notes.filter(n => n.folderId === folderId);
    const isExpanded = !!expandedFolders[folderId];

    return (
      <div 
        key={folderId} 
        style={{ paddingLeft: `${level * 8}px` }}
        className="select-none"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, folderId)}
      >
        {/* Folder Header */}
        <div 
          className="group flex items-center justify-between py-1 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer border border-transparent"
          onClick={() => toggleFolder(folderId)}
          onContextMenu={(e) => showContextMenu(e, folderId)}
          draggable
          onDragStart={(e) => handleDragStart(e, folderId, "folder")}
        >
          <div className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200">
            {isExpanded ? <ChevronDown size={14} className="text-neutral-400" /> : <ChevronRight size={14} className="text-neutral-400" />}
            <Folder size={14} className="text-neutral-500 fill-neutral-200 dark:fill-transparent" />
            <span className="text-sm font-medium truncate max-w-[130px]">{currentFolder.name}</span>
          </div>
          
          <div className="hidden group-hover:flex items-center gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onCreateNote(folderId); }}
              title="New File"
              className="p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-neutral-500"
            >
              <Plus size={12} />
            </button>
          </div>
        </div>

        {/* Folder Children */}
        {isExpanded && (
          <div className="border-l border-neutral-200 dark:border-neutral-800 ml-3.5 my-0.5">
            {childFolders.map(child => renderFolderNode(child.id, level + 1))}
            {childNotes.map(note => (
              <div
                key={note.id}
                draggable
                onDragStart={(e) => handleDragStart(e, note.id, "note")}
                onClick={() => onSelectNote(note.id)}
                className={`flex items-center justify-between py-1 px-3 ml-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer text-sm ${
                  activeNoteId === note.id 
                    ? "bg-neutral-200/70 dark:bg-neutral-800/80 font-medium text-neutral-900 dark:text-neutral-100" 
                    : "text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <FileText size={13} className="text-neutral-400" />
                  <span className="truncate max-w-[140px]">{note.title || "Untitled"}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = folders.filter(f => !f.parentId);
  const rootNotes = notes.filter(n => !n.folderId);

  // Filter notes and directories if searching
  const filteredNotes = notes.filter(n => 
    n.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    n.body?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      className="w-64 h-full flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 select-none text-neutral-700 dark:text-neutral-300"
      onClick={closeContextMenu}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-lg font-semibold tracking-wider font-serif text-neutral-900 dark:text-neutral-100">SCRIBE</h2>
      </div>

      {/* Directory Actions */}
      <div className="p-3 flex gap-2">
        <button 
          onClick={() => onCreateFolder(null)}
          className="flex-1 py-1 px-2 flex items-center justify-center gap-1.5 text-xs font-medium border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <Folder size={12} /> + Folder
        </button>
        <button 
          onClick={() => onCreateNote(null)}
          className="flex-1 py-1 px-2 flex items-center justify-center gap-1.5 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 rounded hover:bg-neutral-800 dark:hover:bg-neutral-200"
        >
          <FileText size={12} /> + Note
        </button>
      </div>

      {/* Search Interface */}
      <div className="px-3 pb-2 relative">
        <span className="absolute left-5 top-2 text-neutral-400">
          <Search size={13} />
        </span>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search encrypted notes..."
          className="w-full text-xs pl-8 pr-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded focus:outline-none focus:ring-1 focus:ring-neutral-400"
        />
      </div>

      {/* Main Folder Directory Tree View */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {searchQuery ? (
          <div>
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 px-2 mb-2">Search Results</h3>
            {filteredNotes.map(note => (
              <div
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                className="flex items-center gap-1.5 py-1 px-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer text-sm text-neutral-600 dark:text-neutral-400"
              >
                <FileText size={13} />
                <span className="truncate">{note.title}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {rootFolders.map(folder => renderFolderNode(folder.id))}
            
            {/* Root-level Notes */}
            {rootNotes.length > 0 && (
              <div className="mt-4 border-t border-neutral-100 dark:border-neutral-800 pt-2">
                <h3 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 px-2 mb-1.5">Unsorted Notes</h3>
                {rootNotes.map(note => (
                  <div
                    key={note.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, note.id, "note")}
                    onClick={() => onSelectNote(note.id)}
                    className={`flex items-center gap-1.5 py-1 px-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded cursor-pointer text-sm ${
                      activeNoteId === note.id 
                        ? "bg-neutral-200/70 dark:bg-neutral-800/80 font-medium text-neutral-900 dark:text-neutral-100" 
                        : "text-neutral-600 dark:text-neutral-400"
                    }`}
                  >
                    <FileText size={13} className="text-neutral-400" />
                    <span className="truncate">{note.title || "Untitled"}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div 
          className="absolute z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg rounded py-1 w-40 text-xs"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={() => { onRenameFolder(contextMenu.folderId); closeContextMenu(); }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Edit2 size={11} /> Rename Folder
          </button>
          <button 
            onClick={() => { onDeleteFolder(contextMenu.folderId); closeContextMenu(); }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5"
          >
            <Trash2 size={11} /> Delete Recursively
          </button>
          <button 
            onClick={() => { onCreateFolder(contextMenu.folderId); closeContextMenu(); }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Folder size={11} /> Create Subfolder
          </button>
        </div>
      )}
    </div>
  );
}
