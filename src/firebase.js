import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  enableIndexedDbPersistence 
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

export { db, auth };
