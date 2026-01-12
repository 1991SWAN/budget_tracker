import React, { useState, useEffect } from 'react';
import { View } from '../../types';
import { ArrowLeft, Trash2, Link2, Link2Off } from 'lucide-react';
import { ImportService, ImportPreset } from '../../services/importService';
import { SupabaseService } from '../../services/supabaseService';

interface ImportSettingsProps {
    onNavigate: (view: View) => void;
}

export const ImportSettings: React.FC<ImportSettingsProps> = ({ onNavigate }) => {
    const [presets, setPresets] = useState<ImportPreset[]>([]);
    const [assets, setAssets] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setPresets(ImportService.getPresets());
        const assetList = await SupabaseService.getAssets();
        setAssets(assetList);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this preset?')) {
            ImportService.deletePreset(id);
            setPresets(ImportService.getPresets());
        }
    };

    const handleUnlink = (id: string) => {
        if (window.confirm('Unlink this preset from the specific account? It will become a generic preset.')) {
            ImportService.unlinkPreset(id);
            setPresets(ImportService.getPresets());
        }
    };

    return (
        <div className="space-y-6 p-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => onNavigate('settings')}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Import Configuration</h1>
                    <p className="text-slate-500">Manage saved import presets and associations.</p>
                </div>
            </div>

            <div className="space-y-4">
                {presets.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                        <p className="text-slate-400 font-bold">No saved presets found.</p>
                        <p className="text-xs text-slate-400 mt-1">Import a CSV file to create your first preset.</p>
                    </div>
                ) : (
                    presets.map(preset => {
                        const linkedAsset = assets.find(a => a.id === preset.linkedAssetId);

                        return (
                            <div key={preset.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="font-bold text-slate-900 text-lg">{preset.name}</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500 truncate max-w-[200px]">
                                            {preset.headerHash.slice(0, 20)}...
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            Created: {new Date(preset.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {/* Linked Status */}
                                    <div className="pt-2">
                                        {linkedAsset ? (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                                                <Link2 size={12} />
                                                Linked to: {linkedAsset.name}
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-xs font-bold">
                                                <Link2Off size={12} />
                                                Generic / Unlinked
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-center">
                                    {linkedAsset && (
                                        <button
                                            onClick={() => handleUnlink(preset.id)}
                                            className="px-3 py-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition-colors"
                                        >
                                            Unlink
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(preset.id)}
                                        className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="Delete Preset"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
