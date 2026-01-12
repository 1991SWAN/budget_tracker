import React, { useRef } from 'react';
import { View } from '../../types';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
    view: View;
    onNavigate: (view: View) => void;
    isOpen: boolean;
    onImportClick: () => void; // Kept for backward compatibility if needed, or we can reuse it
    onImportFile: (file: File) => void; // New prop
    onQuickAddClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    view,
    onNavigate,
    isOpen,
    onImportClick,
    onImportFile,
    onQuickAddClick
}) => {
    const { signOut, user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onImportFile(file);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            onImportFile(file);
        }
    };

    return (
        <aside
            className={`
                fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 p-6 flex flex-col transition-transform duration-300 
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}
        >
            {/* Logo */}
            <div className="flex items-center space-x-2 mb-8 text-primary px-2">
                <span className="text-3xl">🪙</span>
                <span className="text-xl font-bold tracking-tight text-slate-900">SmartPenny</span>
            </div>

            {/* Navigation Zone */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-6">
                <div>
                    <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Menu</p>
                    <nav className="space-y-1">
                        <NavItem v="dashboard" emoji="📊" label="Dashboard" />
                        <NavItem v="transactions" emoji="🧾" label="Transactions" />
                        <NavItem v="assets" emoji="💰" label="Assets" />
                        <NavItem v="analysis" emoji="🤖" label="AI Analysis" />
                    </nav>
                </div>

                {/* Action Zone */}
                <div>
                    <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Actions</p>
                    <div className="space-y-3 px-1">
                        <Button
                            onClick={onQuickAddClick}
                            variant="primary"
                            className="w-full p-3 rounded-full shadow-lg h-auto justify-center hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            <span>➕</span><span className="font-semibold">Quick Add</span>
                        </Button>

                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                variant="secondary"
                                className={`w-full bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 p-3 rounded-2xl font-semibold text-sm shadow-sm h-auto justify-center active:scale-95 transition-all
                                    ${isDragging ? 'border-2 border-slate-900 bg-slate-100 ring-2 ring-slate-200' : ''}
                                `}
                            >
                                <span>📂</span><span>{isDragging ? 'Drop CSV Here' : 'Import CSV'}</span>
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".csv,.xls,.xlsx"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin Zone */}
            <div className="pt-4 mt-4 border-t border-slate-100">
                <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">System</p>
                <div className="space-y-1">
                    <NavItem v="settings" emoji="⚙️" label="Settings" />

                    <Button
                        variant="ghost"
                        onClick={(e) => {
                            e.preventDefault();
                            signOut();
                        }}
                        className="w-full !justify-start pl-4 py-3 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors h-auto active:scale-95"
                    >
                        <span className="text-xl w-8 flex justify-center shrink-0">👋</span>
                        <span className="font-medium">Sign Out</span>
                    </Button>
                </div>

                {/* User Profile */}
                <div className="mt-4 px-3 py-2 bg-slate-50 rounded-2xl flex items-center space-x-3 border border-slate-100/50">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0 text-xs shadow-inner">
                        {user?.email?.[0].toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                            {user?.email?.split('@')[0]}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                            {user?.email}
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
};
