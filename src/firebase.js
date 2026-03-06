// =============================================================================
// src/firebase.js  —  Place this file at src/firebase.js
// =============================================================================
// Replace the placeholder values below with YOUR actual Firebase config.
// Get them from: Firebase Console → Project Settings → General → Your apps
// =============================================================================

import { initializeApp }                          from "firebase/app";
import { getAuth }                                from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// One line gives you full offline support.
// Firebase caches all data locally, lets officers work without internet,
// then syncs everything automatically the moment connection returns.
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === "failed-precondition") {
    console.warn("Offline persistence: only one browser tab allowed at a time.");
  } else if (err.code === "unimplemented") {
    console.warn("This browser does not support offline persistence.");
  }
});
