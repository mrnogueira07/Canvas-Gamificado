
// Import the functions you need from the SDKs you need
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Helper function to safely get environment variables
const getEnv = (key: string, fallback: string): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Ignore errors
  }
  return fallback;
};

// Configuração do Firebase usando variáveis de ambiente (Vite) com fallback
const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY", "AIzaSyBxur8AAtN5iBc2izHrA-bECaxqAX51atc"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN", "canvas-gamificado.firebaseapp.com"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID", "canvas-gamificado"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET", "canvas-gamificado.firebasestorage.app"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "402388744614"),
  appId: getEnv("VITE_FIREBASE_APP_ID", "1:402388744614:web:49ca056a2ee0c2e094f767"),
  measurementId: getEnv("VITE_FIREBASE_MEASUREMENT_ID", "G-RSXL8DQ7P1")
};

// Initialize Firebase
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
const auth = firebase.auth();
const db = getFirestore(app);

// Inicialização segura do Analytics para evitar erros em ambientes onde não é suportado
let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch((err) => {
    console.warn("Analytics não suportado neste ambiente:", err);
  });
}

// Export services so they can be used in other files
export { app, analytics, auth, db };
