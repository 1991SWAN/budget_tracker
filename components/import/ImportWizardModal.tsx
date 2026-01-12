import React, { useState, useRef } from 'react';
import { X, Upload, ArrowRight, Check, AlertTriangle, FileText } from 'lucide-react';
import { ImportService, ColumnMapping } from '../../services/importService';
import { Transaction } from '../../types';

interface ImportWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (transactions: Transaction[]) => void;
    assetName: string; // Display which account we are importing into
    assetId: string;
}

type WizardStep = 'UPLOAD' | 'MAPPING' | 'PREVIEW';

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    assetName,
    assetId
}) => {
    const [step, setStep] = useState<WizardStep>('UPLOAD');
    const [rawData, setRawData] = useState<any[][]>([]);
    const [fileName, setFileName] = useState('');

    // Mapping State
    const [mapping, setMapping] = useState<ColumnMapping>({
        dateIndex: 0,
        memoIndex: 1,
        amountIndex: 2
    });

    // Preview State
    const [validTxs, setValidTxs] = useState<Partial<Transaction>[]>([]);
    const [invalidRows, setInvalidRows] = useState<any[]>([]);

    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    // --- Handlers ---

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const grid = await ImportService.parseFileToGrid(file);
            if (grid.length < 1) {
                alert("File appears to be empty.");
                return;
            }
            setRawData(grid);
            setFileName(file.name);
            setStep('MAPPING');
        } catch (err) {
            alert("Failed to read file.");
            console.error(err);
        }
    };

    const handleMappingConfirm = () => {
        // Generate preview
        const { valid, invalid } = ImportService.mapRawDataToTransactions(rawData, mapping, assetId);
        setValidTxs(valid);
        setInvalidRows(invalid);
        setStep('PREVIEW');
    };

    const handleFinalConfirm = () => {
        // Convert Partial<Transaction>[] to Transaction[] (ID is already set by import service)
        // But we need to ensure type safety. The service returns Partial, but logic needs Full.
        // In reality, ImportService.mapRawDataToTransactions returns objects that have ALL required fields for a new TX except maybe 'id' logic handling if we want Supabase UUIDs later.
        // But for now let's cast them or rely on ImportService.processImportedTransactions to handle final cleanup.

        // We just pass it up to App.tsx which calculates duplicates/transfers
        onConfirm(validTxs as Transaction[]);
        onClose();
    };

    // --- Render Steps ---

    // --- Drag & Drop Handlers ---
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

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (!file) return;

        try {
            const grid = await ImportService.parseFileToGrid(file);
            setRawData(grid);
            setFileName(file.name);
            setStep('MAPPING');
        } catch (err) {
            alert("Failed to read file.");
            console.error(err);
        }
    };

    // --- Render Steps ---

    const renderUploadStep = () => (
        <div
            className={`flex flex-col items-center justify-center p-8 space-y-4 border-2 border-dashed rounded-3xl transition-all duration-200 ${isDragging
                ? 'border-slate-900 bg-slate-50'
                : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-slate-900 text-white' : 'bg-white shadow-sm border border-slate-100 text-slate-900'
                }`}>
                <Upload size={28} />
            </div>
            <div className="text-center space-y-1">
                <h3 className={`text-lg font-bold ${isDragging ? 'text-slate-900' : 'text-slate-800'}`}>
                    {isDragging ? 'Drop file to upload' : 'Upload Bank Statement'}
                </h3>
                <p className="text-sm text-slate-400 font-medium">Supports CSV, XLS, XLSX</p>
            </div>
            <div className="flex justify-between pt-4">
                <button
                    onClick={onClose}
                    className="px-6 py-3 text-slate-400 hover:text-slate-600 font-bold transition-colors rounded-2xl hover:bg-slate-50"
                >
                    Cancel
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-8 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all font-bold pointer-events-auto"
                >
                    Select File
                </button>
            </div>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv, .xls, .xlsx"
                className="hidden"
            />
        </div>
    );

    const renderMappingStep = () => (
        <div className="space-y-6">
            <div className="bg-slate-50 p-5 rounded-2xl text-sm text-slate-600 border border-slate-100">
                <p className="font-bold text-slate-900 mb-1">Assign Columns</p>
                Select which column corresponds to Date, Description, and Amount.
            </div>

            {/* Simplified Mapper UI */}
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date Column</label>
                    <div className="relative">
                        <select
                            className="w-full p-3 pl-3 pr-8 border border-slate-200 rounded-2xl bg-white appearance-none focus:ring-2 focus:ring-slate-900 focus:outline-none font-medium"
                            value={mapping.dateIndex}
                            onChange={(e) => setMapping({ ...mapping, dateIndex: Number(e.target.value) })}
                        >
                            {rawData[0]?.map((col: any, idx: number) => (
                                <option key={idx} value={idx}>Column {idx + 1} ({String(col).slice(0, 10)})</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description</label>
                    <select
                        className="w-full p-3 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none font-medium"
                        value={mapping.memoIndex}
                        onChange={(e) => setMapping({ ...mapping, memoIndex: Number(e.target.value) })}
                    >
                        {rawData[0]?.map((col: any, idx: number) => (
                            <option key={idx} value={idx}>Column {idx + 1} ({String(col).slice(0, 10)})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Amount</label>
                    <select
                        className="w-full p-3 border border-slate-200 rounded-2xl bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none font-medium"
                        value={mapping.amountIndex}
                        onChange={(e) => setMapping({ ...mapping, amountIndex: Number(e.target.value) })}
                    >
                        {rawData[0]?.map((col: any, idx: number) => (
                            <option key={idx} value={idx}>Column {idx + 1} ({String(col).slice(0, 10)})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Preview Grid */}
            <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <tr>
                            {rawData[0]?.map((_: any, idx: number) => (
                                <th key={idx} className={`p-3 border-r border-slate-100 last:border-r-0 ${idx === mapping.dateIndex ? 'bg-emerald-50 text-emerald-700' :
                                    idx === mapping.memoIndex ? 'bg-slate-100/80 text-slate-700' :
                                        idx === mapping.amountIndex ? 'bg-indigo-50 text-indigo-700' : ''
                                    }`}>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase tracking-wider mb-0.5 opacity-70">Column {idx + 1}</span>
                                        <span className="text-xs">
                                            {idx === mapping.dateIndex ? '🗓 DATE' :
                                                idx === mapping.memoIndex ? '📝 DESC' :
                                                    idx === mapping.amountIndex ? '💰 AMT' : '-'}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        {rawData.slice(0, 5).map((row, rIdx) => (
                            <tr key={rIdx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                {row.map((cell: any, cIdx: number) => (
                                    <td key={cIdx} className="p-3 border-r border-slate-50 last:border-r-0 truncate max-w-[150px] font-medium text-slate-600">
                                        {String(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between pt-2">
                <button
                    onClick={onClose}
                    className="px-6 py-3 text-slate-400 hover:text-slate-600 font-bold transition-colors rounded-2xl hover:bg-slate-50"
                >
                    Cancel
                </button>
                <button
                    onClick={handleMappingConfirm}
                    className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 shadow-lg shadow-slate-200 font-bold transition-all"
                >
                    Next Step <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );

    const renderPreviewStep = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100/50">
                    <div className="flex items-center gap-2 text-emerald-700 font-black text-2xl mb-1">
                        <Check size={24} className="bg-emerald-200 p-1 rounded-full text-emerald-800" />
                        {validTxs.length}
                    </div>
                    <p className="text-sm font-bold text-emerald-600/80">Valid Transactions</p>
                </div>
                <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100/50">
                    <div className="flex items-center gap-2 text-rose-700 font-black text-2xl mb-1">
                        <AlertTriangle size={24} className="bg-rose-200 p-1 rounded-full text-rose-800" />
                        {invalidRows.length}
                    </div>
                    <p className="text-sm font-bold text-rose-600/80">Skipped / Invalid</p>
                </div>
            </div>

            {/* Invalid List */}
            {invalidRows.length > 0 && (
                <div className="border border-slate-100 rounded-3xl p-5 bg-slate-50/50 max-h-[160px] overflow-y-auto custom-scrollbar">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">Issues Found</h4>
                    <ul className="space-y-2">
                        {invalidRows.map((err, idx) => (
                            <li key={idx} className="text-xs text-rose-600 flex items-start gap-2 bg-white p-2 rounded-xl border border-rose-50">
                                <span className="font-mono bg-rose-50 px-1.5 py-0.5 rounded text-[10px] font-bold">ROW {err.row}</span>
                                <span className="font-medium">{err.reason}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="pt-2 flex justify-between items-center">
                <button
                    onClick={onClose}
                    className="px-6 py-3 text-slate-400 hover:text-slate-600 font-bold transition-colors rounded-2xl hover:bg-slate-50"
                >
                    Cancel
                </button>
                <div className="flex gap-2">
                    <button onClick={() => setStep('MAPPING')} className="px-6 py-3 text-slate-500 hover:text-slate-800 font-bold transition-colors rounded-2xl hover:bg-slate-50">
                        Back
                    </button>
                    <button
                        onClick={handleFinalConfirm}
                        className="px-8 py-3 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-200 hover:bg-slate-800 hover:shadow-xl transition-all font-bold"
                    >
                        Confirm Import ({validTxs.length})
                    </button>
                </div>
            </div>
        </div>
    );

    // --- Main Render ---

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/20">
                {/* Clean Header (No bottom border, just spacing) */}
                <div className="px-8 pt-8 pb-4 flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">Import Transactions</h2>
                        <p className="text-sm text-slate-400 font-medium mt-1">Target Account: <span className="text-slate-600">{assetName}</span></p>
                    </div>
                    {/* Header X button removed per Headless policy */}
                </div>

                {/* Stepper */}
                <div className="px-8 mb-6">
                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl">
                        {['Upload', 'Map Columns', 'Preview'].map((s, i) => {
                            const isActive = (step === 'UPLOAD' && i === 0) || (step === 'MAPPING' && i === 1) || (step === 'PREVIEW' && i === 2);
                            const isDone = (step === 'MAPPING' && i === 0) || (step === 'PREVIEW' && i <= 1);

                            return (
                                <div key={s} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${isActive ? 'bg-white text-slate-900 shadow-sm' :
                                    isDone ? 'text-emerald-600' : 'text-slate-400'
                                    }`}>
                                    {isDone && <Check size={12} strokeWidth={3} />}
                                    <span>{s}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Body */}
                <div className="px-8 pb-8 overflow-y-auto custom-scrollbar">
                    {step === 'UPLOAD' && renderUploadStep()}
                    {step === 'MAPPING' && renderMappingStep()}
                    {step === 'PREVIEW' && renderPreviewStep()}
                </div>
            </div>
        </div>
    );
};
