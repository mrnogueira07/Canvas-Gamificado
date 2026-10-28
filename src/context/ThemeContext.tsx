import React, { useEffect } from "react";

/**
 * ThemeProvider: garante modo claro fixo no DOM.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
  }, []);

  return <>{children}</>;
};
