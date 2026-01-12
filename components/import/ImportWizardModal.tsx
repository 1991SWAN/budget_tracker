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
            className={`flex flex-col items-center justify-center p-6 space-y-3 border-2 border-dashed rounded-2xl transition-all duration-200 ${isDragging
                ? 'border-slate-900 bg-slate-50'
                : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-slate-900 text-white' : 'bg-white shadow-sm border border-slate-100 text-slate-900'
                }`}>
                <Upload size={24} />
            </div>
            <div className="text-center space-y-0.5">
                <h3 className={`text-base font-bold ${isDragging ? 'text-slate-900' : 'text-slate-800'}`}>
                    {isDragging ? 'Drop file to upload' : 'Upload Bank Statement'}
                </h3>
                <p className="text-xs text-slate-400 font-medium">Supports CSV, XLS, XLSX</p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-between pt-2 gap-2 sm:gap-0 w-full">
                <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2.5 text-slate-400 hover:text-slate-600 font-bold transition-colors rounded-xl hover:bg-slate-50 text-sm"
                >
                    Cancel
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all font-bold pointer-events-auto text-sm"
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
        <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-600 border border-slate-100">
                <p className="font-bold text-slate-900 mb-0.5">Assign Columns</p>
                Select which column corresponds to Date, Description, and Amount.
            </div>

            {/* Simplified Mapper UI */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Date Column</label>
                    <div className="relative">
                        <select
                            className="w-full p-2.5 pl-3 pr-8 border border-slate-200 rounded-xl bg-white appearance-none focus:ring-2 focus:ring-slate-900 focus:outline-none font-medium text-sm"
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
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Description</label>
                    <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none font-medium text-sm"
                        value={mapping.memoIndex}
                        onChange={(e) => setMapping({ ...mapping, memoIndex: Number(e.target.value) })}
                    >
                        {rawData[0]?.map((col: any, idx: number) => (
                            <option key={idx} value={idx}>Column {idx + 1} ({String(col).slice(0, 10)})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Amount</label>
                    <select
                        className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none font-medium text-sm"
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
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm -mx-2 sm:mx-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                            <tr>
                                {rawData[0]?.map((_: any, idx: number) => (
                                    <th key={idx} className={`p-2 border-r border-slate-100 last:border-r-0 ${idx === mapping.dateIndex ? 'bg-emerald-50 text-emerald-700' :
                                        idx === mapping.memoIndex ? 'bg-slate-100/80 text-slate-700' :
                                            idx === mapping.amountIndex ? 'bg-indigo-50 text-indigo-700' : ''
                                        }`}>
                                        <div className="flex flex-col">
                                            <span className="text-[9px] uppercase tracking-wider mb-0.5 opacity-70">Column {idx + 1}</span>
                                            <span className="text-[10px]">
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
                                        <td key={cIdx} className="p-2 border-r border-slate-50 last:border-r-0 max-w-[120px] truncate font-medium text-slate-600">
                                            {String(cell)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-between pt-2 gap-2 sm:gap-0">
                <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2.5 text-slate-400 hover:text-slate-600 font-bold transition-colors rounded-xl hover:bg-slate-50 text-sm"
                >
                    Cancel
                </button>
                <button
                    onClick={handleMappingConfirm}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-md shadow-slate-200 font-bold transition-all text-sm"
                >
                    Next Step <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );

    const renderPreviewStep = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100/50 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-emerald-700 font-black text-xl mb-0.5">
                            <Check size={20} className="bg-emerald-200 p-0.5 rounded-full text-emerald-800" />
                            {validTxs.length}
                        </div>
                        <p className="text-xs font-bold text-emerald-600/80">Valid Transactions</p>
                    </div>
                </div>
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100/50 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-rose-700 font-black text-xl mb-0.5">
                            <AlertTriangle size={20} className="bg-rose-200 p-0.5 rounded-full text-rose-800" />
                            {invalidRows.length}
                        </div>
                        <p className="text-xs font-bold text-rose-600/80">Skipped / Invalid</p>
                    </div>
                </div>
            </div>

            {/* Invalid List */}
            {invalidRows.length > 0 && (
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 max-h-[140px] overflow-y-auto custom-scrollbar">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">Issues Found</h4>
                    <ul className="space-y-1.5">
                        {invalidRows.map((err, idx) => (
                            <li key={idx} className="text-[10px] text-rose-600 flex items-start gap-2 bg-white p-1.5 rounded-lg border border-rose-50">
                                <span className="font-mono bg-rose-50 px-1 py-0.5 rounded text-[9px] font-bold">ROW {err.row}</span>
                                <span className="font-medium">{err.reason}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between items-center gap-2 sm:gap-0">
                <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2.5 text-slate-400 hover:text-slate-600 font-bold transition-colors rounded-xl hover:bg-slate-50 text-sm"
                >
                    Cancel
                </button>
                <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                    <button onClick={() => setStep('MAPPING')} className="w-full sm:w-auto px-4 py-2.5 text-slate-500 hover:text-slate-800 font-bold transition-colors rounded-xl hover:bg-slate-50 text-sm">
                        Back
                    </button>
                    <button
                        onClick={handleFinalConfirm}
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-xl shadow-md shadow-slate-200 hover:bg-slate-800 hover:shadow-xl transition-all font-bold text-sm"
                    >
                        Confirm Import ({validTxs.length})
                    </button>
                </div>
            </div>
        </div>
    );

    // --- Main Render ---

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 animate-in fade-in duration-200">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/20">
                {/* Clean Header (No bottom border, just spacing) */}
                <div className="px-5 pt-5 pb-2 sm:px-6 sm:pt-6 sm:pb-3 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900">Import Transactions</h2>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">Target Account: <span className="text-slate-600">{assetName}</span></p>
                    </div>
                    {/* Header X button removed per Headless policy */}
                </div>

                {/* Stepper */}
                <div className="px-5 sm:px-6 mb-4">
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                        {['Upload', 'Map Columns', 'Preview'].map((s, i) => {
                            const isActive = (step === 'UPLOAD' && i === 0) || (step === 'MAPPING' && i === 1) || (step === 'PREVIEW' && i === 2);
                            const isDone = (step === 'MAPPING' && i === 0) || (step === 'PREVIEW' && i <= 1);

                            return (
                                <div key={s} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${isActive ? 'bg-white text-slate-900 shadow-sm' :
                                    isDone ? 'text-emerald-600' : 'text-slate-400'
                                    }`}>
                                    {isDone && <Check size={10} strokeWidth={3} />}
                                    <span>{s}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Body */}
                <div className="px-5 sm:px-6 pb-6 overflow-y-auto custom-scrollbar">
                    {step === 'UPLOAD' && renderUploadStep()}
                    {step === 'MAPPING' && renderMappingStep()}
                    {step === 'PREVIEW' && renderPreviewStep()}
                </div>
            </div>
        </div>
    );
};
