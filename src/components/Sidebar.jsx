import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";
import { updateDoc, doc } from "firebase/firestore";
import { encryptData } from "../crypto";
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Search,
  Bell,
  Megaphone,
  Info,
  AlertTriangle,
  AlertCircle
} from "lucide-react";

const sidebarAnimationStyles = `
  @keyframes archiwikiSidebarItemIn {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .archiwiki-sidebar-item { animation: archiwikiSidebarItemIn 280ms ease-out both; animation-delay: var(--archiwiki-delay, 0ms); }
  @media (prefers-reduced-motion: reduce) { .archiwiki-sidebar-item { animation: none; } }
`;

export default function Sidebar({
  theme = "beige", folders, notes, activeNoteId,
  onSelectNote, onCreateFolder, onCreateNote,
  onRenameFolder, onDeleteFolder, onMoveItem, onDeleteNote,
  notification = null
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState(() => ({}));
  const [contextMenu, setContextMenu] = useState(null);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const { masterKey } = useAuth();

  // Restore every ancestor of the selected note using the actual React state.
  // This works even though collapsed folders do not render their children.
  useEffect(() => {
    if (!activeNoteId || !folders.length) return;

    const activeNote = notes.find((note) => note.id === activeNoteId);
    if (!activeNote?.folderId) return;

    const ancestors = new Set();
    let folderId = activeNote.folderId;
    const visited = new Set();

    while (folderId && !visited.has(folderId)) {
      visited.add(folderId);
      const folder = folders.find((item) => item.id === folderId);
      if (!folder) break;
      ancestors.add(folder.id);
      folderId = folder.parentId || null;
    }

    if (!ancestors.size) return;

    setExpandedFolders((prev) => {
      let changed = false;
      const next = { ...prev };
      ancestors.forEach((id) => {
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [activeNoteId, notes, folders]);

  useEffect(() => {
  if (!contextMenu) return;

  const handleOutsideClick = (event) => {
    const menu = event.target.closest(".archiwiki-context-menu");

    // Clicking inside the context menu should NOT close it.
    if (menu) return;

    setContextMenu(null);
    setMoveMenuOpen(false);
  };

  document.addEventListener("mousedown", handleOutsideClick);

  return () => {
    document.removeEventListener("mousedown", handleOutsideClick);
  };
}, [contextMenu]);

  const themeClasses = {
    beige: { shell:"border-[#E6E1D3] bg-[#EFEADF] text-neutral-700", brand:"border-[#E6E1D3]", brandText:"text-neutral-900", itemHover:"hover:bg-[#E8E1D2]", activeItem:"bg-[#E2D9C8] font-medium text-neutral-900", idleItem:"text-neutral-600", folderText:"text-neutral-800", folderFill:"fill-[#E2D9C8]", button:"border-[#D8CDBA] hover:bg-[#E8E1D2]", primaryButton:"bg-neutral-900 text-neutral-100 hover:bg-neutral-800", input:"bg-[#F5F2EB] border-[#D8CDBA] focus:ring-neutral-400", divider:"border-[#E6E1D3]", menu:"bg-[#F5F2EB] border-[#D8CDBA]", menuText:"text-neutral-700" },
    wikipedia: { shell:"border-neutral-200 bg-neutral-50 text-neutral-700", brand:"border-neutral-200", brandText:"text-neutral-900", itemHover:"hover:bg-neutral-100", activeItem:"bg-neutral-200/70 font-medium text-neutral-900", idleItem:"text-neutral-600", folderText:"text-neutral-800", folderFill:"fill-neutral-200", button:"border-neutral-300 hover:bg-neutral-100", primaryButton:"bg-neutral-900 text-neutral-100 hover:bg-neutral-800", input:"bg-white border-neutral-200 focus:ring-neutral-400", divider:"border-neutral-100", menu:"bg-white border-neutral-200", menuText:"text-neutral-700" },
    charcoal: { shell:"border-neutral-800 bg-neutral-950 text-neutral-300", brand:"border-neutral-800", brandText:"text-neutral-100", itemHover:"hover:bg-neutral-800", activeItem:"bg-neutral-800/80 font-medium text-neutral-100", idleItem:"text-neutral-400", folderText:"text-neutral-200", folderFill:"fill-transparent", button:"border-neutral-700 hover:bg-neutral-800", primaryButton:"bg-neutral-100 text-neutral-900 hover:bg-neutral-200", input:"bg-neutral-900 border-neutral-800 focus:ring-neutral-500", divider:"border-neutral-800", menu:"bg-neutral-900 border-neutral-800", menuText:"text-neutral-200" }
  };
  const colors = themeClasses[theme] || themeClasses.beige;
  const notificationIcons = { Bell, Megaphone, Info, AlertTriangle, AlertCircle };
  const NotificationIcon = notification?.icon && notificationIcons[notification.icon] ? notificationIcons[notification.icon] : Bell;

  const toggleFolder = (id) => setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  const handleDragStart = (e, id, type) => e.dataTransfer.setData("text/plain", JSON.stringify({ id, type }));
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e, targetFolderId) => {
    e.preventDefault(); e.stopPropagation();
    try { const data = JSON.parse(e.dataTransfer.getData("text/plain")); onMoveItem(data.id, data.type, targetFolderId); }
    catch (err) { console.error("Drop parsed incorrectly", err); }
  };
  const showContextMenu = (e, id, type) => {
    e.preventDefault();
    e.stopPropagation();
    setMoveMenuOpen(false);
    setContextMenu({ x: e.clientX, y: e.clientY, id, type });
  };
  const closeContextMenu = () => {
    setContextMenu(null);
    setMoveMenuOpen(false);
  };
  const handleDeleteNote = (e, noteId) => { e.preventDefault(); e.stopPropagation(); if (noteId) onDeleteNote(noteId); };
  const handleRenameNote = async (note) => {
    const nextTitle = window.prompt("Rename file", note.title || "Untitled");
    if (nextTitle === null) return;
    const trimmed = nextTitle.trim();
    if (!trimmed || !masterKey) return;
    try {
      await updateDoc(doc(db, "notes", note.id), {
        title: encryptData(trimmed, masterKey),
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error("Failed to rename note:", error);
    }
  };
  const handleMoveNote = async (noteId, targetFolderId) => {
    await onMoveItem(noteId, "note", targetFolderId ?? null);
    closeContextMenu();
  };

  const renderNoteItem = (note, index = 0, extraClass = "") => (
    <div
      key={note.id}
      style={{"--archiwiki-delay":`${Math.min(index*35,175)}ms`}}
      className={`archiwiki-sidebar-item group flex items-center justify-between gap-2 py-1 px-3 ${extraClass} ${colors.itemHover} rounded cursor-pointer text-sm ${activeNoteId===note.id?colors.activeItem:colors.idleItem}`}
      draggable
      onDragStart={(e)=>handleDragStart(e,note.id,"note")}
      onClick={()=>onSelectNote(note.id)}
      onContextMenu={(e)=>showContextMenu(e,note.id,"note")}
    >
      <div className="flex items-center gap-1.5 truncate min-w-0"><FileText size={13} className="text-neutral-400 shrink-0"/><span className="truncate">{note.title||"Untitled"}</span></div>
      <button type="button" onClick={(e)=>handleDeleteNote(e,note.id)} title="Delete note" aria-label="Delete note" className="shrink-0 p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={13}/></button>
    </div>
  );

  const renderFolderNode = (folderId, level = 0, itemIndex = 0) => {
    const currentFolder = folders.find((f) => f.id === folderId);
    if (!currentFolder) return null;
    const childFolders = folders.filter((f) => f.parentId === folderId);
    const childNotes = notes.filter((n) => n.folderId === folderId);
    const isExpanded = !!expandedFolders[folderId];

    return (
      <div key={folderId} style={{ paddingLeft:`${level*8}px`, "--archiwiki-delay":`${Math.min(itemIndex*35,175)}ms` }} className="select-none" onDragOver={handleDragOver} onDrop={(e)=>handleDrop(e,folderId)}>
        <div className={`archiwiki-sidebar-item group flex items-center justify-between py-1 px-2 ${colors.itemHover} rounded cursor-pointer border border-transparent`} onClick={()=>toggleFolder(folderId)} onContextMenu={(e)=>showContextMenu(e,folderId,"folder")} draggable onDragStart={(e)=>handleDragStart(e,folderId,"folder")}>
          <div className={`flex items-center gap-1.5 ${colors.folderText} min-w-0`}>
            {isExpanded ? <ChevronDown size={14} className="text-neutral-400 shrink-0"/> : <ChevronRight size={14} className="text-neutral-400 shrink-0"/>}
            <Folder size={14} className={`text-neutral-500 ${colors.folderFill} shrink-0`}/>
            <span className="text-sm font-medium truncate max-w-[130px]">{currentFolder.name}</span>
          </div>
          <div className="hidden group-hover:flex items-center gap-1 shrink-0">
            <button onClick={(e)=>{e.stopPropagation();setExpandedFolders((prev)=>({...prev,[folderId]:true}));onCreateNote(folderId);}} title="New note in folder" className={`p-1 ${colors.itemHover} rounded text-neutral-500`}><Plus size={12}/></button>
          </div>
        </div>
        {isExpanded && <div className={`border-l ${colors.divider} ml-3.5 my-0.5`}>
          {childFolders.map((child,index)=>renderFolderNode(child.id,level+1,index))}
          {childNotes.map((note,index)=>renderNoteItem(note,index,"ml-2"))}
        </div>}
      </div>
    );
  };

  const rootFolders = folders.filter((f)=>!f.parentId);
  const folderIds = new Set(folders.map((folder)=>folder.id));
  const rootNotes = notes.filter((note)=>!note.folderId || !folderIds.has(note.folderId));
  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredNotes = notes.filter((note)=>note.title?.toLowerCase().includes(searchTerm)||note.body?.toLowerCase().includes(searchTerm));
  const filteredFolders = folders.filter((folder)=>folder.name?.toLowerCase().includes(searchTerm));

  return (<>
    <style>{sidebarAnimationStyles}</style>
    <div className={`w-64 h-full flex flex-col border-r select-none ${colors.shell}`} onClick={closeContextMenu}>
      <div className={`p-4 border-b ${colors.brand}`}><h2 className={`text-lg font-semibold tracking-wider font-archi ${colors.brandText}`}>ArchiWiki</h2></div>
      <div className="p-3 flex gap-2"><button type="button" onClick={()=>onCreateFolder(null)} className={`flex-1 py-1 px-2 flex items-center justify-center gap-1.5 text-xs font-medium border rounded ${colors.button}`}><Folder size={12}/>+ Folder</button><button type="button" onClick={()=>onCreateNote(null)} className={`flex-1 py-1 px-2 flex items-center justify-center gap-1.5 text-xs font-medium rounded ${colors.primaryButton}`}><FileText size={12}/>+ Note</button></div>
      <div className="px-3 pb-2 relative"><span className="absolute left-5 top-2 text-neutral-400"><Search size={13}/></span><input type="text" value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search encrypted notes..." className={`w-full text-xs pl-8 pr-3 py-1.5 border rounded focus:outline-none focus:ring-1 ${colors.input}`}/></div>
      <div className="flex-1 min-h-0 overflow-y-auto structure-tree-scrollbar px-2 py-2 space-y-1">
        {searchQuery ? <div><h3 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 px-2 mb-2">Search Results</h3>{filteredNotes.length>0&&<div><h4 className="text-[9px] uppercase tracking-[0.16em] font-semibold text-neutral-400 px-3 mb-1.5">Files</h4>{filteredNotes.map((note,index)=>renderNoteItem(note,index))}</div>}{filteredNotes.length>0&&filteredFolders.length>0&&<div className={`my-3 border-t ${colors.divider}`}/>} {filteredFolders.length>0&&<div><h4 className="text-[9px] uppercase tracking-[0.16em] font-semibold text-neutral-400 px-3 mb-1.5">Folders</h4>{filteredFolders.map((folder,index)=><div key={folder.id} style={{"--archiwiki-delay":`${Math.min(index*35,175)}ms`}} onClick={()=>setExpandedFolders((prev)=>({...prev,[folder.id]:true}))} onContextMenu={(e)=>showContextMenu(e,folder.id,"folder")} className={`archiwiki-sidebar-item flex items-center gap-1.5 py-1 px-3 ${colors.itemHover} rounded cursor-pointer text-sm ${colors.folderText}`}><Folder size={13} className={`${colors.folderFill} text-neutral-500 shrink-0`}/><span className="truncate">{folder.name}</span></div>)}</div>}{filteredNotes.length===0&&filteredFolders.length===0&&<p className="text-xs text-neutral-400 px-3 py-2">No results found.</p>}</div> : <>{rootFolders.map((folder)=>renderFolderNode(folder.id))}{rootNotes.length>0&&<div className={`mt-4 border-t ${colors.divider} pt-2`}><h3 className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 px-2 mb-1.5">Unsorted Notes</h3>{rootNotes.map((note,index)=>renderNoteItem(note,index))}</div>}</>}
      </div>
      {notification && (
        <div className={`shrink-0 w-full px-2 sm:px-3 py-2 sm:py-3 border-t ${colors.divider}`}>
          <div role="status" className={`w-full max-w-full overflow-hidden rounded-lg border px-2.5 sm:px-3 py-2.5 sm:py-3 text-xs leading-5 shadow-sm pointer-events-none select-none ${notification.priority === "critical" ? "border-red-600 bg-red-500 text-white" : notification.priority === "high" ? "border-orange-600 bg-orange-500 text-white" : notification.priority === "medium" ? "border-yellow-500 bg-yellow-400 text-neutral-950" : theme === "charcoal" ? "border-neutral-700 bg-neutral-800 text-neutral-100 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]" : theme === "wikipedia" ? "border-neutral-300 bg-neutral-100 text-neutral-900 shadow-[0_0_0_1px_rgba(32,33,34,0.04)]" : "border-[#C8BCA8] bg-[#E8E1D2] text-neutral-900 shadow-[0_0_0_1px_rgba(92,78,58,0.05)]"}`}>
            <div className="flex min-w-0 items-start gap-2"><NotificationIcon size={15} className="shrink-0 mt-0.5" aria-hidden="true" /><span className="min-w-0 flex-1 whitespace-pre-wrap break-words overflow-wrap-anywhere">{notification.content}</span></div>
          </div>
        </div>
      )}
      {contextMenu&&<div className={`archiwiki-context-menu fixed z-50 border shadow-lg rounded py-1 w-44 text-xs ${colors.menu}`} style={{top:Math.min(contextMenu.y,window.innerHeight-260),left:Math.min(contextMenu.x,window.innerWidth-190)}} onClick={(e)=>e.stopPropagation()}>
        {contextMenu.type === "folder" ? <>
          <button type="button" onClick={()=>{onRenameFolder(contextMenu.id);closeContextMenu();}} className={`w-full text-left px-3 py-1.5 ${colors.itemHover} flex items-center gap-1.5 ${colors.menuText}`}><Edit2 size={11}/>Rename Folder</button>
          <button type="button" onClick={()=>{onDeleteFolder(contextMenu.id);closeContextMenu();}} className={`w-full text-left px-3 py-1.5 ${colors.itemHover} ${colors.menuText} flex items-center gap-1.5`}><Trash2 size={11}/>Delete Recursively</button>
          <button type="button" onClick={()=>{onCreateFolder(contextMenu.id);closeContextMenu();}} className={`w-full text-left px-3 py-1.5 ${colors.itemHover} flex items-center gap-1.5 ${colors.menuText}`}><Folder size={11}/>Create Subfolder</button>
        </> : (()=>{ const note=notes.find((item)=>item.id===contextMenu.id); return <>
          <button type="button" onClick={()=>{onSelectNote(contextMenu.id);closeContextMenu();}} className={`w-full text-left px-3 py-1.5 ${colors.itemHover} flex items-center gap-1.5 ${colors.menuText}`}><Edit2 size={11}/>Edit</button>
          <button type="button" onClick={()=>{if(note) handleRenameNote(note);closeContextMenu();}} className={`w-full text-left px-3 py-1.5 ${colors.itemHover} flex items-center gap-1.5 ${colors.menuText}`}><Edit2 size={11}/>Rename</button>
          <button type="button" onClick={()=>setMoveMenuOpen((open)=>!open)} className={`w-full text-left px-3 py-1.5 ${colors.itemHover} flex items-center justify-between ${colors.menuText}`}><span className="flex items-center gap-1.5"><Folder size={11}/>Move to</span><ChevronRight size={11}/></button>
          {moveMenuOpen&&<div className={`absolute left-full top-0 ml-1 w-48 max-h-64 overflow-y-auto border shadow-lg rounded py-1 ${colors.menu}`}><button type="button" onClick={()=>handleMoveNote(contextMenu.id,null)} className={`w-full text-left px-3 py-1.5 ${colors.itemHover} flex items-center gap-1.5 ${colors.menuText}`}><Folder size={11}/>Root</button>{folders.map((folder)=><button key={folder.id} type="button" onClick={()=>handleMoveNote(contextMenu.id,folder.id)} className={`w-full text-left px-3 py-1.5 ${colors.itemHover} flex items-center gap-1.5 ${colors.menuText}`}><Folder size={11}/><span className="truncate">{folder.name}</span></button>)}</div>}
          <button type="button" onClick={()=>{onDeleteNote(contextMenu.id);closeContextMenu();}} className={`w-full text-left px-3 py-1.5 ${colors.itemHover} text-red-600 flex items-center gap-1.5`}><Trash2 size={11}/>Delete</button>
        </>; })()}
      </div>}
    </div>
  </>);
}
