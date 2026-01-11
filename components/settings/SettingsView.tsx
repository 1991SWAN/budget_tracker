import React from 'react';
import { View } from '../../types';
import { Card } from '../ui/Card';

interface SettingsViewProps {
    onNavigate: (view: View) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate }) => {
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
                            {/* <Badge variant="secondary">New</Badge> */}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Categories</h3>
                        <p className="text-slate-500 text-sm">
                            Customize transaction categories, change colors, and organize your spending types.
                        </p>
                    </Card>

                    {/* Future: Tags */}
                    {/* Future: Budget */}
                </div>
            </section>

            {/* System Section (Future) */}
            <section>
                <h2 className="text-lg font-semibold text-slate-700 mb-4 px-1">System</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <Card className="p-6 opacity-60 cursor-not-allowed">
                        <div className="flex items-start justify-between mb-4">
                            <span className="text-4xl grayscale">💾</span>
                            <span className="text-[10px] items-center px-2 py-1 rounded-full bg-slate-100 text-slate-500">Coming Soon</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Data & Backup</h3>
                        <p className="text-slate-500 text-sm">
                            Export your data and manage backups.
                        </p>
                    </Card>
                </div>
            </section>
        </div>
    );
};
