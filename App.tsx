import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { CreateScript } from './components/CreateScript';
import { CanvasView } from './components/CanvasView';
import { User, AppView, ScriptItem } from './types';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [selectedScript, setSelectedScript] = useState<ScriptItem | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // Initialize Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Listen for Auth Changes
  useEffect(() => {
    if (!auth) {
      setConfigError("Erro de Configuração: O Firebase não foi inicializado corretamente. Verifique as variáveis de ambiente (VITE_FIREBASE_API_KEY, etc).");
      setIsLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          name: user.displayName || 'Usuário',
          email: user.email || '',
          avatarUrl: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=0284c7&color=fff`
        });
        setIsAuthenticated(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogin = () => { /* Auth listener handles this */ };

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      setCurrentView('dashboard');
      setSelectedScript(null);
    }
  };

  const handleCreateClick = () => {
    setSelectedScript(null);
    setCurrentView('create_script');
  };

  const handleViewScript = (script: ScriptItem) => {
    setSelectedScript(script);
    setCurrentView('create_script');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] dark:bg-[#0f172a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Erro de Configuração</h2>
          <p className="text-gray-700">{configError}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (currentView === 'create_script') {
    return (
      <CreateScript 
        onBack={() => {
          setCurrentView('dashboard');
          setSelectedScript(null);
        }} 
        initialData={selectedScript} 
      />
    );
  }

  if (currentView === 'view_script' && selectedScript) {
    return (
      <CanvasView 
        script={selectedScript} 
        onBack={() => {
          setSelectedScript(null);
          setCurrentView('dashboard');
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#0f172a] transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto pt-6 px-4 sm:px-6 lg:px-8 space-y-6 pb-12">
        {currentUser && (
          <Navbar 
            user={currentUser} 
            currentView={currentView}
            onChangeView={setCurrentView}
            onLogout={handleLogout}
            isDarkMode={isDarkMode}
            toggleTheme={toggleTheme}
          />
        )}
        
        {currentView === 'dashboard' && (
          <Dashboard 
            onCreateClick={handleCreateClick} 
            onViewScript={handleViewScript}
          />
        )}
        
        {(currentView === 'library' || currentView === 'settings') && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 transition-colors duration-300">
            Funcionalidade em desenvolvimento
          </div>
        )}
      </div>
    </div>
  );
};

export default App;