import React from 'react';
import { Asset, TransactionType, CategoryItem } from '../types';
import { Button } from './ui/Button';

interface FilterBarProps {
    currentFilter: string;
    onFilterChange: (filter: string) => void;
    assets: Asset[];
    categories: CategoryItem[];
}

const FilterBar: React.FC<FilterBarProps> = ({ currentFilter, onFilterChange, assets, categories }) => {
    const mainFilters = [
        { id: 'ALL', label: 'All', emoji: '♾️' },
        { id: TransactionType.EXPENSE, label: 'Expenses', emoji: '💸' },
        { id: TransactionType.INCOME, label: 'Income', emoji: '💰' },
        { id: TransactionType.TRANSFER, label: 'Transfers', emoji: '↔️' },
    ];

    return (
        <div className="w-full overflow-x-auto p-2 scrollbar-hide">
            <div className="flex gap-2">
                {/* Main Filters */}
                {mainFilters.map(f => {
                    const isActive = currentFilter === f.id;
                    return (
                        <Button
                            key={f.id}
                            onClick={() => onFilterChange(f.id)}
                            variant={isActive ? 'primary' : 'ghost'}
                            size="sm"
                            className={`
                                flex items-center gap-1.5 px-4 py-2 rounded-full font-bold whitespace-nowrap transition-all shadow-none
                                ${isActive
                                    ? 'shadow-md scale-105'
                                    : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}
                            `}
                        >
                            <span>{f.emoji}</span>
                            <span>{f.label}</span>
                        </Button>
                    );
                })}

                <div className="w-[1px] h-8 bg-slate-200 mx-1 shrink-0" />

                {/* Category Filters */}
                {categories.map(c => {
                    const isActive = currentFilter === c.id;
                    return (
                        <Button
                            key={c.id}
                            onClick={() => onFilterChange(c.id)}
                            variant={isActive ? 'primary' : 'ghost'}
                            size="sm"
                            className={`
                                flex items-center gap-1.5 px-4 py-2 rounded-full font-bold whitespace-nowrap transition-all shadow-none
                                ${isActive
                                    ? 'shadow-md scale-105'
                                    : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}
                            `}
                        >
                            <span>{c.emoji}</span>
                            <span>{c.name}</span>
                        </Button>
                    );
                })}

                {categories.length > 0 && <div className="w-[1px] h-8 bg-slate-200 mx-1 shrink-0" />}

                {/* Asset Filters */}
                {assets.map(a => {
                    const isActive = currentFilter === a.id;
                    return (
                        <Button
                            key={a.id}
                            onClick={() => onFilterChange(a.id)}
                            variant={isActive ? 'primary' : 'ghost'}
                            size="sm"
                            className={`
                                flex items-center gap-1.5 px-4 py-2 rounded-full font-bold whitespace-nowrap transition-all shadow-none
                                ${isActive
                                    ? 'shadow-md scale-105'
                                    : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'}
                            `}
                        >
                            <span className="opacity-70">{a.currency === 'KRW' ? '₩' : '$'}</span>
                            <span>{a.name}</span>
                        </Button>
                    );
                })}
            </div>
        </div>
    );
};

export default FilterBar;
