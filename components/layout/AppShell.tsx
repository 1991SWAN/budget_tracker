import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { View } from '../../types';

interface AppShellProps {
    children: React.ReactNode;
    view: View;
    onNavigate: (view: View) => void;
    onImportClick: () => void;
    onImportFile: (file: File) => void;
    onQuickAddClick: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
    children,
    view,
    onNavigate,
    onImportClick,
    onImportFile,
    onQuickAddClick
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleNavigate = (v: View) => {
        onNavigate(v);
        setIsSidebarOpen(false); // Close sidebar on mobile navigation
    };

    return (
        <div className="flex min-h-screen bg-surface">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 lg:hidden animate-in fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <Sidebar
                view={view}
                onNavigate={handleNavigate}
                isOpen={isSidebarOpen}
                onImportClick={onImportClick}
                onImportFile={onImportFile}
                onQuickAddClick={onQuickAddClick}
            />

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <Header onMenuClick={() => setIsSidebarOpen(true)} />
                <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth">
                    <div className="max-w-5xl mx-auto">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
};
