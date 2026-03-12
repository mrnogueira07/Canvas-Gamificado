import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GeneratorPage from "./pages/GeneratorPage";
import { useEffect, useState } from "react";
import { auth } from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { ThemeProvider } from "./context/ThemeContext";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !user.emailVerified) {
        // Usuário logado mas e-mail NÃO verificado: força logout imediato
        await signOut(auth);
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(!!user);
      }
    });
    return () => unsubscribe();
  }, []);

  // Show loading spinner while checking auth
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
        <Routes>
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <Login />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />
            }
          />
          <Route
            path="/generator"
            element={
              isAuthenticated ? (
                <GeneratorPage />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route
            path="/"
            element={
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
