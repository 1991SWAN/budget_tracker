import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled,
    ...props
}) => {
    const baseStyles = "font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2";

    const variants = {
        primary: "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-slate-800",
        secondary: "bg-secondary text-secondary-foreground shadow-lg shadow-secondary/20 hover:bg-emerald-600",
        destructive: "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20 hover:bg-rose-600",
        outline: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
        ghost: "bg-transparent text-slate-500 hover:bg-slate-100"
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-5 py-3 text-sm",
        lg: "px-8 py-4 text-base",
        icon: "p-2 aspect-square rounded-full"
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? <span className="animate-spin text-xl">↻</span> : children}
        </button>
    );
};
