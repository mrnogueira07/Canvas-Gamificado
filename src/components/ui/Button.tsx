import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "primary",
      size = "md",
      isLoading,
      children,
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center rounded-2xl font-black uppercase tracking-widest transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";

    const variantClasses = {
      primary:
        "bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.02]",
      secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
      outline:
        "bg-transparent border-2 border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-500",
      ghost: "bg-transparent text-slate-500 hover:bg-slate-100",
      danger:
        "bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-600",
    };

    const sizeClasses = {
      sm: "px-4 py-2 text-[10px]",
      md: "px-6 py-3 text-xs",
      lg: "px-8 py-4 text-sm",
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <span className="flex items-center gap-2">{children}</span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button };
