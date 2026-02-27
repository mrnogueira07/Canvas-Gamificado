import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ChevronDown, BookOpen, Wand2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
    children: React.ReactNode;
    toolbar?: React.ReactNode;
}

const PAGE_META: Record<string, { title: string; subtitle: string; icon: React.ReactNode }> = {
    '/dashboard': {
        title: 'Meus Planejamentos',
        subtitle: 'Gerencie seus roteiros educacionais gamificados',
        icon: <BookOpen className="w-[18px] h-[18px] text-blue-600" />,
    },
    '/generator': {
        title: 'Gerar Canvas',
        subtitle: 'Crie um novo roteiro com auxílio da IA',
        icon: <Wand2 className="w-[18px] h-[18px] text-purple-600" />,
    },
};

export const Layout: React.FC<LayoutProps> = ({ children, toolbar }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const meta = PAGE_META[location.pathname] ?? PAGE_META['/dashboard'];
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const user = auth.currentUser;

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error signing out', error);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="min-h-screen bg-mesh-light text-slate-800 font-sans transition-colors duration-500 relative overflow-hidden">
            {/* Soft background glow */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Floating pill navbar */}
            <div style={styles.navbarWrap}>
                <motion.nav
                    className="flex items-center gap-2 p-2 glass-light rounded-full shadow-2xl shadow-indigo-500/10 pointer-events-auto w-[92%] max-w-5xl justify-between z-50 border-indigo-100/30"
                    style={{ backgroundColor: 'rgba(241, 245, 249, 0.9)', backdropFilter: 'blur(24px)' }}
                    initial={{ y: -80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                >
                    <div className="flex items-center gap-3 pr-6 border-r border-slate-200/60 ml-2">
                        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform overflow-hidden">
                            <img
                                src="/logo.png"
                                alt="Logo"
                                className="w-5 h-5 object-contain brightness-0 invert"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-black text-xs text-slate-900 tracking-tighter leading-none">Game</span>
                            <span className="font-black text-xs text-indigo-600 tracking-tighter leading-none mt-0.5">Canvas</span>
                        </div>
                    </div>

                    {/* Toolbar injected from page */}
                    {toolbar && (
                        <div style={styles.toolbarArea}>{toolbar}</div>
                    )}

                    {/* User avatar + dropdown */}
                    <div className="flex items-center gap-2" ref={dropdownRef}>
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setDropdownOpen((v) => !v)}
                                className="flex items-center gap-2 p-1 pr-3 bg-transparent hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                            >
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shadow-inner overflow-hidden border border-white">
                                    {user?.photoURL ? (
                                        <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{(user?.displayName || user?.email || 'U')[0].toUpperCase()}</span>
                                    )}
                                </div>
                                <span className="text-sm font-black text-slate-800 hidden sm:block">
                                    {user?.displayName?.split(' ')[0] || 'Perfil'}
                                </span>
                                <ChevronDown className={`w-3 h-3 text-slate-300 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {dropdownOpen && (
                                    <motion.div
                                        className="absolute top-[calc(100%+12px)] right-0 min-w-[240px] bg-slate-50/95 backdrop-blur-3xl rounded-3xl border border-slate-300/40 shadow-2xl shadow-slate-900/10 overflow-hidden origin-top-right p-2 z-[110]"
                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                    >
                                        <div className="flex flex-col items-center px-4 pt-6 pb-4 bg-slate-100 rounded-2xl mb-2">
                                            <div style={styles.dropdownAvatar}>
                                                {user?.photoURL ? (
                                                    <img src={user.photoURL} alt="User" className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    <span className="text-xl font-bold text-white">
                                                        {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[15px] font-bold text-slate-800 m-0 text-center">{user?.displayName || 'Usuário'}</p>
                                            <p className="text-xs text-slate-500 mt-1 m-0 text-center truncate w-full">{user?.email}</p>
                                        </div>
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLogout(); }}
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
                </motion.nav>
            </div>

            <div className="pt-32 px-10 pb-10 max-w-[1400px] mx-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname + '-header'}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.25 }}
                        className="mb-12"
                    >
                        <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-3">{meta.title}</h1>
                        <p className="text-slate-400 text-lg font-bold tracking-tight">{meta.subtitle}</p>
                    </motion.div>
                </AnimatePresence>
            </div>

            <main className="px-10 pb-20 max-w-[1400px] mx-auto">
                {children}
            </main>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    navbarWrap: {
        position: 'fixed',
        top: 24,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 100,
        pointerEvents: 'none',
    },
    toolbarArea: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
    },
    dropdownAvatar: {
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginBottom: 12,
        boxShadow: '0 12px 24px rgba(79, 70, 229, 0.2)',
        border: '4px solid #f1f5f9',
    },
};
