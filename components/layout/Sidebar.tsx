import React, { useRef } from 'react';
import { View } from '../../types';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';

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
    const { signOut, user } = useAuth();

    const NavItem = ({ v, emoji, label }: { v: View, emoji: string, label: string }) => {
        const isActive = view === v;
        return (
            <Button
                onClick={() => onNavigate(v)}
                variant={isActive ? 'primary' : 'ghost'}
                className={`w-full !justify-start pl-4 py-3 rounded-2xl transition-all h-auto ${isActive
                    ? 'shadow-md'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`}
            >
                <span className="text-xl w-8 flex justify-center shrink-0">{emoji}</span>
                <span className="font-medium">{label}</span>
            </Button>
        );
    };

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
                <Button
                    onClick={onImportClick}
                    variant="secondary"
                    className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 p-3 rounded-2xl font-semibold text-sm shadow-none h-auto justify-center"
                >
                    <span>📂</span><span>Import CSV</span>
                </Button>
                <Button
                    onClick={onQuickAddClick}
                    variant="primary"
                    className="w-full p-3 rounded-2xl shadow-lg h-auto justify-center"
                >
                    <span>➕</span><span className="font-semibold">Quick Add</span>
                </Button>

                <div className="h-px bg-slate-100 my-2" />

                <NavItem v="settings" emoji="⚙️" label="Settings" />

                <div className="px-4 py-2 mb-2 bg-slate-50 rounded-2xl flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
                        {user?.email?.[0].toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                            {user?.email?.split('@')[0]}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                            {user?.email}
                        </p>
                    </div>
                </div>

                <div className="h-px bg-slate-100 my-2" />

                <button
                    onClick={(e) => {
                        e.preventDefault();
                        signOut();
                    }}
                    className="w-full flex items-center justify-start pl-4 py-3 rounded-2xl text-slate-500 hover:bg-slate-100 hover:text-rose-600 transition-colors gap-0 group"
                >
                    <span className="text-xl w-8 flex justify-center shrink-0 grayscale group-hover:grayscale-0">🚪</span>
                    <span className="font-medium">Log Out</span>
                </button>
            </div>
        </aside>
    );
};
