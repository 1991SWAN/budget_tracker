import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { View } from '../../types';
import { ExpandableFAB } from '../ui/ExpandableFAB';
import { useAuth } from '../../contexts/AuthContext';

interface AppShellProps {
    children: React.ReactNode;
    view: View;
    onNavigate: (view: View) => void;
    onImportClick: () => void;
    onImportFile: (file: File) => void;
    onQuickAddClick: () => void;
    onAddAsset?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
    children,
    view,
    onNavigate,
    onImportClick,
    onImportFile,
    onQuickAddClick,
    onAddAsset
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { signOut } = useAuth();

    const handleNavigate = (v: View) => {
        onNavigate(v);
        setIsSidebarOpen(false); // Still keep for LG transition just in case
    };

    return (
        <div className="flex min-h-screen bg-surface">
            {/* Mobile Overlay - Only used if sidebar is somehow opened on mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 lg:hidden animate-in fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Visible only on LG+ screens by default */}
            <Sidebar
                view={view}
                onNavigate={handleNavigate}
                isOpen={isSidebarOpen}
                onImportClick={onImportClick}
                onImportFile={onImportFile}
                onQuickAddClick={onQuickAddClick}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {/* Header - Hidden on mobile, only desktop title or empty on mobile */}
                <div className="lg:hidden">
                    {/* Tiny Page Title for Mobile (Optional, let's keep it very clean) */}
                    <div className="p-4 text-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {view}
                        </span>
                    </div>
                </div>

                <div className="hidden lg:block">
                    <Header onMenuClick={() => setIsSidebarOpen(true)} />
                </div>

                <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
                    <div className="max-w-5xl mx-auto">
                        {children}
                    </div>
                </div>

                {/* Mobile All-in-One Navigation */}
                <ExpandableFAB
                    activeView={view}
                    onNavigate={onNavigate}
                    onQuickAdd={onQuickAddClick}
                    onAddAsset={onAddAsset || (() => { })}
                    onImportFile={onImportFile}
                    onSignOut={signOut}
                />
            </main>
        </div>
    );
};
