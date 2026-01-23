import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { View } from '../../types';
import {
    LayoutDashboard,
    ReceiptText,
    Wallet,
    Bot,
    Plus,
    FileUp,
    Settings,
    LogOut,
    X,
    Menu
} from 'lucide-react';

interface ExpandableFABProps {
    activeView: View;
    onNavigate: (view: View) => void;
    onQuickAdd: () => void;
    onAddAsset: () => void;
    onImportFile: (file: File) => void;
    onSignOut: () => void;
}

export const ExpandableFAB: React.FC<ExpandableFABProps> = ({
    activeView,
    onNavigate,
    onQuickAdd,
    onAddAsset,
    onImportFile,
    onSignOut
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const toggleMenu = () => setIsOpen(!isOpen);

    // Categorize items for hierarchy
    const navigationItems = [
        { id: 'analysis', icon: <Bot size={18} />, label: 'AI Analysis', view: 'analysis' as View },
        { id: 'assets', icon: <Wallet size={18} />, label: 'Assets', view: 'assets' as View },
        { id: 'transactions', icon: <ReceiptText size={18} />, label: 'Transactions', view: 'transactions' as View },
        { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard', view: 'dashboard' as View },
    ].filter(item => item.view !== activeView);

    const actionItems = [
        // Contextual Actions (Priority - Closest to thumb)
        ...(activeView === 'assets' ? [
            { id: 'add-asset', icon: <Plus size={20} />, label: 'Add New Asset', onClick: onAddAsset, color: 'text-primary font-bold', priority: true }
        ] : [
            { id: 'add-tx', icon: <Plus size={20} />, label: 'Quick Add', onClick: onQuickAdd, color: 'text-primary font-bold', priority: true }
        ]),
        { id: 'import', icon: <FileUp size={20} />, label: 'Import CSV', onClick: () => fileInputRef.current?.click() },
        { id: 'settings', icon: <Settings size={20} />, label: 'Settings', onClick: () => onNavigate('settings') },
        { id: 'signout', icon: <LogOut size={20} />, label: 'Sign Out', onClick: onSignOut, color: 'text-rose-400' },
    ];

    const handleItemClick = (item: any) => {
        if (item.onClick) {
            item.onClick();
        } else if (item.view) {
            onNavigate(item.view);
        }
        setIsOpen(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onImportFile(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsOpen(false);
    };

    return (
        <div className="fixed bottom-8 right-8 z-50 lg:hidden">
            {/* Backdrop Blur Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
                    />
                )}
            </AnimatePresence>

            {/* Menu Items */}
            <div className="relative z-50 flex flex-col items-end space-y-3">
                <AnimatePresence>
                    {isOpen && (
                        <div className="flex flex-col items-end mb-3">
                            {/* Actions Group (Prominent) */}
                            <div className="flex flex-col items-end space-y-3 mb-4">
                                {actionItems.map((item, index) => (
                                    <motion.button
                                        key={item.id}
                                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                                        animate={{
                                            opacity: 1,
                                            scale: 1,
                                            y: 0,
                                            transition: { delay: (actionItems.length - index) * 0.05 }
                                        }}
                                        exit={{
                                            opacity: 0,
                                            scale: 0.5,
                                            y: 20,
                                            transition: { delay: index * 0.05 }
                                        }}
                                        onClick={() => handleItemClick(item)}
                                        className={`
                                            flex items-center space-x-3 px-4 py-3 rounded-2xl shadow-xl bg-white
                                            ${item.priority ? 'border-2 border-primary/10 scale-105 mr-0.5' : 'border border-slate-100'}
                                            ${item.color || 'text-slate-600'}
                                        `}
                                    >
                                        <span className="font-semibold text-sm">{item.label}</span>
                                        <div className="shrink-0">{item.icon}</div>
                                    </motion.button>
                                ))}
                            </div>

                            {/* Divider */}
                            <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                className="w-12 h-[1px] bg-white/30 mb-4 mr-2"
                            />

                            {/* Navigation Group (Slim/Subtle) */}
                            <div className="flex flex-col items-end space-y-2">
                                {navigationItems.map((item, index) => (
                                    <motion.button
                                        key={item.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{
                                            opacity: 1,
                                            x: 0,
                                            transition: { delay: (navigationItems.length - index) * 0.05 + 0.2 }
                                        }}
                                        exit={{
                                            opacity: 0,
                                            x: 20,
                                            transition: { delay: index * 0.05 }
                                        }}
                                        onClick={() => handleItemClick(item)}
                                        className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md text-white border border-white/10"
                                    >
                                        <span className="text-xs font-medium">{item.label}</span>
                                        <div className="shrink-0 scale-90">{item.icon}</div>
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Main FAB */}
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={toggleMenu}
                    className="size-14 rounded-full bg-primary text-white shadow-2xl flex items-center justify-center relative overflow-hidden group"
                >
                    <motion.div
                        animate={{ rotate: isOpen ? 90 : 0 }}
                        className="flex items-center justify-center"
                    >
                        {isOpen ? <X size={24} /> : <Menu size={24} />}
                    </motion.div>
                </motion.button>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".csv,.xls,.xlsx"
            />
        </div>
    );
};
