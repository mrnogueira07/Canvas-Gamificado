import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

type Theme = 'light' | 'dark';
const Context = createContext({ theme: 'dark' as Theme, toggleTheme: () => {} });
export const useTheme = () => useContext(Context);
const systemTheme = (): Theme => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const preferenceKey = (uid: string | null) => `mindcanvas-theme:${uid || 'guest'}`;
function readPreference(uid: string | null): Theme | null {
  try {
    const value = localStorage.getItem(preferenceKey(uid));
    return value === 'light' || value === 'dark' ? value : null;
  } catch { return null; }
}
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const uid = useRef<string | null>(auth.currentUser?.uid || null);
  const preference = useRef<Theme | null>(readPreference(uid.current));
  const [theme, setTheme] = useState<Theme>(() => preference.current || systemTheme());

  useEffect(() => onAuthStateChanged(auth, user => {
    uid.current = user?.uid || null;
    preference.current = readPreference(uid.current);
    setTheme(preference.current || systemTheme());
  }), []);

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => { if (!preference.current) setTheme(systemTheme()); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    preference.current = next;
    try { localStorage.setItem(preferenceKey(uid.current), next); } catch { /* Keep the choice for this session. */ }
    setTheme(next);
  };
  return <Context.Provider value={{ theme, toggleTheme }}>{children}</Context.Provider>;
}
