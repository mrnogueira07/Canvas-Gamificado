import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  updatePassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { RefreshCw, Mail, CheckCircle2 } from "lucide-react";

// Particle network canvas background
const ParticleCanvas: React.FC<{ mouseX: number; mouseY: number }> = ({
  mouseX,
  mouseY,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: mouseX, y: mouseY });

  useEffect(() => {
    mouseRef.current = { x: mouseX, y: mouseY };
  }, [mouseX, mouseY]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
    }

    const COUNT = 50;
    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 2 + 0.5,
    }));

    const MAX_DIST = 150;
    const MOUSE_RADIUS = 100;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          p.x += (dx / dist) * force * 2;
          p.y += (dy / dist) * force * 2;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(99, 102, 241, 0.3)";
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            const alpha = (1 - d / MAX_DIST) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
    />
  );
};

// Traduz os erros do Firebase para mensagens amigáveis em português
const translateFirebaseError = (err: any): string => {
  const code = err?.code || "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use":
      "Este e-mail já está cadastrado. Tente entrar ou use outro e-mail.",
    "auth/user-not-found": "Nenhuma conta encontrada com este e-mail.",
    "auth/wrong-password": "Senha incorreta. Por favor, tente novamente.",
    "auth/invalid-credential":
      "E-mail ou senha inválidos. Verifique seus dados.",
    "auth/invalid-email": "Formato de e-mail inválido.",
    "auth/weak-password": "Senha muito fraca. Use pelo menos 6 caracteres.",
    "auth/too-many-requests":
      "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
    "auth/network-request-failed":
      "Falha de conexão. Verifique sua internet e tente novamente.",
    "auth/popup-closed-by-user":
      "Login cancelado. A janela do Google foi fechada.",
    "auth/requires-recent-login":
      "Por segurança, faça login novamente para realizar essa ação.",
    "auth/user-disabled":
      "Esta conta foi desativada. Entre em contato com o suporte.",
  };
  return (
    messages[code] ||
    err?.message ||
    "Ocorreu um erro inesperado. Tente novamente."
  );
};

