import React, { useState } from 'react';
import { View } from '../../types';
import { Card } from '../ui/Card';
import { SupabaseService } from '../../services/supabaseService';
import { ExportService } from '../../services/exportService';
import { ResetDataModal } from './ResetDataModal'; // Import new modal

interface SettingsViewProps {
    onNavigate: (view: View) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
    const [showResetModal, setShowResetModal] = useState(false);

    const handleExport = async () => {
        try {
            // Fetch fresh data
            const [txs, assets, recurring, goals, categories] = await Promise.all([
                SupabaseService.getTransactions(),
                SupabaseService.getAssets(),
                SupabaseService.getRecurring(),
                SupabaseService.getGoals(),
                SupabaseService.getCategories()
            ]);
            ExportService.exportData(txs, assets, recurring, goals, categories);
        } catch (e) {
            console.error("Export failed", e);
            alert("Failed to export data.");
        }
    };

    const handleResetConfirm = async (options: any) => {
        await SupabaseService.resetData(options);
        window.location.reload();
    };

    return (
        <div className="space-y-8 p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
                <p className="text-slate-500 mt-1">Manage your preferences and data.</p>
            </div>

            {/* Data Management Section */}
            <section>
                <h2 className="text-lg font-semibold text-slate-700 mb-4 px-1">Data Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Categories Card */}
                    <Card
                        className="p-6 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 group relative overflow-hidden"
                        onClick={() => onNavigate('settings-categories')}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <span className="text-4xl group-hover:scale-110 transition-transform duration-200">🏷️</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Categories</h3>
                        <p className="text-slate-500 text-sm">
                            Customize transaction categories, change colors, and organize your spending types.
                        </p>
                    </Card>
                </div>
            </section>

            {/* System Section */}
            <section>
                <h2 className="text-lg font-semibold text-slate-700 mb-4 px-1">System</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Appearance (Coming Soon) */}
                    <Card className="p-6 opacity-60 cursor-not-allowed">
                        <div className="flex items-start justify-between mb-4">
                            <span className="text-4xl grayscale">🎨</span>
                            <span className="text-[10px] items-center px-2 py-1 rounded-full bg-slate-100 text-slate-500">Coming Soon</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Appearance</h3>
                        <p className="text-slate-500 text-sm">
                            Dark mode and theme customization.
                        </p>
                    </Card>

                    {/* Import Configuration */}
                    <Card
                        className="p-6 cursor-pointer hover:shadow-md transition-all duration-200 group"
                        onClick={() => onNavigate('settings-import')}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <span className="text-4xl group-hover:scale-110 transition-transform duration-200">📥</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Import Config</h3>
                        <p className="text-slate-500 text-sm">
                            Manage CSV import presets and account links.
                        </p>
                    </Card>

                    {/* Data & Backup */}
                    <Card className="p-6 cursor-pointer hover:shadow-md transition-all duration-200 group">
                        <div className="flex items-start justify-between mb-4">
                            <span className="text-4xl group-hover:scale-110 transition-transform duration-200">💾</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Data & Backup</h3>
                        <p className="text-slate-500 text-sm mb-4">
                            Export your data to Excel or reset your account.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleExport(); }}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100"
                            >
                                Export Data
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowResetModal(true); }}
                                className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100"
                            >
                                Reset Data
                            </button>
                        </div>
                    </Card>
                </div>
            </section>

            {/* Reset Data Modal */}
            <ResetDataModal
                isOpen={showResetModal}
                onClose={() => setShowResetModal(false)}
                onConfirm={handleResetConfirm}
            />
        </div>
    );
};
