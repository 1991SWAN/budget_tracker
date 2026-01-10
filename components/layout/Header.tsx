import React from 'react';

interface HeaderProps {
    onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    return (
        <header className="lg:hidden bg-white border-b border-slate-100 p-4 flex justify-between items-center sticky top-0 z-30">
            <div className="flex items-center space-x-2 text-primary">
                <span className="text-2xl">🪙</span>
                <span className="font-bold text-slate-900">SmartPenny</span>
            </div>
            <button onClick={onMenuClick} className="p-2 text-slate-600 text-2xl">
                ☰
            </button>
        </header>
    );
};
