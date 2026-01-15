import React, { useState, useRef } from 'react';
import { X, Upload, ArrowRight, Check, AlertTriangle, FileText } from 'lucide-react';
import { ImportService, ColumnMapping, ImportPreset } from '../../services/importService';
import { Transaction } from '../../types';
import { useToast } from '../../contexts/ToastContext';

interface ImportWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (transactions: Transaction[]) => void;
    assetName: string;
    assetId: string;
    assets: any[]; // New prop
    initialFile?: File; // New prop for Sidebar Dropzone
    categories: any[]; // Categories for mapping
}

type WizardStep = 'UPLOAD' | 'ASSET_SELECTION' | 'MAPPING' | 'PREVIEW';

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    assetName,
    assetId,
    assets = [],
    initialFile,
    categories = []
}) => {
    const { addToast } = useToast();
    const [step, setStep] = useState<WizardStep>('UPLOAD');
    const [rawData, setRawData] = useState<any[][]>([]);
    const [fileName, setFileName] = useState('');

    // Target Asset State (Global Override)
    const [targetAssetId, setTargetAssetId] = useState(assetId);

    // Preset State
    const [allPresets, setAllPresets] = useState<ImportPreset[]>([]);
    const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
    const [saveAsPreset, setSaveAsPreset] = useState(false);
    const [updateCurrentPreset, setUpdateCurrentPreset] = useState(false);
    const [presetName, setPresetName] = useState('');
    const [matchingPreset, setMatchingPreset] = useState<ImportPreset | null>(null);
    const [applyPreset, setApplyPreset] = useState(true);

    // Mapping State
    const [mapping, setMapping] = useState<ColumnMapping>({
        dateIndex: 0,
        memoIndex: 1,
        amountIndex: 2,
        assetIndex: -1,
        categoryIndex: -1,
        merchantIndex: -1
    });

    // Preview State
    const [validTxs, setValidTxs] = useState<Partial<Transaction>[]>([]);
    const [invalidRows, setInvalidRows] = useState<any[]>([]);

    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize Presets & Asset ID
    React.useEffect(() => {
        if (isOpen) {
            setAllPresets(ImportService.getPresets());
            setTargetAssetId(assetId);

            // If we have an initial file passed (e.g. from Sidebar drop), process it immediately
            if (initialFile) {
                ImportService.parseFileToGrid(initialFile).then(grid => {
                    processFileGrid(grid, initialFile.name);
                }).catch(err => {
                    console.error("Failed to parse initial file", err);
                    alert("Failed to read the dropped file.");
                });
            }
        }
    }, [isOpen, assetId, initialFile]);

    if (!isOpen) return null;

    // --- Handlers ---

    const processFileGrid = (grid: any[][], fName: string) => {
        if (grid.length < 1) {
            alert("File appears to be empty.");
            return;
        }

        setRawData(grid);
        setFileName(fName);
        setStep('ASSET_SELECTION');
    };

    // Check for matching preset when step or asset changes
    React.useEffect(() => {
        if (step === 'ASSET_SELECTION' && rawData.length > 0) {
            const headers = rawData[0] || [];
            const preset = ImportService.findMatchingPreset(headers, targetAssetId);
            setMatchingPreset(preset || null);
            setApplyPreset(!!preset); // Default to true if found
        }
    }, [step, targetAssetId, rawData]);

    const handleAssetConfirm = () => {
        const headers = rawData[0] || [];

        // Apply Preset if user opted in
        if (matchingPreset && applyPreset) {
            console.log("Applying matched preset:", matchingPreset.name);
            setMapping(matchingPreset.mapping);
            setSelectedPresetId(matchingPreset.id);
            setPresetName(matchingPreset.name);

            // Validation: If General Import (dynamic), Asset Column MUST be mapped
            if (targetAssetId === 'dynamic' && matchingPreset.mapping.assetIndex === -1) {
                addToast("Preset incomplete for General Import. Please map Account column.", 'warning');
                setStep('MAPPING');
                return;
            }

            // Auto-advance to PREVIEW
            const { valid, invalid } = ImportService.mapRawDataToTransactions(
                rawData,
                matchingPreset.mapping,
                targetAssetId,
                assets,
                categories
            );
            setValidTxs(valid);
            setInvalidRows(invalid);
            setStep('PREVIEW');

        } else {
            // Reset to defaults or custom if ignored or not found
            setSelectedPresetId('custom');
            setPresetName('');
            setUpdateCurrentPreset(false);
            setStep('MAPPING');
        }
    };

    const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newId = e.target.value;
        setSelectedPresetId(newId);
        setUpdateCurrentPreset(false);

        if (newId === 'custom') {
            setPresetName('');
        } else {
            const preset = allPresets.find(p => p.id === newId);
            if (preset) {
                setMapping(preset.mapping);
                setPresetName(preset.name);
            }
        }
    };

    const handleMappingChange = (field: keyof ColumnMapping, value: number) => {
        setMapping(prev => ({ ...prev, [field]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const grid = await ImportService.parseFileToGrid(file);
            processFileGrid(grid, file.name);
        } catch (err) {
            alert("Failed to read file.");
            console.error(err);
        }
    };

    const handleMappingConfirm = () => {
        // Validation: If General Import (dynamic), Asset Column MUST be mapped
        if (targetAssetId === 'dynamic' && mapping.assetIndex === -1) {
            addToast("For General Import, you must map an 'Account' column.", 'error');
            return;
        }

        const headers = rawData[0] || [];

        // Logic: Update Existing OR Save As New
        // Logic: Implicitly Update or Create Preset for this Asset + Header Combo
        const headerHash = ImportService.generateHeaderHash(headers);
        ImportService.savePreset(
            `Auto-Preset (${new Date().toLocaleDateString()})`, // Default name if new
            mapping,
            headerHash,
            targetAssetId
        );

        // Generate preview
        const { valid, invalid } = ImportService.mapRawDataToTransactions(rawData, mapping, targetAssetId, assets, categories);
        setValidTxs(valid);
        setInvalidRows(invalid);
        setStep('PREVIEW');
    };

    const handleFinalConfirm = () => {
        // We just pass it up to App.tsx which calculates duplicates/transfers
        onConfirm(validTxs as Transaction[]);
        onClose();
    };

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
            processFileGrid(grid, file.name);
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
                    className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all font-bold pointer-events-auto text-sm"
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

    const renderAssetSelectionStep = () => (
        <div className="flex flex-col items-center justify-center p-4 space-y-4 min-h-[350px]">
            {/* Reduced Icon Size */}
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 shadow-sm">
                <span className="text-2xl">🏦</span>
            </div>

            <div className="text-center space-y-1 max-w-sm">
                <h3 className="text-lg font-bold text-slate-900">Select Account</h3>
                <p className="text-slate-500 text-xs font-medium">
                    Where should these transactions go?
                </p>
            </div>

            <div className="w-full max-w-xs space-y-3 pt-2">
                <select
                    value={targetAssetId}
                    onChange={(e) => setTargetAssetId(e.target.value)}
                    className="w-full bg-white text-sm font-bold text-slate-900 border border-slate-200 rounded-xl p-2.5 focus:ring-2 focus:ring-slate-900 focus:outline-none shadow-sm"
                    autoFocus
                >
                    <option value="dynamic">✨ General Import (Match by Column)</option>
                    <option disabled className="text-slate-300">━━━━━━━━━━━━━━━━</option>
                    {assets.map(a => (
                        <option key={a.id} value={a.id}>{a.institution ? `${a.institution} - ${a.name}` : a.name}</option>
                    ))}
                </select>

                {/* Matching Preset Found UI */}
                {/* Matching Preset Found UI (Reserved Space) */}
                <div className="h-[52px] flex items-center justify-center">
                    {matchingPreset ? (
                        <div className="w-full animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="flex items-center gap-3 p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl cursor-pointer hover:bg-indigo-100/50 transition-colors w-full">
                                <input
                                    type="checkbox"
                                    checked={applyPreset}
                                    onChange={(e) => setApplyPreset(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-indigo-900 line-clamp-1">Apply '{matchingPreset.name}'</p>
                                </div>
                            </label>
                        </div>
                    ) : (
                        /* Empty placeholder to keep Next button position fixed */
                        <div className="w-full h-full" />
                    )}
                </div>

                <button
                    onClick={handleAssetConfirm}
                    className="w-full py-3 bg-slate-900 text-white rounded-full font-bold shadow-lg hover:bg-slate-800 transition-all transform active:scale-95 text-sm flex items-center justify-center gap-2"
                >
                    <span>Next</span>
                    <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );



    const getColumnRole = (colIdx: number) => {
        if (mapping.dateIndex === colIdx) return 'date';
        if (mapping.memoIndex === colIdx) return 'memo';
        if (mapping.amountIndex === colIdx) return 'amount'; // General Mode
        if (mapping.amountInIndex === colIdx) return 'amountIn'; // Banking Mode
        if (mapping.amountOutIndex === colIdx) return 'amountOut'; // Banking Mode
        if (mapping.assetIndex === colIdx) return 'asset';
        if (mapping.categoryIndex === colIdx) return 'category';
        if (mapping.merchantIndex === colIdx) return 'merchant';
        if (mapping.tagIndex === colIdx) return 'tag';
        if (mapping.installmentIndex === colIdx) return 'installment';
        return 'ignore';
    };

    const handleColumnRoleChange = (idx: number, role: string) => {
        setMapping(prev => {
            const next = { ...prev };
            // 1. Remove this index from any existing role
            if (next.dateIndex === idx) next.dateIndex = -1;
            if (next.memoIndex === idx) next.memoIndex = -1;
            if (next.amountIndex === idx) next.amountIndex = -1;
            if (next.amountInIndex === idx) next.amountInIndex = -1;
            if (next.amountOutIndex === idx) next.amountOutIndex = -1;
            if (next.assetIndex === idx) next.assetIndex = -1;
            if (next.categoryIndex === idx) next.categoryIndex = -1;
            if (next.merchantIndex === idx) next.merchantIndex = -1;
            if (next.tagIndex === idx) next.tagIndex = -1;
            if (next.installmentIndex === idx) next.installmentIndex = -1;

            // 2. Assign new role
            if (role === 'date') next.dateIndex = idx;
            if (role === 'memo') next.memoIndex = idx;
            if (role === 'amount') next.amountIndex = idx;
            if (role === 'amountIn') next.amountInIndex = idx;
            if (role === 'amountOut') next.amountOutIndex = idx;
            if (role === 'asset') next.assetIndex = idx;
            if (role === 'category') next.categoryIndex = idx;
            if (role === 'merchant') next.merchantIndex = idx;
            if (role === 'tag') next.tagIndex = idx;
            if (role === 'installment') next.installmentIndex = idx;

            return next;
        });
    };

    const renderMappingStep = () => (
        <div className="space-y-4">
            {/* Header / Instructions */}
            <div className="flex items-center justify-between px-1">
                <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">Map Columns</h3>
                    <p className="text-xs text-slate-500">Assign column types to your data headers.</p>
                </div>
            </div>

            {/* Compact Table Mapping UI */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs text-left whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                {rawData[0]?.map((col: any, idx: number) => {
                                    const role = getColumnRole(idx);
                                    let containerClass = 'bg-white border border-transparent';
                                    let labelClass = 'text-slate-500';

                                    if (role === 'date') {
                                        containerClass = 'bg-emerald-50 border-emerald-200 shadow-sm';
                                        labelClass = 'text-emerald-700 opacity-90';
                                    } else if (role === 'amount') {
                                        containerClass = 'bg-indigo-50 border-indigo-200 shadow-sm';
                                        labelClass = 'text-indigo-700 opacity-90';
                                    } else if (role === 'amountIn') {
                                        containerClass = 'bg-blue-50 border-blue-200 shadow-sm';
                                        labelClass = 'text-blue-700 opacity-90';
                                    } else if (role === 'amountOut') {
                                        containerClass = 'bg-rose-50 border-rose-200 shadow-sm';
                                        labelClass = 'text-rose-700 opacity-90';
                                    } else if (role === 'memo') {
                                        containerClass = 'bg-slate-100 border-slate-200 shadow-sm';
                                        labelClass = 'text-slate-700 opacity-90';
                                    } else if (role === 'asset') {
                                        containerClass = 'bg-blue-50 border-blue-200 shadow-sm';
                                        labelClass = 'text-blue-700 opacity-90';
                                    } else if (role === 'category') {
                                        containerClass = 'bg-amber-50 border-amber-200 shadow-sm';
                                        labelClass = 'text-amber-700 opacity-90';
                                    } else if (role === 'merchant') {
                                        containerClass = 'bg-violet-50 border-violet-200 shadow-sm';
                                        labelClass = 'text-violet-700 opacity-90';
                                    } else if (role === 'tag') {
                                        containerClass = 'bg-pink-50 border-pink-200 shadow-sm';
                                        labelClass = 'text-pink-700 opacity-90';
                                    } else if (role === 'installment') {
                                        containerClass = 'bg-orange-50 border-orange-200 shadow-sm';
                                        labelClass = 'text-orange-700 opacity-90';
                                    }

                                    return (
                                        <th key={idx} className="p-1 min-w-[140px] border-r border-slate-100 last:border-r-0 align-top">
                                            <div className={`flex flex-col gap-2 p-2 rounded-xl transition-all h-full ${containerClass}`}>
                                                {/* Raw Header Name */}
                                                <div className={`text-[10px] font-bold uppercase truncate mb-0.5 ${labelClass}`} title={String(col)}>
                                                    {String(col) || `Column ${idx + 1}`}
                                                </div>

                                                {/* Mapping Dropdown */}
                                                <select
                                                    value={role}
                                                    onChange={(e) => handleColumnRoleChange(idx, e.target.value)}
                                                    className={`w-full p-1.5 text-xs font-bold rounded-lg border-0 focus:ring-2 transition-all cursor-pointer shadow-sm ${role === 'ignore'
                                                        ? 'bg-slate-50 text-slate-400 ring-1 ring-slate-200 hover:bg-slate-100'
                                                        : 'bg-white ring-1 ring-black/5 hover:shadow-md'
                                                        } ${role === 'date' ? 'text-emerald-700' :
                                                            role === 'amount' ? 'text-indigo-700' :
                                                                role === 'amountIn' ? 'text-blue-600' :
                                                                    role === 'amountOut' ? 'text-rose-600' :
                                                                        role === 'memo' ? 'text-slate-700' :
                                                                            role === 'asset' ? 'text-blue-700' :
                                                                                role === 'category' ? 'text-amber-700' :
                                                                                    role === 'merchant' ? 'text-violet-700' :
                                                                                        role === 'tag' ? 'text-pink-700' :
                                                                                            role === 'installment' ? 'text-orange-700' : ''}`}
                                                >
                                                    <option value="ignore">Skip</option>
                                                    <option value="date">Date</option>
                                                    <option value="memo">Description</option>

                                                    {/* Conditional Options based on Target Asset */}
                                                    {targetAssetId === 'dynamic' ? (
                                                        <option value="amount">Amount (+/-)</option>
                                                    ) : (
                                                        <>
                                                            <option value="amountOut">Withdrawal (-)</option>
                                                            <option value="amountIn">Deposit (+)</option>
                                                        </>
                                                    )}

                                                    <option value="category">Category</option>
                                                    <option value="merchant">Merchant</option>
                                                    <option value="tag">Tag (#)</option>
                                                    <option value="installment">Installment (Months)</option>

                                                    {/* Only show Account mapping in Dynamic Mode */}
                                                    {targetAssetId === 'dynamic' && <option value="asset">Account</option>}
                                                </select>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {rawData.slice(1, 8).map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-50/50">
                                    {row.map((cell: any, cIdx: number) => {
                                        const role = getColumnRole(cIdx);
                                        let cellClass = 'text-slate-500';
                                        if (role === 'date') cellClass = 'text-emerald-700 font-medium';
                                        if (role === 'amount') cellClass = 'text-indigo-700 font-medium'; // General Mode
                                        if (role === 'amountIn') cellClass = 'text-blue-600 font-medium'; // Banking Mode
                                        if (role === 'amountOut') cellClass = 'text-rose-600 font-medium'; // Banking Mode
                                        if (role === 'memo') cellClass = 'text-slate-900';
                                        if (role === 'tag') cellClass = 'text-pink-600 font-medium';
                                        if (role === 'installment') cellClass = 'text-orange-600 font-medium';

                                        return (
                                            <td key={cIdx} className={`p-2 border-r border-slate-50 last:border-r-0 max-w-[160px] truncate ${cellClass}`}>
                                                {String(cell)}
                                            </td>
                                        );
                                    })}
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
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setStep('ASSET_SELECTION')}
                        className="w-full sm:w-auto px-4 py-2.5 text-slate-400 hover:text-slate-600 font-bold transition-colors rounded-xl hover:bg-slate-50 text-sm"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleMappingConfirm}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-full hover:bg-slate-800 shadow-md shadow-slate-200 font-bold transition-all text-sm"
                    >
                        Review Import <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </div >
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
                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-full shadow-md shadow-slate-200 hover:bg-slate-800 hover:shadow-xl transition-all font-bold text-sm"
                    >
                        Confirm Import ({validTxs.length})
                    </button>
                </div>
            </div>
        </div>
    );

    // --- Main Render ---

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-3 animate-in fade-in duration-200">
            <div className="bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/20">
                {/* Header removed per Headless policy */}
                <div className="pt-5 sm:pt-6" />

                {/* Stepper */}
                <div className="px-5 sm:px-6 mb-4">
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                        {['Upload', 'Select Account', 'Map Columns', 'Preview'].map((s, i) => {
                            const stepIndex = step === 'UPLOAD' ? 0 : step === 'ASSET_SELECTION' ? 1 : step === 'MAPPING' ? 2 : 3;
                            const isActive = i === stepIndex;
                            const isDone = i < stepIndex;

                            return (
                                <div key={s} className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${isActive ? 'bg-white text-slate-900 shadow-sm' :
                                    isDone ? 'text-emerald-600' : 'text-slate-400'
                                    }`}>
                                    {isDone && <Check size={10} strokeWidth={3} />}
                                    <span className="truncate px-1">{s}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Body */}
                <div className="px-5 sm:px-6 pb-6 overflow-y-auto custom-scrollbar">
                    {step === 'UPLOAD' && renderUploadStep()}
                    {step === 'ASSET_SELECTION' && renderAssetSelectionStep()}
                    {step === 'MAPPING' && renderMappingStep()}
                    {step === 'PREVIEW' && renderPreviewStep()}
                </div>
            </div>
        </div>
    );
};
