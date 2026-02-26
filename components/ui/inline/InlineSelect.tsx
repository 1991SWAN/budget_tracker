import React, { useState, useEffect, useRef } from 'react';
import { Pencil } from 'lucide-react';
import { CategoryItem } from '../../../types';

interface InlineSelectProps {
    value: string; // The category ID or name
    options: CategoryItem[];
    onSave: (value: string) => void;
    className?: string;
}

export const InlineSelect: React.FC<InlineSelectProps> = ({
    value,
    options,
    onSave,
    className = ''
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const selectRef = useRef<HTMLSelectElement>(null);

    useEffect(() => {
        setCurrentValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && selectRef.current) {
            selectRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        if (currentValue !== value) {
            onSave(currentValue);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setCurrentValue(value);
        }
    };

    const safeOptions = options || [];
    const selectedOption = safeOptions.find(o => o.id === value || o.name === value);
    const displayColor = selectedOption?.color ? selectedOption.color.replace('bg-', 'text-') : 'text-slate-600';

    if (isEditing) {
        return (
            <select
                ref={selectRef}
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={`w-full bg-white border border-indigo-300 ring-2 ring-indigo-500/20 rounded-md px-2 py-1 outline-none text-xs font-medium text-slate-700 shadow-sm appearance-none ${className}`}
            >
                {options.map(opt => (
                    <option key={opt.id} value={opt.id}>
                        {opt.emoji} {opt.name}
                    </option>
                ))}
            </select>
        );
    }
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            className={`group relative flex items-center gap-1.5 min-h-[32px] px-2 py-1 rounded-md cursor-pointer hover:bg-slate-100 hover:ring-1 hover:ring-slate-200 transition-colors ${className}`}
            title="Click to change category"
        >
            <div className={`p-1.5 rounded-lg ${selectedOption?.color || 'bg-slate-100'} bg-opacity-20 flex shrink-0`}>
                <span className="text-xs">{selectedOption?.emoji || '🏷️'}</span>
            </div>
            <span className={`text-xs font-semibold truncate ${displayColor}`}>
                {selectedOption?.name || value}
            </span>
        </div>
    );
};
