import React, { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';

interface InlineDateProps {
    value: string; // YYYY-MM-DD
    onSave: (value: string) => void;
    className?: string;
    textClassName?: string;
    displayComponent?: React.ReactNode;
}

export const InlineDate: React.FC<InlineDateProps> = ({
    value,
    onSave,
    className = '',
    textClassName = '',
    displayComponent
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setCurrentValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            // Optional: try to open picker automatically (browser dependent)
            if (typeof inputRef.current.showPicker === 'function') {
                try {
                    inputRef.current.showPicker();
                } catch (e) {
                    // Ignore error if not supported/allowed
                }
            }
        }
    }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        if (currentValue && currentValue !== value) {
            onSave(currentValue);
        } else if (!currentValue) {
            setCurrentValue(value); // Revert on empty
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setCurrentValue(value);
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="date"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`w-full bg-white border border-indigo-300 ring-2 ring-indigo-500/20 rounded-md px-2 py-1 outline-none text-xs font-medium text-slate-900 shadow-sm ${className}`}
            />
        );
    }

    // Format display date: "24-03-15" (short format) default
    let displayDateStr = value;
    try {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            const yy = d.getFullYear().toString().slice(-2);
            const mm = (d.getMonth() + 1).toString().padStart(2, '0');
            const dd = d.getDate().toString().padStart(2, '0');
            displayDateStr = `${yy}-${mm}-${dd}`;
        }
    } catch (e) { }

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            className={`group relative flex justify-center items-center px-1 min-h-[32px] rounded-md cursor-pointer hover:bg-slate-100 hover:ring-1 hover:ring-slate-200 transition-colors ${className}`}
            title="Click to edit date"
        >
            <div className={`text-xs font-bold text-slate-500 font-mono tracking-tighter ${textClassName}`}>
                {displayComponent || displayDateStr}
            </div>
        </div>
    );
};
