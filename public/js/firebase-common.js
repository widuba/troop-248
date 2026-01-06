// public/js/firebase-common.js
// Shared Firebase app/auth/db/storage for all pages.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// 🚨 IMPORTANT 🚨
// Go to Firebase console → Project Settings → General → Your web app config
// Copy the *entire* firebaseConfig object and paste it here, replacing this one.

const firebaseConfig = {
  apiKey: "AIzaSyD5qUHa2JuQ3iI7U3DrX7JDyhx76PGzhxM",
  authDomain: "troop-248.firebaseapp.com",
  projectId: "troop-248",
  storageBucket: "troop-248.firebasestorage.app", // ← very likely needs to be "troop-248.appspot.com"
  messagingSenderId: "925363875752",
  appId: "1:925363875752:web:0b001c1a7a09fb8232f79d",
  measurementId: "G-NY75GX5TBH"
};

// ⬆️ Replace the whole object above with the one from Firebase console so there is ZERO mismatch.

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
