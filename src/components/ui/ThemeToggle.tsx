import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from '../../lib/icons';
export function ThemeToggle() { const {theme,toggleTheme}=useTheme(); const label=theme==='dark'?'Modo claro':'Modo escuro'; return <button className="theme-toggle" onClick={toggleTheme} aria-label={'Ativar '+label} title={'Ativar '+label}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}<span>{label}</span></button>; }
