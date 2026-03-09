import React, { useState, useRef, useEffect } from 'react';
import { Asset, AssetType } from '../../../types';
import { Landmark, CreditCard, Wallet, TrendingUp, PiggyBank, HelpCircle } from 'lucide-react';

interface InlineAssetPickerProps {
    value: string; // The asset ID
    options: Asset[];
    onSave: (value: string) => void;
    className?: string;
}

const getAssetIcon = (type: AssetType) => {
    switch (type) {
        case AssetType.CHECKING: return <Landmark size={14} />;
        case AssetType.CREDIT_CARD: return <CreditCard size={14} />;
        case AssetType.CASH: return <Wallet size={14} />;
        case AssetType.INVESTMENT: return <TrendingUp size={14} />;
        case AssetType.SAVINGS: return <PiggyBank size={14} />;
        default: return <HelpCircle size={14} />;
    }
};

export const InlineAssetPicker: React.FC<InlineAssetPickerProps> = ({
    value,
    options,
    onSave,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    const safeOptions = options || [];
    const selectedOption = safeOptions.find(o => o.id === value);

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

    const handleSelect = (assetId: string) => {
        setIsOpen(false);
        if (assetId !== value) {
            onSave(assetId);
        }
    };

    return (
        <div ref={pickerRef} className={`relative flex items-center ${className}`}>
            <div
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className={`group flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer`}
                title="Click to change account"
            >
                <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap truncate max-w-[100px]">
                    {selectedOption?.name || 'Unknown'}
                </span>
            </div>

            {isOpen && (
                <div
                    className="absolute z-50 left-0 top-full mt-1 w-[220px] bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Select Account</span>
                    </div>

                    <div className="max-h-[250px] overflow-y-auto p-1">
                        {safeOptions.map(opt => {
                            const isSelected = opt.id === value;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => handleSelect(opt.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${isSelected
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <span className={`${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                                            {getAssetIcon(opt.type)}
                                        </span>
                                        <span className={`text-[13px] font-semibold truncate ${isSelected ? 'text-white' : ''}`}>
                                            {opt.name}
                                        </span>
                                    </div>
                                    <span className={`text-[11px] font-mono ${isSelected ? 'text-white/50' : 'text-slate-400'}`}>
                                        {opt.balance.toLocaleString()}
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