const Login: React.FC = () => {
  const navigate = useNavigate();

  // Auth State
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Google Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newGooglePassword, setNewGooglePassword] = useState("");

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 60, damping: 20 });
  const springY = useSpring(rawY, { stiffness: 60, damping: 20 });

  const orb1X = useTransform(springX, [-1, 1], [-30, 30]);
  const orb1Y = useTransform(springY, [-1, 1], [-30, 30]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      rawX.set(nx);
      rawY.set(ny);
      setMouse({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [rawX, rawY]);

  const isValidDomain = (em: string) => em.toLowerCase().endsWith("@innyx.com");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!isValidDomain(email)) {
        throw new Error(
          "Acesso restrito: apenas e-mails com domínio @innyx.com são autorizados.",
        );
      }

      if (isSignUp) {
        if (password !== confirmPassword)
          throw new Error("As senhas não coincidem.");
        if (password.length < 6)
          throw new Error("A senha deve ter pelo menos 6 caracteres.");

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const user = userCredential.user;
        await updateProfile(user, { displayName: name });
        await sendEmailVerification(user);
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name,
          email,
          createdAt: new Date(),
          passwordSet: true,
        });

        // Desloga imediatamente — só entra quem verificou o e-mail
        await signOut(auth);
        setAwaitingVerification(true);
      } else {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const user = userCredential.user;

        if (!user.emailVerified) {
          await signOut(auth);
          setError(
            "Sua conta ainda não foi verificada. Por favor, clique no link que enviamos para o seu e-mail.",
          );
          return;
        }
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error(err);
      setError(translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || !password) {
      setError("Por favor, preencha e-mail e senha para reenviar o código.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      if (!userCredential.user.emailVerified) {
        await sendEmailVerification(userCredential.user);
      }
      await signOut(auth);
      setAwaitingVerification(true);
    } catch (err: any) {
      setError(translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email || !isValidDomain(user.email)) {
        await auth.signOut();
        throw new Error(
          "Acesso restrito: apenas e-mails com domínio @innyx.com são autorizados.",
        );
      }

      // Google accounts are always email-verified by Google
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        if (userDoc.data().passwordSet) {
          navigate("/dashboard");
          return;
        }
      } else {
        await setDoc(userDocRef, {
          uid: user.uid,
          name: user.displayName || "",
          email: user.email,
          createdAt: new Date(),
          passwordSet: false,
        });
      }
      setShowPasswordModal(true);
    } catch (err: any) {
      console.error(err);
      setError(translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSetGooglePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (newGooglePassword.length < 6) {
      setError("Senha muito curta.");
      setLoading(false);
      return;
    }
    try {
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, newGooglePassword);
        await setDoc(
          doc(db, "users", user.uid),
          { passwordSet: true },
          { merge: true },
        );
        setShowPasswordModal(false);
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error(err);
      setError(translateFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh-light flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <motion.div
        style={{ x: orb1X, y: orb1Y }}
        className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"
      />
      <motion.div
        style={{ x: -orb1X, y: -orb1Y }}
        className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"
      />

      <ParticleCanvas mouseX={mouse.x} mouseY={mouse.y} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="bg-slate-100/90 backdrop-blur-3xl rounded-[3.5rem] p-12 shadow-[0_32px_120px_-20px_rgba(79,70,229,0.15)] border border-slate-200/50 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -ml-16 -mb-16" />

          {/* ── TELA DE AGUARDANDO VERIFICAÇÃO ── */}
          {awaitingVerification ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center gap-6"
            >
              <div className="w-20 h-20 bg-indigo-500 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/30">
                <Mail className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
                  Verifique seu e-mail
                </h1>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  Enviamos um link de verificação para
                  <br />
                  <span className="font-black text-indigo-500">{email}</span>
                </p>
              </div>
              <div className="w-full p-5 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-2 text-left">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-600">
                    Abra o e-mail que acabamos de enviar
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-600">
                    Clique no link de confirmação
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-600">
                    Volte aqui e faça seu login normalmente
                  </span>
                </div>
              </div>
              {error && (
                <div className="w-full p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold rounded-2xl text-center">
                  {error}
                </div>
              )}
              <button
                onClick={() => {
                  setAwaitingVerification(false);
                  setError("");
                }}
                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                Já verifiquei — Fazer Login
              </button>
              <button
                onClick={handleResendVerification}
                disabled={loading}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-3 h-3 animate-spin mx-auto" />
                ) : (
                  "Reenviar e-mail de verificação"
                )}
              </button>
            </motion.div>
          ) : (
            <>
              {/* ── TELA DE LOGIN / CADASTRO ── */}
              <div className="flex flex-col items-center mb-10">
                <motion.div
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="w-20 h-20 bg-white shadow-xl shadow-indigo-500/10 rounded-3xl flex items-center justify-center mb-6 border border-indigo-50"
                >
                  <img
                    src="/logo.png"
                    alt="Logo"
                    className="w-12 h-12 object-contain"
                  />
                </motion.div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">
                  {isSignUp ? "Criar Conta" : "Game Canvas IA"}
                </h1>
                <p className="text-slate-500 text-sm font-medium text-center">
                  {isSignUp
                    ? "Cadastre-se para começar"
                    : "Prepare-se para aulas extraordinárias"}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-5">
                {isSignUp && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full p-4 bg-indigo-50/30 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white text-slate-800 transition-all font-medium"
                      required
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full p-4 bg-indigo-50/30 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white text-slate-800 transition-all font-medium"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-4 bg-indigo-50/30 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white text-slate-800 transition-all font-medium"
                    required
                  />
                </div>
                {isSignUp && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Confirmar Senha
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800"
                      required
                    />
                  </div>
                )}

                {error && (
                  <div className="space-y-3">
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold rounded-2xl text-center">
                      {error}
                    </div>
                    {error.includes("não foi verificada") && (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={loading}
                        className="w-full text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-600 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {loading ? (
                          <RefreshCw className="w-3 h-3 animate-spin mx-auto" />
                        ) : (
                          "Reenviar e-mail de verificação"
                        )}
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                  ) : isSignUp ? (
                    "Criar Conta e Verificar"
                  ) : (
                    "Entrar na Plataforma"
                  )}
                </button>
              </form>

              <div className="mt-8 flex flex-col gap-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] font-black text-slate-400">
                    <span className="px-4 bg-slate-50 rounded-full uppercase tracking-[0.2em]">
                      Ou continue com
                    </span>
                  </div>
                </div>
                <motion.button
                  whileHover={{
                    scale: 1.02,
                    y: -2,
                    boxShadow: "0 20px 40px -10px rgba(79,70,229,0.1)",
                  }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-4 bg-slate-100/80 backdrop-blur-sm border border-slate-200/50 text-slate-800 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-colors hover:bg-white cursor-pointer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"
                    />
                    <path
                      fill="#34A853"
                      d="M16.04 18.013c-1.09.593-2.346.915-3.644.915-2.855 0-5.304-1.857-6.13-4.407L2.24 17.636C4.2 21.59 8.27 24 12.604 24c3.055 0 5.782-1.013 7.718-2.727l-4.282-3.26Z"
                    />
                    <path
                      fill="#4285F4"
                      d="M22.218 8.455h-9.822v4.718h5.618c-.24 1.233-.941 2.276-1.97 2.943l4.282 3.26C22.836 17.51 24 14.945 24 12c0-.85-.109-1.673-.282-2.455-1.5 0-1.5 0-1.5-1.09Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.266 14.235c-.202-.6-.317-1.24-.317-1.909 0-.668.115-1.309.317-1.909L1.24 7.302A11.97 11.97 0 0 0 0 12c0 1.688.35 3.298.98 4.755l4.286-2.52Z"
                    />
                  </svg>
                  Google Account
                </motion.button>
              </div>

              <div className="mt-10 text-center">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                  }}
                  className="text-xs font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-all hover:underline cursor-pointer"
                >
                  {isSignUp
                    ? "Já tem uma conta? Entrar"
                    : "Novo por aqui? Criar conta"}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-light p-10 rounded-[3rem] w-full max-w-sm border border-white shadow-2xl text-center"
          >
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/10 border border-indigo-50">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">
              Defina sua Senha
            </h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">
              Crie uma senha de acesso para facilitar seu próximo login.
            </p>
            <form onSubmit={handleSetGooglePassword} className="space-y-4">
              <input
                type="password"
                value={newGooglePassword}
                onChange={(e) => setNewGooglePassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-800 text-center font-bold"
                required
              />
              <button
                type="submit"
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all hover:bg-slate-800 cursor-pointer"
              >
                Concluir Cadastro
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Login;
