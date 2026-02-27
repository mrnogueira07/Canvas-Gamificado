import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC-kgklRml2RDoffWc-ydIHUw1GIvCpG6c",
    authDomain: "canvasgame-2025.firebaseapp.com",
    projectId: "canvasgame-2025",
    storageBucket: "canvasgame-2025.firebasestorage.app",
    messagingSenderId: "1053489460817",
    appId: "1:1053489460817:web:70bc1ce02b3a1494c9aa70",
    measurementId: "G-6Y46STKM6B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

