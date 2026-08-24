import React, { useEffect, useState } from "react";
import { Bell, Megaphone, Info, AlertTriangle, AlertCircle } from "lucide-react";

import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "firebase/auth";

import {
  collection,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc
} from "firebase/firestore";

import { auth, db } from "../firebase";


const generateInviteCode = () => {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const values = new Uint32Array(12);

  crypto.getRandomValues(values);

  return Array.from(values, (value) =>
    alphabet[value % alphabet.length]
  ).join("");
};


/*
 * Prevent Firestore from keeping the admin page
 * stuck forever if the request never resolves.
 */
const withTimeout = (promise, timeoutMs = 8000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            "The administrator access check timed out. Please check your Firebase connection and Firestore rules."
          )
        );
      }, timeoutMs);
    })
  ]);
};


export default function InviteAdmin() {
  const [user, setUser] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [invites, setInvites] = useState([]);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [creating, setCreating] = useState(false);
const [loggingIn, setLoggingIn] = useState(false);
const [newInviteToken, setNewInviteToken] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationContent, setNotificationContent] = useState("");
  const [notificationPriority, setNotificationPriority] = useState("low");
  const [notificationIcon, setNotificationIcon] = useState("Bell");
  const [notificationSaving, setNotificationSaving] = useState(false);
  const notificationIconComponents = { Bell, Megaphone, Info, AlertTriangle, AlertCircle };
  const notificationRef = doc(db, "adminMetrics", "notification");

  const maintenanceRef = doc(db, "adminMetrics", "maintenance");


  /*
   * Firebase Auth listener.
   *
   * This component deliberately handles its own authentication.
   * It does NOT depend on AuthContext.
   */
  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!mounted) return;

        setUser(currentUser);
        setAuthorized(false);
        setError("");

        /*
         * No authenticated user.
         *
         * We can immediately show the admin login.
         */
        if (!currentUser) {
          setCheckingAccess(false);
          return;
        }

        /*
         * Authenticated user exists.
         *
         * Now verify that the user's UID exists in:
         *
         * adminUsers/{uid}
         *
         * and that:
         *
         * active === true
         */
        try {
          const adminRef = doc(
            db,
            "adminUsers",
            currentUser.uid
          );

          const adminSnap = await withTimeout(
            getDoc(adminRef),
            8000
          );

          if (!mounted) return;

          if (
            adminSnap.exists() &&
            adminSnap.data()?.active === true
          ) {
            setAuthorized(true);
            setError("");
          } else {
            setAuthorized(false);

            /*
             * The Firebase account exists, but is not
             * an administrator.
             */
            setError(
              "This Firebase account is not authorized as an administrator."
            );

            /*
             * Remove the authenticated session so that
             * the login screen is shown cleanly.
             */
            try {
              await signOut(auth);
            } catch (signOutError) {
              console.error(
                "Failed to sign out unauthorized user:",
                signOutError
              );
            }

            if (!mounted) return;

            setUser(null);
          }
        } catch (err) {
          console.error(
            "Failed to check administrator access:",
            err
          );

          if (!mounted) return;

          setAuthorized(false);

          setError(
            err?.message ||
              "Unable to verify administrator access."
          );
        } finally {
          if (mounted) {
            setCheckingAccess(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);


  /*
   * Load invitations only after administrator access
   * has been confirmed.
   */
  useEffect(() => {
    if (!authorized) {
      setInvites([]);
      return;
    }

    const invitesQuery = query(
      collection(db, "pendingInvites"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      invitesQuery,
      (snapshot) => {
        setInvites(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
          }))
        );

        /*
         * Clear an old error if the query succeeds.
         */
        setError("");
      },
      (err) => {
        console.error(
          "Failed to load invitations:",
          err
        );

        setError(
          err?.message ||
            "Unable to load invitations. Check Firestore rules."
        );
      }
    );

    return unsubscribe;
  }, [authorized]);


  useEffect(() => {
    if (!authorized) return;

    const unsubscribe = onSnapshot(
      notificationRef,
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        setNotificationEnabled(data.enabled === true);
        setNotificationContent(typeof data.content === "string" ? data.content : "");
        setNotificationPriority(
          ["low", "medium", "high", "critical"].includes(data.priority) ? data.priority : "low"
        );
        setNotificationIcon(
          ["Bell", "Megaphone", "Info", "AlertTriangle", "AlertCircle"].includes(data.icon)
            ? data.icon
            : "Bell"
        );
      },
      (err) => {
        console.error("Failed to load notification status:", err);
        setError("Unable to read notification settings. Check Firestore rules.");
      }
    );

    return unsubscribe;
  }, [authorized]);

  useEffect(() => {
    if (!authorized) return;

    const unsubscribe = onSnapshot(
      maintenanceRef,
      (snapshot) => {
        setMaintenance(
          snapshot.exists() && snapshot.data()?.inMaintenance === true
        );
      },
      (err) => {
        console.error("Failed to load maintenance status:", err);
        setError("Unable to read maintenance status. Check Firestore rules.");
      }
    );

    return unsubscribe;
  }, [authorized]);

  const saveNotification = async () => {
    if (notificationSaving) return;

    setNotificationSaving(true);
    setError("");

    try {
      await setDoc(
        notificationRef,
        {
          enabled: notificationEnabled,
          content: notificationContent.trim(),
          priority: notificationPriority,
          icon: notificationIcon,
          updatedAt: Date.now()
        },
        { merge: true }
      );
      setMessage(notificationEnabled ? "User notification enabled." : "User notification disabled.");
    } catch (err) {
      console.error("Failed to update notification:", err);
      setError(err?.message || "Unable to update user notification.");
    } finally {
      setNotificationSaving(false);
    }
  };

  const toggleMaintenance = async () => {
    if (maintenanceSaving) return;

    setMaintenanceSaving(true);
    setError("");

    try {
      await setDoc(
        maintenanceRef,
        {
          inMaintenance: !maintenance,
          updatedAt: Date.now()
        },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to update maintenance mode:", err);
      setError(
        err?.message ||
          "Unable to change maintenance mode. Check Firestore rules."
      );
    } finally {
      setMaintenanceSaving(false);
    }
  };

  /*
   * Administrator login.
   */
  const handleLogin = async (event) => {
    event.preventDefault();

    if (loggingIn) return;

    setError("");
    setMessage("");
    setLoggingIn(true);

    try {
      const normalizedEmail =
        email.trim().toLowerCase();

      if (!normalizedEmail) {
        throw new Error(
          "Please enter your email address."
        );
      }

      if (!password) {
        throw new Error(
          "Please enter your password."
        );
      }

      const credential =
        await signInWithEmailAndPassword(
          auth,
          normalizedEmail,
          password
        );

      /*
       * Explicitly check the admin document here.
       *
       * This gives the login action a direct result instead
       * of depending only on the Auth state listener.
       */
      const adminRef = doc(
        db,
        "adminUsers",
        credential.user.uid
      );

      const adminSnap = await withTimeout(
        getDoc(adminRef),
        8000
      );

      if (!adminSnap.exists()) {
        await signOut(auth);

        throw new Error(
          "Administrator record not found. Create adminUsers/" +
            credential.user.uid +
            " in Firestore."
        );
      }

      if (adminSnap.data()?.active !== true) {
        await signOut(auth);

        throw new Error(
          "This account is not authorized as an administrator."
        );
      }

      /*
       * Successful login.
       *
       * The onAuthStateChanged listener will also run,
       * but the access check above guarantees that we do
       * not wait indefinitely for it.
       */
      setUser(credential.user);
      setAuthorized(true);

      setEmail("");
      setPassword("");
      setError("");
      setMessage("Administrator access granted.");
    } catch (err) {
      console.error(
        "Admin login failed:",
        err
      );

      setError(
        err?.message ||
          "Unable to sign in."
      );
    } finally {
      setLoggingIn(false);
    }
  };


  /*
   * Create invitation.
   */
  const createInvite = async () => {
    if (!user || !authorized) {
      setError(
        "You are not authorized to create invitations."
      );
      return;
    }

    if (creating) return;

    setError("");
    setMessage("");
    setCreating(true);

    try {
      const token = generateInviteCode();

      await setDoc(
        doc(db, "pendingInvites", token),
        {
          token,

          status: "available",

          used: false,

          claimId: null,
          claimedAt: null,

          usedBy: null,
          usedEmail: null,
          usedAt: null,

          createdAt: serverTimestamp(),

          createdBy: user.uid
        }
      );

      setNewInviteToken(token);

setMessage(
  `Invitation created: ${token}`
);
    } catch (err) {
      console.error(
        "Failed to create invitation:",
        err
      );

      setError(
        err?.message ||
          "Unable to create invitation."
      );
    } finally {
      setCreating(false);
    }
  };


  /*
   * Copy invitation.
   */
  /*
 * Build the shareable registration link for an invitation.
 *
 * Example:
 * https://archithswiki.netlify.app/?invite=ABC123XYZ
 */
const getInviteLink = (token) => {
  const normalizedToken = String(token || "").trim();

  if (!normalizedToken) return "";

  return `${window.location.origin}/?invite=${encodeURIComponent(
    normalizedToken
  )}`;
};


  /*
 * Copy the raw invitation code only.
 */
const copyInviteCode = async (token) => {
  const code = String(token || "").trim();

  if (!code) {
    setError("Unable to copy the invitation code.");
    return;
  }

  try {
    await navigator.clipboard.writeText(code);

    setMessage("Invitation code copied.");
    setError("");
  } catch (err) {
    console.error(
      "Unable to copy invitation code:",
      err
    );

    setError(
      "Unable to copy the invitation code."
    );
  }
};

  /*
 * Revoke an invitation.
 *
 * The invitation is retained in Firestore for audit/history,
 * but its status changes to "revoked".
 */
const revokeInvite = async (invite) => {
  if (!user || !authorized) {
    setError(
      "You are not authorized to revoke invitations."
    );
    return;
  }

  const token = String(
    invite?.token || invite?.id || ""
  ).trim();

  if (!token) {
    setError("Unable to identify this invitation.");
    return;
  }

  if (invite.status === "revoked") {
    setError("This invitation has already been revoked.");
    return;
  }

  if (invite.status === "used" || invite.used) {
    setError("A used invitation cannot be revoked.");
    return;
  }

  const confirmed = window.confirm(
    `Revoke invitation ${token}?\n\nThis invitation will no longer be usable.`
  );

  if (!confirmed) return;

  setError("");
  setMessage("");

  try {
    await updateDoc(
      doc(db, "pendingInvites", token),
      {
        status: "revoked",
        revoked: true,
        revokedAt: serverTimestamp(),
        revokedBy: user.uid
      }
    );

    setMessage(
      `Invitation ${token} has been revoked.`
    );
  } catch (err) {
    console.error(
      "Failed to revoke invitation:",
      err
    );

    setError(
      err?.message ||
        "Unable to revoke the invitation."
    );
  }
};
  


/*
 * Copy the full registration link.
 */
const copyInviteLink = async (token) => {
  const inviteLink = getInviteLink(token);

  if (!inviteLink) {
    setError("Unable to create the invitation link.");
    return;
  }

  try {
    await navigator.clipboard.writeText(inviteLink);

    setMessage("Invitation link copied.");
    setError("");
  } catch (err) {
    console.error(
      "Unable to copy invitation link:",
      err
    );

    setError(
      "Unable to copy the invitation link."
    );
  }
};


/*
 * Share the full registration link.
 *
 * On phones/tablets and supported browsers this opens
 * the native sharing menu.
 *
 * If Web Share is unavailable, fall back to copying
 * the link to the clipboard.
 */
const shareInviteLink = async (token) => {
  const inviteLink = getInviteLink(token);

  if (!inviteLink) {
    setError("Unable to create the invitation link.");
    return;
  }

  const shareData = {
    title: "ArchiWiki Invitation",
    text: "You're invited to join ArchiWiki.",
    url: inviteLink
  };

  try {
    if (
      navigator.share &&
      typeof navigator.share === "function"
    ) {
      await navigator.share(shareData);

      setMessage("Invitation link ready to share.");
      setError("");
      return;
    }

    // Desktop browsers that don't support Web Share:
    await navigator.clipboard.writeText(inviteLink);

    setMessage(
      "Sharing isn't available here, so the invitation link was copied instead."
    );
    setError("");
  } catch (err) {
    // User closing/cancelling the native share dialog
    // is not an application error.
    if (err?.name === "AbortError") {
      return;
    }

    console.error(
      "Unable to share invitation link:",
      err
    );

    // Final fallback to clipboard.
    try {
      await navigator.clipboard.writeText(inviteLink);

      setMessage(
        "Unable to open sharing, so the invitation link was copied instead."
      );
      setError("");
    } catch (copyError) {
      console.error(
        "Unable to copy invitation link:",
        copyError
      );

      setError(
        "Unable to share or copy the invitation link."
      );
    }
  }
};


  /*
   * Sign out.
   */
  const handleSignOut = async () => {
    try {
      await signOut(auth);

      setUser(null);
      setAuthorized(false);
      setInvites([]);
      setNewInviteToken("");
      setEmail("");
      setPassword("");

      setMessage("");
      setError("");
    } catch (err) {
      console.error(
        "Admin sign out failed:",
        err
      );

      setError(
        err?.message ||
          "Unable to sign out."
      );
    }
  };


  /*
   * Firestore Timestamp formatter.
   */
  const formatDate = (value) => {
    if (!value) return "—";

    try {
      const date =
        typeof value.toDate === "function"
          ? value.toDate()
          : new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "—";
      }

      return date.toLocaleString();
    } catch {
      return "—";
    }
  };


  /*
   * INITIAL ACCESS CHECK
   */
  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB] p-6">
        <div className="w-full max-w-sm bg-white border border-neutral-300 rounded shadow-md p-7 text-center">
          <h1 className="text-xl font-bold">
            ArchiWiki Administration
          </h1>

          <p className="text-xs text-neutral-500 mt-3">
            Checking administrator access…
          </p>

          <p className="text-[11px] text-neutral-400 mt-2">
            This check will time out if Firebase is unreachable.
          </p>
        </div>
      </div>
    );
  }


  /*
   * LOGIN SCREEN
   */
  if (!user || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB] p-6">
        <div className="w-full max-w-sm bg-white border border-neutral-300 rounded shadow-md p-7">

          <h1 className="text-xl font-bold text-center">
            ArchiWiki Administration
          </h1>

          <p className="text-xs text-neutral-500 text-center mt-2 mb-6">
            Private administrator access
          </p>

          <form
            onSubmit={handleLogin}
            className="space-y-4"
          >

            <div>
              <label className="block text-xs font-semibold mb-1">
                Email
              </label>

              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
              />
            </div>


            <div>
              <label className="block text-xs font-semibold mb-1">
                Password
              </label>

              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                className="w-full border border-neutral-300 rounded px-3 py-2 text-sm"
              />
            </div>


            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-xs text-red-700">
                  {error}
                </p>
              </div>
            )}

