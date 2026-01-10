import React from 'react';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    action,
    className = ''
}) => {
    return (
        <div className={`flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300 ${className}`}>
            <div className="text-4xl mb-3 text-slate-300">
                {icon || '🍃'}
            </div>
            <h3 className="text-sm font-bold text-slate-700 mb-1">
                {title}
            </h3>
            {description && (
                <p className="text-xs text-slate-400 max-w-[200px] mb-4">
                    {description}
                </p>
            )}
            {action && (
                <div className="mt-2">
                    {action}
                </div>
            )}
        </div>
    );
};
