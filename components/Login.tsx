
import React, { useState } from 'react';
import { Button } from './Button';
import { Eye, EyeOff, Code2, AlertCircle, Check, Mail, Lock, User as UserIcon, ArrowRight, Loader2 } from 'lucide-react';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Removido validação de domínio para permitir acesso geral durante testes/demo
  const validateDomain = (email: string) => true; // email.toLowerCase().endsWith('@innyx.com');

  const handleGoogleLogin = async () => {
    if (!auth) { setError("Firebase não inicializado."); return; }
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      /* Validação removida temporariamente
      if (user && user.email && !validateDomain(user.email)) {
         await user.delete();
         await signOut(auth);
         setError('Acesso restrito a e-mails @innyx.com');
         setLoading(false);
         return;
      }
      */

      if (user && db) {
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
      }
    } catch (err: any) {
      setError(err.message || 'Erro no login Google');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) { setError("Firebase não inicializado."); return; }
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        /* Validação removida temporariamente
        if (!validateDomain(email)) {
           setError('Cadastro restrito a @innyx.com');
           setLoading(false);
           return;
        }
        */
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (user && db) {
          await updateProfile(user, { displayName: name });
          await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            createdAt: serverTimestamp(),
          });
          // await sendEmailVerification(user); // Opcional para demo
          // await signOut(auth);
          // setResetSent(true); 
          // setError('');
          // alert("Conta criada! Verifique seu email antes de entrar.");
          // setIsRegistering(false);
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError('Email ou senha incorretos.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este email já está em uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setError(err.message || 'Ocorreu um erro. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white dark:bg-[#0f172a] transition-colors duration-300">
      
      {/* Left Side - Brand / Visuals (Desktop Only) */}
      <div className="hidden lg:flex w-1/2 relative bg-[#0f172a] text-white flex-col justify-between p-16 overflow-hidden">
        
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }}></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '1s' }}></div>
          <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }}></div>
        </div>

        {/* Brand Content */}
        <div className="relative z-10 animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/50">
              <Code2 className="text-white" size={20} strokeWidth={2.5} />
            </div>
            <span className="text-xl font-bold tracking-tight">EduCanvas Pro</span>
          </div>
          
          <h1 className="text-5xl font-bold leading-[1.1] mb-6">
            Gamifique suas aulas com <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">Inteligência Artificial</span>.
          </h1>
          <p className="text-lg text-indigo-200/70 max-w-md leading-relaxed">
            Crie roteiros pedagógicos alinhados à BNCC, quizzes e dinâmicas de jogo em segundos.
          </p>
        </div>

        {/* Footer/Testimonial Placeholder */}
        <div className="relative z-10 animate-fade-in-up">
           <div className="flex -space-x-3 mb-4">
              {[1,2,3].map(i => (
                <div key={i} className={`w-10 h-10 rounded-full border-2 border-[#0f172a] bg-gray-700 flex items-center justify-center text-xs overflow-hidden`}>
                  <img src={`https://ui-avatars.com/api/?name=User+${i}&background=random`} alt="user" />
                </div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-[#0f172a] bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                +2k
              </div>
           </div>
           <p className="text-sm text-indigo-200/50 font-medium">
             Junte-se a mais de 2.000 educadores inovadores.
           </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative">
         <div className="w-full max-w-[420px] animate-fade-in-up">
            
            {/* Mobile Brand (Visible only on mobile) */}
            <div className="lg:hidden flex flex-col items-center mb-10">
               <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200 dark:shadow-none">
                  <Code2 className="text-white" size={24} />
               </div>
               <h2 className="text-2xl font-bold text-gray-900 dark:text-white">EduCanvas Pro</h2>
            </div>

            <div className="mb-8 text-center lg:text-left">
               <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                 {isRegistering ? 'Criar nova conta' : 'Bem-vindo de volta'}
               </h2>
               <p className="text-gray-500 dark:text-gray-400">
                 {isRegistering ? 'Preencha os dados abaixo para começar.' : 'Entre com suas credenciais para acessar.'}
               </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 flex items-start gap-3">
                <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-4">
               {/* Google Login */}
               {!isRegistering && (
                 <>
                  <button 
                    onClick={handleGoogleLogin} 
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700"
                  >
                     <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                     </svg>
                     <span>Continuar com Google</span>
                  </button>

                  <div className="relative flex items-center py-2">
                     <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                     <span className="flex-shrink-0 mx-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">OU</span>
                     <div className="flex-grow border-t border-gray-200 dark:border-gray-700"></div>
                  </div>
                 </>
               )}

               <form onSubmit={handleSubmit} className="space-y-5">
                  
                  {isRegistering && (
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Nome Completo</label>
                       <div className="relative group">
                          <UserIcon className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                          <input 
                            type="text" 
                            placeholder="Seu nome" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" 
                            required 
                          />
                       </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Email</label>
                     <div className="relative group">
                        <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                        <input 
                          type="email" 
                          placeholder="nome@email.com" 
                          value={email} 
                          onChange={e => setEmail(e.target.value)} 
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" 
                          required 
                        />
                     </div>
                  </div>

                  <div className="space-y-1.5">
                     <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide ml-1">Senha</label>
                     <div className="relative group">
                        <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                        <input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••" 
                          value={password} 
                          onChange={e => setPassword(e.target.value)} 
                          className="w-full pl-11 pr-12 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" 
                          required 
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)} 
                          className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus:outline-none"
                        >
                            {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                        </button>
                     </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all transform active:scale-[0.98]" 
                    isLoading={loading}
                  >
                     {isRegistering ? 'Criar Conta' : 'Entrar na Plataforma'}
                     {!loading && <ArrowRight size={18} className="ml-2" />}
                  </Button>
               </form>
            </div>

            <div className="mt-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem acesso?'}
                    <button 
                        onClick={() => {
                            setIsRegistering(!isRegistering);
                            setError('');
                        }} 
                        className="ml-2 font-bold text-indigo-600 dark:text-indigo-400 hover:underline focus:outline-none"
                    >
                        {isRegistering ? 'Fazer Login' : 'Criar cadastro'}
                    </button>
                </p>
            </div>

            <div className="mt-12 flex justify-center items-center gap-2 text-xs text-gray-400">
                <Lock size={12} />
                <span>Ambiente seguro e criptografado</span>
            </div>

         </div>
      </div>
    </div>
  );
};
