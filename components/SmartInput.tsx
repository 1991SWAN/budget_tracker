import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, TransactionType, Category, Asset, CategoryItem, Tag as TagType } from '../types';
import { SupabaseService } from '../services/supabaseService';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import {
  FileText,
  Camera,
  AlignLeft,
  RefreshCw,
  AlertCircle,
  Check
} from 'lucide-react';

interface SmartInputProps {
  onTransactionsParsed: (transactions: Partial<Transaction>[]) => void;
  onCancel: () => void;
  assets: Asset[];
  categories: CategoryItem[];
  initialData?: Transaction | null;
  transactions?: Transaction[]; // For Autocomplete history
  onDelete?: (tx: Transaction) => void;
}

const SmartInput: React.FC<SmartInputProps> = ({ onTransactionsParsed, onCancel, assets, categories = [], initialData, transactions = [], onDelete }) => {
  const [mode, setMode] = useState<'select' | 'ocr' | 'text' | 'manual'>(initialData ? 'manual' : 'select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isExternalTransfer, setIsExternalTransfer] = useState(() => {
    if (!initialData) return false;
    return initialData.type === TransactionType.TRANSFER && !initialData.toAssetId;
  });

  const [isInstallment, setIsInstallment] = useState(() => !!initialData?.installment);
  const [installmentMonths, setInstallmentMonths] = useState(() => initialData?.installment?.totalMonths || 2);
  const [isInterestFree, setIsInterestFree] = useState(() => initialData?.installment?.isInterestFree ?? true);

  // TAGGING SYSTEM STATE
  const [availableTags, setAvailableTags] = useState<TagType[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<TagType[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // Load Tags on Mount
  useEffect(() => {
    const loadTags = async () => {
      const tags = await SupabaseService.getTags();
      setAvailableTags(tags);
    };
    loadTags();
  }, []);

  // Handle Memo Change with Tag Detection
  const handleMemoChange = (text: string) => {
    setManualForm(prev => ({ ...prev, memo: text }));

    // Detect if typing a tag (last word starts with #)
    const words = text.split(' ');
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('#')) {
      const query = lastWord.slice(1).toLowerCase();
      const filtered = availableTags
        .filter(t => t.name.toLowerCase().includes(query))
        .slice(0, 5); // Limit to 5 suggestions
      setTagSuggestions(filtered);
      setShowTagSuggestions(filtered.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  };

  const insertTag = (tagName: string) => {
    const words = manualForm.memo.split(' ');
    words.pop(); // Remove partial tag
    const newMemo = [...words, `#${tagName} `].join(' '); // Add full tag
    setManualForm(prev => ({ ...prev, memo: newMemo }));
    setShowTagSuggestions(false);
  };


  const [manualForm, setManualForm] = useState(() => {
    if (initialData) {
      return {
        date: initialData.date,
        amount: initialData.amount.toString(),
        type: initialData.type,
        category: initialData.category as Category,
        // BUG FIX: Prevent duplicate @Tagging if already present
        memo: (() => {
          const legacy = (initialData as any).merchant;
          const currentMemo = initialData.memo || '';
          if (legacy && !currentMemo.includes(`@${legacy}`)) {
            return currentMemo ? `${currentMemo} @${legacy}` : `@${legacy}`;
          }
          return currentMemo;
        })(),
        assetId: initialData.assetId,
        toAssetId: initialData.toAssetId || ''
      };
    }
    return {
      date: new Date().toISOString().split('T')[0],
      amount: '',
      type: TransactionType.EXPENSE,
      category: categories.length > 0 ? categories[0].id : Category.FOOD, // Default to first category or legacy
      memo: '',
      merchant: '',
      assetId: assets[0]?.id || '',
      toAssetId: ''
    };
  });




  useEffect(() => {
    if (initialData) {
      setMode('manual');
      const isExternal = initialData.type === TransactionType.TRANSFER && !initialData.toAssetId;
      setIsExternalTransfer(isExternal);

      if (initialData.installment) {
        setIsInstallment(true);
        setInstallmentMonths(initialData.installment.totalMonths);
        setIsInterestFree(initialData.installment.isInterestFree ?? true);
      }

      setManualForm({
        date: initialData.date,
        amount: initialData.amount.toString(),
        type: initialData.type,
        category: initialData.category as Category,
        // BUG FIX: Prevent duplicate @Tagging if already present
        memo: (() => {
          const legacy = (initialData as any).merchant;
          const currentMemo = initialData.memo || '';
          if (legacy && !currentMemo.includes(`@${legacy}`)) {
            return currentMemo ? `${currentMemo} @${legacy}` : `@${legacy}`;
          }
          return currentMemo;
        })(),
        assetId: initialData.assetId,
        toAssetId: initialData.toAssetId || ''
      });
    }
  }, [initialData]);

  const handleCategoryChange = (cat: Category | string) => {
    setManualForm(prev => ({
      ...prev,
      category: cat
    }));
  };

  const [syncConfirmData, setSyncConfirmData] = useState<{
    newAmount: number;
    linkedTxId: string;
    linkedAssetName: string;
  } | null>(null);

  const handleManualSubmit = () => {
    if (!manualForm.amount) { setError("Please enter an amount."); return; }
    if (!manualForm.assetId) { setError("Please select an account."); return; }

    const isInternalTransfer = manualForm.type === TransactionType.TRANSFER && !isExternalTransfer;

    if (isInternalTransfer) {
      if (!manualForm.toAssetId) { setError("Please select a destination account."); return; }
      if (manualForm.assetId === manualForm.toAssetId) { setError("Source and destination accounts must be different."); return; }
    }

    const totalAmount = parseFloat(manualForm.amount);

    // 1. Check for Sync Opportunity (Only on EDIT)
    if (initialData?.id && initialData.linkedTransactionId && totalAmount !== initialData.amount && !syncConfirmData) {
      const linkedTx = transactions.find(t => t.id === initialData.linkedTransactionId);
      if (linkedTx) {
        const linkedAsset = assets.find(a => a.id === linkedTx.assetId);
        setSyncConfirmData({
          newAmount: totalAmount,
          linkedTxId: linkedTx.id,
          linkedAssetName: linkedAsset?.name || 'Linked Account'
        });
        return; // Wait for user choice
      }
    }

    // HYBRID TAGGING: Scan for new tags and update dictionary in background
    const tags = manualForm.memo?.match(/#\S+/g); // Find all #hashtags
    if (tags) {
      tags.forEach(tag => {
        // Remove # and upsert
        SupabaseService.upsertTag(tag.slice(1));
      });
    }

    // V3 DUAL CREATION LOGIC
    if (isInternalTransfer && !initialData) { // Only for new creations, not edits (edits are handled via mapped Partial updates)
      // Generate IDs for both sides
      const sourceId = crypto.randomUUID();
      const targetId = crypto.randomUUID();

      const commonData = {
        date: manualForm.date,
        amount: totalAmount, // Always positive
        category: manualForm.category,
        memo: manualForm.memo,
        installment: null as any
      };

      // 1. Source Transaction (Withdrawal Side)
      const sourceTx: Partial<Transaction> = {
        ...commonData,
        id: sourceId,
        type: TransactionType.TRANSFER,
        assetId: manualForm.assetId,
        toAssetId: manualForm.toAssetId,
        linkedTransactionId: targetId
      };

      // 2. Target Transaction (Deposit Side)
      const targetTx: Partial<Transaction> = {
        ...commonData,
        id: targetId,
        type: TransactionType.TRANSFER,
        assetId: manualForm.toAssetId,
        toAssetId: undefined,
        linkedTransactionId: sourceId
      };

      onTransactionsParsed([sourceTx, targetTx]);
      return;
    }

    // Standard Single/Dual Update Logic
    const transactionData: Partial<Transaction> = {
      id: initialData?.id,
      date: manualForm.date,
      amount: totalAmount,
      type: manualForm.type,
      category: manualForm.category,
      memo: manualForm.memo,
      assetId: manualForm.assetId,
      toAssetId: (manualForm.type === TransactionType.TRANSFER && !isExternalTransfer) ? manualForm.toAssetId : undefined
    };

    if (isInstallment && manualForm.type === TransactionType.EXPENSE) {
      const existing = initialData?.installment;
      transactionData.installment = {
        totalMonths: installmentMonths,
        currentMonth: existing ? existing.currentMonth : 1,
        isInterestFree: !!isInterestFree,
        remainingBalance: existing ? existing.remainingBalance : totalAmount
      };
    } else if (initialData?.installment && !isInstallment) {
      transactionData.installment = null as any;
    }

    // If user chose to sync
    if (syncConfirmData) {
      const syncTx: Partial<Transaction> = {
        id: syncConfirmData.linkedTxId,
        amount: totalAmount
      };
      onTransactionsParsed([transactionData, syncTx]);
    } else {
      onTransactionsParsed([transactionData]);
    }
  };

  const getTitle = () => {
    if (loading) return "Processing...";
    // Option A: Invisible Header for Manual Mode (Edit/New)
    // We return undefined to hide the header bar entirely
    if (mode === 'manual') return undefined;
    return 'Smart Input';
  };



  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      title={getTitle()}
      maxWidth="lg"
      footer={mode === 'manual' && !syncConfirmData ? (
        <div className="flex w-full gap-2 items-center justify-end">
          <Button
            onClick={initialData ? onCancel : () => setMode('select')}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            onClick={handleManualSubmit}
            variant="primary"
          >
            {initialData ? 'Update' : 'Save'}
          </Button>
        </div>
      ) : undefined}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted animate-pulse font-medium">Gemini is analyzing...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {['manual', 'ocr', 'text'].map((m) => {
            const Icon = m === 'manual' ? FileText : m === 'ocr' ? Camera : AlignLeft;
            return (
              <button
                key={m}
                onClick={() => setMode(m as any)}
                className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="mb-2 text-slate-400 group-hover:text-blue-600 transition-colors">
                  <Icon size={32} />
                </div>
                <span className="font-bold text-slate-700 text-sm">{m === 'manual' ? 'Manual' : m === 'ocr' ? 'Scan' : 'Paste'}</span>
              </button>
            );
          })}

          {mode === 'manual' && (
            <div className="flex flex-col gap-2">
              {/* 1. Hero Section: Amount & Type */}
              <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                {/* Type Segmented Control */}
                <div className="flex p-0.5 bg-slate-200/50 rounded-lg">
                  {Object.values(TransactionType).map((t) => (
                    <button
                      key={t}
                      onClick={() => setManualForm({
                        ...manualForm,
                        type: t,
                        category: t === TransactionType.TRANSFER ? Category.TRANSFER : manualForm.category
                      })}
                      className={`flex-1 py-1.5 text-[10px] font-black rounded-md transition-all uppercase tracking-wide ${manualForm.type === t
                        ? (t === TransactionType.INCOME ? 'bg-white text-emerald-600 shadow-sm' : t === TransactionType.EXPENSE ? 'bg-white text-rose-600 shadow-sm' : 'bg-white text-blue-600 shadow-sm')
                        : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Hero Amount Input */}
                <div className="relative flex items-center justify-center py-1">
                  <span className={`text-xl font-bold mr-1 ${manualForm.type === TransactionType.EXPENSE ? 'text-rose-500' : manualForm.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-blue-500'}`}>
                    {manualForm.type === TransactionType.EXPENSE ? '-' : manualForm.type === TransactionType.INCOME ? '+' : '→'}
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    aria-label="Transaction Amount"
                    value={manualForm.amount}
                    onChange={e => setManualForm({ ...manualForm, amount: e.target.value })}
                    className="w-full text-center bg-transparent text-3xl font-black text-slate-800 placeholder-slate-200 outline-none p-0"
                    autoFocus={!initialData}
                  />
                  <span className="text-lg font-bold text-slate-400 absolute right-2">₩</span>
                </div>
              </div>

              {/* 2. Horizontal Category List */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-1 block">Category</label>
                <div className="overflow-x-auto py-2 -mx-4 px-5 scrollbar-hide flex gap-2 snap-x">
                  {categories.length > 0 ? (
                    // Dynamic Categories
                    categories
                      .filter(c => c.type === manualForm.type)
                      .map(cat => {
                        const isSelected = manualForm.category === cat.id; // Match by ID
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setManualForm({ ...manualForm, category: cat.id })}
                            className={`snap-start shrink-0 px-4 py-2 rounded-xl border transition-all text-xs font-bold whitespace-nowrap flex items-center gap-2 ${isSelected
                              ? `bg-slate-800 text-white border-slate-800 shadow-lg shadow-slate-200 scale-105`
                              : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}
                          >
                            <span>{cat.emoji}</span>
                            <span>{cat.name}</span>
                          </button>
                        );
                      })
                  ) : (
                    // Legacy Fallback
                    Object.values(Category).map(cat => {
                      const isSelected = manualForm.category === cat;
                      return (
                        <button
                          key={cat}
                          onClick={() => handleCategoryChange(cat)}
                          className={`snap-start shrink-0 px-4 py-2 rounded-xl border transition-all text-xs font-bold whitespace-nowrap ${isSelected
                            ? 'bg-slate-800 text-white border-slate-800 shadow-lg shadow-slate-200 scale-105'
                            : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'}`}
                        >
                          {cat.replace('&', '').split(' ')[0]}
                        </button>
                      );
                    })
                  )}
                  {/* Append 'Others' or Allow Add New? For now just list available */}
                </div>
              </div>

              {/* 3. Compact Inputs Grid */}
              {/* 3. Compact Inputs Grid (Flex Column forced for persistent vertical stack) */}
              <div className="flex flex-col gap-3">
                <Input
                  label="Date"
                  type="date"
                  value={manualForm.date}
                  onChange={e => setManualForm({ ...manualForm, date: e.target.value })}
                  className="h-10 appearance-none py-0"
                />
                <Select
                  label={manualForm.type === TransactionType.TRANSFER ? 'From' : 'Account'}
                  value={manualForm.assetId}
                  onChange={e => setManualForm({ ...manualForm, assetId: e.target.value })}
                  options={assets.map(a => ({ label: a.institution ? `${a.institution} - ${a.name}` : a.name, value: a.id }))}
                  className="h-10 py-0"
                />

                {manualForm.type === TransactionType.TRANSFER && !isExternalTransfer && (
                  <div className="col-span-2 animate-in slide-in-from-top-1">
                    <Select
                      label="To Account"
                      value={manualForm.toAssetId}
                      onChange={e => setManualForm({ ...manualForm, toAssetId: e.target.value })}
                      options={[
                        { label: 'Select Target', value: '' },
                        ...assets
                          .filter(a => a.id !== manualForm.assetId)
                          .map(a => ({ label: a.institution ? `${a.institution} - ${a.name}` : a.name, value: a.id }))
                      ]}
                      className="bg-blue-50 border-blue-100 text-blue-700"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <div className="relative">
                    <Input
                      label="Description"
                      value={manualForm.memo}
                      onChange={e => handleMemoChange(e.target.value)}
                      placeholder="Description @Merchant #Tag"
                      className="placeholder:text-slate-300"
                    />
                    {showTagSuggestions && (
                      <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-48 overflow-y-auto">
                        {tagSuggestions.map(tag => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => insertTag(tag.name)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex justify-between items-center"
                          >
                            <span className="font-bold text-blue-500">#{tag.name}</span>
                            <span className="text-xs text-slate-400">{tag.usage_count} used</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 pl-1 text-right font-medium">Use <span className="text-purple-500 font-bold bg-purple-50 px-1 rounded mx-0.5">@</span> Merchant, <span className="text-blue-500 font-bold bg-blue-50 px-1 rounded mx-0.5">#</span> Tag</p>
                </div>
              </div>

              {/* 4. Options Row (Installment / Internal) */}
              <div className="flex items-center gap-3 pt-2">
                {manualForm.type === TransactionType.TRANSFER ? (
                  <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                    <button onClick={() => setIsExternalTransfer(false)} className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${!isExternalTransfer ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>INT</button>
                    <button onClick={() => setIsExternalTransfer(true)} className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${isExternalTransfer ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>EXT</button>
                  </div>
                ) : manualForm.type === TransactionType.EXPENSE ? (
                  <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                    <button onClick={() => setIsInstallment(false)} className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${!isInstallment ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'}`}>LUMP</button>
                    <button onClick={() => setIsInstallment(true)} className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${isInstallment ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>INST</button>
                  </div>
                ) : null}

                {/* Installment Slider (Inline) */}
                {isInstallment && manualForm.type === TransactionType.EXPENSE && (
                  <div className="flex-1 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-left-2">
                    <span className="text-[9px] font-bold text-blue-500 whitespace-nowrap">{installmentMonths}M</span>
                    <input type="range" min="2" max="24" aria-label="Installment Months" value={installmentMonths} onChange={e => setInstallmentMonths(Number(e.target.value))} className="flex-1 h-1.5 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    <div className={`cursor-pointer px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${isInterestFree ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`} onClick={() => setIsInterestFree(!isInterestFree)}>
                      {isInterestFree ? 'Free' : 'Fee'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {syncConfirmData && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
                  <RefreshCw size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-blue-900 leading-tight">연동 거래 금액 동기화</h4>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Sync Linked Transaction</p>
                </div>
              </div>

              <p className="text-xs text-blue-800 mb-4 leading-relaxed">
                이 거래는 <span className="font-black underline mx-0.5">{syncConfirmData.linkedAssetName}</span>의 내역과 연결되어 있습니다.<br />
                상대 거래의 금액도 <span className="font-black text-blue-600 bg-white px-1 rounded mx-0.5">₩{syncConfirmData.newAmount.toLocaleString()}</span>으로 함께 변경하시겠습니까?
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={() => handleManualSubmit()} // Keep state as is, triggers dual update
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none h-10 text-xs font-black shadow-lg shadow-blue-200"
                >
                  함께 수정
                </Button>
                <Button
                  onClick={() => {
                    setSyncConfirmData(null);
                    // We need a way to tell handleManualSubmit NOT to re-prompt
                    // A quick hack is to use a ref or just call it after clearing state but with a flag
                    // but for now, let's just make it call onTransactionsParsed directly for single
                    const totalAmount = parseFloat(manualForm.amount);
                    onTransactionsParsed([{
                      id: initialData?.id,
                      date: manualForm.date,
                      amount: totalAmount,
                      type: manualForm.type,
                      category: manualForm.category,
                      memo: manualForm.memo,
                      assetId: manualForm.assetId,
                      toAssetId: (manualForm.type === TransactionType.TRANSFER && !isExternalTransfer) ? manualForm.toAssetId : undefined
                    }]);
                  }}
                  variant="ghost"
                  className="flex-1 text-slate-500 h-10 text-xs font-bold"
                >
                  현재만 수정
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-rose-100">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
};

export default SmartInput;
