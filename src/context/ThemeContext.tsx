import React, { createContext, useContext, useEffect } from 'react';

interface ThemeContextType {
    isDark: boolean;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * ThemeProvider simplificado: Agora apenas fornece o modo claro (isDark: false)
 * para remover a complexidade e erros do modo escuro.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    useEffect(() => {
        // Garante que o modo escuro nunca seja ativado no DOM
        const root = document.documentElement;
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
        localStorage.setItem('gamecanvas_darkmode', 'false');
    }, []);

    const toggleTheme = () => {
        console.warn('O modo escuro foi removido do sistema.');
    };

    return (
        <ThemeContext.Provider value={{ isDark: false, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
