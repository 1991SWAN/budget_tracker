import React, { useState, useRef, useEffect } from 'react';
import { CategoryItem } from '../../../types';

interface InlineCategoryPickerProps {
    value: string; // The category ID or name
    options: CategoryItem[];
    onSave: (value: string) => void;
    className?: string;
}

export const InlineCategoryPicker: React.FC<InlineCategoryPickerProps> = ({
    value,
    options,
    onSave,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    const safeOptions = options || [];
    const selectedOption = safeOptions.find(o => o.id === value || o.name === value);
    const displayColor = selectedOption?.color ? selectedOption.color.replace('bg-', 'text-') : 'text-slate-600';

    // Handle click outside to close popover
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleSelect = (categoryId: string) => {
        setIsOpen(false);
        if (categoryId !== value) {
            onSave(categoryId);
        }
    };

    return (
        <div ref={pickerRef} className={`relative flex items-center ${className}`}>
            {/* Trigger Button (looks just like the old display but opens popover instead of becoming a <select>) */}
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={`group flex items-center gap-1.5 min-h-[32px] px-2 py-1 rounded-md cursor-pointer hover:bg-slate-100/70 transition-colors w-full h-full`}
                title="Click to change category"
            >
                <div className={`p-1.5 rounded-lg ${selectedOption?.color || 'bg-slate-100'} bg-opacity-20 flex shrink-0`}>
                    <span className="text-xs">{selectedOption?.emoji || '🏷️'}</span>
                </div>
                <span className={`text-xs font-semibold truncate ${displayColor}`}>
                    {selectedOption?.name || value}
                </span>
            </div>

            {/* Popover Menu */}
            {isOpen && (
                <div
                    className="absolute z-50 left-0 top-full mt-1 w-[280px] bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()} // Prevent row click
                >
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Select Category</span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto p-2 grid grid-cols-2 gap-1">
                        {safeOptions.map(opt => {
                            const isSelected = opt.id === value;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => handleSelect(opt.id)}
                                    className={`flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all ${isSelected
                                        ? 'bg-slate-800 text-white shadow-md'
                                        : 'hover:bg-slate-100 text-slate-700'
                                        }`}
                                >
                                    <span className="text-sm">{opt.emoji}</span>
                                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : ''}`}>
                                        {opt.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
