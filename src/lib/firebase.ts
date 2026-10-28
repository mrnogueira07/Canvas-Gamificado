/**
 * Configuração e inicialização do Firebase (Auth, Firestore, Storage, Functions e Analytics)
 */
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Configurações do projeto Firebase (Mind Canvas / canvasgame-2025)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAsW8ajQ9p4t65uYxsbRb2GShgeCAO2Rug",
  authDomain: "canvasgame-2025.firebaseapp.com",
  projectId: "canvasgame-2025",
  storageBucket: "canvasgame-2025.firebasestorage.app",
  messagingSenderId: "1053489460817",
  appId: "1:1053489460817:web:aa12c0fef4b1c3fec9aa70",
  measurementId: "G-QJXK3ZFLZ2",
};

// Inicializa a instância do Firebase
const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

// Exporta as instâncias de Auth, Firestore, Storage e Functions para uso no projeto
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
