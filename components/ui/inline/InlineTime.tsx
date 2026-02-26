import React, { useState, useEffect, useRef } from 'react';

interface InlineTimeProps {
    value?: string; // Expecting ISO timestamp string or similar that can be parsed
    onSave: (newTimestamp: string) => void;
    className?: string;
    textClassName?: string;
    displayComponent?: React.ReactNode;
}

export const InlineTime: React.FC<InlineTimeProps> = ({
    value,
    onSave,
    className = '',
    textClassName = '',
    displayComponent
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState<string>(''); // Will hold "HH:mm"
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize the time string from the full timestamp
    useEffect(() => {
        if (!value) {
            setCurrentValue('');
            return;
        }
        try {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                const hh = d.getHours().toString().padStart(2, '0');
                const mm = d.getMinutes().toString().padStart(2, '0');
                setCurrentValue(`${hh}:${mm}`);
            } else {
                setCurrentValue('');
            }
        } catch (e) {
            setCurrentValue('');
        }
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if (typeof inputRef.current.showPicker === 'function') {
                try {
                    inputRef.current.showPicker();
                } catch (e) { }
            }
        }
    }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        if (!currentValue || !value) return; // If no value to save or no original value, do nothing for now

        try {
            // Parse the new time and apply it to the existing date
            const existingDate = new Date(value);
            if (!isNaN(existingDate.getTime())) {
                const [hhStr, mmStr] = currentValue.split(':');
                if (hhStr && mmStr) {
                    const newDate = new Date(existingDate);
                    newDate.setHours(parseInt(hhStr, 10));
                    newDate.setMinutes(parseInt(mmStr, 10));
                    // Check if it actually changed
                    if (newDate.getTime() !== existingDate.getTime()) {
                        onSave(newDate.toISOString());
                    }
                }
            }
        } catch (e) {
            // Parsing error, revert
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                setCurrentValue(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            // Revert value
            if (value) {
                const d = new Date(value);
                if (!isNaN(d.getTime())) {
                    setCurrentValue(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
                }
            }
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="time"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`w-full bg-white border border-indigo-300 ring-2 ring-indigo-500/20 rounded-md px-2 py-1 outline-none text-xs font-medium text-slate-900 shadow-sm ${className}`}
            />
        );
    }

    // Default formatting if no displayComponent provided
    let displayTimeStr = '--:--';
    if (value) {
        try {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
                const hh = d.getHours().toString().padStart(2, '0');
                const mm = d.getMinutes().toString().padStart(2, '0');
                const ss = d.getSeconds().toString().padStart(2, '0');
                displayTimeStr = `${hh}:${mm}:${ss}`;
            }
        } catch (e) { }
    }

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            className={`group relative flex justify-center items-center px-1 min-h-[32px] rounded-md cursor-pointer hover:bg-slate-100 hover:ring-1 hover:ring-slate-200 transition-colors ${className}`}
            title="Click to edit time"
        >
            <div className={`text-xs font-bold text-slate-500 font-mono tracking-tighter ${textClassName}`}>
                {displayComponent || displayTimeStr}
            </div>
        </div>
    );
};
