
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPXosl-PjSZ645njpDnd_6y4GxzroNdDk",
  authDomain: "siza-me.firebaseapp.com",
  projectId: "siza-me",
  storageBucket: "siza-me.firebasestorage.app",
  messagingSenderId: "757286741457",
  appId: "1:757286741457:web:ceeac2b1644dfb55362cf0",
  measurementId: "G-SHK1SXLC9C"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

console.log("Siza-Me Firebase connected!");
