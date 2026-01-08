import React from 'react';
import { Asset, TransactionType } from '../types';

interface FilterBarProps {
    currentFilter: string;
    onFilterChange: (filter: string) => void;
    assets: Asset[];
}

const FilterBar: React.FC<FilterBarProps> = ({ currentFilter, onFilterChange, assets }) => {
    const mainFilters = [
        { id: 'ALL', label: 'All', emoji: '♾️' },
        { id: TransactionType.EXPENSE, label: 'Expenses', emoji: '💸' },
        { id: TransactionType.INCOME, label: 'Income', emoji: '💰' },
        { id: TransactionType.TRANSFER, label: 'Transfers', emoji: '↔️' },
    ];

    return (
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex gap-2 px-1">
                {/* Main Filters */}
                {mainFilters.map(f => (
                    <button
                        key={f.id}
                        onClick={() => onFilterChange(f.id)}
                        className={`
              flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all
              ${currentFilter === f.id
                                ? 'bg-slate-800 text-white shadow-lg shadow-slate-200 scale-105'
                                : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}
            `}
                    >
                        <span>{f.emoji}</span>
                        <span>{f.label}</span>
                    </button>
                ))}

                <div className="w-[1px] h-8 bg-slate-200 mx-1 shrink-0" />

                {/* Asset Filters */}
                {assets.map(a => (
                    <button
                        key={a.id}
                        onClick={() => onFilterChange(a.id)}
                        className={`
              flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all
              ${currentFilter === a.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                                : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}
            `}
                    >
                        <span className="opacity-70">{a.currency === 'KRW' ? '₩' : '$'}</span>
                        <span>{a.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FilterBar;
