import React from 'react';

interface SelectOption {
    label: string;
    value: string | number;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
    label,
    error,
    options,
    children,
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
                <select
                    id={id}
                    ref={ref}
                    className={`
                        w-full appearance-none rounded-xl border bg-white p-3 pr-10 text-sm font-medium transition-all outline-none
                        ${error
                            ? 'border-destructive focus:ring-2 focus:ring-destructive/20'
                            : 'border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10'
                        }
                        disabled:opacity-50 disabled:bg-slate-50
                        ${className}
                    `}
                    {...props}
                >
                    {options ? (
                        options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))
                    ) : (
                        children
                    )}
                </select>
                {/* Custom Chevron */}
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                </div>
            </div>
            {error && (
                <p className="mt-1 ml-1 text-xs text-destructive font-medium">{error}</p>
            )}
        </div>
    );
});

Select.displayName = 'Select';
