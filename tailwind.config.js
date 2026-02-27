/** @type {import('tailwindcss').Config} */
export default {
    // darkMode: 'class', // Desativado para manter apenas modo claro premium
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: 'var(--primary)',
                    hover: 'var(--primary-hover)',
                    light: 'var(--primary-light)',
                },
                background: 'var(--background)',
                surface: {
                    DEFAULT: 'var(--surface)',
                    hover: 'var(--surface-hover)',
                },
                text: {
                    DEFAULT: 'var(--text)',
                    muted: 'var(--text-muted)',
                    light: 'var(--text-light)',
                },
                border: 'var(--border)',
            },
            borderRadius: {
                lg: 'var(--radius-lg)',
                md: 'var(--radius-md)',
                sm: 'var(--radius-sm)',
            },
        },
    },
    plugins: [],
}
