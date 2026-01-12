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
            className={`flex flex-col items-center justify-center p-8 space-y-4 border-2 border-dashed rounded-xl transition-all duration-200 ${isDragging
                ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                : 'border-slate-200 bg-slate-50 hover:border-blue-300'
                }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
                }`}>
                <Upload size={32} />
            </div>
            <div className="text-center">
                <h3 className={`text-lg font-semibold ${isDragging ? 'text-blue-700' : 'text-slate-800'}`}>
                    {isDragging ? 'Drop file to upload' : 'Upload Bank Statement'}
                </h3>
                <p className="text-sm text-slate-500">Supports CSV, XLS, XLSX</p>
            </div>
            <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium pointer-events-auto"
            >
                Select File
            </button>
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
            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 mb-4">
                <p className="font-semibold">Assign Columns</p>
                Select which column corresponds to Date, Description, and Amount.
            </div>

            {/* Simplified Mapper UI - Just Dropdowns for now */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Date Column</label>
                    <select
                        className="w-full p-2 border rounded-lg bg-white"
                        value={mapping.dateIndex}
                        onChange={(e) => setMapping({ ...mapping, dateIndex: Number(e.target.value) })}
                    >
                        {rawData[0]?.map((col: any, idx: number) => (
                            <option key={idx} value={idx}>Column {idx + 1} ({String(col).slice(0, 10)})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Description Column</label>
                    <select
                        className="w-full p-2 border rounded-lg bg-white"
                        value={mapping.memoIndex}
                        onChange={(e) => setMapping({ ...mapping, memoIndex: Number(e.target.value) })}
                    >
                        {rawData[0]?.map((col: any, idx: number) => (
                            <option key={idx} value={idx}>Column {idx + 1} ({String(col).slice(0, 10)})</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Amount Column</label>
                    <select
                        className="w-full p-2 border rounded-lg bg-white"
                        value={mapping.amountIndex}
                        onChange={(e) => setMapping({ ...mapping, amountIndex: Number(e.target.value) })}
                    >
                        {rawData[0]?.map((col: any, idx: number) => (
                            <option key={idx} value={idx}>Column {idx + 1} ({String(col).slice(0, 10)})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Preview Grid (First 5 Rows) */}
            <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-medium">
                        <tr>
                            {rawData[0]?.map((_: any, idx: number) => (
                                <th key={idx} className={`p-2 border-r last:border-r-0 ${idx === mapping.dateIndex ? 'bg-green-100 text-green-800 border-green-200' :
                                    idx === mapping.memoIndex ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                        idx === mapping.amountIndex ? 'bg-purple-100 text-purple-800 border-purple-200' : ''
                                    }`}>
                                    Col {idx + 1}
                                    <div className="text-[10px] font-normal uppercase mt-1">
                                        {idx === mapping.dateIndex ? 'DATE' :
                                            idx === mapping.memoIndex ? 'DESC' :
                                                idx === mapping.amountIndex ? 'AMT' : '-'}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rawData.slice(0, 5).map((row, rIdx) => (
                            <tr key={rIdx} className="border-t">
                                {row.map((cell: any, cIdx: number) => (
                                    <td key={cIdx} className="p-2 border-r last:border-r-0 truncate max-w-[150px]">
                                        {String(cell)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleMappingConfirm}
                    className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                >
                    Next: Preview <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );

    const renderPreviewStep = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                    <div className="flex items-center gap-2 text-green-700 font-bold text-lg mb-1">
                        <Check size={20} /> {validTxs.length}
                    </div>
                    <p className="text-sm text-green-600">Valid Transactions</p>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                    <div className="flex items-center gap-2 text-red-700 font-bold text-lg mb-1">
                        <AlertTriangle size={20} /> {invalidRows.length}
                    </div>
                    <p className="text-sm text-red-600">Invalid / Skipped Rows</p>
                </div>
            </div>

            {/* Invalid List */}
            {invalidRows.length > 0 && (
                <div className="border rounded-lg p-4 bg-slate-50 max-h-[150px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Issues Found</h4>
                    <ul className="space-y-1">
                        {invalidRows.map((err, idx) => (
                            <li key={idx} className="text-xs text-red-600 flex gap-2">
                                <span className="font-mono bg-red-100 px-1 rounded">Row {err.row}</span>
                                {err.reason}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="pt-4 flex justify-between items-center">
                <button onClick={() => setStep('MAPPING')} className="text-slate-500 hover:text-slate-800 text-sm">
                    Back to Mapping
                </button>
                <button
                    onClick={handleFinalConfirm}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-blue-200/50 transition-all font-bold"
                >
                    Import {validTxs.length} Transactions
                </button>
            </div>
        </div>
    );

    // --- Main Render ---

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Import Transactions</h2>
                        <p className="text-sm text-slate-500">Target: <span className="font-medium text-slate-700">{assetName}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="flex border-b border-slate-100 bg-slate-50/50">
                    {['Upload', 'Map Columns', 'Preview'].map((s, i) => {
                        const isActive = (step === 'UPLOAD' && i === 0) || (step === 'MAPPING' && i === 1) || (step === 'PREVIEW' && i === 2);
                        const isPast = (step === 'MAPPING' && i === 0) || (step === 'PREVIEW' && i <= 1);

                        return (
                            <div key={s} className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-colors ${isActive ? 'border-blue-500 text-blue-600' :
                                isPast ? 'border-green-500 text-green-600' : 'border-transparent text-slate-400'
                                }`}>
                                {isPast ? <Check size={12} className="inline mr-1" /> : <span className="mr-1">{i + 1}.</span>}
                                {s}
                            </div>
                        );
                    })}
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto min-h-[300px]">
                    {step === 'UPLOAD' && renderUploadStep()}
                    {step === 'MAPPING' && renderMappingStep()}
                    {step === 'PREVIEW' && renderPreviewStep()}
                </div>
            </div>
        </div>
    );
};
