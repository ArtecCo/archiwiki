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
   * Watch Firebase authentication.
   */
  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

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

        const adminSnap = await getDoc(adminRef);

        setAuthorized(
          adminSnap.exists() &&
          adminSnap.data()?.active === true
        );
      } catch (err) {
        console.error(
          "Failed to check admin access:",
          err
        );

        setAuthorized(false);
      }

      setCheckingAccess(false);
    });
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

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    try {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      /*
       * Authorization is checked by the useEffect above.
       */
      const adminRef = doc(
        db,
        "adminUsers",
        credential.user.uid
      );

      const adminSnap = await getDoc(adminRef);

      if (
        !adminSnap.exists() ||
        adminSnap.data()?.active !== true
      ) {
        await signOut(auth);

        throw new Error(
          "This account is not authorized as an administrator."
        );
      }

      setEmail("");
      setPassword("");
    } catch (err) {
      console.error(
        "Admin login failed:",
        err
      );

      setError(
        err?.message ||
        "Unable to sign in."
      );
    }
  };

  const createInvite = async () => {
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


      setMessage(
        `Invitation created: ${token}`
      );
    } catch (err) {
      console.error(
        "Failed to create invitation:",
        err
      );

      setError(
        "Unable to create invitation."
      );
    } finally {
      setCreating(false);
    }
  };

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

  const formatDate = (value) => {
    if (!value) return "—";

    const date =
      typeof value.toDate === "function"
        ? value.toDate()
        : new Date(value);

    return date.toLocaleString();
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F2EB]">
        <p className="text-sm text-neutral-500">
          Checking administrator access…
        </p>
      </div>
    );
  }

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
            onClick={() => signOut(auth)}
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
