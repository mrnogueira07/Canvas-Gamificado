
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import * as firebaseAuth from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Helper function to safely get environment variables
// This handles both Vite (import.meta.env) and standard process.env scenarios
const getEnv = (key: string, fallback: string): string => {
  try {
    // 1. Try standard process.env (Node/Webpack)
    if (typeof process !== 'undefined' && process && process.env && process.env[key]) {
      return process.env[key];
    }
    
    // 2. Try Vite's import.meta.env
    // We check existence of 'import.meta' and 'import.meta.env' defensively
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      const val = import.meta.env[key];
      if (val) return val;
    }
  } catch (e) {
    // Ignore errors to prevent crash
    console.warn(`Warning: Error reading env var ${key}`, e);
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
// Ensure we don't initialize twice in HMR or re-renders
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use namespace import if getAuth is not exported directly (e.g. strict ESM/CJS interop issues)
const auth = firebaseAuth.getAuth ? firebaseAuth.getAuth(app) : (firebaseAuth as any).default?.getAuth?.(app) || getAuth(app);

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
