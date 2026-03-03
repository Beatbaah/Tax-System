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
  apiKey: "AIzaSyD6yPkTvwra2X6uoHQMuqpYJ2KxIGc4sGs",
  authDomain: "bekwai-tax-system.firebaseapp.com",
  projectId: "bekwai-tax-system",
  storageBucket: "bekwai-tax-system.firebasestorage.app",
  messagingSenderId: "498706366746",
  appId: "1:498706366746:web:449552d95e0ba6b7472ca3"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);

// One line gives you full offline support.
// Firebase caches all data locally, lets Officers work without internet,
// then syncs everything automatically the moment connection returns.
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === "failed-precondition") {
    console.warn("Offline persistence: only one browser tab allowed at a time.");
  } else if (err.code === "unimplemented") {
    console.warn("This browser does not support offline persistence.");
  }
});
