
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Configuração do Firebase atualizada conforme fornecido
const firebaseConfig = {
  apiKey: "AIzaSyBxur8AAtN5iBc2izHrA-bECaxqAX51atc",
  authDomain: "canvas-gamificado.firebaseapp.com",
  projectId: "canvas-gamificado",
  storageBucket: "canvas-gamificado.firebasestorage.app",
  messagingSenderId: "402388744614",
  appId: "1:402388744614:web:49ca056a2ee0c2e094f767",
  measurementId: "G-RSXL8DQ7P1"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
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
