
import React, { useState, useRef, useEffect } from 'react';
import { ImportService, ColumnMapping, ImportPreset, ImportRow } from '../../services/importService';
import { Transaction, Asset, CategoryItem } from '../../types';
import { Upload, ArrowRight, X, AlertTriangle, Check, Trash2 } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useToast } from '../../contexts/ToastContext';

interface ImportWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (validTxs: Transaction[]) => void;
    initialFile?: File;
    assetId?: string; // Optional: Pre-selected Asset Context
    assetName?: string;
    assets: Asset[];
    categories: CategoryItem[];
}



export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({ isOpen, onClose, onConfirm, initialFile, assetId, assets, categories }) => {
    // Steps: UPLOAD -> ASSET_SELECTION -> MAPPING -> PREVIEW
    const [step, setStep] = useState<'UPLOAD' | 'ASSET_SELECTION' | 'MAPPING' | 'PREVIEW'>('UPLOAD');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    // Data
    const [rawData, setRawData] = useState<any[][]>([]);
    const [fileName, setFileName] = useState('');
    const [targetAssetId, setTargetAssetId] = useState(assetId || 'dynamic'); // 'dynamic' means use column mapping

    // Mapping State
    const [mapping, setMapping] = useState<ColumnMapping>({
        dateIndex: -1,
        amountIndex: -1,
        amountInIndex: -1,
        amountOutIndex: -1,
        memoIndex: -1,
        assetIndex: -1,
        categoryIndex: -1,
        merchantIndex: -1,
        tagIndex: -1,
        installmentIndex: -1,
    });

    // Preset State
    const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
    const [presetName, setPresetName] = useState('');
    const [updateCurrentPreset, setUpdateCurrentPreset] = useState(false);
    const [matchingPreset, setMatchingPreset] = useState<any | null>(null);
    const [applyPreset, setApplyPreset] = useState(false);
    const [allPresets, setAllPresets] = useState<ImportPreset[]>([]);

    // Preview Data
    const [importRows, setImportRows] = useState<ImportRow[]>([]);
    const [previewTab, setPreviewTab] = useState<'VALID' | 'INVALID'>('VALID');

    // Memos for performance
    const validRows = React.useMemo(() => importRows.filter(r => r.status === 'valid'), [importRows]);
    const invalidRows = React.useMemo(() => importRows.filter(r => r.status === 'invalid'), [importRows]);

    // Load Presets
    useEffect(() => {
        if (isOpen) {
            setAllPresets(ImportService.getPresets());
        }
    }, [isOpen]);

    // Reset when opening
    React.useEffect(() => {
        if (isOpen) {
            setStep(initialFile ? 'ASSET_SELECTION' : 'UPLOAD');
            setRawData([]);
            setImportRows([]);
            setMapping({
                dateIndex: -1,
                amountIndex: -1,
                amountInIndex: -1,
                amountOutIndex: -1,
                memoIndex: -1,
                assetIndex: -1,
                categoryIndex: -1,
                merchantIndex: -1,
                tagIndex: -1,
                installmentIndex: -1,
            });
            setTargetAssetId(assetId || 'dynamic');
            setPresetName('');
            setMatchingPreset(null);
            setApplyPreset(false);

            if (initialFile) {
                // If passed a file directly, parse it immediately
                ImportService.parseFileToGrid(initialFile).then(grid => {
                    processFileGrid(grid, initialFile.name);
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

        // Clean empty rows from the end
        const cleanGrid = grid.filter(row => row.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== ''));

        setRawData(cleanGrid);
        setFileName(fName);
        setStep('ASSET_SELECTION');
    };

    const handleDeleteRawRow = (index: number) => {
        if (index === 0) {
            // Deleting Header -> Next row becomes header
            if (rawData.length <= 1) {
                alert("Cannot delete the last row.");
                return;
            }
            if (window.confirm("Disconnect current header and use the next row as header?")) {
                setRawData(prev => prev.slice(1));
            }
        } else {
            // Deleting Body Row
            setRawData(prev => prev.filter((_, i) => i !== index));
        }
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
                addToast("Preset incomplete for General Import. Please map Account column.", 'error');
                setStep('MAPPING');
                return;
            }

            // Auto-advance to PREVIEW
            const rows = ImportService.mapRawDataToImportRows(
                rawData,
                matchingPreset.mapping,
                targetAssetId,
                assets,
                categories
            );
            setImportRows(rows);
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
        const rows = ImportService.mapRawDataToImportRows(rawData, mapping, targetAssetId, assets, categories);
        setImportRows(rows);
        setStep('PREVIEW');
    };

    const handleFinalConfirm = () => {
        // We just pass it up to App.tsx which calculates duplicates/transfers
        const validTxs = validRows.map(r => r.transaction as Transaction);
        onConfirm(validTxs);
        onClose();
    };

    // Phase 2: Inline Editing & Deletion
    const handleUpdateRowData = (rowIndex: number, colIndex: number, newValue: any) => {
        setImportRows(prev => {
            const next = [...prev];
            const rowIdx = next.findIndex(r => r.index === rowIndex);
            if (rowIdx === -1) return prev;

            // 1. Update Raw Data
            const updatedData = [...next[rowIdx].data];
            updatedData[colIndex] = newValue;

            // 2. Re-validate atomic row
            const { transaction, reason } = ImportService.validateRow(
                updatedData,
                rowIndex,
                mapping,
                targetAssetId,
                assets,
                categories
            );

            // 3. Update Row State
            next[rowIdx] = {
                ...next[rowIdx],
                data: updatedData,
                status: transaction ? 'valid' : 'invalid',
                transaction: transaction || undefined,
                reason: reason || undefined
            };

            return next;
        });
    };

    const handleDeleteRow = (rowIndex: number) => {
        if (window.confirm("Remove this row from import?")) {
            setImportRows(prev => prev.filter(r => r.index !== rowIndex));
        }
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

            {/* Compact Table Mapping UI (Virtualized) */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white h-[450px]">
                <div className="h-full overflow-auto custom-scrollbar relative">
                    {/* Sticky Header */}
                    <div className="flex bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm min-w-max">
                        {/* Action Header */}
                        <div className="w-[50px] flex-shrink-0 p-2 border-r border-slate-100 bg-slate-50 flex items-center justify-center sticky left-0 z-10">
                            <button
                                onClick={() => handleDeleteRawRow(0)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                title="Discard this Header Row (Shift Up)"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                        {/* Columns */}
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
                                <div key={idx} className="w-[160px] flex-shrink-0 p-1 border-r border-slate-100 last:border-r-0 bg-white">
                                    <div className={`flex flex-col gap-2 p-3 rounded-2xl transition-all h-full border-2 ${role === 'ignore' ? 'border-transparent bg-slate-50' : containerClass}`}>
                                        {/* Raw Header Name */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className={`text-[10px] font-black uppercase truncate tracking-wider ${labelClass}`} title={String(col)}>
                                                {String(col) || `Column ${idx + 1}`}
                                            </div>
                                            {role !== 'ignore' && (
                                                <div className={`w-2 h-2 rounded-full ${role === 'date' ? 'bg-emerald-500' : role === 'amount' ? 'bg-indigo-500' : 'bg-slate-400'}`} />
                                            )}
                                        </div>

                                        {/* Mapping Dropdown */}
                                        <select
                                            value={role}
                                            onChange={(e) => handleColumnRoleChange(idx, e.target.value)}
                                            className={`w-full py-2 px-2.5 text-xs font-bold rounded-xl border-0 focus:ring-2 focus:ring-offset-0 transition-all cursor-pointer ${role === 'ignore'
                                                ? 'bg-slate-200/50 text-slate-400 hover:bg-slate-200'
                                                : 'bg-white shadow-sm ring-1 ring-black/5'
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
                                </div>
                            );
                        })}
                    </div>

                    {/* Body Rows */}
                    <div className="min-w-max">
                        {rawData.slice(1, 51).map((row, index) => (
                            <div key={index} className={`flex border-b border-slate-50 hover:bg-slate-50/50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                {/* Action Cell */}
                                <div className="w-[50px] flex-shrink-0 flex items-center justify-center border-r border-slate-50 sticky left-0 bg-inherit z-10">
                                    <button
                                        onClick={() => handleDeleteRawRow(index + 1)} // Index + 1 because data is sliced
                                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                                {/* Data Cells */}
                                {row.map((cell: any, cIdx: number) => {
                                    const role = getColumnRole(cIdx);
                                    let cellClass = 'text-slate-400';
                                    let bgClass = '';

                                    if (role === 'date') { cellClass = 'text-emerald-700 font-bold'; bgClass = 'bg-emerald-50/30'; }
                                    if (role === 'amount') { cellClass = 'text-indigo-700 font-bold'; bgClass = 'bg-indigo-50/30'; }
                                    if (role === 'amountIn') { cellClass = 'text-blue-600 font-bold'; bgClass = 'bg-blue-50/30'; }
                                    if (role === 'amountOut') { cellClass = 'text-rose-600 font-bold'; bgClass = 'bg-rose-50/30'; }
                                    if (role === 'memo') { cellClass = 'text-slate-700 font-medium'; bgClass = 'bg-slate-50/30'; }

                                    // Ignore Style
                                    if (role === 'ignore') {
                                        cellClass = 'text-slate-300 line-through decoration-slate-200 decoration-2';
                                    }

                                    return (
                                        <div key={cIdx} className={`w-[160px] flex-shrink-0 p-3 border-r border-slate-50 last:border-r-0 truncate transition-colors text-xs ${cellClass} ${bgClass}`}>
                                            {String(cell)}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                        {rawData.length > 51 && (
                            <div className="p-4 text-center text-xs text-slate-400 border-t border-slate-50 italic">
                                ... and {rawData.length - 51} more rows (hidden for simplified view)
                            </div>
                        )}
                    </div>
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


    // Dynamic Columns for Preview
    const activeColumns = React.useMemo(() => {
        const cols = [];
        if (mapping.dateIndex >= 0) cols.push({ id: 'date', label: 'Date', index: mapping.dateIndex, width: '110px' });
        if (mapping.memoIndex >= 0) cols.push({ id: 'memo', label: 'Description', index: mapping.memoIndex, width: '180px' });

        // Amount logic
        if (mapping.amountIndex >= 35 || mapping.amountIndex >= 0) { // Mapping usually >=0
            // The mapping object might have -1 for unmapped.
        }

        // Refined check
        if (mapping.amountIndex >= 0) {
            cols.push({ id: 'amount', label: 'Amount', index: mapping.amountIndex, width: '110px' });
        } else if ((mapping.amountInIndex !== undefined && mapping.amountInIndex >= 0) || (mapping.amountOutIndex !== undefined && mapping.amountOutIndex >= 0)) {
            cols.push({ id: 'amount_combined', label: 'Amount', index: -2, width: '110px' });
        }

        if (mapping.categoryIndex !== undefined && mapping.categoryIndex >= 0) cols.push({ id: 'category', label: 'Category', index: mapping.categoryIndex, width: '140px' });
        if (mapping.assetIndex !== undefined && mapping.assetIndex >= 0) cols.push({ id: 'asset', label: 'Account', index: mapping.assetIndex, width: '120px' });
        if (mapping.merchantIndex !== undefined && mapping.merchantIndex >= 0) cols.push({ id: 'merchant', label: 'Merchant', index: mapping.merchantIndex, width: '120px' });
        if (mapping.tagIndex !== undefined && mapping.tagIndex >= 0) cols.push({ id: 'tag', label: 'Tag', index: mapping.tagIndex, width: '100px' });
        if (mapping.installmentIndex !== undefined && mapping.installmentIndex >= 0) cols.push({ id: 'installment', label: 'Inst.', index: mapping.installmentIndex, width: '80px' });

        return cols;
    }, [mapping]);

    const renderPreviewStep = () => (
        <div className="space-y-4 h-full flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-shrink-0 p-1">
                {/* Valid Tab */}
                <button
                    onClick={() => setPreviewTab('VALID')}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all duration-200 ${previewTab === 'VALID'
                        ? 'bg-emerald-50 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                        : 'bg-emerald-50/50 border-emerald-100/50 hover:bg-emerald-50 hover:border-emerald-200'
                        }`}
                >
                    <div className="text-left">
                        <div className="flex items-center gap-2 text-emerald-700 font-black text-xl mb-0.5">
                            <Check size={20} className="bg-emerald-200 p-0.5 rounded-full text-emerald-800" />
                            {validRows.length}
                        </div>
                        <p className="text-xs font-bold text-emerald-600/80">Valid Transactions</p>
                    </div>
                    {previewTab === 'VALID' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                </button>

                {/* Invalid Tab */}
                <button
                    onClick={() => setPreviewTab('INVALID')}
                    className={`p-4 rounded-2xl border flex items-center justify-between transition-all duration-200 ${previewTab === 'INVALID'
                        ? 'bg-rose-50 border-rose-500 shadow-md ring-1 ring-rose-500'
                        : invalidRows.length > 0
                            ? 'bg-rose-50/50 border-rose-100/50 hover:bg-rose-50 hover:border-rose-200 cursor-pointer'
                            : 'bg-slate-50 border-slate-100 opacity-60 cursor-default'
                        }`}
                >
                    <div className="text-left">
                        <div className={`flex items-center gap-2 font-black text-xl mb-0.5 ${invalidRows.length > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                            <AlertTriangle size={20} className={`p-0.5 rounded-full ${invalidRows.length > 0 ? 'bg-rose-200 text-rose-800' : 'bg-slate-200 text-slate-500'}`} />
                            {invalidRows.length}
                        </div>
                        <p className={`text-xs font-bold ${invalidRows.length > 0 ? 'text-rose-600/80' : 'text-slate-400'}`}>Requires Correction</p>
                    </div>
                    {previewTab === 'INVALID' && <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
                </button>
            </div>

            {/* Main Content Area (Virtualized Table) */}
            <div className="border border-slate-200 rounded-[24px] overflow-hidden bg-white shadow-sm flex-1 min-h-[500px] flex flex-col">
                <div className="flex-1 overflow-x-auto">
                    <Virtuoso
                        style={{ height: '500px', minWidth: activeColumns.reduce((acc, c) => acc + parseInt(c.width), 340) + 'px' }}
                        computeItemKey={(index, row) => `row-${row.index}`}
                        data={previewTab === 'VALID' ? validRows : invalidRows}
                        components={{
                            Header: () => (
                                <div className="bg-slate-50 border-b border-slate-200 flex items-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] sticky top-0 z-50 gap-2">
                                    {activeColumns.map(col => (
                                        <div key={col.id} style={{ width: col.width }} className="flex-shrink-0 pl-1">{col.label}</div>
                                    ))}
                                    <div className="flex-1 px-4 min-w-[150px] pl-1">{previewTab === 'INVALID' ? 'Problem' : 'Detected Info'}</div>
                                    <div className="w-[40px] flex-shrink-0 text-center"></div>
                                </div>
                            )
                        }}
                        itemContent={(_, row) => {
                            const isInvalid = row.status === 'invalid';
                            const tx = row.transaction || {};

                            // Simple error detection for cell styling
                            const hasDateError = isInvalid && (row.reason?.toLowerCase().includes('date') || !tx.date);
                            const hasAmountError = isInvalid && (row.reason?.toLowerCase().includes('amount') || !tx.amount);
                            const hasAssetError = isInvalid && row.reason?.toLowerCase().includes('account');
                            const hasDescriptionError = isInvalid && row.reason?.toLowerCase().includes('description');

                            return (
                                <div className={`flex items-center px-4 py-2 border-b border-slate-50 hover:bg-slate-50/50 transition-colors gap-2 text-xs ${isInvalid ? 'bg-rose-50/20' : ''}`}>
                                    {activeColumns.map(col => {
                                        if (col.id === 'date') {
                                            return (
                                                <div key={col.id} style={{ width: col.width }} className="flex-shrink-0">
                                                    <input
                                                        type="text"
                                                        defaultValue={row.data[col.index]}
                                                        onBlur={(e) => handleUpdateRowData(row.index, col.index, e.target.value)}
                                                        className={`w-full bg-transparent border-none p-1 focus:ring-1 focus:ring-slate-200 rounded text-slate-600 font-bold ${hasDateError ? 'text-rose-600 bg-rose-50 ring-1 ring-rose-200' : ''}`}
                                                        placeholder="YYYY-MM-DD"
                                                    />
                                                </div>
                                            );
                                        }

                                        if (col.id === 'memo') {
                                            return (
                                                <div key={col.id} style={{ width: col.width }} className="flex-shrink-0">
                                                    <input
                                                        type="text"
                                                        defaultValue={row.data[col.index]}
                                                        onBlur={(e) => handleUpdateRowData(row.index, col.index, e.target.value)}
                                                        className={`w-full bg-transparent border-none p-1 focus:ring-1 focus:ring-slate-200 rounded text-slate-900 font-medium ${hasDescriptionError ? 'text-rose-600 bg-rose-50 ring-1 ring-rose-200' : ''}`}
                                                    />
                                                </div>
                                            );
                                        }

                                        if (col.id === 'amount' || col.id === 'amount_combined') {
                                            let displayVal = '';
                                            let updateIdx = -1;

                                            if (col.id === 'amount') {
                                                displayVal = row.data[col.index];
                                                updateIdx = col.index;
                                            } else {
                                                // Dual column: find the one that has a value
                                                const inVal = row.data[mapping.amountInIndex!];
                                                const outVal = row.data[mapping.amountOutIndex!];
                                                displayVal = inVal || outVal || '';
                                                updateIdx = inVal ? mapping.amountInIndex! : mapping.amountOutIndex!;
                                            }

                                            return (
                                                <div key={col.id} style={{ width: col.width }} className="flex-shrink-0">
                                                    <input
                                                        type="text"
                                                        defaultValue={displayVal}
                                                        onBlur={(e) => updateIdx >= 0 && handleUpdateRowData(row.index, updateIdx, e.target.value)}
                                                        className={`w-full bg-transparent border-none p-1 focus:ring-1 focus:ring-slate-200 rounded font-bold ${hasAmountError ? 'text-rose-600 bg-rose-50 ring-1 ring-rose-200' : tx.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900'}`}
                                                    />
                                                </div>
                                            );
                                        }

                                        if (col.id === 'category') {
                                            return (
                                                <div key={col.id} style={{ width: col.width }} className="flex-shrink-0">
                                                    <select
                                                        value={tx.category || ''}
                                                        onChange={(e) => {
                                                            setImportRows(prev => prev.map(r => r.index === row.index ? {
                                                                ...r,
                                                                transaction: { ...r.transaction, category: e.target.value } as any
                                                            } : r));
                                                        }}
                                                        className="w-full bg-slate-100 border-none p-1.5 rounded-lg text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-slate-900 cursor-pointer"
                                                    >
                                                        <option value="Uncategorized">Uncategorized</option>
                                                        {categories.map(c => (
                                                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        }

                                        // Fallback for other text columns (Asset, Merchant, Tag, Installment)
                                        const colIndex = col.index;
                                        const isAssetCol = col.id === 'asset';
                                        return (
                                            <div key={col.id} style={{ width: col.width }} className="flex-shrink-0">
                                                <input
                                                    type="text"
                                                    defaultValue={row.data[colIndex]}
                                                    onBlur={(e) => handleUpdateRowData(row.index, colIndex, e.target.value)}
                                                    className={`w-full bg-transparent border-none p-1 focus:ring-1 focus:ring-slate-200 rounded text-slate-600 ${isAssetCol && hasAssetError ? 'text-rose-600 bg-rose-50 ring-1 ring-rose-200' : ''}`}
                                                />
                                            </div>
                                        );
                                    })}

                                    {/* Status / Reason / Detected Details */}
                                    <div className="flex-1 px-4 min-w-[150px]">
                                        {isInvalid ? (
                                            <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-bold leading-none inline-block max-w-full truncate" title={row.reason}>
                                                {row.reason}
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-2 opacity-60">
                                                {tx.assetId && (() => {
                                                    const asset = assets.find(a => a.id === tx.assetId);
                                                    if (!asset) return null;
                                                    return (
                                                        <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                                            {asset.institution ? `[${asset.institution}] ` : ''}{asset.name}
                                                        </span>
                                                    );
                                                })()}
                                                {tx.merchant && (
                                                    <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                                                        @{tx.merchant}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Delete Action */}
                                    <div className="w-[40px] flex-shrink-0 flex justify-center">
                                        <button
                                            onClick={() => handleDeleteRow(row.index)}
                                            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Remove Row"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        }}
                    />
                </div>
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-between items-center gap-2 sm:gap-0 flex-shrink-0">
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
                        disabled={validRows.length === 0}
                        className={`w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-full shadow-md shadow-slate-200 hover:bg-slate-800 hover:shadow-xl transition-all font-bold text-sm ${validRows.length === 0 ? 'opacity-50 cursor-not-allowed bg-slate-400 shadow-none' : ''}`}
                    >
                        Confirm Import ({validRows.length})
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