{/*
            {message && (
              <p className="text-xs text-green-700">
                {message}
              </p>
            )}
            */}

            {message && (
  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
    <p className="text-xs text-green-700">
      {message}
    </p>

    {newInviteToken && (
      <div className="mt-3">
        <p className="text-xs font-mono text-green-900 break-all">
          {getInviteLink(newInviteToken)}
        </p>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              copyInviteLink(newInviteToken)
            }
            className="px-3 py-1.5 border border-green-300 rounded text-xs text-green-800 hover:bg-green-100"
          >
            Copy link
          </button>

          <button
            type="button"
            onClick={() =>
              shareInviteLink(newInviteToken)
            }
            className="px-3 py-1.5 bg-neutral-900 text-white rounded text-xs hover:bg-neutral-800"
          >
            Share
          </button>
        </div>
      </div>
    )}
  </div>
)}

            


            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded text-sm font-semibold disabled:opacity-50"
            >
              {loggingIn
                ? "Signing in…"
                : "Sign in"}
            </button>

          </form>

        </div>
      </div>
    );
  }


  /*
   * ADMIN DASHBOARD
   */
  return (
    <div className="min-h-screen bg-[#F5F2EB] text-neutral-900 p-6">

      <div className="max-w-5xl mx-auto">

        <div className="flex items-center justify-between mb-8">

          <div>
            <h1 className="text-2xl font-bold">
              Invitation Manager
            </h1>

            <p className="text-xs text-neutral-500 mt-1">
              ArchiWiki administrator
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMaintenance}
              disabled={maintenanceSaving}
              aria-pressed={maintenance}
              title={maintenance ? "Maintenance mode is ON" : "Maintenance mode is OFF"}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
            >
              <span>Maintenance</span>
              <span className={maintenance ? "h-2 w-2 rounded-full bg-amber-500" : "h-2 w-2 rounded-full bg-green-600"} />
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              Sign out
            </button>
          </div>

        </div>


        <div className="bg-white border border-neutral-300 rounded p-4 sm:p-6 mb-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold mb-1">User notification</h2>
              <p className="text-xs text-neutral-500">
                Show a read-only announcement or warning to all users.
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={notificationEnabled} onChange={(e) => setNotificationEnabled(e.target.checked)} className="h-4 w-4" />
              Enable
            </label>
          </div>

          <textarea
            value={notificationContent}
            onChange={(e) => setNotificationContent(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Write your announcement or warning…"
            className="mt-4 w-full max-w-full box-border border border-neutral-300 rounded px-3 py-2 text-sm resize-y"
          />

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="min-w-0 text-xs text-neutral-500">
              Icon
              <span className="mt-1 flex items-center gap-2">
                <select value={notificationIcon} onChange={(e) => setNotificationIcon(e.target.value)} className="min-w-0 flex-1 border border-neutral-300 rounded px-2 py-2 text-xs bg-white">
                  <option value="Bell">Bell</option>
                  <option value="Megaphone">Megaphone</option>
                  <option value="Info">Info</option>
                  <option value="AlertTriangle">Alert triangle</option>
                  <option value="AlertCircle">Alert circle</option>
                </select>
                {(() => {
                  const Icon = notificationIconComponents[notificationIcon] || Bell;
                  return <Icon size={17} className="shrink-0 text-neutral-700" aria-hidden="true" />;
                })()}
              </span>
            </label>

            <label className="min-w-0 text-xs text-neutral-500">
              Priority
              <select value={notificationPriority} onChange={(e) => setNotificationPriority(e.target.value)} className="mt-1 w-full border border-neutral-300 rounded px-2 py-2 text-xs bg-white">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>

            <div className="flex items-end">
              <button type="button" onClick={saveNotification} disabled={notificationSaving} className="w-full px-3 py-2 bg-neutral-900 text-white rounded text-xs disabled:opacity-50">
                {notificationSaving ? "Saving…" : "Save notification"}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-neutral-300 rounded p-6 mb-6">
          <h2 className="font-semibold mb-2">
            Create invitation
          </h2>

          <p className="text-xs text-neutral-500 mb-4">
            Generate a single-use invitation token.
          </p>

          <button
            onClick={createInvite}
            disabled={creating}
            className="px-4 py-2 bg-neutral-900 text-white rounded text-sm disabled:opacity-50"
          >
            {creating
              ? "Creating…"
              : "Generate Invite"}
          </button>


          {message && (
            <p className="mt-4 text-xs text-green-700">
              {message}
            </p>
          )}


          {error && (
            <p className="mt-4 text-xs text-red-600">
              {error}
            </p>
          )}

        </div>


        <div className="bg-white border border-neutral-300 rounded overflow-hidden">

          <div className="p-5 border-b border-neutral-200">

            <h2 className="font-semibold">
              Invitations
            </h2>

            <p className="text-xs text-neutral-500 mt-1">
              {invites.length} invitation
              {invites.length === 1
                ? ""
                : "s"}
            </p>

          </div>


          {invites.length === 0 ? (

            <div className="p-8 text-center text-sm text-neutral-500">
              No invitations yet.
            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full text-xs">

                <thead>
                  <tr className="border-b border-neutral-200 text-left">

                    <th className="p-4">
                      Code
                    </th>

                    <th className="p-4">
                      Status
                    </th>

                    <th className="p-4">
                      Created
                    </th>

                    <th className="p-4">
                      Used by
                    </th>

                    <th className="p-4">
                      Used at
                    </th>

                    <th className="p-4">
  Actions
</th>

                  </tr>
                </thead>


                <tbody>

                  {invites.map((invite) => {

                    const status =
                      invite.status ||
                      (
                        invite.used
                          ? "Used"
                          : "Available"
                      );


                    return (
                      <tr
                        key={invite.id}
                        className="border-b border-neutral-100"
                      >

                        <td className="p-4 font-mono">
                          {invite.token ||
                            invite.id}
                        </td>


                        <td className="p-4">

                          <span
  className={
    status === "used"
      ? "text-red-700"
      : status === "revoked"
      ? "text-neutral-500"
      : status === "claimed"
      ? "text-amber-700"
      : "text-green-700"
  }
>
  {status}
</span>

                        </td>


                        <td className="p-4 text-neutral-500">
                          {formatDate(
                            invite.createdAt
                          )}
                        </td>


                        <td className="p-4">
                          {invite.usedEmail ||
                            "—"}
                        </td>


                        <td className="p-4 text-neutral-500">
                          {formatDate(
                            invite.usedAt
                          )}
                        </td>


                        <td className="p-4">
  {status !== "used" && status !== "revoked" ? (
    <details className="relative inline-block">
      <summary className="list-none cursor-pointer select-none text-neutral-500 hover:text-neutral-900">
        <span className="inline-flex items-center gap-1 px-2 py-1 border border-neutral-200 rounded hover:bg-neutral-50">
          Actions
          <span className="text-[10px]">▾</span>
        </span>
      </summary>

      <div className="absolute right-0 z-20 mt-1 w-40 bg-white border border-neutral-200 rounded shadow-lg py-1">
        <button
          type="button"
          onClick={() =>
            copyInviteCode(
              invite.token || invite.id
            )
          }
          className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          Copy code
        </button>

        <button
          type="button"
          onClick={() =>
            copyInviteLink(
              invite.token || invite.id
            )
          }
          className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          Copy link
        </button>

        <button
          type="button"
          onClick={() =>
            shareInviteLink(
              invite.token || invite.id
            )
          }
          className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
        >
          Share
        </button>

        <div className="my-1 border-t border-neutral-100" />

        <button
          type="button"
          onClick={() =>
            revokeInvite(invite)
          }
          className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50"
        >
          Revoke
        </button>
      </div>
    </details>
  ) : (
    <span className="text-xs text-neutral-400">
      —
    </span>
  )}
</td>
                      </tr>
                    );

                  })}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </div>
  );
}
