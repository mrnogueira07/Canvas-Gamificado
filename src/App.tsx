import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import GeneratorPage from "./pages/GeneratorPage";
import StudioHome from "./pages/StudioHome";
import StudioEditor from "./pages/StudioEditor";
import { StudioJobNotifications } from "./components/studio/StudioJobNotifications";
import { useEffect, useState } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

import { ThemeProvider } from "./context/ThemeContext";
import { AppErrorBoundary } from "./components/ui/AppErrorBoundary";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Usuário não autenticado — estado normal de logout
        setIsAuthenticated(false);
        return;
      }

      // 1ª guarda: e-mail não verificado → derruba a sessão (exceto no localhost)
      if (!user.emailVerified && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        await signOut(auth);
        setIsAuthenticated(false);
        return;
      }

      // 2ª guarda: domínio fora do @innyx.com → derruba a sessão (exceto no localhost)
      if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && !user.email?.toLowerCase().endsWith("@innyx.com")) {
        await signOut(auth);
        setIsAuthenticated(false);
        return;
      }

      // Sincroniza informações de perfil do Google / Gmail na coleção "users"
      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(
          userDocRef,
          {
            uid: user.uid,
            name: user.displayName || user.email?.split("@")[0] || "Educador(a)",
            email: user.email || "",
            photoURL: user.photoURL || null,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("Erro ao sincronizar perfil do usuário:", err);
      }

      // Tudo certo → usuário autenticado e autorizado
      setIsAuthenticated(true);
    });
    return () => unsubscribe();
  }, []);

  // Mostra um spinner maneiro de carregamento enquanto a gente checa a autenticação
  if (isAuthenticated === null) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background:
            "linear-gradient(135deg, #0f0c29 0%, #1a1040 40%, #24243e 100%)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: "3px solid rgba(99,102,241,0.3)",
            borderTopColor: "#6366f1",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        {isAuthenticated && <StudioJobNotifications userId={auth.currentUser?.uid || ""} />}
        <AppErrorBoundary>
          <Routes>
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <Login />
              ) : (
                <Navigate to="/inicio" replace />
              )
            }
          />
          <Route
            path="/inicio"
            element={
              isAuthenticated ? <StudioHome section="inicio" /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/projetos"
            element={
              isAuthenticated ? <StudioHome section="projetos" /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/materiais"
            element={<Navigate to="/projetos" replace />}
          />
          <Route
            path="/modelos"
            element={
              isAuthenticated ? <StudioHome section="modelos" /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/ranking"
            element={
              isAuthenticated ? <StudioHome section="ranking" /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/studio/slides"
            element={
              isAuthenticated ? <StudioEditor kind="slides" /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/studio/roteiro"
            element={
              isAuthenticated ? <StudioEditor kind="roteiro" /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/studio/pacote"
            element={
              isAuthenticated ? <StudioEditor kind="pacote" /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/studio/:kind"
            element={
              <Navigate to="/studio/slides" replace />
            }
          />
          <Route
            path="/meus-roteiros"
            element={<Navigate to="/projetos" replace />}
          />
          <Route
            path="/dashboard"
            element={<Navigate to="/inicio" replace />}
          />
          <Route
            path="/canvas-generator/:username"
            element={
              isAuthenticated ? (
                <GeneratorPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/generator"
            element={
              <Navigate to="/inicio" replace />
            }
          />
          <Route
            path="/"
            element={
              <Navigate
                to={isAuthenticated ? "/inicio" : "/login"}
                replace
              />
            }
          />
          <Route
            path="*"
            element={
              <Navigate
                to={isAuthenticated ? "/inicio" : "/login"}
                replace
              />
            }
          />
          </Routes>
        </AppErrorBoundary>
      </Router>
    </ThemeProvider>
  );
}

export default App;
