import React, { useState, useEffect } from 'react';
import { View } from '../../types';
import { ArrowLeft, Trash2, Link2, Link2Off, FileUp } from 'lucide-react';
import { ImportService, ImportPreset } from '../../services/importService';
import { SupabaseService } from '../../services/supabaseService';

interface ImportSettingsProps {
    onNavigate: (view: View) => void;
    onImportFile: (file: File) => void;
}

export const ImportSettings: React.FC<ImportSettingsProps> = ({ onNavigate, onImportFile }) => {
    const [presets, setPresets] = useState<ImportPreset[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onImportFile(file);
        }
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

            {/* Import Action Area */}
            <div
                className={`bg-white p-8 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all duration-200
                    ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-slate-200 hover:border-slate-300'}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className={`p-4 rounded-full ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                    <FileUp size={32} />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-900 mb-1">Upload CSV or Excel file</h3>
                    <p className="text-sm text-slate-500 mb-4">Drag and drop your bank statement here</p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-full font-semibold shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                    >
                        Browse Files
                    </button>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".csv,.xls,.xlsx"
                />
            </div>

            <div className="space-y-4 pt-4">
                <h2 className="text-lg font-semibold text-slate-900 px-1">Saved Presets</h2>
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
