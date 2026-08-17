import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { db } from "./firebase";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  query, 
  where 
} from "firebase/firestore";
import { encryptData, decryptData } from "./crypto";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import GraphView from "./components/GraphView";
import { FileText, LogOut, Share2, Book } from "lucide-react";

export default function App() {
  const { user, masterKey, login, registerWithInvite, logout } = useAuth();
  
  // Auth Form parameters
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [masterPass, setMasterPass] = useState("");
  const [error, setError] = useState("");

  // Application States
  const [folders, setFolders] = useState([]);
  const [encryptedNotes, setEncryptedNotes] = useState([]);
  const [decryptedNotes, setDecryptedNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [fontSize, setFontSize] = useState(16);
  const [theme, setTheme] = useState("beige"); // beige | wikipedia | charcoal
  const [activeTab, setActiveTab] = useState("editor"); // editor | graph

  // Load Database Items
  useEffect(() => {
    if (!user) return;

    // Load Folders
    const qFolders = query(collection(db, "folders"), where("userId", "==", user.uid));
    const unsubFolders = onSnapshot(qFolders, (snap) => {
      setFolders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Load Notes
    const qNotes = query(collection(db, "notes"), where("userId", "==", user.uid));
    const unsubNotes = onSnapshot(qNotes, (snap) => {
      setEncryptedNotes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubFolders();
      unsubNotes();
    };
  }, [user]);

  // Decrypt Notes automatically when masterKey or encryptedNotes change
  useEffect(() => {
    if (!masterKey || encryptedNotes.length === 0) {
      setDecryptedNotes([]);
      return;
    }
    const decrypted = encryptedNotes.map(n => {
      return {
        id: n.id,
        folderId: n.folderId,
        title: decryptData(n.title, masterKey) || "Untitled Note",
        body: decryptData(n.body, masterKey) || "",
        updatedAt: n.updatedAt
      };
    });
    setDecryptedNotes(decrypted);
  }, [encryptedNotes, masterKey]);

  // Handling registration & login calls
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegistering) {
        await registerWithInvite(email, password, inviteToken, masterPass);
      } else {
        await login(email, password, masterPass);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateFolder = async (parentId = null) => {
    const name = prompt("Name your folder:");
    if (!name) return;
    await addDoc(collection(db, "folders"), {
      name,
      parentId,
      userId: user.uid,
      createdAt: Date.now()
    });
  };

  const handleCreateNote = async (folderId = null) => {
    const defaultTitle = "Untitled Manuscript";
    const defaultBody = "Start writing your encrypted notes...";
    
    await addDoc(collection(db, "notes"), {
      userId: user.uid,
      folderId,
      title: encryptData(defaultTitle, masterKey),
      body: encryptData(defaultBody, masterKey),
      updatedAt: Date.now()
    });
  };

  const handleSaveNote = async (noteId, rawTitle, rawBody) => {
    const noteRef = doc(db, "notes", noteId);
    await updateDoc(noteRef, {
      title: encryptData(rawTitle, masterKey),
      body: encryptData(rawBody, masterKey),
      updatedAt: Date.now()
    });
  };

  const handleDeleteFolder = async (folderId) => {
    if (!confirm("Are you sure? This recursively deletes subfolders and connected manuscripts.")) return;
    // Simple mock recursive delete
    const deleteRecursive = async (fid) => {
      const childFolds = folders.filter(f => f.parentId === fid);
      for (const child of childFolds) {
        await deleteRecursive(child.id);
      }
      // Delete notes in folder
      const fNotes = encryptedNotes.filter(n => n.folderId === fid);
      for (const n of fNotes) {
        await deleteDoc(doc(db, "notes", n.id));
      }
      await deleteDoc(doc(db, "folders", fid));
    };
    await deleteRecursive(folderId);
  };

  const handleMoveItem = async (itemId, itemType, targetFolderId) => {
    if (itemType === "folder") {
      if (itemId === targetFolderId) return; // Cannot move into self
      await updateDoc(doc(db, "folders", itemId), { parentId: targetFolderId });
    } else {
      await updateDoc(doc(db, "notes", itemId), { folderId: targetFolderId });
    }
  };

  // Compile entire decrypted project as a ZIP download structure
  const exportAllToZip = () => {
    alert("Export active! Compiling individual raw files in local directories...");
    const files = decryptedNotes.map(n => {
      const path = getFolderPath(n.folderId);
      return {
        name: `${path}/${n.title}.md`,
        content: `# ${n.title}\n\n${n.body}`
      };
    });
    console.log("Mock backup generated", files);
    // Simple simulated download trigger file logic
    const link = document.createElement("a");
    const jsonStr = JSON.stringify(files, null, 2);
    link.href = "data:text/plain;charset=utf-8," + encodeURIComponent(jsonStr);
    link.download = "scribe-notebook-backup.json";
    link.click();
  };

  const getFolderPath = (folderId) => {
    if (!folderId) return "Root";
    const fold = folders.find(f => f.id === folderId);
    return fold ? `${getFolderPath(fold.parentId)}/${fold.name}` : "Root";
  };

  // Theme variable styles helper
  const getThemeClasses = () => {
    switch(theme) {
      case "wikipedia":
        return "bg-[#F8F9FA] text-[#202122] font-sans";
      case "charcoal":
        return "bg-neutral-900 text-neutral-100 font-sans dark";
      default: // Warm Beige
        return "bg-[#F5F2EB] text-neutral-800 font-sans";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB] text-[#202122] font-serif p-6">
        <div className="w-full max-w-md bg-white border border-neutral-300 rounded shadow-md p-8">
          <h2 className="text-2xl font-bold tracking-wider text-center mb-1">SCRIBE</h2>
          <p className="text-xs text-neutral-400 text-center uppercase tracking-widest mb-6">Encrypted Ledger Mode</p>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider">Email</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm border border-neutral-300 rounded px-3 py-2 bg-neutral-50/50 focus:outline-none focus:border-neutral-800"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider">Password</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm border border-neutral-300 rounded px-3 py-2 bg-neutral-50/50 focus:outline-none focus:border-neutral-800"
              />
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider">Invite Token</label>
                <input 
                  type="text" 
                  required 
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  className="w-full text-sm border border-neutral-300 rounded px-3 py-2 bg-neutral-50/50 focus:outline-none focus:border-neutral-800"
                  placeholder="Invite token code"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider">Master Password (Local AES-256 Key)</label>
              <input 
                type="password" 
                required 
                value={masterPass}
                onChange={(e) => setMasterPass(e.target.value)}
                className="w-full text-sm border border-neutral-300 rounded px-3 py-2 bg-neutral-50/50 focus:outline-none focus:border-neutral-800"
                placeholder="Never sent to server"
              />
            </div>

            {error && <p className="text-xs text-neutral-500 italic mt-2">{error}</p>}

            <button 
              type="submit"
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-sm font-semibold tracking-wider transition-colors"
            >
              {isRegistering ? "Register Account" : "Access Manuscript Ledger"}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-neutral-200 text-center">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-xs text-neutral-500 hover:underline"
            >
              {isRegistering ? "Already invited? Login" : "Have an invite code? Register"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden ${getThemeClasses()}`}>
      <Sidebar 
        folders={folders}
        notes={decryptedNotes}
        activeNoteId={activeNoteId}
        onSelectNote={(id) => { setActiveNoteId(id); setActiveTab("editor"); }}
        onCreateFolder={handleCreateFolder}
        onCreateNote={handleCreateNote}
        onRenameFolder={async (id) => {
          const newName = prompt("Rename to:");
          if (newName) await updateDoc(doc(db, "folders", id), { name: newName });
        }}
        onDeleteFolder={handleDeleteFolder}
        onMoveItem={handleMoveItem}
        onDeleteNote={async (id) => {
          if (confirm("Delete this manuscript permanently?")) {
            await deleteDoc(doc(db, "notes", id));
            if (activeNoteId === id) setActiveNoteId(null);
          }
        }}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex justify-between items-center px-6 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                activeTab === "editor" ? "bg-neutral-200 dark:bg-neutral-800" : "hover:bg-neutral-100"
              }`}
            >
              Manuscript Editor
            </button>
            <button
              onClick={() => setActiveTab("graph")}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                activeTab === "graph" ? "bg-neutral-200 dark:bg-neutral-800" : "hover:bg-neutral-100"
              }`}
            >
              Interactive Graph
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {/* Theme switcher */}
            <div className="flex items-center gap-1">
              <span>Theme:</span>
              <select 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                className="bg-transparent border border-neutral-200 dark:border-neutral-800 rounded px-1 py-0.5 text-xs focus:outline-none"
              >
                <option value="beige">Warm Beige</option>
                <option value="wikipedia">Wikipedia Light</option>
                <option value="charcoal">OLED Dark</option>
              </select>
            </div>

            <button 
              onClick={exportAllToZip}
              className="py-1 px-2.5 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded flex items-center gap-1"
            >
              <Share2 size={12} /> Backup Backup (.json)
            </button>

            <button onClick={logout} className="p-1 text-neutral-500 hover:text-neutral-800">
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Content Render Frame */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "editor" ? (
            <Editor 
              note={decryptedNotes.find(n => n.id === activeNoteId)}
              onSaveNote={handleSaveNote}
              notesPool={decryptedNotes}
              userId={user.uid}
              fontSize={fontSize}
              setFontSize={setFontSize}
              onNavigateToNote={(id) => setActiveNoteId(id)}
            />
          ) : (
            <GraphView 
              notes={decryptedNotes}
              onNavigateToNote={(id) => { setActiveNoteId(id); setActiveTab("editor"); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
