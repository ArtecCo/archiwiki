import React, { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "firebase/auth";

import {
  doc,
  getDoc,
  updateDoc
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
    // 1. Validate invite token
    const inviteRef = doc(db, "pendingInvites", inviteToken);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists() || inviteSnap.data().used === true) {
      throw new Error("Invalid or already exhausted invite token.");
    }

    // 2. Create Firebase account
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const newUser = userCredential.user;

    // 3. Mark invite as used
    await updateDoc(inviteRef, {
      used: true,
      usedBy: newUser.email,
      usedAt: Date.now()
    });

    // 4. Derive local encryption key from LOGIN PASSWORD
    const derived = deriveMasterKey(password, newUser.uid);

    sessionStorage.setItem(
      "scribe_session_aes_key",
      derived
    );

    setMasterKey(derived);

    return newUser;
  };

  /*
   * Login password is also the encryption password.
   */
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const loggedUser = userCredential.user;

    // Derive encryption key from the same login password
    const derived = deriveMasterKey(
      password,
      loggedUser.uid
    );

    sessionStorage.setItem(
      "scribe_session_aes_key",
      derived
    );

    setMasterKey(derived);

    return loggedUser;
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
        logout,
        resetPassword
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
