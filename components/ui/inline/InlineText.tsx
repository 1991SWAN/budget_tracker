import React, { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';

interface InlineTextProps {
    value?: string;
    onSave: (value: string) => void;
    placeholder?: string;
    className?: string;
    textClassName?: string;
    displayComponent?: React.ReactNode; // NEW: Allow custom display when not editing
}

export const InlineText: React.FC<InlineTextProps> = ({
    value = '',
    onSave,
    placeholder = 'Empty',
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
            // Don't select all text automatically to make appending tags easier
            // inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        if (currentValue !== value) {
            onSave(currentValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setCurrentValue(value); // Revert
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`w-full bg-slate-50 border-b-2 border-slate-500 rounded-none px-2 py-1 outline-none text-[14px] font-medium text-slate-900 ${className}`}
                placeholder={placeholder}
            />
        );
    }

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            className={`group relative flex-grow flex items-center px-1 min-w-[50px] min-h-[32px] rounded-md cursor-text hover:bg-slate-100/70 transition-colors ${className}`}
            title="Click to edit"
        >
            <div className={`truncate ${!value && !displayComponent ? 'text-slate-400 italic' : 'text-slate-900'} ${textClassName}`}>
                {displayComponent || value || placeholder}
            </div>
        </div>
    );
};
