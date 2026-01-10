import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'success';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
    children,
    variant = 'default',
    className = ''
}) => {
    const baseStyles = "px-2 py-0.5 rounded-md font-bold tracking-wide uppercase text-[10px]";

    const variants = {
        default: "bg-slate-100 text-slate-600",
        outline: "bg-transparent border border-slate-200 text-slate-500",
        secondary: "bg-blue-50 text-blue-600",
        success: "bg-emerald-50 text-emerald-600 border border-emerald-100",
        destructive: "bg-rose-50 text-rose-600 border border-rose-100"
    };

    return (
        <span className={`${baseStyles} ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};
