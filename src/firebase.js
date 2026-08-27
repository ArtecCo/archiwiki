import { initializeApp } from "firebase/app";
import { 
  getFirestore
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Enable Firestore Offline Persistence for seamless offline/airplane writing
// enableIndexedDbPersistence(db).catch((err) => {
//   if (err.code === 'failed-precondition') {
//     console.warn("Multiple tabs open; offline persistence enabled in primary tab only.");
//   } else if (err.code === 'unimplemented') {
//     console.warn("The current browser does not support offline persistence.");
//   }
// });

export { db, auth };
