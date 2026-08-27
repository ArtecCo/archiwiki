import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { db } from "./firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  doc,
  deleteDoc,
  query,
  where,
  getDoc
} from "firebase/firestore";
import { encryptData, decryptData } from "./crypto";
import InviteAdmin from "./components/InviteAdmin";
import Guide from "./components/Guide";
import Feedback from "./components/Feedback";
import Tickets from "./components/Tickets";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import GraphView from "./components/GraphView";
import { LogOut, Share2, Menu, ListTree, Link2, Network } from "lucide-react";

function ArchiWikiApp() {
  useEffect(() => {
    const loader = document.getElementById("archiwiki-loader");

    if (!loader) return;

    const timer = setTimeout(() => {
      loader.style.opacity = "0";
      loader.style.visibility = "hidden";

      setTimeout(() => {
        loader.remove();
      }, 450);
    }, 350);

    return () => clearTimeout(timer);
  }, []);

  const {
    user,
    masterKey,
    login,
    unlock,
    registerWithInvite,
    logout
  } = useAuth();

  // Auth Form parameters
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const inviteFromUrl = params.get("invite");

  if (!inviteFromUrl) return;

  const normalizedInvite = inviteFromUrl.trim();

  if (!normalizedInvite) return;

  setInviteToken(normalizedInvite);
  setIsRegistering(true);

  // Remove the invite code from the visible URL
  // without reloading the page.
  const cleanUrl =
    window.location.pathname +
    window.location.hash;

  window.history.replaceState(
    {},
    "",
    cleanUrl
  );
}, []);
  

  // Application States
  const [folders, setFolders] = useState([]);
  const [encryptedNotes, setEncryptedNotes] = useState([]);
  const [decryptedNotes, setDecryptedNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [newNoteId, setNewNoteId] = useState(null);
  const [pendingNotes, setPendingNotes] = useState([]);
  const [fontSize, setFontSize] = useState(16);
  const [notification, setNotification] = useState(null);

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("archiwiki-theme") || "beige";
  }); // beige | wikipedia | charcoal

  const [activeTab, setActiveTab] = useState("editor");
  const [mobileReaderPanel, setMobileReaderPanel] = useState("article");
  const [dialog, setDialog] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("archiwiki-theme", theme);
  }, [theme]);

  useEffect(() => {
    const themeConfig = {
      beige: {
        color: "#F5F2EB",
        manifest: "/manifest-beige.json"
      },
      wikipedia: {
        color: "#F8F9FA",
        manifest: "/manifest-wikipedia.json"
      },
      charcoal: {
        color: "#171717",
        manifest: "/manifest-charcoal.json"
      }
    };

    const selected = themeConfig[theme] || themeConfig.beige;

    let themeMeta = document.querySelector(
      'meta[name="theme-color"]'
    );

    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }

    themeMeta.setAttribute("content", selected.color);

    let manifestLink = document.querySelector(
      'link[rel="manifest"]'
    );

    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }

    manifestLink.setAttribute("href", selected.manifest);

    document.documentElement.style.colorScheme =
      theme === "charcoal" ? "dark" : "light";
  }, [theme]);

  useEffect(() => {
    if (!user) {
      setEmail("");
      setPassword("");
    }
  }, [user]);

  // Load Database Items
  useEffect(() => {
    if (!user) return;

    // Load Folders
    const qFolders = query(
      collection(db, "folders"),
      where("userId", "==", user.uid)
    );

    const unsubFolders = onSnapshot(
      qFolders,
      (snap) => {
        setFolders(
          snap.docs.map((folderDoc) => ({
            id: folderDoc.id,
            ...folderDoc.data()
          }))
        );
      },
      (error) => {
        console.error("Failed to load folders from Firestore:", error);
      }
    );

    // Load Notes
    const qNotes = query(
      collection(db, "notes"),
      where("userId", "==", user.uid)
    );

    const unsubNotes = onSnapshot(
      qNotes,
      (snap) => {
        const snapshotNotes = snap.docs.map((noteDoc) => ({
          id: noteDoc.id,
          ...noteDoc.data()
        }));

        setEncryptedNotes(snapshotNotes);

        // Remove locally-pending notes once Firestore confirms them.
        setPendingNotes((prev) =>
          prev.filter(
            (pending) =>
              !snapshotNotes.some(
                (note) => note.id === pending.id
              )
          )
        );
      },
      (error) => {
        console.error(
          "Failed to load notes from Firestore:",
          error
        );
      }
    );

    return () => {
      unsubFolders();
      unsubNotes();
    };
  }, [user]);

  // Load the administrator notification separately from notes/folders.
  // It is a public, read-only document for normal users.
  useEffect(() => {
    const notificationRef = doc(db, "adminMetrics", "notification");

    return onSnapshot(
      notificationRef,
      (snap) => {
        if (!snap.exists()) {
          setNotification(null);
          return;
        }

        const data = snap.data();
        setNotification(
          data.enabled === true && typeof data.content === "string" && data.content.trim()
            ? {
                content: data.content.trim(),
                priority: ["low", "medium", "high", "critical"].includes(data.priority)
                  ? data.priority
                  : "low",
                icon: ["Bell", "Megaphone", "Info", "AlertTriangle", "AlertCircle"].includes(data.icon)
                  ? data.icon
                  : "Bell"
              }
            : null
        );
      },
      (error) => {
        console.error("Failed to load admin notification:", error);
        setNotification(null);
      }
    );
  }, []);

  // Decrypt notes automatically when masterKey,
  // encryptedNotes, or pendingNotes change.
  useEffect(() => {
    if (!masterKey) {
      setDecryptedNotes([]);
      return;
    }

    const allNotes = [
      ...encryptedNotes,
      ...pendingNotes.filter(
        (pending) =>
          !encryptedNotes.some(
            (note) => note.id === pending.id
          )
      )
    ];

    const decrypted = allNotes.map((note) => ({
      id: note.id,
      folderId: note.folderId ?? null,
      title: decryptData(note.title, masterKey) || "",
      body: decryptData(note.body, masterKey) || "",
      updatedAt: note.updatedAt
    }));

    setDecryptedNotes(decrypted);
  }, [encryptedNotes, pendingNotes, masterKey]);

  // Restore currently selected note from URL hash.
  useEffect(() => {
    const restoreNoteFromUrl = () => {
      const params = new URLSearchParams(
        window.location.hash.substring(1)
      );

      const noteId = params.get("note");

      if (noteId) {
        setActiveNoteId(noteId);
        setNewNoteId(null);
        setActiveTab("editor");
      } else {
        setActiveNoteId(null);
        setNewNoteId(null);
        setActiveTab("editor");
      }
    };

    restoreNoteFromUrl();

    window.addEventListener("popstate", restoreNoteFromUrl);
    window.addEventListener("hashchange", restoreNoteFromUrl);

    return () => {
      window.removeEventListener("popstate", restoreNoteFromUrl);
      window.removeEventListener("hashchange", restoreNoteFromUrl);
    };
  }, []);

  // Handling registration & login calls
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      if (requiresUnlock) {
        // Firebase user is already authenticated.
        // Verify the same account password and rebuild
        // the encryption key.
        await unlock(password);
      } else if (isRegistering) {
  await registerWithInvite(
    email,
    password,
    inviteToken
  );

  setInviteToken("");
  setIsRegistering(false);
} else {
        await login(email, password);
      }
    } catch (err) {
      console.error("Authentication error:", err);

      if (err?.code === "auth/email-already-in-use") {
        setError(
          "An account with this email already exists."
        );
      } else if (err?.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err?.code === "auth/weak-password") {
        setError("Please choose a stronger password.");
      } else if (
        err?.code === "auth/wrong-password" ||
        err?.code === "auth/invalid-credential"
      ) {
        setError("Incorrect password.");
      } else {
        setError(
          err?.message ||
            "Authentication failed. Please try again."
        );
      }
    } finally {
      // Never retain authentication credentials in React state.
      setEmail("");
      setPassword("");
    }
  };

  const handleCreateFolder = async (parentId = null) => {
    setDialog({
      kind: "input",
      title: "Create folder",
      label: "Folder name",
      value: "",
      confirmLabel: "Create",
      onConfirm: async (name) => {
        if (!name.trim()) return;

        await addDoc(collection(db, "folders"), {
          name: name.trim(),
          parentId,
          userId: user.uid,
          createdAt: Date.now()
        });
      }
    });
  };

  const handleCreateNote = async (folderId = null) => {
    const noteRef = doc(collection(db, "notes"));
    const now = Date.now();

    const newNote = {
      id: noteRef.id,
      userId: user.uid,
      folderId: folderId ?? null,
      title: "",
      body: "",
      updatedAt: now
    };

    setPendingNotes((prev) => {
      if (prev.some((note) => note.id === newNote.id)) {
        return prev;
      }

      return [...prev, newNote];
    });

    setNewNoteId(noteRef.id);
    setActiveNoteId(noteRef.id);
    setActiveTab("editor");

    window.history.pushState(
      { noteId: noteRef.id },
      "",
      `#note=${noteRef.id}`
    );

    try {
      await setDoc(noteRef, {
        userId: user.uid,
        folderId: folderId ?? null,
        title: "",
        body: "",
        updatedAt: now
      });
    } catch (error) {
      console.error("Failed to create note:", error);

      setPendingNotes((prev) =>
        prev.filter(
          (note) => note.id !== noteRef.id
        )
      );
    }
  };

  const handleSaveNote = async (
    noteId,
    rawTitle,
    rawBody
  ) => {
    const noteRef = doc(db, "notes", noteId);

    await updateDoc(noteRef, {
      title: encryptData(rawTitle, masterKey),
      body: encryptData(rawBody, masterKey),
      updatedAt: Date.now()
    });
  };

  const handleDeleteFolder = async (folderId) => {
    const deleteRecursive = async (fid) => {
      const childFolds = folders.filter(
        (folder) => folder.parentId === fid
      );

      for (const child of childFolds) {
        await deleteRecursive(child.id);
      }

      // Delete notes in folder
      const fNotes = encryptedNotes.filter(
        (note) => note.folderId === fid
      );

      for (const note of fNotes) {
        await deleteDoc(doc(db, "notes", note.id));
      }

      await deleteDoc(doc(db, "folders", fid));
    };

    setDialog({
      kind: "confirm",
      title: "Delete folder?",
      message:
        "This permanently deletes the folder, its subfolders, and their notes.",
      confirmLabel: "Delete permanently",
      destructive: true,
      onConfirm: () => deleteRecursive(folderId)
    });
  };

  const handleMoveItem = async (
    itemId,
    itemType,
    targetFolderId
  ) => {
    if (itemType === "folder") {
      if (itemId === targetFolderId) return;

      await updateDoc(
        doc(db, "folders", itemId),
        { parentId: targetFolderId }
      );
    } else {
      await updateDoc(
        doc(db, "notes", itemId),
        { folderId: targetFolderId }
      );
    }
  };

  // Compile entire decrypted project as a JSON backup.
  const exportAllToZip = () => {
    const files = decryptedNotes.map((note) => {
      const path = getFolderPath(note.folderId);

      return {
        name: `${path}/${note.title}.md`,
        content: `# ${note.title}\n\n${note.body}`
      };
    });

    console.log("Mock backup generated", files);

    const link = document.createElement("a");
    const jsonStr = JSON.stringify(files, null, 2);

    link.href =
      "data:text/plain;charset=utf-8," +
      encodeURIComponent(jsonStr);

    link.download = "scribe-notebook-backup.json";
    link.click();
  };

  const getFolderPath = (folderId) => {
    if (!folderId) return "Root";

    const fold = folders.find(
      (folder) => folder.id === folderId
    );

    return fold
      ? `${getFolderPath(fold.parentId)}/${fold.name}`
      : "Root";
  };

  // Build the visible breadcrumb for the currently open article.
  const getArticleBreadcrumb = (folderId) => {
    if (!folderId) return "";

    const parts = [];
    const visited = new Set();
    let currentId = folderId;

    while (
      currentId &&
      !visited.has(currentId)
    ) {
      visited.add(currentId);

      const folder = folders.find(
        (item) => item.id === currentId
      );

      if (!folder) break;

      parts.unshift(folder.name);
      currentId = folder.parentId || null;
    }

    return parts.join(" / ");
  };

  const handleCloseNote = () => {
    setNewNoteId(null);
    setActiveNoteId(null);
    setActiveTab("editor");

    window.history.pushState(
      {},
      "",
      window.location.pathname
    );
  };

  // Theme variable styles helper
  const getThemeClasses = () => {
    switch (theme) {
      case "wikipedia":
        return "bg-[#F8F9FA] text-[#202122] font-sans";

      case "charcoal":
        return "bg-neutral-900 text-neutral-100 font-sans dark";

      default:
        return "bg-[#F5F2EB] text-neutral-800 font-sans";
    }
  };

  const getShellThemeClasses = () => {
    switch (theme) {
      case "wikipedia":
        return {
          topbar: "border-neutral-200 bg-[#F8F9FA]",
          tabActive:
            "bg-neutral-200 text-neutral-900",
          tabIdle:
            "hover:bg-neutral-100 text-neutral-700",
          select:
            "bg-[#F8F9FA] text-[#202122] border-neutral-300",
          option:
            "bg-[#F8F9FA] text-[#202122]",
          button:
            "border-neutral-300 hover:bg-neutral-100",
          logout:
            "text-neutral-500 hover:text-neutral-800"
        };

      case "charcoal":
        return {
          topbar:
            "border-neutral-800 bg-neutral-950",
          tabActive:
            "bg-neutral-800 text-neutral-100",
          tabIdle:
            "hover:bg-neutral-800 text-neutral-300",
          select:
            "bg-neutral-950 text-neutral-100 border-neutral-700",
          option:
            "bg-neutral-950 text-neutral-100",
          button:
            "border-neutral-700 hover:bg-neutral-800",
          logout:
            "text-neutral-400 hover:text-neutral-100"
        };

      default:
        return {
          topbar:
            "border-[#E6E1D3] bg-[#EFEADF]",
          tabActive:
            "bg-[#E2D9C8] text-neutral-900",
          tabIdle:
            "hover:bg-[#E8E1D2] text-neutral-700",
          select:
            "bg-[#F5F2EB] text-[#202122] border-[#D8CDBA]",
          option:
            "bg-[#F5F2EB] text-[#202122]",
          button:
            "border-[#D8CDBA] hover:bg-[#E8E1D2]",
          logout:
            "text-neutral-500 hover:text-neutral-800"
        };
    }
  };

  const shellTheme = getShellThemeClasses();

  const articleCount = decryptedNotes.length;

  const folderCount = folders.filter(
    (folder) => !folder.parentId
  ).length;

  const subfolderCount = folders.filter(
    (folder) => !!folder.parentId
  ).length;

  const writingSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime)
    : null;

  const formattedWritingSince = writingSince
    ? `${String(
        writingSince.getDate()
      ).padStart(2, "0")}-${String(
        writingSince.getMonth() + 1
      ).padStart(2, "0")}-${writingSince.getFullYear()}`
    : "";

  const requiresUnlock = Boolean(
    user && !masterKey
  );

  const dialogTheme = {
    beige: {
      panel:
        "bg-[#F5F2EB] border-[#D8CDBA] text-[#202122]",
      muted: "text-neutral-600",
      input:
        "bg-white/70 border-[#D8CDBA]",
      cancel:
        "border border-[#D8CDBA] bg-[#EFEADF] text-[#202122] hover:bg-[#E8E1D2]",
      primary:
        "bg-neutral-900 text-white hover:bg-neutral-800"
    },

    wikipedia: {
      panel:
        "bg-[#F8F9FA] border-neutral-300 text-[#202122]",
      muted: "text-neutral-600",
      input:
        "bg-white border-neutral-300",
      cancel:
        "border border-neutral-300 bg-white text-[#202122] hover:bg-neutral-100",
      primary:
        "bg-[#202122] text-white hover:bg-neutral-700"
    },

    charcoal: {
      panel:
        "bg-neutral-900 border-neutral-700 text-neutral-100",
      muted: "text-neutral-400",
      input:
        "bg-neutral-800 border-neutral-700",
      cancel:
        "border border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700",
      primary:
        "bg-neutral-100 text-neutral-900 hover:bg-neutral-200"
    }
  }[theme];

  const confirmDialog = async () => {
    const currentDialog = dialog;

    if (!currentDialog) return;

    if (
      currentDialog.kind === "input" &&
      !currentDialog.value.trim()
    ) {
      return;
    }

    setDialog(null);

    await currentDialog.onConfirm(
      currentDialog.value || ""
    );
  };

  const handleLogout = async () => {
  setEmail("");
  setPassword("");
  setInviteToken("");
  setError("");
  setIsRegistering(false);

  await logout();
};

  if (!user || requiresUnlock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB] text-[#202122] font-serif p-6">
        <div className="w-full max-w-md bg-white border border-neutral-300 rounded shadow-md p-8">
          <h2 className="text-2xl font-bold font-archi tracking-wider text-center mb-1">
            ArchiWiki
          </h2>

          <p className="text-xs text-neutral-400 text-center uppercase tracking-widest mb-6">
            {requiresUnlock
              ? "Unlock encrypted notes"
              : "Your encrypted personal Wikipedia"}
          </p>

          {requiresUnlock && (
            <p className="mb-5 text-center text-xs text-neutral-500">
              Enter your password to restore access to your encrypted notes.
            </p>
          )}

          <form
            onSubmit={handleAuthSubmit}
            autoComplete="off"
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider">
                Email
              </label>

              <input
                type="email"
                required
                autoComplete="off"
                value={
                  requiresUnlock
                    ? user.email
                    : email
                }
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                disabled={requiresUnlock}
                className="w-full text-sm border border-neutral-300 rounded px-3 py-2 bg-neutral-50/50 focus:outline-none focus:border-neutral-800 disabled:cursor-not-allowed disabled:text-neutral-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider">
                Password
              </label>

              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                className="w-full text-sm border border-neutral-300 rounded px-3 py-2 bg-neutral-50/50 focus:outline-none focus:border-neutral-800"
              />
            </div>

            {isRegistering && !requiresUnlock && (
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider">
                  Invite Token
                </label>

                <input
                  type="text"
                  required
                  value={inviteToken}
                  onChange={(e) =>
                    setInviteToken(e.target.value)
                  }
                  className="w-full text-sm border border-neutral-300 rounded px-3 py-2 bg-neutral-50/50 focus:outline-none focus:border-neutral-800"
                  placeholder="Invite token code"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-neutral-500 italic mt-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-sm font-semibold tracking-wider transition-colors"
            >
              {requiresUnlock
                ? "Unlock Notes"
                : isRegistering
                ? "Register Account"
                : "Access Your Encrypted Articles"}
            </button>
          </form>

          {requiresUnlock && (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full mt-3 py-2 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Log out
            </button>
          )}

          {!requiresUnlock && (
            <div className="mt-6 pt-4 border-t border-neutral-200 text-center">
              <button
                onClick={() =>
                  setIsRegistering(!isRegistering)
                }
                className="text-xs text-neutral-500 hover:underline"
              >
                {isRegistering
                  ? "Already invited? Login"
                  : "Have an invite code? Register"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`h-screen flex overflow-hidden ${getThemeClasses()}`}
    >
      <div className="hidden md:block h-full">
        <Sidebar
          theme={theme}
          folders={folders}
          notes={decryptedNotes}
          activeNoteId={activeNoteId}
          notification={notification}
          onSelectNote={(id) => {
            setNewNoteId(null);
            setActiveNoteId(id);
            setActiveTab("editor");

            window.history.pushState(
              { noteId: id },
              "",
              `#note=${id}`
            );
          }}
          onCreateFolder={handleCreateFolder}
          onCreateNote={handleCreateNote}
          onRenameFolder={(id) =>
            setDialog({
              kind: "input",
              title: "Rename folder",
              label: "Folder name",
              value:
                folders.find(
                  (folder) =>
                    folder.id === id
                )?.name || "",
              confirmLabel: "Rename",
              onConfirm: (name) =>
                updateDoc(
                  doc(db, "folders", id),
                  { name: name.trim() }
                )
            })
          }
          onDeleteFolder={handleDeleteFolder}
          onMoveItem={handleMoveItem}
          onDeleteNote={(id) =>
            setDialog({
              kind: "confirm",
              title: "Delete note?",
              message:
                "This article will be permanently deleted.",
              confirmLabel:
                "Delete permanently",
              destructive: true,
              onConfirm: async () => {
                await deleteDoc(
                  doc(db, "notes", id)
                );

                if (activeNoteId === id) {
                  setActiveNoteId(null);
                }
              }
            })
          }
        />
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() =>
              setIsSidebarOpen(false)
            }
            className="absolute inset-0 w-full bg-black/40"
          />

          <div className="relative z-[70] h-full w-64 shadow-xl">
            <Sidebar
              theme={theme}
              folders={folders}
              notes={decryptedNotes}
              activeNoteId={activeNoteId}
              notification={notification}
              onSelectNote={(id) => {
                setNewNoteId(null);
                setActiveNoteId(id);
                setActiveTab("editor");
                setIsSidebarOpen(false);

                window.history.pushState(
                  { noteId: id },
                  "",
                  `#note=${id}`
                );
              }}
              onCreateFolder={handleCreateFolder}
              onCreateNote={handleCreateNote}
              onRenameFolder={(id) =>
                setDialog({
                  kind: "input",
                  title: "Rename folder",
                  label: "Folder name",
                  value:
                    folders.find(
                      (folder) =>
                        folder.id === id
                    )?.name || "",
                  confirmLabel: "Rename",
                  onConfirm: (name) =>
                    updateDoc(
                      doc(db, "folders", id),
                      { name: name.trim() }
                    )
                })
              }
              onDeleteFolder={
                handleDeleteFolder
              }
              onMoveItem={handleMoveItem}
              onDeleteNote={(id) =>
                setDialog({
                  kind: "confirm",
                  title: "Delete note?",
                  message:
                    "This manuscript will be permanently deleted.",
                  confirmLabel:
                    "Delete permanently",
                  destructive: true,
                  onConfirm: async () => {
                    await deleteDoc(
                      doc(db, "notes", id)
                    );

                    if (
                      activeNoteId === id
                    ) {
                      setActiveNoteId(null);
                    }
                  }
                })
              }
            />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Navigation Tabs */}
        <div
          className={`flex justify-between items-center gap-3 px-6 py-2 max-md:px-3 max-md:flex-wrap border-b ${shellTheme.topbar}`}
        >
          <div className="flex gap-2 max-md:w-full">
            <button
              type="button"
              onClick={() =>
                setIsSidebarOpen(true)
              }
              className="md:hidden p-1"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>

            <button
              onClick={() => {
                setActiveTab("editor");
                setMobileReaderPanel("article");
              }}
              className={`px-3 py-1 rounded text-xs font-semibold ${
                activeTab === "editor" && mobileReaderPanel === "article"
                  ? shellTheme.tabActive
                  : shellTheme.tabIdle
              }`}
            >
              Article Editor
            </button>

            <button
              onClick={() =>
                setActiveTab("graph")
              }
              className={`px-3 py-1 rounded text-xs font-semibold ${
                activeTab === "graph"
                  ? shellTheme.tabActive
                  : shellTheme.tabIdle
              }`}
            >
              <span className="hidden md:inline">Interactive Graph</span>
              <span className="md:hidden">Graph</span>
            </button>

{(activeNoteId || newNoteId) && (
              <div className="md:hidden flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("editor");
                  setMobileReaderPanel("structure");
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                  activeTab === "editor" && mobileReaderPanel === "structure"
                    ? shellTheme.tabActive
                    : shellTheme.tabIdle
                }`}
                aria-label="Open structure"
              >
                <ListTree size={13} />
                <span>Structure</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("editor");
                  setMobileReaderPanel("links");
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 ${
                  activeTab === "editor" && mobileReaderPanel === "links"
                    ? shellTheme.tabActive
                    : shellTheme.tabIdle
                }`}
                aria-label="Open links"
              >
                <Link2 size={13} />
                <span>Links</span>
              </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-4 text-xs max-md:w-full max-md:justify-between">
            {/* Theme switcher */}
            <div className="flex items-center gap-1">
              <span>Theme:</span>

              <select
                value={theme}
                onChange={(e) =>
                  setTheme(e.target.value)
                }
                className={`border rounded px-1 py-0.5 text-xs focus:outline-none ${shellTheme.select}`}
              >
                <option
                  className={shellTheme.option}
                  value="beige"
                >
                  Warm Beige
                </option>

                <option
                  className={shellTheme.option}
                  value="wikipedia"
                >
                  Wikipedia Light
                </option>

                <option
                  className={shellTheme.option}
                  value="charcoal"
                >
                  OLED Dark
                </option>
              </select>
            </div>

            <button
              onClick={exportAllToZip}
              className={`flex py-1 px-2.5 border rounded items-center gap-1 ${shellTheme.button}`}
            >
              <Share2 size={12} />

              <span className="hidden sm:inline">
                Backup (.json)
              </span>

              <span className="sm:hidden">
                Backup
              </span>
            </button>

            <button
              onClick={handleLogout}
              className={`p-1 ${shellTheme.logout}`}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Content Render Frame */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "editor" ? (
            <div className="h-full min-h-0 flex flex-col">
              <div className="flex-1 min-h-0">
            <Editor
  theme={theme}
  mobileReaderPanel={mobileReaderPanel}
  setMobileReaderPanel={setMobileReaderPanel}
  newNoteId={newNoteId}
  note={decryptedNotes.find(
    (note) =>
      note.id === activeNoteId
  )}

  onDeleteNote={(id) =>
    setDialog({
      kind: "confirm",
      title: "Delete note?",
      message:
        "This article will be permanently deleted.",
      confirmLabel:
        "Delete permanently",
      destructive: true,
      onConfirm: async () => {
        await deleteDoc(
          doc(db, "notes", id)
        );

        if (activeNoteId === id) {
          setActiveNoteId(null);
        }
      }
    })
  }

  articleCount={articleCount}
  folderCount={folderCount}
  subfolderCount={subfolderCount}
  writingSince={formattedWritingSince}
  breadcrumb={getArticleBreadcrumb(
    decryptedNotes.find(
      (note) =>
        note.id === activeNoteId
    )?.folderId
  )}
  onSaveNote={handleSaveNote}
  notesPool={decryptedNotes}
  fontSize={fontSize}
  setFontSize={setFontSize}
  onCloseNote={handleCloseNote}
  onNavigateToNote={(id) => {
    setNewNoteId(null);
    setActiveNoteId(id);
    setActiveTab("editor");

    window.history.pushState(
      { noteId: id },
      "",
      `#note=${id}`
    );
  }}
/>
              </div>
            </div>
          ) : (
            <GraphView
              theme={theme}
              notes={decryptedNotes}
              onNavigateToNote={(id) => {
                setNewNoteId(null);
                setActiveNoteId(id);
                setActiveTab("editor");

                window.history.pushState(
                  { noteId: id },
                  "",
                  `#note=${id}`
                );
              }}
            />
          )}
        </div>
      </div>

      {dialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <div
            className={`w-full max-w-sm rounded border p-5 shadow-xl ${dialogTheme.panel}`}
          >
            <h2
              id="dialog-title"
              className="text-base font-semibold"
            >
              {dialog.title}
            </h2>

            {dialog.message && (
              <p
                className={`mt-2 text-sm ${dialogTheme.muted}`}
              >
                {dialog.message}
              </p>
            )}

            {dialog.kind === "input" && (
              <label
                className={`mt-4 block text-xs font-medium ${dialogTheme.muted}`}
              >
                {dialog.label}

                <input
                  autoFocus
                  value={dialog.value}
                  onChange={(event) =>
                    setDialog((current) => ({
                      ...current,
                      value: event.target.value
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      confirmDialog();
                    }
                  }}
                  className={`mt-1.5 w-full rounded border px-3 py-2 text-sm outline-none ${dialogTheme.input}`}
                />
              </label>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setDialog(null)
                }
                className={`rounded px-3 py-1.5 text-sm ${dialogTheme.cancel}`}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDialog}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  dialog.destructive
                    ? "bg-red-700 text-white hover:bg-red-800"
                    : dialogTheme.primary
                }`}
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/*
 * Route selection happens OUTSIDE ArchiWikiApp.
 *
 * This is intentional.
 *
 * ArchiWikiApp contains many React hooks. If we put:
 *
 *   if (pathname === "/invite-admin") return <InviteAdmin />;
 *
 * inside ArchiWikiApp, React can see a different number/order
 * of hooks depending on the current route.
 *
 * Keeping the route switch in this wrapper means ArchiWikiApp
 * either mounts normally with all of its hooks, or does not mount
 * at all when /invite-admin is requested.
 */
function MaintenanceScreen({ theme }) {
  const dark = theme === "charcoal";
  const wiki = theme === "wikipedia";
  return (
    <div className={"min-h-screen flex items-center justify-center p-6 font-sans " + (dark ? "bg-neutral-900 text-neutral-100" : wiki ? "bg-[#F8F9FA] text-[#202122]" : "bg-[#F5F2EB] text-neutral-800")}>
      <div className={"w-full max-w-md rounded border p-8 text-center shadow-sm " + (dark ? "border-neutral-700 bg-neutral-950" : wiki ? "border-neutral-300 bg-white" : "border-[#D8CDBA] bg-white")}>
        <div className="text-2xl mb-4">⚒</div>
        <h1 className="text-xl font-semibold">We&apos;ll be back shortly</h1>
        <p className={"mt-3 text-sm leading-6 " + (dark ? "text-neutral-400" : "text-neutral-500")}>
          ArchiWiki is temporarily unavailable while maintenance is being performed. Please try again shortly.
        </p>
      </div>
    </div>
  );
}

function ForcePwaScreen() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const ios =
      /iphone|ipad|ipod/i.test(
        window.navigator.userAgent
      );

    setIsIos(ios);

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();

    try {
      await installPrompt.userChoice;
    } catch (error) {
      console.error(
        "PWA installation prompt failed:",
        error
      );
    }

    setInstallPrompt(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB] text-[#202122] p-6">
      <div className="w-full max-w-md bg-white border border-neutral-300 rounded shadow-md p-8 text-center">
        <h1 className="text-2xl font-bold font-archi tracking-wider">
          ArchiWiki
        </h1>

        <p className="mt-3 text-sm text-neutral-600 leading-6">
          Please install ArchiWiki as an app to continue.
        </p>

        {installPrompt ? (
          <button
            type="button"
            onClick={install}
            className="mt-6 w-full py-2.5 bg-neutral-900 text-white rounded text-sm font-semibold hover:bg-neutral-800"
          >
            Install ArchiWiki
          </button>
        ) : isIos ? (
          <div className="mt-6 text-sm text-neutral-600 leading-6">
            <p>
              Open this page in Safari, tap the
              Share button, then choose
              <strong> Add to Home Screen</strong>.
            </p>

            <p className="mt-3">
              Then open ArchiWiki from your Home
              Screen.
            </p>
          </div>
        ) : (
          <div className="mt-6 text-sm text-neutral-600 leading-6">
            <p>
              Use your browser&apos;s install option
              to install ArchiWiki as an app.
            </p>

            <p className="mt-3">
              Then open ArchiWiki from your Home
              Screen or installed apps.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const pathname = window.location.pathname;

  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceChecked, setMaintenanceChecked] =
    useState(false);

  const [forcePwa, setForcePwa] =
    useState(false);

  const [forcePwaChecked, setForcePwaChecked] =
    useState(false);

  const [isStandalone, setIsStandalone] =
    useState(false);

  const [theme] = useState(
    () =>
      localStorage.getItem(
        "archiwiki-theme"
      ) || "beige"
  );

  useEffect(() => {
    const loader = document.getElementById("archiwiki-loader");
    if (pathname === "/invite-admin") {
      if (loader) {
        loader.style.opacity = "0";
        loader.style.visibility = "hidden";
        setTimeout(() => loader.remove(), 450);
      }
      setMaintenanceChecked(true);
      return;
    }
    let mounted = true;
    getDoc(doc(db, "adminMetrics", "maintenance"))
      .then((snapshot) => {
        if (!mounted) return;
        setMaintenance(snapshot.exists() && snapshot.data()?.inMaintenance === true);
      })
      .catch((error) => {
        console.error("Maintenance status check failed:", error);
        if (mounted) setMaintenance(false);
      })
      .finally(() => {
        if (mounted) setMaintenanceChecked(true);
      });
    return () => { mounted = false; };
  }, [pathname]);

  useEffect(() => {
    if (!maintenanceChecked) return;
    const loader = document.getElementById("archiwiki-loader");
    if (!loader) return;
    loader.style.opacity = "0";
    loader.style.visibility = "hidden";
    const timer = setTimeout(() => loader.remove(), 450);
    return () => clearTimeout(timer);
  }, [maintenanceChecked]);

  useEffect(() => {
  const standalone =
    window.matchMedia(
      "(display-mode: standalone)"
    ).matches ||
    window.navigator.standalone === true;

  setIsStandalone(standalone);

  // Installed PWAs don't need the gate.
  if (standalone) {
    setForcePwaChecked(true);
    return;
  }

  let mounted = true;

  getDoc(
    doc(
      db,
      "adminMetrics",
      "pwaGate"
    )
  )
    .then((snapshot) => {
      if (!mounted) return;

      setForcePwa(
        snapshot.exists() &&
          snapshot.data()?.enabled === true
      );
    })
    .catch((error) => {
      console.error(
        "PWA gate check failed:",
        error
      );

      // Fail open if the setting cannot be read.
      setForcePwa(false);
    })
    .finally(() => {
      if (mounted) {
        setForcePwaChecked(true);
      }
    });

  return () => {
    mounted = false;
  };
}, []);

  // Admin must remain accessible so the administrator
// can turn the temporary PWA requirement off.
if (pathname === "/invite-admin") {
  return <InviteAdmin />;
}

if (
  !maintenanceChecked ||
  !forcePwaChecked
) {
  return null;
}

if (maintenance) {
  return (
    <MaintenanceScreen
      theme={theme}
    />
  );
}

// Never show the PWA gate when already running
// as an installed web app.
if (forcePwa && !isStandalone) {
  return <ForcePwaScreen />;
}

if (pathname === "/guide") {
  return <Guide theme={theme} />;
}

if (pathname === "/feedback") {
  return <Feedback theme={theme} />;
}

if (pathname === "/tickets") {
  return <Tickets theme={theme} />;
}

return <ArchiWikiApp />;


}

export default App;
