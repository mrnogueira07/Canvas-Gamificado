import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wand2, LogOut } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

export const Sidebar: React.FC = () => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error signing out', error);
        }
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Wand2, label: 'Gerador / IA', path: '/generator' },
    ];

    return (
        <aside className="w-64 bg-surface border-r border-slate-200 hidden md:flex flex-col">
            <div className="p-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-surface rounded-xl flex items-center justify-center shadow-sm border border-slate-200">
                    <img src="/logo.png" alt="Logo" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                </div>
                <span className="font-bold text-lg text-slate-800">Game Canvas</span>
            </div>

            <nav className="flex-1 px-4 mt-6 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
              ${isActive
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
            `}
                    >
                        <item.icon className="w-5 h-5" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Sair
                </button>
            </div>
        </aside>
    );
};
