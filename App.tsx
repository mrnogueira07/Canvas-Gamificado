
import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { CreateScript } from './components/CreateScript';
import { CanvasView } from './components/CanvasView';
import { User, AppView, ScriptItem } from './types';
import { auth } from './firebase';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [selectedScript, setSelectedScript] = useState<ScriptItem | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Theme - Always start in Light Mode
  useEffect(() => {
    // Force light mode on startup regardless of system preference or previous storage
    setIsDarkMode(false);
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  // Listen for Auth Changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
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

  const handleLogin = () => {
    // Auth state listener handles this
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setCurrentView('dashboard');
      setSelectedScript(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleCreateClick = () => {
    setSelectedScript(null); // Garante que estamos criando um novo
    setCurrentView('create_script');
  };

  const handleViewScript = (script: ScriptItem) => {
    setSelectedScript(script);
    // Agora redireciona para a tela de edição/criação preenchida, em vez da visualização estática
    setCurrentView('create_script');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] dark:bg-[#0f172a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Se estiver na tela de criação/edição
  if (currentView === 'create_script') {
    return (
      <CreateScript 
        onBack={() => {
          setCurrentView('dashboard');
          setSelectedScript(null);
        }} 
        initialData={selectedScript} // Passa os dados se estiver editando
      />
    );
  }

  // Mantendo a view antiga caso queira usar em outro contexto, mas o fluxo principal agora usa create_script
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
        
        {/* Placeholder views for Library and Settings */}
        {currentView === 'library' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 transition-colors duration-300">
            Biblioteca (Em breve)
          </div>
        )}
        {currentView === 'settings' && (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 transition-colors duration-300">
            Ajustes (Em breve)
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
