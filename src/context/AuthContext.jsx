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
  updateDoc, 
  collection, 
  getDocs 
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

  /**
   * Registers a new user only if a valid, unused registration invite token is passed.
   */
  const registerWithInvite = async (email, password, inviteToken, masterPassword) => {
    // 1. Validate invite token exists and is active
    const inviteRef = doc(db, "pendingInvites", inviteToken);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists() || inviteSnap.data().used === true) {
      throw new Error("Invalid or already exhausted invite token.");
    }

    // 2. Create the user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const newUser = userCredential.user;

    // 3. Set the invite token to used
    await updateDoc(inviteRef, {
      used: true,
      usedBy: newUser.email,
      usedAt: Date.now()
    });

    // 4. Derive and set the client master password key locally
    const derived = deriveMasterKey(masterPassword, newUser.uid);
    sessionStorage.setItem("scribe_session_aes_key", derived);
    setMasterKey(derived);

    return newUser;
  };

  /**
   * Classic Sign-In with an additional prompt requirement for the local decryption key
   */
  const login = async (email, password, masterPassword) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const loggedUser = userCredential.user;
    
    // Derive and set the Master AES Key locally
    const derived = deriveMasterKey(masterPassword, loggedUser.uid);
    sessionStorage.setItem("scribe_session_aes_key", derived);
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
    <AuthContext.Provider value={{
      user,
      loading,
      masterKey,
      registerWithInvite,
      login,
      logout,
      resetPassword
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
