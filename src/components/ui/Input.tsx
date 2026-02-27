import React from 'react';
// cleaned up imports

// Since I don't have tailwind, I'll use CSS modules or just style objects/standard classes.
// I'll use standard classes defined in global.css or scoped styles.
// Actually, I'll use inline styles/standard classes for simplicity with the variables I defined.

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, ...props }, ref) => {
        return (
            <div className="flex flex-col gap-2" style={{ marginBottom: '1rem' }}>
                {label && (
                    <label className="text-sm font-bold text-muted" style={{ marginBottom: '0.25rem' }}>
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={`
            w-full rounded-md border border-input bg-surface px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
            ${className || ''}
          `}
                    style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--surface-hover)',
                        fontSize: '0.9rem',
                        color: 'var(--text)',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        outline: 'none',
                    }}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.boxShadow = '0 0 0 2px var(--primary-light)';
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                    {...props}
                />
            </div>
        );
    }
);
Input.displayName = "Input";

export { Input };
