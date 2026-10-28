import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { AlertTriangle, ArrowRight, Gamepad2, Presentation, Video, LockKeyhole, RefreshCw } from "lucide-react";
import { LoginFlowBackground } from "../components/ui/LoginFlowBackground";
import { Turnstile } from "../components/auth/Turnstile";
import type { TurnstileRef } from "../components/auth/Turnstile";
import "../styles/login.css";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blockedEmail, setBlockedEmail] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileRef>(null);

  const handleGoogleLogin = async () => {
    if (loading) return;
    if (!turnstileToken) {
      setError("Conclua a verificação da Cloudflare para continuar.");
      return;
    }
    setLoading(true);
    setError("");
    setBlockedEmail(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const { user } = await signInWithPopup(auth, provider);
      if (!user.email || !user.email.toLowerCase().endsWith("@innyx.com")) {
        await signOut(auth);
        setBlockedEmail(user.email || "Conta sem e-mail");
        return;
      }
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          name: user.displayName || user.email.split("@")[0] || "",
          email: user.email,
          photoURL: user.photoURL || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          passwordSet: false,
        });
      } else {
        await setDoc(
          userDocRef,
          {
            name: user.displayName || userDoc.data()?.name || user.email.split("@")[0] || "",
            email: user.email,
            photoURL: user.photoURL || userDoc.data()?.photoURL || null,
            updatedAt: new Date(),
          },
          { merge: true }
        );
      }
      navigate("/inicio");
    } catch (err: unknown) {
      const code = typeof err === "object" && err !== null && "code" in err ? String(err.code) : "";
      const messages: Record<string, string> = {
        "auth/popup-closed-by-user": "A janela do Google foi fechada. Tente novamente quando quiser.",
        "auth/cancelled-popup-request": "Outra tentativa de acesso está em andamento.",
        "auth/popup-blocked": "Permita a abertura da janela do Google no navegador para continuar.",
        "auth/network-request-failed": "Verifique sua conexão e tente novamente.",
        "auth/too-many-requests": "Muitas tentativas. Aguarde um instante e tente novamente.",
        "auth/user-disabled": "Esta conta foi desativada. Entre em contato com o suporte.",
      };
      setError(messages[code] || "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
      setTurnstileToken("");
      turnstileRef.current?.reset();
    }
  };

  return (
    <div className="mind-login">
      <LoginFlowBackground />
      <header className="mind-login-header">
        <div className="mind-login-brand">
          <div className="mind-login-brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="rgba(255, 255, 255, 0.22)" stroke="#ffffff" />
              <path d="M2 17l10 5 10-5" stroke="#ffffff" />
              <path d="M2 12l10 5 10-5" stroke="#ffffff" />
            </svg>
          </div>
          <div>
            <span className="mind-login-brand-title">Mind Canvas</span>
            <span className="mind-login-brand-caption">WORKSPACE PEDAGÓGICO</span>
          </div>
        </div>
        <img src="/logo-innyx-branco.webp" alt="INNYX Educação" className="mind-login-innyx" />
      </header>

      <main className="mind-login-main">
        <section className="mind-login-intro" aria-labelledby="mind-login-title">
          <div className="mind-login-eyebrow"><span /> SEU ESPAÇO DE CRIAÇÃO PEDAGÓGICA</div>
          <h1 id="mind-login-title">Grandes ideias.<br /><span>Novas formas<br />de aprender.</span></h1>
          <p className="mind-login-description">Dê vida às suas ideias com o MIND CANVAS. Crie jogos, apresentações e roteiros que transformam conteúdo em experiências de aprendizagem ativas e alinhadas à BNCC.</p>
          <div className="mind-login-formats" aria-label="Formatos disponíveis no estúdio">
            <div className="mind-login-format format-game"><span className="mind-login-format-icon games"><Gamepad2 size={20} strokeWidth={1.8} aria-hidden="true" /></span><span>Game Canvas<small>Aprender jogando</small></span></div>
            <div className="mind-login-format format-slides"><span className="mind-login-format-icon slides"><Presentation size={20} strokeWidth={1.8} aria-hidden="true" /></span><span>Slides Canvas<small>Sequência visual de aula</small></span></div>
            <div className="mind-login-format format-script"><span className="mind-login-format-icon scripts"><Video size={20} strokeWidth={1.8} aria-hidden="true" /></span><span>Roteiro de Gravação<small>Decupagem cena a cena</small></span></div>
          </div>
          <div className="mind-login-intro-note"><span className="mind-login-note-line" /> Da primeira ideia à próxima experiência pedagógica.</div>
        </section>

        <section className="mind-login-card" aria-label="Acesso ao MIND CANVAS" aria-busy={loading}>
          <div className="mind-login-card-heading">
            <div className="mind-login-card-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" fill="rgba(255, 255, 255, 0.28)" stroke="#ffffff" />
                <path d="M2 17l10 5 10-5" stroke="#ffffff" />
                <path d="M2 12l10 5 10-5" stroke="#ffffff" />
              </svg>
            </div>
            <div>
              <h2>MIND CANVAS</h2>
              <p>Acesse seu workspace pedagógico integrado.</p>
            </div>
          </div>

          {blockedEmail ? (
            <div className="mind-login-state">
              <span className="mind-login-state-icon denied"><LockKeyhole size={26} aria-hidden="true" /></span>
              <h3>Acesso restrito</h3>
              <p>A conta <strong>{blockedEmail}</strong> não tem permissão para acessar o estúdio. Utilize sua conta corporativa INNYX (@innyx.com).</p>
              <button type="button" className="mind-login-google" disabled={loading || !turnstileToken} onClick={handleGoogleLogin}>Tentar com outra conta<ArrowRight size={17} aria-hidden="true" /></button>
            </div>
          ) : (
            <div className="mind-login-google-access">
              <p className="mind-login-access-description">Entre com sua conta Google corporativa para continuar.</p>
              <button type="button" onClick={handleGoogleLogin} disabled={loading || !turnstileToken} className="mind-login-google">
                {loading ? <RefreshCw size={20} className="animate-spin" aria-hidden="true" /> : (
                <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.04 46.98 31.9 46.98 24.55Z" /><path fill="#FBBC05" d="M10.53 28.59a14.41 14.41 0 0 1 0-9.18l-7.97-6.19a23.91 23.91 0 0 0 0 21.56l7.97-6.19Z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48Z" /></svg>
                )}
                {loading ? "Conectando..." : "Continuar com o Google"}
              </button>
            </div>
          )}

          <div className="mind-login-security">
            <span className="mind-login-security-label">Verificação de segurança</span>
            <Turnstile
              ref={turnstileRef}
              theme="dark"
              size="flexible"
              onVerify={(token) => { setTurnstileToken(token); setError(""); }}
              onExpire={() => setTurnstileToken("")}
              onError={() => {
                setTurnstileToken("");
                setError("Não foi possível carregar a verificação da Cloudflare. Atualize a página para tentar novamente.");
              }}
            />
          </div>

          {error && <div className="mind-login-message error" role="alert"><AlertTriangle size={18} aria-hidden="true" /><span>{error}</span></div>}
          <div className="mind-login-card-footer"><LockKeyhole size={14} aria-hidden="true" /><span>Ambiente exclusivo INNYX · @innyx.com</span></div>
        </section>
      </main>

      <footer className="mind-login-footer">
        <span>MIND CANVAS <span className="mind-login-footer-dot">·</span> Uma iniciativa INNYX Educação</span>
        <span>Ideias conectadas. Aprendizagem transformada.</span>
      </footer>
    </div>
  );
};

export default Login;
