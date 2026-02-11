import React from 'react';
import { User, AppView } from '../types';
import { 
  LogOut, 
  Moon,
  Sun,
  Code2
} from 'lucide-react';

interface NavbarProps {
  user: User;
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  onLogout: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout, isDarkMode, toggleTheme }) => {
  return (
    <header className="bg-white dark:bg-gray-800 rounded-full px-6 py-3 shadow-sm border border-gray-200/60 dark:border-gray-700 flex items-center justify-between transition-colors duration-300">
      {/* Left: Brand */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-[#4338ca] dark:bg-[#6366f1] rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-900/20 dark:shadow-indigo-500/20 transform rotate-3">
          <Code2 size={24} strokeWidth={2.5} />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Canvas Gamificado</h1>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sistema de Gamificação Educacional</span>
        </div>
      </div>

      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700"></div>

        {/* User Profile */}
        <div className="flex items-center gap-3">
          <img 
            src={user.avatarUrl} 
            alt={user.name} 
            className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-600 shadow-sm"
          />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 hidden md:block">
            {user.name.split(' ')[0]}
          </span>
        </div>

        {/* Logout Button */}
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400 hover:border-red-100 dark:hover:border-red-900/30 transition-all ml-2"
        >
          <LogOut size={16} />
          <span>Sair</span>
        </button>
      </div>
    </header>
  );
};