
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { AlertCircle, Eye, EyeOff, UserPlus, LogIn, Code2, ArrowLeft, CheckCircle } from 'lucide-react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

interface LoginProps {
  onLogin: () => void;
}

// --- Particle Background Component ---
const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let animationFrameId: number;

    const particles: any[] = [];
    const particleCount = 70; // Adjust density

    // Particle Class
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.3; // Slow movement
        this.vy = (Math.random() - 0.5) * 0.3;
        this.size = Math.random() * 2 + 0.5;
        // Tech colors: purple/blue hints
        const colors = ['rgba(99, 102, 241, 0.5)', 'rgba(168, 85, 247, 0.5)', 'rgba(203, 213, 225, 0.5)']; 
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
    }

    // Init
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      // Draw Particles
      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      // Draw Connections (Tech effect)
      particles.forEach((a, i) => {
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full bg-gradient-to-br from-gray-100 to-gray-300 pointer-events-none z-0"
    />
  );
};

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [apiErrorLink, setApiErrorLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Validação de domínio Innyx
  const validateDomain = (email: string) => {
    return email.toLowerCase().endsWith('@innyx.com');
  };

  const handleGoogleLogin = async () => {
    setError('');
    setApiErrorLink(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check domain for Google Login as well
      if (user.email && !validateDomain(user.email)) {
         await user.delete(); // Remove user if created
         await signOut(auth);
         setError('Acesso restrito. Utilize um e-mail corporativo @innyx.com');
         setLoading(false);
         return;
      }

      // Check if user exists in Firestore, if not create
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          createdAt: serverTimestamp(),
        });
      }
      // Auth listener in App.tsx handles the rest
    } catch (err: any) {
      console.error(err);
      
      const errorMessage = err.message || '';
      
      if (errorMessage.includes('identity-toolkit-api-has-not-been-used') || errorMessage.includes('disabled')) {
        const match = errorMessage.match(/project=(\d+)/) || errorMessage.match(/project\s+(\d+)/);
        const projectId = match ? match[1] : 'canvas-gamificado';
        
        setApiErrorLink(`https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${projectId}`);
        setError('A API de Autenticação não está ativada. Clique no link abaixo para ativar.');
      } else if (errorMessage.includes('auth/popup-closed-by-user')) {
        setError('O login com Google foi cancelado.');
      } else {
        setError('Erro ao autenticar com Google. Verifique a configuração.');
      }
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setApiErrorLink(null);
    setLoading(true);

    try {
      if (isRegistering) {
        // Validação de Domínio Estrita
        if (!validateDomain(email)) {
           setError('O cadastro é restrito exclusivamente ao domínio @innyx.com');
           setLoading(false);
           return;
        }

        // Sign Up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, {
          displayName: name
        });

        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name: name,
          email: email,
          createdAt: serverTimestamp(),
        });

        await sendEmailVerification(user);
        await signOut(auth);
        setRegistrationSuccess(true);
      } else {
        // Login
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error('Login error full:', err);
      
      const errorCode = err.code || '';
      const errorMessage = err.message || '';

      if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos.');
      } else if (errorCode === 'auth/email-already-in-use') {
        setError('Usuário já existe. Por favor, faça login.');
      } else if (errorCode === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (errorCode === 'auth/too-many-requests') {
        setError('Muitas tentativas falhas. Tente novamente mais tarde.');
      } else if (errorMessage.includes('identity-toolkit-api-has-not-been-used') || errorMessage.includes('disabled')) {
         const match = errorMessage.match(/project=(\d+)/) || errorMessage.match(/project\s+(\d+)/);
         const projectId = match ? match[1] : 'canvas-gamificado';
         
         setApiErrorLink(`https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${projectId}`);
         setError('ERRO CRÍTICO: API de Autenticação desativada. Ative-a no console.');
      } else if (errorMessage.includes('CONFIGURATION_NOT_FOUND')) {
        setError('Erro de Configuração: Domínio ou Projeto Firebase não encontrado.');
      } else {
        setError('Ocorreu um erro ao conectar. Verifique o console.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
    setApiErrorLink(null);
    setEmail('');
    setPassword('');
    setName('');
    setRegistrationSuccess(false);
  };

  const handleBackToLogin = () => {
    setRegistrationSuccess(false);
    setIsRegistering(false);
    setError('');
    setApiErrorLink(null);
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden font-sans">
      
      {/* 1. Background Particles */}
      <ParticleBackground />

      {/* 2. Floating Shapes (Subtle decorations like in reference) */}
      <div className="absolute top-[10%] left-[10%] w-20 h-20 bg-white/30 rounded-lg transform rotate-12 blur-sm pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-[15%] right-[10%] w-32 h-32 bg-indigo-100/20 rounded-full blur-xl pointer-events-none"></div>

      {/* 3. Main Card */}
      <div className="relative z-10 w-full max-w-[420px] mx-4">
        <div className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-8 md:p-10 border border-white/50 backdrop-blur-sm">
          
          {registrationSuccess ? (
            /* Success View */
            <div className="text-center animate-fade-in py-8">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Verifique seu e-mail</h2>
              <p className="text-gray-500 mb-8">
                Enviamos um link para <br/><span className="font-semibold text-gray-700">{email}</span>
              </p>
              <Button 
                onClick={handleBackToLogin}
                className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white py-3 rounded-xl shadow-lg shadow-indigo-500/30"
                icon={<ArrowLeft size={18} />}
              >
                Voltar para Login
              </Button>
            </div>
          ) : (
            /* Login/Register Form */
            <>
              {/* Logo Section */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-14 h-14 bg-gradient-to-br from-[#4f46e5] to-[#6366f1] rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4 transform rotate-3">
                  <Code2 className="text-white w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-[#333] tracking-tight">
                  Canvas Gamificado
                </h1>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide font-medium">
                  {isRegistering ? 'Crie sua conta corporativa' : 'Sistema de Roteiros de Gamificação'}
                </p>
              </div>

              {/* Google Button */}
              {!isRegistering && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 mb-6"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        style={{ color: '#4285F4' }}
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        style={{ color: '#34A853' }}
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        style={{ color: '#FBBC05' }}
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        style={{ color: '#EA4335' }}
                      />
                    </svg>
                    <span>Entrar com Google</span>
                  </button>

                  <div className="relative flex py-2 items-center mb-6">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-semibold uppercase">ou</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                  </div>
                </>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex flex-col gap-2 text-sm text-red-600 animate-fade-in">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span className="flex-1 text-xs font-medium leading-tight">{error}</span>
                    </div>
                    {apiErrorLink && (
                        <a 
                            href={apiErrorLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs font-bold underline pl-6 hover:text-red-800 transition-colors"
                        >
                            Ativar API no Google Cloud
                        </a>
                    )}
                  </div>
                )}

                {isRegistering && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 ml-1">Nome Completo</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-gray-200/60 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 transition-all outline-none"
                      placeholder="Seu nome"
                      required
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 ml-1">Email Corporativo</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-200/60 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 transition-all outline-none"
                    placeholder="usuario@innyx.com"
                    required
                  />
                  {isRegistering && (
                    <p className="text-[10px] text-gray-500 ml-1 text-right">Obrigatório uso de @innyx.com</p>
                  )}
                </div>

                <div className="space-y-1 relative">
                  <label className="text-xs font-semibold text-gray-500 ml-1">Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-200/60 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 transition-all outline-none"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {!isRegistering && (
                   <div className="flex justify-end pt-1">
                     <a href="#" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                       Esqueceu a senha?
                     </a>
                   </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 mt-4" 
                  isLoading={loading}
                >
                  {isRegistering ? 'Cadastrar Conta Innyx' : 'Entrar'}
                </Button>
              </form>

              <div className="mt-8 text-center">
                 <p className="text-sm text-gray-500">
                   {isRegistering ? 'Já possui conta?' : 'Não tem uma conta?'}
                   <button 
                     onClick={toggleMode}
                     className="ml-1 font-bold text-indigo-600 hover:text-indigo-800 hover:underline focus:outline-none"
                   >
                     {isRegistering ? 'Fazer Login' : 'Cadastre-se'}
                   </button>
                 </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
