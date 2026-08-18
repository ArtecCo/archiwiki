import React, { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser
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

  let newUser = null;

  try {
    /*
     * Create the Firebase account first.
     *
     * This authenticates the user so Firestore rules
     * can verify request.auth.uid when consuming the invite.
     */
    const userCredential =
      await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

    newUser = userCredential.user;

    /*
     * Atomically consume the invitation.
     *
     * The Firestore transaction prevents two users
     * from successfully consuming the same invite.
     */
    await runTransaction(db, async (transaction) => {
      const inviteSnap =
        await transaction.get(inviteRef);

      if (!inviteSnap.exists()) {
        throw new Error("Invalid invite token.");
      }

      const invite = inviteSnap.data();

      if (invite.used === true) {
        throw new Error(
          "This invite token has already been used."
        );
      }

      transaction.update(inviteRef, {
        used: true,
        status: "used",
        claimId: null,
        claimedAt: null,
        usedBy: newUser.uid,
        usedEmail: normalizedEmail,
        usedAt: serverTimestamp()
      });
    });

    /*
     * Only derive the encryption key after the
     * account and invite have both succeeded.
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

  } catch (error) {

    /*
     * If account creation succeeded but the invite
     * could not be consumed, remove the newly-created
     * Firebase account so the registration is rolled back.
     */
    if (newUser) {
      try {
        await deleteUser(newUser);
      } catch (deleteError) {
        console.error(
          "Failed to roll back Firebase account:",
          deleteError
        );
      }
    }

    throw error;
  }
};


  /*
   * Derive local encryption key from the same password
   * and Firebase UID used by the existing application.
   */




  const logout = async () => {
    await signOut(auth);
    clearLocalKey();
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const login = async (email, password) => {
  const normalizedEmail = email.trim().toLowerCase();

  const credential = await signInWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );

  const derived = deriveMasterKey(
    password,
    credential.user.uid
  );

  sessionStorage.setItem(
    "scribe_session_aes_key",
    derived
  );

  setMasterKey(derived);

  return credential.user;
};

const unlock = async (password) => {
  if (!user) {
    throw new Error("No authenticated user.");
  }

  const credential = EmailAuthProvider.credential(
    user.email,
    password
  );

  await reauthenticateWithCredential(
    user,
    credential
  );

  const derived = deriveMasterKey(
    password,
    user.uid
  );

  sessionStorage.setItem(
    "scribe_session_aes_key",
    derived
  );

  setMasterKey(derived);

  return derived;
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
