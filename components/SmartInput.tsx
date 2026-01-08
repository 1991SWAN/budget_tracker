import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GeminiService } from '../services/geminiService';
import { Transaction, TransactionType, Category, Asset, AssetType } from '../types';

import { useModalClose } from '../hooks/useModalClose';

interface SmartInputProps {
  onTransactionsParsed: (transactions: Partial<Transaction>[]) => void;
  onCancel: () => void;
  assets: Asset[];
  initialData?: Transaction | null;
  transactions?: Transaction[]; // For Autocomplete history
}

const SmartInput: React.FC<SmartInputProps> = ({ onTransactionsParsed, onCancel, assets, initialData, transactions = [] }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalClose(true, onCancel, modalRef);
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

  const [manualForm, setManualForm] = useState(() => {
    if (initialData) {
      return {
        date: initialData.date,
        amount: initialData.amount.toString(),
        type: initialData.type,
        category: initialData.category as Category,
        memo: initialData.memo,
        merchant: initialData.merchant || '',
        assetId: initialData.assetId,
        toAssetId: initialData.toAssetId || ''
      };
    }
    return {
      date: new Date().toISOString().split('T')[0],
      amount: '',
      type: TransactionType.EXPENSE,
      category: Category.FOOD,
      memo: '',
      merchant: '',
      assetId: assets[0]?.id || '',
      toAssetId: ''
    };
  });

  // Unique Merchants for Autocomplete
  const uniqueMerchants = useMemo(() => {
    const merchants = new Set<string>();
    transactions.forEach(t => {
      if (t.merchant) merchants.add(t.merchant);
    });
    return Array.from(merchants).sort();
  }, [transactions]);


  useEffect(() => {
    if (initialData) {
      setMode('manual');
      const isExternal = initialData.type === TransactionType.TRANSFER && !initialData.toAssetId;
      setIsExternalTransfer(isExternal);

      // Check if it was an installment (existing logic check)
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
        memo: initialData.memo,
        merchant: initialData.merchant || '',
        assetId: initialData.assetId,
        toAssetId: initialData.toAssetId || ''
      });
    }
  }, [initialData]);

  const handleCategoryChange = (cat: Category) => {
    setManualForm(prev => ({
      ...prev,
      category: cat
    }));
  };

  const handleManualSubmit = () => {
    if (!manualForm.amount) { setError("Please enter an amount."); return; }
    if (!manualForm.assetId) { setError("Please select an account."); return; }

    if (manualForm.type === TransactionType.TRANSFER && !isExternalTransfer) {
      if (!manualForm.toAssetId) { setError("Please select a destination account."); return; }
      if (manualForm.assetId === manualForm.toAssetId) { setError("Source and destination accounts must be different."); return; }
    }

    const totalAmount = parseFloat(manualForm.amount);

    // Construct the Transaction Object
    const transactionData: Partial<Transaction> = {
      date: manualForm.date,
      amount: totalAmount,
      type: manualForm.type,
      category: manualForm.category,
      memo: manualForm.memo,
      merchant: manualForm.merchant,
      // emoji: manualForm.emoji,
      assetId: manualForm.assetId,
      toAssetId: (manualForm.type === TransactionType.TRANSFER && !isExternalTransfer) ? manualForm.toAssetId : undefined
    };

    // Add Installment Metadata if applicable
    console.log('DEBUG: handleManualSubmit', { isInstallment, type: manualForm.type, months: installmentMonths, isInterestFree });

    if (isInstallment && manualForm.type === TransactionType.EXPENSE) {
      const existing = initialData?.installment;
      console.log('DEBUG: Constructing Installment Object. InterestFree:', isInterestFree);

      transactionData.installment = {
        totalMonths: installmentMonths,
        currentMonth: existing ? existing.currentMonth : 1,
        // Save redundant keys to ensure persistence regardless of DB convention
        // @ts-ignore
        isInterestFree: !!isInterestFree,
        // @ts-ignore
        is_interest_free: !!isInterestFree,
        remainingBalance: existing ? existing.remainingBalance : totalAmount
      };

      // Append info to memo logic removed as per user request

    } else if (initialData?.installment && !isInstallment) {
      console.log('DEBUG: Clearing Installment Object');
      // Explicitly clear installment if user unchecked it
      transactionData.installment = null as any;
    }

    onTransactionsParsed([transactionData]);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-slate-600 animate-pulse font-medium">Gemini is analyzing...</p>
      </div>
    );
  }

  return (
    <div ref={modalRef} className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden w-full max-w-lg mx-auto flex flex-col max-h-[90vh]">
      {/* Compact Header */}
      <div className="bg-slate-50/80 backdrop-blur-sm px-6 py-3 flex justify-between items-center border-b border-slate-100 shrink-0">
        <h3 className="text-sm sm:text-lg font-bold text-slate-800 flex items-center gap-2">
          {mode === 'manual' ? (
            <><span className="text-lg">📝</span>{initialData ? 'Edit Entry' : 'New Entry'}</>
          ) : (
            <><span className="text-lg">✨</span>Smart Input</>
          )}
        </h3>
        <button onClick={onCancel} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
          <span className="text-2xl leading-none">×</span>
        </button>
      </div>

      <div className="p-4 sm:p-5 overflow-y-auto scroll-smooth">
        {mode === 'select' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['manual', 'ocr', 'text'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m as any)}
                className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <span className="text-3xl mb-2 grayscale group-hover:grayscale-0">{m === 'manual' ? '📝' : m === 'ocr' ? '📷' : '📄'}</span>
                <span className="font-bold text-slate-700 text-sm">{m === 'manual' ? 'Manual' : m === 'ocr' ? 'Scan' : 'Paste'}</span>
              </button>
            ))}
          </div>
        )}

        {mode === 'manual' && (
          <div className="flex flex-col gap-4">

            {/* 1. Hero Section: Amount & Type */}
            <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-3xl border border-slate-100">
              {/* Type Segmented Control */}
              <div className="flex p-1 bg-slate-200/50 rounded-xl">
                {Object.values(TransactionType).map((t) => (
                  <button
                    key={t}
                    onClick={() => setManualForm({
                      ...manualForm,
                      type: t,
                      category: t === TransactionType.TRANSFER ? Category.TRANSFER : manualForm.category
                    })}
                    className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all uppercase tracking-wide ${manualForm.type === t
                      ? (t === TransactionType.INCOME ? 'bg-white text-emerald-600 shadow-sm' : t === TransactionType.EXPENSE ? 'bg-white text-rose-600 shadow-sm' : 'bg-white text-blue-600 shadow-sm')
                      : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Hero Amount Input */}
              <div className="relative flex items-center justify-center py-2">
                <span className={`text-2xl font-bold mr-2 ${manualForm.type === TransactionType.EXPENSE ? 'text-rose-500' : manualForm.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-blue-500'}`}>
                  {manualForm.type === TransactionType.EXPENSE ? '-' : manualForm.type === TransactionType.INCOME ? '+' : '→'}
                </span>
                <input
                  type="number"
                  placeholder="0"
                  value={manualForm.amount}
                  onChange={e => setManualForm({ ...manualForm, amount: e.target.value })}
                  className="w-full text-center bg-transparent text-4xl font-black text-slate-800 placeholder-slate-200 outline-none p-0"
                  autoFocus={!initialData}
                />
                <span className="text-xl font-bold text-slate-400 absolute right-4">₩</span>
              </div>
            </div>

            {/* 2. Horizontal Category List */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 mb-1.5 block">Category</label>
              <div className="overflow-x-auto pb-4 -mx-4 px-5 scrollbar-hide flex gap-2 snap-x">
                {Object.values(Category).map(cat => {
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
                })}
              </div>
            </div>

            {/* 3. Compact Inputs Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Date */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                <input type="date" value={manualForm.date} onChange={e => setManualForm({ ...manualForm, date: e.target.value })} className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-slate-600" />
              </div>

              {/* Account */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {manualForm.type === TransactionType.TRANSFER ? 'From' : 'Account'}
                </label>
                <select value={manualForm.assetId} onChange={e => setManualForm({ ...manualForm, assetId: e.target.value })} className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-slate-700">
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {/* Transfer Target (Conditional) */}
              {manualForm.type === TransactionType.TRANSFER && !isExternalTransfer && (
                <div className="col-span-2 space-y-1 animate-in slide-in-from-top-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">To Account</label>
                  <select value={manualForm.toAssetId} onChange={e => setManualForm({ ...manualForm, toAssetId: e.target.value })} className="w-full h-11 px-3 bg-blue-50 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-blue-700">
                    <option value="">Select Target</option>
                    {assets.map(a => <option key={a.id} value={a.id} disabled={a.id === manualForm.assetId}>{a.name}</option>)}
                  </select>
                </div>
              )}

              {/* Merchant */}
              <div className="col-span-1 space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {manualForm.type === TransactionType.TRANSFER ? 'Recipient' : 'Merchant'}
                </label>
                <input
                  type="text"
                  list="merchant-suggestions"
                  value={manualForm.merchant}
                  onChange={e => setManualForm({ ...manualForm, merchant: e.target.value })}
                  className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium placeholder:text-slate-300"
                  placeholder="Where?"
                />
                <datalist id="merchant-suggestions">
                  {uniqueMerchants.map((m, i) => <option key={i} value={m} />)}
                </datalist>
              </div>

              {/* Memo */}
              <div className="col-span-1 space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Memo</label>
                <input type="text" placeholder="Note" value={manualForm.memo} onChange={e => setManualForm({ ...manualForm, memo: e.target.value })} className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium placeholder:text-slate-300" />
              </div>
            </div>

            {/* 4. Options Row (Installment / Internal) */}
            <div className="flex items-center gap-3 pt-2">
              {manualForm.type === TransactionType.TRANSFER ? (
                <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                  <button onClick={() => setIsExternalTransfer(false)} className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${!isExternalTransfer ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>INT</button>
                  <button onClick={() => setIsExternalTransfer(true)} className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${isExternalTransfer ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>EXT</button>
                </div>
              ) : (
                <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                  <button onClick={() => setIsInstallment(false)} className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${!isInstallment ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'}`}>LUMP</button>
                  <button onClick={() => setIsInstallment(true)} className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${isInstallment ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>INST</button>
                </div>
              )}

              {/* Installment Slider (Inline) */}
              {isInstallment && manualForm.type === TransactionType.EXPENSE && (
                <div className="flex-1 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-left-2">
                  <span className="text-[9px] font-bold text-blue-500 whitespace-nowrap">{installmentMonths}M</span>
                  <input type="range" min="2" max="24" value={installmentMonths} onChange={e => setInstallmentMonths(Number(e.target.value))} className="flex-1 h-1.5 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  <div className={`cursor-pointer px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${isInterestFree ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`} onClick={() => setIsInterestFree(!isInterestFree)}>
                    {isInterestFree ? 'Free' : 'Fee'}
                  </div>
                </div>
              )}
            </div>

            {/* 6. Action Footer - Floating look */}
            <div className="flex gap-2 pt-4 shrink-0">
              <button
                onClick={initialData ? onCancel : () => setMode('select')}
                className="flex-1 py-3 text-slate-400 bg-slate-100 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleManualSubmit}
                className="flex-[2] py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-wide"
              >
                {initialData ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="px-5 pb-3 animate-in fade-in shrink-0">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black text-center border border-rose-100 uppercase tracking-tight">
            ⚠️ {error}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartInput;
