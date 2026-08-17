import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  enableIndexedDbPersistence, 
  doc, 
  runTransaction 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDbM8rNS3ka7Ep5oB4urLB1l5HG4-DzEoo",

  authDomain: "archiwiki-be104.firebaseapp.com",

  projectId: "archiwiki-be104",

  storageBucket: "archiwiki-be104.firebasestorage.app",

  messagingSenderId: "1047391408919",

  appId: "1:1047391408919:web:b58f8eb374b5606476dd52",

  measurementId: "G-Q6VT0BZ1WD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Enable Firestore Offline Persistence for seamless offline/airplane writing
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("Multiple tabs open; offline persistence enabled in primary tab only.");
  } else if (err.code === 'unimplemented') {
    console.warn("The current browser does not support offline persistence.");
  }
});

/**
 * Acquire an active editing lock on a document.
 * Prevents multi-device concurrent editing collisions.
 */
export const acquireLock = async (noteId, userId, sessionToken) => {
  const lockRef = doc(db, "locks", noteId);
  const now = Date.now();
  const lockDuration = 5 * 60 * 1000; // 5 minutes validity

  return runTransaction(db, async (transaction) => {
    const lockSnap = await transaction.get(lockRef);
    if (lockSnap.exists()) {
      const lockData = lockSnap.data();
      // If lock is still valid, not expired, and held by someone else (different session)
      if (lockData.expiresAt > now && lockData.sessionToken !== sessionToken) {
        return { success: false, lockedBy: lockData.userId };
      }
    }
    // Acquire or renew lock
    transaction.set(lockRef, {
      userId,
      sessionToken,
      expiresAt: now + lockDuration,
      updatedAt: now
    });
    return { success: true };
  });
};

/**
 * Cleanly release lock on note when closing or moving away
 */
export const releaseLock = async (noteId, sessionToken) => {
  const lockRef = doc(db, "locks", noteId);
  try {
    await runTransaction(db, async (transaction) => {
      const lockSnap = await transaction.get(lockRef);
      if (lockSnap.exists() && lockSnap.data().sessionToken === sessionToken) {
        transaction.delete(lockRef);
      }
    });
  } catch (err) {
    console.error("Error releasing lock:", err);
  }
};

export { db, auth };
