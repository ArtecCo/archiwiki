import React, { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "firebase/auth";

import {
  doc,
  runTransaction,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";


import { auth, db } from "../firebase";
import { deriveMasterKey } from "../crypto";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [masterKey, setMasterKey] = useState(() => {
    return sessionStorage.getItem("scribe_session_aes_key") || null;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        clearLocalKey();
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const clearLocalKey = () => {
    sessionStorage.removeItem("scribe_session_aes_key");
    setMasterKey(null);
  };

  /*
   * The Firebase login password is now also used
   * to derive the local AES-256 encryption key.
   *
   * The password itself is NEVER stored in Firestore
   * or sessionStorage.
   */

  const registerWithInvite = async (
  email,
  password,
  inviteToken
) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedInvite = inviteToken.trim();

  if (!normalizedEmail) {
    throw new Error("Please enter your email address.");
  }

  if (!password) {
    throw new Error("Please enter a password.");
  }

  if (!normalizedInvite) {
    throw new Error("Please enter an invite token.");
  }

  const inviteRef = doc(
    db,
    "pendingInvites",
    normalizedInvite
  );

  /*
   * IMPORTANT:
   *
   * Claim the invite atomically BEFORE creating the
   * Firebase account.
   *
   * This prevents two browsers from using the same
   * invite at the same time.
   */
  const claimId =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  await runTransaction(db, async (transaction) => {
    const inviteSnap = await transaction.get(inviteRef);

    if (!inviteSnap.exists()) {
      throw new Error("Invalid invite token.");
    }

    const invite = inviteSnap.data();

    if (invite.used === true) {
      throw new Error(
        "This invite token has already been used."
      );
    }

    /*
     * Mark it as claimed immediately.
     *
     * Because this happens inside a transaction,
     * concurrent registration attempts cannot both
     * successfully claim the same invite.
     */
    transaction.update(inviteRef, {
      used: true,
      claimId,
      claimedAt: serverTimestamp(),
      usedBy: null,
      usedEmail: null,
      usedAt: null
    });
  });

  let newUser = null;

  try {
    /*
     * Firebase Auth itself prevents duplicate
     * email/password accounts in the same project.
     */
    const userCredential =
      await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

    newUser = userCredential.user;

    /*
     * Finalize the invitation.
     */
    await updateDoc(inviteRef, {
      used: true,
      claimId: null,
      usedBy: newUser.uid,
      usedEmail: normalizedEmail,
      usedAt: serverTimestamp()
    });

  } catch (error) {
    /*
     * If account creation definitely failed, release
     * our claim so the invite can be used again.
     *
     * We only release the invite if there is no
     * Firebase user from this registration attempt.
     */
    if (!newUser) {
      try {
        await runTransaction(db, async (transaction) => {
          const inviteSnap =
            await transaction.get(inviteRef);

          if (!inviteSnap.exists()) {
            return;
          }

          const invite = inviteSnap.data();

          /*
           * Only release OUR claim.
           *
           * Never overwrite somebody else's claim.
           */
          if (
            invite.used === true &&
            invite.claimId === claimId
          ) {
            transaction.update(inviteRef, {
              used: false,
              claimId: null,
              claimedAt: null,
              usedBy: null,
              usedEmail: null,
              usedAt: null
            });
          }
        });
      } catch (releaseError) {
        console.error(
          "Failed to release invite claim:",
          releaseError
        );
      }
    }

    throw error;
  }

  /*
   * Derive local encryption key from the same password
   * and Firebase UID used by the existing application.
   */
  const derived = deriveMasterKey(
    password,
    newUser.uid
  );

  sessionStorage.setItem(
    "scribe_session_aes_key",
    derived
  );

  setMasterKey(derived);

  return newUser;
};




  const logout = async () => {
    await signOut(auth);
    clearLocalKey();
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        masterKey,
        registerWithInvite,
        login,
        unlock,
        logout,
        resetPassword
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
