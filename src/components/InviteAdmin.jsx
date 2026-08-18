import React, { useEffect, useState } from "react";
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
  getDoc
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

  /*
   * Check whether the currently authenticated Firebase
   * user exists in adminUsers/{uid} and is active.
   *
   * This deliberately checks auth.currentUser immediately
   * instead of waiting indefinitely for the auth listener.
   */
  useEffect(() => {
    let mounted = true;

    const checkAdminAccess = async (currentUser) => {
      if (!mounted) return;

      setUser(currentUser);

      /*
       * No authenticated Firebase user.
       * Stop checking immediately and show login.
       */
      if (!currentUser) {
        setAuthorized(false);
        setCheckingAccess(false);
        return;
      }

      try {
        const adminRef = doc(
          db,
          "adminUsers",
          currentUser.uid
        );

        /*
         * Prevent the admin page from remaining on the
         * loading screen forever if Firestore is unavailable.
         */
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                "Administrator access check timed out."
              )
            );
          }, 10000);
        });

        const adminSnap = await Promise.race([
          getDoc(adminRef),
          timeoutPromise
        ]);

        if (!mounted) return;

        const isAdmin =
          adminSnap.exists() &&
          adminSnap.data()?.active === true;

        setAuthorized(isAdmin);

        /*
         * If the authenticated Firebase account exists
         * but is not an active administrator, sign it out.
         */
        if (!isAdmin) {
          await signOut(auth);

          if (!mounted) return;

          setUser(null);
          setAuthorized(false);
        }
      } catch (err) {
        console.error(
          "Failed to check admin access:",
          err
        );

        if (!mounted) return;

        setAuthorized(false);

        if (
          err?.message ===
          "Administrator access check timed out."
        ) {
          setError(
            "Unable to connect to Firebase. Please check your connection and try again."
          );
        } else {
          setError(
            "Unable to verify administrator access. Check your Firestore rules."
          );
        }
      } finally {
        if (mounted) {
          setCheckingAccess(false);
        }
      }
    };

    /*
     * IMPORTANT:
     * Check the current Firebase user immediately.
     * This prevents the page from depending entirely
     * on the auth-state callback firing before rendering.
     */
    checkAdminAccess(auth.currentUser);

    /*
     * Continue watching authentication changes.
     */
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        checkAdminAccess(currentUser);
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  /*
   * Load invitations only after authorization.
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

    return onSnapshot(
      invitesQuery,
      (snapshot) => {
        setInvites(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
          }))
        );
      },
      (err) => {
        console.error(
          "Failed to load invitations:",
          err
        );

        setError(
          "Unable to load invitations. Check Firestore rules."
        );
      }
    );
  }, [authorized]);

  /*
   * Administrator login.
   */
  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    try {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email.trim().toLowerCase(),
          password
        );

      /*
       * Verify the authenticated Firebase UID against:
       *
       * adminUsers/{uid}
       */
      const adminRef = doc(
        db,
        "adminUsers",
        credential.user.uid
      );

      const adminSnap = await getDoc(adminRef);

      const isAdmin =
        adminSnap.exists() &&
        adminSnap.data()?.active === true;

      if (!isAdmin) {
        await signOut(auth);

        setUser(null);
        setAuthorized(false);

        throw new Error(
          "This account is not authorized as an administrator."
        );
      }

      /*
       * The auth listener will also see this user,
       * but explicitly update state here so the UI
       * does not have to wait for another auth event.
       */
      setUser(credential.user);
      setAuthorized(true);
      setCheckingAccess(false);

      setEmail("");
      setPassword("");
    } catch (err) {
      console.error(
        "Admin login failed:",
        err
      );

      setAuthorized(false);
      setCheckingAccess(false);

      if (
        err?.code === "auth/invalid-credential" ||
        err?.code === "auth/wrong-password"
      ) {
        setError("Incorrect email or password.");
      } else if (
        err?.code === "auth/user-not-found"
      ) {
        setError("No account exists with this email.");
      } else if (
        err?.code === "auth/invalid-email"
      ) {
        setError("Please enter a valid email address.");
      } else {
        setError(
          err?.message ||
          "Unable to sign in."
        );
      }
    }
  };

  /*
   * Create a new single-use invitation.
   */
  const createInvite = async () => {
    setError("");
    setMessage("");
    setCreating(true);

    try {
      if (!user) {
        throw new Error(
          "You must be signed in as an administrator."
        );
      }

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
   * Copy invitation token.
   */
  const copyInvite = async (token) => {
    try {
      await navigator.clipboard.writeText(token);

      setMessage(
        `Copied ${token}`
      );
    } catch {
      setError(
        "Unable to copy the invitation."
      );
    }
  };

  /*
   * Format Firestore timestamps.
   */
  const formatDate = (value) => {
    if (!value) return "—";

    const date =
      typeof value.toDate === "function"
        ? value.toDate()
        : new Date(value);

    return date.toLocaleString();
  };

  /*
   * Loading state.
   */
  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB]">
        <p className="text-sm text-neutral-500">
          Checking administrator access…
        </p>
      </div>
    );
  }

  /*
   * Login screen.
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
              <p className="text-xs text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-neutral-900 text-white rounded text-sm font-semibold"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  /*
   * Authorized administrator interface.
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

          <button
            onClick={async () => {
              await signOut(auth);
              setUser(null);
              setAuthorized(false);
              setCheckingAccess(false);
            }}
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            Sign out
          </button>
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
              {invites.length === 1 ? "" : "s"}
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
                    <th className="p-4">Code</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Created</th>
                    <th className="p-4">Used by</th>
                    <th className="p-4">Used at</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>

                <tbody>
                  {invites.map((invite) => {
                    const status =
                      invite.status ||
                      (invite.used
                        ? "used"
                        : "available");

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
                          {status !== "used" && (
                            <button
                              onClick={() =>
                                copyInvite(
                                  invite.token ||
                                    invite.id
                                )
                              }
                              className="text-neutral-500 hover:text-neutral-900"
                            >
                              Copy
                            </button>
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
