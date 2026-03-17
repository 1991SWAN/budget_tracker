import React, { useState } from 'react';
import { View } from '../../types';
import { ArrowLeft, Trash2, Link2, Link2Off, FileUp } from 'lucide-react';
import { useImportSettingsController } from '../../hooks/useImportSettingsController';

interface ImportSettingsProps {
    onNavigate: (view: View) => void;
    onImportFile: (file: File) => void;
}

export const ImportSettings: React.FC<ImportSettingsProps> = ({ onNavigate, onImportFile }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const { presets, assets, handleDelete, handleUnlink } = useImportSettingsController();

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
        <div className="space-y-10 p-8 sm:p-12 max-w-4xl mx-auto min-h-screen animate-in fade-in duration-700">
            {/* Header with Premium Typography */}
            <div className="flex items-start gap-6 mb-12">
                <button
                    onClick={() => onNavigate('settings')}
                    className="mt-1 p-3.5 bg-white/80 backdrop-blur-xl hover:bg-slate-900 hover:text-white rounded-[22px] transition-all shadow-sm border border-white/60 active:scale-95 group"
                >
                    <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
                </button>
                <div className="space-y-1.5">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight italic">
                        Import <span className="text-indigo-600">Config</span>
                    </h1>
                    <p className="text-slate-400 text-sm font-bold tracking-tight">Manage your financial data ingestion pipelines and smart presets.</p>
                </div>
            </div>

            {/* Smart Import Zone (Matches Wizard Aesthetics) */}
            <div
                className={`relative group p-12 rounded-[48px] border-2 border-dashed transition-all duration-700 cursor-pointer overflow-hidden
                    ${isDragging 
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02] shadow-[0_32px_80px_rgba(99,102,241,0.15)]' 
                        : 'border-slate-200 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.03)] hover:border-slate-300 hover:shadow-xl'}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-500/[0.02] to-transparent pointer-events-none" />
                <div className="relative flex flex-col items-center justify-center gap-6">
                    <div className={`w-20 h-20 rounded-[32px] flex items-center justify-center transition-all duration-700 shadow-2xl ${isDragging ? 'bg-indigo-600 text-white rotate-12' : 'bg-slate-900 text-white'}`}>
                        <FileUp size={32} strokeWidth={2.5} />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-black text-slate-950 tracking-tight">Instant Data Drop</h3>
                        <p className="text-sm text-slate-400 font-bold max-w-[280px] leading-relaxed">
                            Drag your bank statement here for <span className="text-emerald-500">SmartAuto</span> processing.
                        </p>
                    </div>
                    <button
                        className="px-10 py-4 bg-slate-900 text-white rounded-full font-black text-sm shadow-2xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all"
                    >
                        Browse Statements
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

            {/* Presets Grid */}
            <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Financial Presets</h2>
                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-widest">{presets.length} SAVED</span>
                </div>

                {presets.length === 0 ? (
                    <div className="text-center p-20 bg-slate-50/50 backdrop-blur-xl rounded-[40px] border-2 border-dashed border-slate-100 italic transition-all">
                        <p className="text-slate-300 font-black text-lg">No ingestion pipelines found.</p>
                        <p className="text-xs text-slate-300 mt-2 font-bold uppercase tracking-widest">Import a file to calibrate your first preset.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {presets.map(preset => {
                            const linkedAsset = assets.find(a => a.id === preset.linkedAssetId);

                            return (
                                <div key={preset.id} className="group relative bg-white/80 backdrop-blur-xl p-8 rounded-[40px] border border-white/60 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 ring-1 ring-black/[0.03]">
                                    <div className="absolute top-8 right-8 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {linkedAsset && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleUnlink(preset.id); }}
                                                className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-white rounded-2xl transition-all shadow-sm border border-slate-100"
                                                title="Unlink Pipeline"
                                            >
                                                <Link2Off size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(preset.id); }}
                                            className="p-2.5 bg-rose-50 text-rose-400 hover:text-rose-600 hover:bg-rose-100 rounded-2xl transition-all shadow-sm border border-rose-100"
                                            title="Delete Pipeline"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-1.5 pt-2">
                                            <h3 className="font-black text-slate-900 text-xl tracking-tight italic line-clamp-1">{preset.name}</h3>
                                            <div className="flex items-center gap-2">
                                               <span className="text-[10px] font-mono bg-slate-900/5 px-2 py-0.5 rounded-lg text-slate-500">
                                                    HASH: {preset.headerHash.slice(0, 12)}...
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            {linkedAsset ? (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-wider ring-1 ring-emerald-100">
                                                    <Link2 size={14} />
                                                    {linkedAsset.name}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-wider ring-1 ring-slate-200">
                                                    <Link2Off size={14} />
                                                    Global
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
