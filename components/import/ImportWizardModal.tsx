import React, { useState, useRef, useEffect } from 'react';
import { ImportService, ColumnMapping, ImportPreset, ImportRow, ColumnAnalysis } from '../../services/importService';
import { Transaction, Asset, CategoryItem } from '../../types';
import { TransactionService } from '../../services/transactionService';
import { Upload, ArrowRight, X, AlertTriangle, Check, Trash2, Sparkles, Download, LayoutTemplate, FileJson, History } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useToast } from '../../contexts/ToastContext';
import { MappingCanvas } from './MappingCanvas';

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
    const [headerIndex, setHeaderIndex] = useState(0);
    const [targetAssetId, setTargetAssetId] = useState(assetId || 'dynamic'); // 'dynamic' means use column mapping

    // Mapping State
    const [mapping, setMapping] = useState<ColumnMapping>({
        dateIndex: -1,
        timeIndex: -1,
        amountIndex: -1,
        amountInIndex: -1,
        amountOutIndex: -1,
        memoIndex: -1,
        memoIndices: [],
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
    const [previewTab, setPreviewTab] = useState<'VALID' | 'INVALID' | 'DUPLICATE'>('VALID');
    const [columnAnalyses, setColumnAnalyses] = useState<ColumnAnalysis[]>([]);
    const [dbHashBank, setDbHashBank] = useState<Set<string>>(new Set());
    const [isLoadingDb, setIsLoadingDb] = useState(false);

    // Memos for performance
    const validRows = React.useMemo(() => importRows.filter(r => r.status === 'valid'), [importRows]);
    const invalidRows = React.useMemo(() => importRows.filter(r => r.status === 'invalid'), [importRows]);
    const duplicateRows = React.useMemo(() => importRows.filter(r => r.status === 'duplicate'), [importRows]);
    
    const currentPreviewRows = previewTab === 'VALID' 
        ? validRows 
        : (previewTab === 'INVALID' ? invalidRows : duplicateRows);

    // Load Presets
    useEffect(() => {
        if (isOpen) {
            setAllPresets(ImportService.getPresets());
        }
    }, [isOpen]);

    // Reset when opening - only depends on isOpen to avoid infinite re-init loops
    React.useEffect(() => {
        if (isOpen) {
            setStep(initialFile ? 'ASSET_SELECTION' : 'UPLOAD');
            setRawData([]);
            setHeaderIndex(0);
            setImportRows([]);
            setColumnAnalyses([]);
            setFileName('');
            setMapping({
                dateIndex: -1,
                timeIndex: -1,
                amountIndex: -1,
                amountInIndex: -1,
                amountOutIndex: -1,
                memoIndex: -1,
                memoIndices: [],
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
            setDbHashBank(new Set());
            setPreviewTab('VALID');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Parse the initial file once after the modal opens (runs after reset effect)
    React.useEffect(() => {
        if (!isOpen || !initialFile) return;

        let cancelled = false;
        (async () => {
            try {
                const { rawGrid, displayGrid } = await ImportService.parseFileToGrid(initialFile);
                if (cancelled) return;
                if (rawGrid.length < 1) return;
                const cleanRaw = rawGrid.filter((row: any[]) =>
                    row.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== '')
                );
                const cleanDisplay = displayGrid.filter((row: any[]) =>
                    row.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== '')
                );
                const analysisResult = ImportService.analyzeColumns(cleanRaw, cleanDisplay);
                setRawData(cleanRaw);
                setFileName(initialFile.name);
                setColumnAnalyses(analysisResult.columns);
                setHeaderIndex(analysisResult.headerIndex);
            } catch (err) {
                console.error('Failed to parse initial file:', err);
            }
        })();

        return () => { cancelled = true; };
    }, [isOpen, initialFile]);

    // Handle DB Hash Bank Loading on Date Mapping
    useEffect(() => {
        const loadDbHashes = async () => {
            if (mapping.dateIndex === -1 || rawData.length <= headerIndex + 1) return;

            setIsLoadingDb(true);
            try {
                // 1. Scan Min/Max Dates from the raw data using the mapping
                let minDateStr = '';
                let maxDateStr = '';

                for (let i = headerIndex + 1; i < rawData.length; i++) {
                    const cell = rawData[i][mapping.dateIndex];
                    if (!cell) continue;
                    
                    const d = ImportService.parseLooseDate(cell);
                    if (d) {
                        const iso = d.toISOString().split('T')[0];
                        if (!minDateStr || iso < minDateStr) minDateStr = iso;
                        if (!maxDateStr || iso > maxDateStr) maxDateStr = iso;
                    }
                }

                if (minDateStr && maxDateStr) {
                    // Add 1 day buffer as planned
                    const minDate = new Date(minDateStr);
                    minDate.setDate(minDate.getDate() - 1);
                    const maxDate = new Date(maxDateStr);
                    maxDate.setDate(maxDate.getDate() + 1);

                    const hashes = await TransactionService.getHashKeysByDateRange(
                        minDate.toISOString().split('T')[0],
                        maxDate.toISOString().split('T')[0]
                    );
                    setDbHashBank(hashes);
                    
                    // Re-calculate hash keys if we already have rows
                    if (importRows.length > 0) {
                        setImportRows(prev => ImportService.reassignHashKeys(prev, hashes));
                    }
                }
            } catch (err) {
                console.error("Failed to load DB hash bank:", err);
            } finally {
                setIsLoadingDb(false);
            }
        };

        loadDbHashes();
    }, [mapping.dateIndex, rawData, headerIndex]);

    if (!isOpen) return null;

    // --- Handlers ---
    const processFileGrid = ({ rawGrid, displayGrid }: { rawGrid: any[][], displayGrid: any[][] }, fName: string) => {
        if (rawGrid.length < 1) {
            alert('File appears to be empty.');
            return;
        }

        // Clean empty rows
        const cleanRaw = rawGrid.filter(row => row.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== ''));
        const cleanDisplay = displayGrid.filter(row => row.some((cell: any) => cell !== undefined && cell !== null && String(cell).trim() !== ''));

        setRawData(cleanRaw);
        setFileName(fName);
        
        // analyzeColumns: type detection from rawGrid, sampleValues from displayGrid
        const analysisResult = ImportService.analyzeColumns(cleanRaw, cleanDisplay);
        setColumnAnalyses(analysisResult.columns);
        setHeaderIndex(analysisResult.headerIndex);
        
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
            const headers = rawData[headerIndex] || [];
            const preset = ImportService.findMatchingPreset(headers, targetAssetId);
            setMatchingPreset(preset || null);
            setApplyPreset(!!preset); // Default to true if found
        }
    }, [step, targetAssetId, rawData]);

    const handleAssetConfirm = () => {
        const headers = rawData[headerIndex] || [];

        // Apply Preset if user opted in
        if (matchingPreset && applyPreset) {
            console.log("Applying matched preset:", matchingPreset.name);
            setMapping(matchingPreset.mapping);
            setSelectedPresetId(matchingPreset.id);
            setPresetName(matchingPreset.name);

            // Validation: If General Import (dynamic), Asset Column MUST be mapped
            if (targetAssetId === 'dynamic' && matchingPreset.mapping.assetIndex === undefined) {
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
                categories,
                headerIndex
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

    const handleMappingChange = (newMapping: ColumnMapping) => {
        setMapping(newMapping);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const result = await ImportService.parseFileToGrid(file);
            processFileGrid(result, file.name);
        } catch (err) {
            alert('Failed to read file.');
            console.error(err);
        }
    };

    const handleMappingConfirm = () => {
        // Validation: If General Import (dynamic), Asset Column MUST be mapped
        if (targetAssetId === 'dynamic' && mapping.assetIndex === undefined) {
            addToast("For General Import, you must map an 'Account' column.", 'error');
            return;
        }

        const headers = rawData[headerIndex] || [];

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
        const rawRows = ImportService.mapRawDataToImportRows(rawData, mapping, targetAssetId, assets, categories, headerIndex);
        const rows = ImportService.reassignHashKeys(rawRows, dbHashBank);
        setImportRows(rows);
        setStep('PREVIEW');
    };

    const handleFinalConfirm = () => {
        // We just pass it up to App.tsx which calculates duplicates/transfers
        // Include valid (non-duplicate) rows. 
        // We exclude duplicates by default unless we add a way to toggle them back.
        const validTxs = validRows.map(r => r.transaction as Transaction);
        onConfirm(validTxs);
        onClose();
    };

    // Phase 2: Inline Editing & Deletion
    const handleUpdateRowData = (rowIndex: number, colIndex: number, newValue: any) => {
        setImportRows(prev => {
            const existingRows = prev.filter(r => r.index === rowIndex);
            if (existingRows.length === 0) return prev;

            const updatedData = [...existingRows[0].data];
            if (updatedData[colIndex] === newValue) return prev; // No change, no update needed
            
            updatedData[colIndex] = newValue;

            // 2. Re-validate atomic row (now returns multiple)
            const { transactions, reason } = ImportService.validateRow(
                updatedData,
                rowIndex,
                mapping,
                targetAssetId,
                assets,
                categories
            );

            // 3. Update the global state with new data for this specific index
            // Remove old rows for this index, add new ones, then re-assign all hash keys
            const filtered = prev.filter(r => r.index !== rowIndex);
            
            const nextRows: ImportRow[] = [...filtered];
            if (transactions && transactions.length > 0) {
                transactions.forEach(tx => {
                    nextRows.push({
                        index: rowIndex,
                        data: updatedData,
                        status: 'valid',
                        transaction: tx
                    });
                });
            } else {
                nextRows.push({
                    index: rowIndex,
                    data: updatedData,
                    status: 'invalid',
                    reason: reason || 'Unknown Error'
                });
            }

            // Global collision check and hash key reformatting (includes DB check)
            return ImportService.reassignHashKeys(nextRows.sort((a, b) => a.index - b.index), dbHashBank);
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
            const result = await ImportService.parseFileToGrid(file);
            processFileGrid(result, file.name);
        } catch (err) {
            alert('Failed to read file.');
            console.error(err);
        }
    };

    // --- Render Steps ---

    const renderUploadStep = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Track Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Track 1: Manual */}
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`group relative p-6 rounded-[32px] border-2 border-dashed transition-all duration-500 cursor-pointer overflow-hidden ${isDragging
                        ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                            <Upload size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-900 text-sm italic">TRACK 1</h4>
                            <h3 className="font-black text-slate-900 text-lg tracking-tight">Manual</h3>
                            <p className="text-[11px] text-slate-400 font-bold leading-relaxed mt-1">Flexible mapping for any CSV/Excel file.</p>
                        </div>
                    </div>
                </div>

                {/* Track 2: Preset */}
                <div 
                    className="group relative p-6 rounded-[32px] border-2 border-slate-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/30 transition-all duration-500 cursor-default overflow-hidden"
                >
                    <div className="absolute top-4 right-4 text-emerald-500">
                        <Sparkles size={20} className="animate-pulse" />
                    </div>
                    <div className="relative space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <History size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-emerald-700 text-sm italic">TRACK 2</h4>
                            <h3 className="font-black text-slate-900 text-lg tracking-tight">Preset</h3>
                            <p className="text-[11px] text-slate-400 font-bold leading-relaxed mt-1">Auto-detects your saved bank formats.</p>
                        </div>
                    </div>
                </div>

                {/* Track 3: Migration */}
                <div 
                    className="group relative p-6 rounded-[32px] border-2 border-slate-100 bg-white hover:border-amber-200 hover:bg-amber-50/30 transition-all duration-500 cursor-default overflow-hidden"
                >
                    <div className="relative space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <LayoutTemplate size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-amber-700 text-sm italic">TRACK 3</h4>
                            <h3 className="font-black text-slate-900 text-lg tracking-tight">Migration</h3>
                            <p className="text-[11px] text-slate-400 font-bold leading-relaxed mt-1">Import from BankSalad or our template.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions / Integration */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-full hover:bg-slate-800 shadow-2xl shadow-slate-200 transition-all font-black text-sm active:scale-95 flex items-center justify-center gap-3"
                >
                    <FileJson size={18} />
                    Choose File
                </button>
                <div className="hidden sm:block h-8 w-[1px] bg-slate-200 mx-2" />
                <button
                    className="w-full sm:w-auto px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-full hover:bg-slate-50 transition-all font-black text-sm flex items-center justify-center gap-3"
                >
                    <Download size={18} />
                    Download Template
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
        <div className="flex flex-col items-center justify-center py-8 space-y-10 min-h-[400px]">
            <div className="relative">
                <div className="w-24 h-24 bg-white/40 backdrop-blur-3xl rounded-[32px] flex items-center justify-center border border-white/40 shadow-[0_20px_40px_rgba(0,0,0,0.1)] animate-in zoom-in-50 duration-700">
                    <span className="text-5xl">🏦</span>
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white animate-in slide-in-from-top-4 duration-1000">
                    <Check size={20} strokeWidth={3} />
                </div>
            </div>

            <div className="text-center space-y-3 max-w-sm">
                <h3 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Target Account</h3>
                <p className="text-slate-400 text-sm font-bold leading-relaxed">
                    Which asset should handle these incoming transactions?
                </p>
            </div>

            <div className="w-full max-w-sm space-y-6 pt-2">
                <div className="relative group">
                    <select
                        value={targetAssetId}
                        onChange={(e) => setTargetAssetId(e.target.value)}
                        className="w-full bg-slate-50/50 backdrop-blur-xl text-sm font-black text-slate-900 border-2 border-white/40 rounded-[28px] p-5 pr-12 focus:ring-8 focus:ring-slate-900/5 focus:border-slate-900/50 focus:outline-none shadow-sm transition-all appearance-none cursor-pointer hover:bg-white hover:border-slate-200/50 ring-1 ring-black/5"
                        autoFocus
                    >
                        <option value="dynamic">✨ Smart Auto-Mapping (Multi-Account)</option>
                        <option disabled className="text-slate-300">━━━━━━━━━━━━━━━━</option>
                        {assets.map(a => (
                            <option key={a.id} value={a.id}>{a.institution ? `${a.institution} - ${a.name}` : a.name}</option>
                        ))}
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-slate-900 transition-colors">
                        <ArrowRight size={20} className="rotate-90" />
                    </div>
                </div>

                {/* Matching Preset Found UI */}
                <div className="h-[80px] flex items-center justify-center">
                    {matchingPreset ? (
                        <div className="w-full animate-in fade-in slide-in-from-top-4 duration-700">
                            <label className="flex items-center gap-5 p-5 bg-gradient-to-br from-indigo-50/80 to-indigo-100/40 backdrop-blur-xl border border-white/60 rounded-[28px] cursor-pointer hover:from-white hover:to-indigo-50 transition-all group overflow-hidden relative shadow-lg shadow-indigo-100/50 ring-1 ring-indigo-200/50">
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-white/40 to-indigo-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1500" />
                                <div className="relative w-6 h-6 flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        checked={applyPreset}
                                        onChange={(e) => setApplyPreset(e.target.checked)}
                                        className="w-6 h-6 text-indigo-600 rounded-xl border-indigo-200 focus:ring-indigo-500 transition-all cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1 relative">
                                    <div className="flex items-center gap-2">
                                        <Sparkles size={12} className="text-indigo-500" />
                                        <p className="text-[10px] font-black text-indigo-900 uppercase tracking-[0.15em] mb-0.5">Preset Detected</p>
                                    </div>
                                    <p className="text-[15px] font-black text-indigo-700/90 line-clamp-1 italic">Apply '{matchingPreset.name}'</p>
                                </div>
                            </label>
                        </div>
                    ) : (
                        <div className="w-full h-full border-2 border-dashed border-slate-100 rounded-[28px] flex items-center justify-center">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Preset Found</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 pt-4">
                   <button
                        onClick={() => setStep('UPLOAD')}
                        className="flex-1 py-5 text-slate-400 hover:text-slate-800 font-black transition-colors text-sm"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleAssetConfirm}
                        className="flex-[2] py-5 bg-slate-900 text-white rounded-full font-black shadow-2xl shadow-slate-300 hover:bg-slate-800 hover:-translate-y-1 transition-all transform active:scale-95 text-sm flex items-center justify-center gap-3 group"
                    >
                        <span>Continue to Map</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );


    const renderMappingStep = () => (
        <MappingCanvas 
            analyses={columnAnalyses}
            initialMapping={mapping}
            onMappingChange={handleMappingChange}
            onComplete={handleMappingConfirm}
        />
    );


    // Dynamic Columns for Preview
    const activeColumns = React.useMemo(() => {
        const cols = [];
        if (mapping.dateIndex >= 0) cols.push({ id: 'date', label: 'Date', index: mapping.dateIndex, width: '110px' });
        if (mapping.timeIndex !== undefined && mapping.timeIndex >= 0) cols.push({ id: 'time', label: 'Time', index: mapping.timeIndex, width: '80px' });
        if (mapping.memoIndex >= 0) cols.push({ id: 'memo', label: 'Description', index: mapping.memoIndex, width: '180px' });
        
        // Memo Extra indices (concatenated in service, but we show them if desired, or just show the result)
        // For preview, it's often better to show the "final" memo. But the current UI is column-based.
        // Let's add a "Final Memo" pseudo-column if there are multiple.
        if (mapping.memoIndices && mapping.memoIndices.length > 0) {
            cols.push({ id: 'final_memo', label: 'Final Memo', index: -4, width: '200px' });
        }

        // Amount logic
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

        // Add Hash Key column for transparency
        cols.push({ id: 'hashKey', label: 'Hash Key', index: -3, width: '120px' });

        return cols;
    }, [mapping]);

    const renderPreviewStep = () => {
        // Data is now sourced from top-level memo: currentPreviewRows

        return (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="space-y-1">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Review Transactions</h3>
                        <p className="text-sm text-slate-400 font-medium">Verify detected data before final import.</p>
                    </div>

                    <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50 backdrop-blur-sm">
                        <button
                            onClick={() => setPreviewTab('VALID')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${previewTab === 'VALID'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            Valid ({validRows.length})
                        </button>
                        <button
                            onClick={() => setPreviewTab('INVALID')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${previewTab === 'INVALID'
                                ? 'bg-white text-rose-600 shadow-sm'
                                : invalidRows.length > 0
                                    ? 'text-slate-400 hover:text-rose-600'
                                    : 'text-slate-300 cursor-not-allowed'
                                }`}
                            disabled={invalidRows.length === 0}
                        >
                            Issues ({invalidRows.length})
                        </button>
                        <button
                            onClick={() => setPreviewTab('DUPLICATE')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${previewTab === 'DUPLICATE'
                                ? 'bg-white text-amber-600 shadow-sm'
                                : duplicateRows.length > 0
                                    ? 'text-slate-400 hover:text-amber-600'
                                    : 'text-slate-300 cursor-not-allowed'
                                }`}
                            disabled={duplicateRows.length === 0}
                        >
                            {isLoadingDb ? 'Checking...' : `Duplicates (${duplicateRows.length})`}
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 border border-slate-200/60 rounded-[32px] overflow-hidden bg-white/40 shadow-inner backdrop-blur-sm flex flex-col">
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                        <Virtuoso
                            key={previewTab} // Force reset on tab change
                            style={{ height: '500px', minWidth: activeColumns.reduce((acc, c) => acc + parseInt(c.width), 450) + 'px' }}
                            data={currentPreviewRows}
                            components={{
                                Header: () => (
                                    <div className="bg-slate-900/5 backdrop-blur-xl border-b border-slate-200/50 flex items-center px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-50">
                                        {activeColumns.map(col => (
                                            <div key={col.id} style={{ width: col.width }} className="flex-shrink-0 px-2">{col.label}</div>
                                        ))}
                                        <div className="flex-1 px-4 min-w-[200px]">Detected Info</div>
                                        <div className="w-[50px] flex-shrink-0"></div>
                                    </div>
                                )
                            }}
                            itemContent={(_, row) => {
                                const isInvalid = row.status === 'invalid';
                                const isDuplicate = row.status === 'duplicate';
                                const tx = row.transaction || {};

                                return (
                                    <div className={`flex items-center px-4 py-3 border-b border-slate-100/50 hover:bg-white/60 transition-colors group ${isInvalid ? 'bg-rose-50/20' : isDuplicate ? 'bg-amber-50/20' : ''}`}>
                                        {activeColumns.map(col => {
                                            const val = row.data[col.index];
                                            const hasError = isInvalid && row.reason?.toLowerCase().includes(col.id.toLowerCase());

                                            return (
                                                <div key={col.id} style={{ width: col.width }} className="flex-shrink-0 px-2">
                                                    {col.id === 'hashKey' ? (
                                                        <div className="font-mono text-[9px] text-slate-400 bg-slate-50 px-2 py-1 rounded-lg truncate w-full" title={tx.hashKey}>
                                                            {tx.hashKey || '-'}
                                                        </div>
                                                    ) : col.id === 'final_memo' ? (
                                                        <div className="text-[11px] font-bold text-slate-700 italic truncate" title={tx.memo}>
                                                            {tx.memo}
                                                        </div>
                                                    ) : col.id === 'category' ? (
                                                        <select
                                                            value={tx.category || ''}
                                                            onChange={(e) => {
                                                                setImportRows(prev => prev.map(r => r.index === row.index ? {
                                                                    ...r,
                                                                    transaction: { ...r.transaction, category: e.target.value } as any
                                                                } : r));
                                                            }}
                                                            className="w-full bg-slate-100/50 border-none px-2 py-1.5 rounded-lg text-[10px] font-black text-slate-700 cursor-pointer focus:ring-4 focus:ring-black/5"
                                                        >
                                                            <option value="Uncategorized">UNCATEGORIZED</option>
                                                            {categories.map(c => (
                                                                <option key={c.id} value={c.id}>{c.icon} {c.name.toUpperCase()}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            defaultValue={(() => {
                                                                // Raw Value from Excel/CSV
                                                                const rawVal = col.index >= 0 ? row.data[col.index] : (col.id === 'amount_combined' ? tx.amount : val);
                                                                
                                                                // 1. Date ID Formatting
                                                                if (col.id === 'date') {
                                                                    if (tx.timestamp) {
                                                                        return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(tx.timestamp));
                                                                    }
                                                                    if (typeof rawVal === 'number' && rawVal > 10000) {
                                                                        const d = new Date((rawVal - 25569) * 86400 * 1000 + (12 * 60 * 60 * 1000));
                                                                        return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}`;
                                                                    }
                                                                }
                                                                
                                                                // 2. Time ID Formatting
                                                                if (col.id === 'time') {
                                                                    if (typeof rawVal === 'number' && rawVal > 0 && rawVal < 1) {
                                                                        const totalSeconds = Math.round(rawVal * 86400);
                                                                        const h = Math.floor(totalSeconds / 3600);
                                                                        const m = Math.floor((totalSeconds % 3600) / 60);
                                                                        const s = totalSeconds % 60;
                                                                        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                                                                    }
                                                                }

                                                                return rawVal || '';
                                                            })()}
                                                            readOnly={col.index < 0}
                                                            onBlur={(e) => {
                                                                if (col.index >= 0) {
                                                                    handleUpdateRowData(row.index, col.index, e.target.value);
                                                                }
                                                            }}
                                                            className={`w-full bg-transparent border-none p-1 text-[12px] font-black focus:ring-2 focus:ring-black/5 rounded-lg transition-all ${hasError ? 'text-rose-600 bg-rose-50 ring-1 ring-rose-200' :
                                                                (col.id === 'amount' || col.id === 'amount_combined') ? (tx.type === 'INCOME' ? 'text-emerald-600' : 'text-slate-900') :
                                                                    'text-slate-700'
                                                                } ${col.index < 0 ? 'opacity-80 cursor-not-allowed' : ''}`}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })}

                                        <div className="flex-1 px-4 min-w-[200px]">
                                            {isInvalid ? (
                                                <div className="flex items-center gap-2">
                                                    <AlertTriangle size={14} className="text-rose-500 flex-shrink-0" />
                                                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter truncate" title={row.reason}>
                                                        {row.reason}
                                                    </span>
                                                </div>
                                            ) : isDuplicate ? (
                                                <div className="flex items-center gap-2">
                                                    <History size={14} className="text-amber-500 flex-shrink-0" />
                                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter truncate">
                                                        Existing in DB (Skipped)
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 opacity-80">
                                                    {tx.assetId && (() => {
                                                        const asset = assets.find(a => a.id === tx.assetId);
                                                        return asset && (
                                                            <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-lg uppercase tracking-tighter">
                                                                {asset.name}
                                                            </span>
                                                        );
                                                    })()}
                                                    {tx.merchant && (
                                                        <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg uppercase tracking-tighter">
                                                            @{tx.merchant}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="w-[50px] flex-shrink-0 flex justify-center">
                                            <button
                                                onClick={() => handleDeleteRow(row.index)}
                                                className="p-2 text-slate-300 hover:text-rose-500 transition-colors rounded-xl hover:bg-rose-50 opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }}
                        />
                    </div>
                </div>

                <div className="pt-8 flex justify-between items-center bg-transparent">
                    <button onClick={() => setStep('MAPPING')} className="px-6 py-3 text-slate-400 hover:text-slate-800 font-bold transition-colors text-sm">
                        Back
                    </button>
                    <div className="flex gap-4">
                        <button
                            onClick={handleFinalConfirm}
                            disabled={validRows.length === 0}
                            className={`px-10 py-4 rounded-full font-black shadow-2xl transition-all active:scale-95 text-sm flex items-center justify-center gap-3 group ${validRows.length === 0
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-900 text-white shadow-slate-300 hover:bg-slate-800'
                                }`}
                        >
                            <span>Finalize Import</span>
                            <Check size={18} className="group-hover:scale-110 transition-transform duration-300" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // --- Main Render ---

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xl p-0 sm:p-4 animate-in fade-in duration-500">
            {/* Modal Body with Glassmorphism */}
            <div className="bg-white/90 backdrop-blur-2xl rounded-t-[48px] sm:rounded-[48px] shadow-[0_32px_80px_rgba(0,0,0,0.3)] w-full max-w-3xl overflow-hidden flex flex-col max-h-[94vh] border border-white/60 ring-1 ring-black/5 relative group/modal">
                {/* Decorative Background Elements */}
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-slate-900/[0.03] to-transparent pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="pt-10 sm:pt-14 relative z-10" />

                {/* Progress Stepper with Glass Design */}
                <div className="px-10 sm:px-14 mb-10 relative z-10">
                    <div className="flex items-center gap-2 bg-slate-900/5 backdrop-blur-xl p-2 rounded-[28px] border border-white/40 ring-1 ring-black/5">
                        {['Upload', 'Asset', 'Map', 'Review'].map((s, i) => {
                            const stepIndex = step === 'UPLOAD' ? 0 : step === 'ASSET_SELECTION' ? 1 : step === 'MAPPING' ? 2 : 3;
                            const isActive = i === stepIndex;
                            const isDone = i < stepIndex;

                            return (
                                <div key={s} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[22px] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${isActive ? 'bg-white text-slate-950 shadow-xl scale-[1.03] ring-1 ring-black/5' :
                                    isDone ? 'text-emerald-600 bg-emerald-50/50' : 'text-slate-400'
                                    }`}>
                                    {isDone && <Check size={14} strokeWidth={4} className="animate-in zoom-in duration-500" />}
                                    <span className="truncate hidden sm:inline">{s}</span>
                                    {isActive && <span className="sm:hidden">{s}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Body Area */}
                <div className="px-10 sm:px-14 pb-14 overflow-y-auto custom-scrollbar flex-1 flex flex-col relative z-10">
                    {step === 'UPLOAD' && renderUploadStep()}
                    {step === 'ASSET_SELECTION' && renderAssetSelectionStep()}
                    {step === 'MAPPING' && renderMappingStep()}
                    {step === 'PREVIEW' && renderPreviewStep()}
                </div>

                {/* Close Button Pin */}
                <button 
                    onClick={onClose}
                    className="absolute top-8 right-8 p-3 rounded-full bg-white/40 hover:bg-white text-slate-400 hover:text-slate-900 transition-all hover:rotate-90 hover:scale-110 shadow-sm border border-white/60 z-50 backdrop-blur-sm"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};
