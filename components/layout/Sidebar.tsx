import React, { useRef } from 'react';
import { View } from '../../types';

interface SidebarProps {
    view: View;
    onNavigate: (view: View) => void;
    isOpen: boolean;
    onImportClick: () => void;
    onQuickAddClick: () => void;
    // We might need to handle file input ref here or pass a handler that triggers it
    // For now, let's assume the parent handles the actual file input click via onImportClick
}

export const Sidebar: React.FC<SidebarProps> = ({
    view,
    onNavigate,
    isOpen,
    onImportClick,
    onQuickAddClick
}) => {

    const NavItem = ({ v, emoji, label }: { v: View, emoji: string, label: string }) => (
        <button
            onClick={() => onNavigate(v)}
            className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all ${view === v
                    ? 'bg-primary text-white shadow-lg shadow-blue-200'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
        >
            <span className="text-xl">{emoji}</span>
            <span className="font-medium">{label}</span>
        </button>
    );

    return (
        <aside
            className={`
                fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 p-6 flex flex-col transition-transform duration-300 
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}
        >
            <div className="flex items-center space-x-2 mb-10 text-primary">
                <span className="text-3xl">🪙</span>
                <span className="text-xl font-bold tracking-tight text-slate-900">SmartPenny</span>
            </div>

            <nav className="space-y-2 flex-1">
                <NavItem v="dashboard" emoji="📊" label="Dashboard" />
                <NavItem v="transactions" emoji="🧾" label="Transactions" />
                <NavItem v="assets" emoji="💰" label="Assets" />
                <NavItem v="analysis" emoji="🤖" label="AI Analysis" />
            </nav>

            <div className="pt-6 border-t border-slate-100 space-y-3">
                <button
                    onClick={onImportClick}
                    className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 p-3 rounded-xl flex items-center justify-center space-x-2 font-semibold text-sm transition-colors"
                >
                    <span>📂</span><span>Import CSV</span>
                </button>
                <button
                    onClick={onQuickAddClick}
                    className="w-full bg-primary text-white p-3 rounded-xl shadow-lg flex items-center justify-center space-x-2"
                >
                    <span>➕</span><span className="font-semibold">Quick Add</span>
                </button>
            </div>
        </aside>
    );
};
