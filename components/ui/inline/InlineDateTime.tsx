import React, { useState, useEffect, useRef } from 'react';

interface InlineDateTimeProps {
    value?: string; // Expecting ISO timestamp string
    onSave: (newTimestamp: string) => void;
    className?: string;
    textClassName?: string;
    displayComponent?: React.ReactNode;
}

export const InlineDateTime: React.FC<InlineDateTimeProps> = ({
    value,
    onSave,
    className = '',
    textClassName = '',
    displayComponent
}) => {
    const [currentValue, setCurrentValue] = useState<string>(''); // Will hold "YYYY-MM-DDThh:mm" expected by datetime-local
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize the datetime string from the full timestamp
    useEffect(() => {
        if (!value) {
            setCurrentValue('');
            return;
        }
        try {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                const yyyy = d.getFullYear();
                const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                const dd = d.getDate().toString().padStart(2, '0');
                const hh = d.getHours().toString().padStart(2, '0');
                const min = d.getMinutes().toString().padStart(2, '0');
                const ss = d.getSeconds().toString().padStart(2, '0');
                // The required format is "YYYY-MM-DDThh:mm:ss" when step="1"
                setCurrentValue(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`);
            } else {
                setCurrentValue('');
            }
        } catch (e) {
            setCurrentValue('');
        }
    }, [value]);

    const handleSave = (newValue: string) => {
        if (!newValue) return;

        try {
            // newValue is something like "2024-03-15T14:30"
            const newDate = new Date(newValue);
            if (!isNaN(newDate.getTime())) {
                // Since the user can now edit seconds, we no longer override the user's input with the original seconds
                // Only save if it's different
                if (!value || newDate.getTime() !== new Date(value).getTime()) {
                    onSave(newDate.toISOString());
                }
            }
        } catch (e) {
            // Silently ignore invalid parses
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (inputRef.current && typeof inputRef.current.showPicker === 'function') {
            try {
                inputRef.current.showPicker();
            } catch (err) {
                // Fallback for browsers that don't support showPicker (e.g. very old Safari)
                inputRef.current.focus();
            }
        } else {
            inputRef.current?.focus();
        }
    };

    // Default formatting if no displayComponent provided
    let displayStr = '--:--:--';
    if (value) {
        try {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                const hh = d.getHours().toString().padStart(2, '0');
                const mm = d.getMinutes().toString().padStart(2, '0');
                const ss = d.getSeconds().toString().padStart(2, '0');
                displayStr = `${hh}:${mm}:${ss}`;
            }
        } catch (e) { }
    }

    return (
        <div
            onClick={handleClick}
            className={`group relative flex justify-center items-center px-1 min-h-[32px] rounded-md cursor-pointer hover:bg-slate-100/70 transition-colors ${className}`}
            title="Click to edit date & time"
        >
            <div className={`text-xs font-bold text-slate-500 font-mono tracking-tighter ${textClassName}`}>
                {displayComponent || displayStr}
            </div>

            {/* Hidden Native Input to drive the Popover */}
            <input
                ref={inputRef}
                type="datetime-local"
                step="1"
                value={currentValue}
                onChange={(e) => {
                    setCurrentValue(e.target.value);
                    // In a native picker, onChange fires when they select a complete date/time
                    handleSave(e.target.value);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full outline-none focus:outline-none focus:ring-0"
            />
        </div>
    );
};
