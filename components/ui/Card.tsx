import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'flat' | 'ghost';
    noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    variant = 'default',
    noPadding = false,
    ...props
}) => {
    const baseStyles = "rounded-3xl overflow-hidden transition-all duration-300";
    const variants = {
        default: "bg-white shadow-sm hover:shadow-md border border-slate-100",
        flat: "bg-slate-50 text-slate-900 border border-transparent",
        ghost: "bg-transparent border border-dashed border-slate-200"
    };

    const padding = noPadding ? '' : 'p-6';

    return (
        <div className={`${baseStyles} ${variants[variant]} ${padding} ${className}`} {...props}>
            {children}
        </div>
    );
};
