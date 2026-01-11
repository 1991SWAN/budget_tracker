import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
    label,
    error,
    leftIcon,
    className = '',
    ...props
}, ref) => {
    const generatedId = React.useId();
    const id = props.id || generatedId;

    return (
        <div className="w-full">
            {label && (
                <label htmlFor={id} className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">
                    {label}
                </label>
            )}
            <div className="relative">
                {leftIcon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {leftIcon}
                    </div>
                )}
                <input
                    id={id}
                    ref={ref}
                    className={`
                        w-full rounded-xl border bg-white p-3 text-sm font-medium transition-all outline-none
                        ${leftIcon ? 'pl-10' : ''}
                        ${error
                            ? 'border-destructive focus:ring-2 focus:ring-destructive/20'
                            : 'border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10'
                        }
                        disabled:opacity-50 disabled:bg-slate-50
                        placeholder:text-slate-400
                        ${className}
                    `}
                    {...props}
                />
            </div>
            {error && (
                <p className="mt-1 ml-1 text-xs text-destructive font-medium">{error}</p>
            )}
        </div>
    );
});

Input.displayName = 'Input';
