import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, ChevronDown, BookOpen, Wand2 } from "lucide-react";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";

interface LayoutProps {
  children: React.ReactNode;
  toolbar?: React.ReactNode;
}

const PAGE_META: Record<
  string,
  { title: string; subtitle: string; icon: React.ReactNode }
> = {
  "/dashboard": {
    title: "Meus Planejamentos",
    subtitle: "Gerencie seus roteiros educacionais gamificados",
    icon: <BookOpen className="w-[18px] h-[18px] text-blue-600" />,
  },
  "/generator": {
    title: "Gerar Canvas",
    subtitle: "Crie um novo roteiro com auxílio da IA",
    icon: <Wand2 className="w-[18px] h-[18px] text-purple-600" />,
  },
};

export const Layout: React.FC<LayoutProps> = ({ children, toolbar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? PAGE_META["/dashboard"];
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getMotivationalMessage = () => {
    const hour = new Date().getHours();
    const firstName = user?.displayName
      ? user.displayName.split(" ")[0]
      : "Prof.";

    const greetings = {
      morning: `Bom dia, ${firstName}!`,
      afternoon: `Boa tarde, ${firstName}!`,
      night: `Boa noite, ${firstName}!`,
    };

    const motivationalSuffixes = [
      "Pronto para transformar a educação hoje?",
      "Que tal criar algo incrível para seus alunos?",
      "Sua criatividades é a chave para o engajamento!",
      "Vamos gamificar o aprendizado e surpreender a turma?",
      "Sua paixão por ensinar faz toda a diferença.",
      "Transforme o conteúdo em uma aventura inesquecível!",
      "Educar é inspirar. Vamos começar?",
      "Inovação e educação caminham juntas aqui.",
      "Pronto para elevar o nível da sua aula?",
      "O futuro da educação começa com suas ideias.",
    ];

    let selectedGreeting = greetings.night;
    if (hour >= 5 && hour < 12) selectedGreeting = greetings.morning;
    else if (hour >= 12 && hour < 18) selectedGreeting = greetings.afternoon;

    // Estabilizado por renderização do componente para não mudar em cada refresh de estado,
    // mas mudar em cada entrada/re-montagem.
    const randomIndex = Math.floor(Math.random() * motivationalSuffixes.length);
    return `${selectedGreeting} ${motivationalSuffixes[randomIndex]}`;
  };

  return (
    <div className="min-h-screen bg-mesh-light text-slate-800 font-sans transition-colors duration-500 relative overflow-hidden">
      {/* Soft background glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Floating pill navbar */}
      <div style={styles.navbarWrap}>
        <motion.div
          className="relative w-[96%] max-w-7xl pointer-events-auto shadow-2xl shadow-indigo-500/10"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        >
          {/* Animated Border Wrapper - This clips the gradient but NOT the dropdown */}
          <div className="absolute inset-0 p-[1px] rounded-full overflow-hidden">
            <div className="absolute inset-[-500%] animate-[spin_5s_linear_infinite] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_150deg,#6366f1_180deg,#a855f7_210deg,#6366f1_240deg,transparent_270deg)] opacity-40" />
          </div>

          <nav
            className="relative flex items-center gap-1.5 md:gap-4 p-1.5 md:p-2 glass-light rounded-full border border-white/50 justify-between w-full h-full z-10"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(32px)",
            }}
          >
            <div className="flex items-center gap-3 pr-4 md:pr-6 border-r border-slate-200/60 ml-1 md:ml-2 shrink-0">
              <div className="w-8 h-8 md:w-9 md:h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform overflow-hidden shrink-0">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="w-4 h-4 md:w-5 md:h-5 object-contain brightness-0 invert"
                />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-black text-[10px] md:text-xs text-slate-900 tracking-tighter leading-none">
                  Game
                </span>
                <span className="font-black text-[10px] md:text-xs text-indigo-600 tracking-tighter leading-none mt-0.5">
                  Canvas
                </span>
              </div>
            </div>

            {/* Toolbar injected from page */}
            {toolbar && (
              <div
                style={styles.toolbarArea}
                className="min-w-0 pr-1 md:pr-2 overflow-hidden"
              >
                {toolbar}
              </div>
            )}

            {/* User avatar + dropdown */}
            <div className="flex items-center shrink-0" ref={dropdownRef}>
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex shrink-0 items-center gap-2 md:gap-3 p-1 md:p-1.5 pr-2 md:pr-5 bg-slate-50/80 shadow-sm border border-slate-200/60 rounded-full transition-all cursor-pointer hover:bg-white active:scale-95 z-20"
                >
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px] shadow-md overflow-hidden border border-white shrink-0">
                    {user?.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="User"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>
                        {(user?.displayName ||
                          user?.email ||
                          "U")[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="hidden sm:block text-[11px] font-black text-slate-900 truncate max-w-[160px] md:max-w-[200px] uppercase tracking-wider shrink-0">
                    {user?.displayName?.split(" ")[0] || "Perfil"}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 md:w-3.5 md:h-3.5 text-slate-500 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <motion.div
                      className="absolute top-[calc(100%+12px)] right-0 min-w-[240px] bg-slate-50/95 backdrop-blur-3xl rounded-3xl border border-slate-300/40 shadow-2xl shadow-slate-900/10 overflow-hidden origin-top-right p-2 z-[999]"
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex flex-col items-center px-4 pt-6 pb-4 bg-slate-100 rounded-2xl mb-2">
                        <div style={styles.dropdownAvatar}>
                          {user?.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt="User"
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-xl font-bold text-white">
                              {(user?.displayName ||
                                user?.email ||
                                "U")[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-[15px] font-bold text-slate-800 m-0 text-center">
                          {user?.displayName || "Usuário"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 m-0 text-center truncate w-full">
                          {user?.email}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleLogout();
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-sm font-black transition-all group mt-2"
                      >
                        <LogOut className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        Sair da conta
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </nav>
        </motion.div>
      </div>

      <div className="pt-32 px-10 pb-10 max-w-[1400px] mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname + "-header"}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={{
              initial: { opacity: 0 },
              animate: { opacity: 1, transition: { staggerChildren: 0.12 } },
              exit: { opacity: 0 },
            }}
            className="mb-12"
          >
            <motion.div
              variants={{
                initial: { opacity: 0, y: 20 },
                animate: {
                  opacity: 1,
                  y: 0,
                  transition: { type: "spring", damping: 15 },
                },
              }}
              className="flex items-center gap-4 mb-4"
            >
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                {meta.icon}
              </div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tight">
                {meta.title}
              </h1>
            </motion.div>

            <motion.p
              variants={{
                initial: { opacity: 0, x: -10 },
                animate: { opacity: 1, x: 0 },
              }}
              className="text-slate-400 text-lg font-bold tracking-tight mb-2"
            >
              {meta.subtitle}
            </motion.p>

            {location.pathname === "/dashboard" && (
              <motion.p
                variants={{
                  initial: { opacity: 0, scale: 0.95 },
                  animate: { opacity: 1, scale: 1, transition: { delay: 0.4 } },
                }}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-500 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-100"
              >
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse" />
                {getMotivationalMessage()}
              </motion.p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <main className="px-10 pb-20 max-w-[1400px] mx-auto">{children}</main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  navbarWrap: {
    position: "fixed",
    top: 24,
    left: 0,
    right: 0,
    padding: "0 20px",
    display: "flex",
    justifyContent: "center",
    zIndex: 100,
    pointerEvents: "none",
  },
  toolbarArea: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 16px",
    minWidth: 0,
  },
  dropdownAvatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #4f46e5, #4338ca)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
    boxShadow: "0 12px 24px rgba(79, 70, 229, 0.2)",
    border: "4px solid #f1f5f9",
  },
};
