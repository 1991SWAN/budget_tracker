import React, { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';

interface InlineNumberProps {
    value: number;
    onSave: (value: number) => void;
    className?: string;
    textClassName?: string;
    isExpense?: boolean;
}

export const InlineNumber: React.FC<InlineNumberProps> = ({
    value,
    onSave,
    className = '',
    textClassName = '',
    isExpense = true
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setCurrentValue(value.toString());
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        const numValue = Number(currentValue.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(numValue) && numValue !== value) {
            onSave(numValue);
        } else {
            setCurrentValue(value.toString()); // Revert if invalid
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setCurrentValue(value.toString());
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`w-full min-w-[100px] text-right bg-slate-50 border-b-2 border-slate-500 rounded-none px-2 py-1 outline-none text-sm font-bold text-slate-900 ${className}`}
            />
        );
    }

    const formattedAmount = value.toLocaleString();
    const amountSign = isExpense ? '-' : '+';
    const amountColor = isExpense ? 'text-rose-600' : 'text-emerald-600';

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            className={`group relative flex items-center justify-end min-h-[32px] px-2 py-1 rounded-md cursor-text hover:bg-slate-100/70 transition-colors ${className}`}
            title="Click to edit amount"
        >
            <span className={`font-bold tracking-tight whitespace-nowrap ${amountColor} ${textClassName}`}>
                {amountSign}₩{formattedAmount}
            </span>
        </div>
    );
};
