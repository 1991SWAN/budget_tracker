import React, { useState, useRef, useEffect } from 'react';
import { Asset, TransactionType, CategoryItem } from '../types';
import { Button } from './ui/Button';

interface FilterBarProps {
    searchTerm: string;
    onSearchChange: (term: string) => void;
    dateRange: { start: string, end: string } | null;
    onDateRangeChange: (range: { start: string, end: string } | null) => void;
    filterType: TransactionType | 'ALL';
    onTypeChange: (type: TransactionType | 'ALL') => void;
    filterSubExpense: 'ALL' | 'REGULAR' | 'INSTALLMENT';
    onSubExpenseChange: (type: 'ALL' | 'REGULAR' | 'INSTALLMENT') => void;
    filterCategories: string[];
    onCategoriesChange: (ids: string[]) => void;
    filterAssets: string[];
    onAssetsChange: (ids: string[]) => void;
    assets: Asset[];
    categories: CategoryItem[];
}

const FilterBar: React.FC<FilterBarProps> = ({
    searchTerm, onSearchChange,
    dateRange, onDateRangeChange,
    filterType, onTypeChange,
    filterSubExpense, onSubExpenseChange,
    filterCategories, onCategoriesChange,
    filterAssets, onAssetsChange,
    assets, categories
}) => {
    // Dropdown States
    const [activeDropdown, setActiveDropdown] = useState<'category' | 'asset' | 'date' | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleFilter = (id: string, current: string[], setFn: (ids: string[]) => void) => {
        if (current.includes(id)) {
            setFn(current.filter(c => c !== id));
        } else {
            setFn([...current, id]);
        }
    };

    const handleDatePreset = (type: 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisYear') => {
        const end = new Date();
        const start = new Date();

        switch (type) {
            case 'today':
                // Already set to now
                break;
            case 'yesterday':
                start.setDate(end.getDate() - 1);
                end.setDate(end.getDate() - 1);
                break;
            case 'thisWeek':
                const day = start.getDay();
                const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
                start.setDate(diff);
                break;
            case 'thisMonth':
                start.setDate(1);
                break;
            case 'lastMonth':
                start.setMonth(start.getMonth() - 1);
                start.setDate(1);
                end.setDate(0); // Last day of prev month
                break;
            case 'thisYear':
                start.setMonth(0, 1);
                break;
        }

        onDateRangeChange({
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        });
        setActiveDropdown(null);
    };

    const clearDate = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDateRangeChange(null);
    };

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-3 space-y-3 relative z-20">
            {/* Row 1: Search & Dropdown Triggers */}
            <div className="flex gap-2 items-center" ref={dropdownRef}>
                {/* Search */}
                <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
                    <span className="text-slate-400 mr-2">🔍</span>
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="bg-transparent w-full outline-none text-sm placeholder:text-slate-400"
                    />
                </div>

                <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden md:block"></div>

                {/* Date Dropdown */}
                <div className="relative">
                    <Button
                        variant={dateRange ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setActiveDropdown(activeDropdown === 'date' ? null : 'date')}
                        className={`rounded-full px-4 h-10 border-slate-200 transition-colors ${dateRange ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <span>📅</span>
                        <span className="ml-1 hidden md:inline">
                            {dateRange
                                ? `${dateRange.start.slice(5)} ~ ${dateRange.end.slice(5)}`
                                : 'Date'}
                        </span>
                        {dateRange && <span className="ml-2 text-xs opacity-60 hover:opacity-100" onClick={clearDate}>✕</span>}
                    </Button>

                    {activeDropdown === 'date' && (
                        <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-slate-100 p-3 flex flex-col gap-3 animate-in fade-in zoom-in-95 z-50">
                            <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Presets</div>
                            <div className="grid grid-cols-2 gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleDatePreset('today')} className="justify-start rounded-xl text-xs h-9">Today</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDatePreset('yesterday')} className="justify-start rounded-xl text-xs h-9">Yesterday</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDatePreset('thisWeek')} className="justify-start rounded-xl text-xs h-9">This Week</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDatePreset('thisMonth')} className="justify-start rounded-xl text-xs h-9">This Month</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDatePreset('lastMonth')} className="justify-start rounded-xl text-xs h-9">Last Month</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDatePreset('thisYear')} className="justify-start rounded-xl text-xs h-9">This Year</Button>
                            </div>

                            <div className="h-[1px] bg-slate-100 mx-2"></div>

                            <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Custom Range</div>
                            <div className="flex flex-col gap-2 px-1">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Start</span>
                                        <input
                                            type="date"
                                            value={dateRange?.start || ''}
                                            onChange={(e) => onDateRangeChange({ start: e.target.value, end: dateRange?.end || e.target.value })}
                                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">End</span>
                                        <input
                                            type="date"
                                            value={dateRange?.end || ''}
                                            onChange={(e) => onDateRangeChange({ start: dateRange?.start || e.target.value, end: e.target.value })}
                                            className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button variant="ghost" size="sm" onClick={() => onDateRangeChange(null)} className="justify-center text-rose-500 rounded-xl text-xs font-bold mt-1">
                                Reset Date Filter
                            </Button>
                        </div>
                    )}
                </div>

                {/* Category Dropdown (Multi) */}
                <div className="relative">
                    <Button
                        variant={filterCategories.length > 0 ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setActiveDropdown(activeDropdown === 'category' ? null : 'category')}
                        className={`rounded-full px-4 h-10 border-slate-200 transition-colors ${filterCategories.length > 0 ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <span>📂</span>
                        <span className="ml-1 hidden md:inline">Category</span>
                        {filterCategories.length > 0 && <span className="ml-1 bg-white/20 px-1.5 rounded-full text-[10px]">{filterCategories.length}</span>}
                    </Button>

                    {activeDropdown === 'category' && (
                        <div className="absolute top-full right-0 mt-2 w-64 max-h-[300px] overflow-y-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-2 grid grid-cols-1 gap-1 animate-in fade-in zoom-in-95 z-50">
                            <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Select Categories</div>
                            {categories.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => toggleFilter(c.id, filterCategories, onCategoriesChange)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full text-left
                                        ${filterCategories.includes(c.id) ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-600'}
                                    `}
                                >
                                    <span>{c.emoji}</span>
                                    <span>{c.name}</span>
                                    {filterCategories.includes(c.id) && <span className="ml-auto text-emerald-500">✓</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Asset Dropdown (Multi) */}
                <div className="relative">
                    <Button
                        variant={filterAssets.length > 0 ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setActiveDropdown(activeDropdown === 'asset' ? null : 'asset')}
                        className={`rounded-full px-4 h-10 border-slate-200 transition-colors ${filterAssets.length > 0 ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <span>💳</span>
                        <span className="ml-1 hidden md:inline">Asset</span>
                        {filterAssets.length > 0 && <span className="ml-1 bg-white/20 px-1.5 rounded-full text-[10px]">{filterAssets.length}</span>}
                    </Button>

                    {activeDropdown === 'asset' && (
                        <div className="absolute top-full right-0 mt-2 w-64 max-h-[300px] overflow-y-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-2 grid grid-cols-1 gap-1 animate-in fade-in zoom-in-95 z-50">
                            <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Select Assets</div>
                            {assets.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => toggleFilter(a.id, filterAssets, onAssetsChange)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full text-left
                                        ${filterAssets.includes(a.id) ? 'bg-slate-100 text-slate-900 font-bold' : 'hover:bg-slate-50 text-slate-600'}
                                    `}
                                >
                                    <span className="text-xs text-slate-400">{a.currency}</span>
                                    <span>{a.institution ? `${a.institution} - ${a.name}` : a.name}</span>
                                    {filterAssets.includes(a.id) && <span className="ml-auto text-emerald-500">✓</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Row 2: Quick Access Chips */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {[
                    { id: 'ALL', label: 'All', emoji: '♾️' },
                    { id: TransactionType.EXPENSE, label: 'Expenses', emoji: '💸' },
                    { id: TransactionType.INCOME, label: 'Income', emoji: '💰' },
                    { id: TransactionType.TRANSFER, label: 'Transfers', emoji: '↔️' },
                ].map((f) => {
                    const isActive = filterType === f.id;
                    let activeClass = 'bg-slate-900 text-white border-slate-900';

                    // Semantic colors for Active Chips
                    if (isActive) {
                        if (f.id === TransactionType.EXPENSE) activeClass = 'bg-rose-500 text-white border-rose-500';
                        if (f.id === TransactionType.INCOME) activeClass = 'bg-emerald-500 text-white border-emerald-500';
                    }

                    return (
                        <div key={f.id} className="flex">
                            <button
                                onClick={() => onTypeChange(f.id as any)}
                                className={`
                                    flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shadow-sm
                                    ${isActive
                                        ? activeClass
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}
                                    ${isActive && f.id === TransactionType.EXPENSE ? 'rounded-r-none border-r-0' : ''}
                                `}
                            >
                                <span>{f.emoji}</span>
                                <span>{f.label}</span>
                            </button>

                            {isActive && f.id === TransactionType.EXPENSE && (
                                <div className="flex bg-rose-500 border border-rose-500 border-l-0 rounded-r-full pr-1 overflow-hidden items-center">
                                    <div className="w-[1px] h-3 bg-white/30" />
                                    {[
                                        { id: 'ALL', label: 'All' },
                                        { id: 'REGULAR', label: 'Regular' },
                                        { id: 'INSTALLMENT', label: 'Inst.' }
                                    ].map(sub => (
                                        <button
                                            key={sub.id}
                                            onClick={() => onSubExpenseChange(sub.id as any)}
                                            className={`px-2.5 py-1 text-[10px] font-bold rounded-full transition-colors whitespace-nowrap
                                                ${filterSubExpense === sub.id ? 'bg-white text-rose-600 shadow-sm' : 'text-white/80 hover:text-white'}
                                            `}
                                        >
                                            {sub.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Static Separator */}
                <div className="w-[1px] h-4 bg-slate-200 mx-1 self-center shrink-0"></div>

                {/* Active Filter Chips (Removable) */}
                {filterCategories.map(catId => {
                    const cat = categories.find(c => c.id === catId);
                    if (!cat) return null;
                    return (
                        <button
                            key={catId}
                            onClick={() => toggleFilter(catId, filterCategories, onCategoriesChange)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                        >
                            <span>{cat.emoji}</span>
                            <span>{cat.name}</span>
                            <span className="opacity-50">✕</span>
                        </button>
                    );
                })}

                {filterAssets.map(assetId => {
                    const asset = assets.find(a => a.id === assetId);
                    if (!asset) return null;
                    return (
                        <button
                            key={assetId}
                            onClick={() => toggleFilter(assetId, filterAssets, onAssetsChange)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                        >
                            <span>💳</span>
                            <span>{asset.name}</span>
                            <span className="opacity-50">✕</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default FilterBar;
