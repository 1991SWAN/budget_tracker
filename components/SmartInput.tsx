import React, { useState, useRef, useEffect } from 'react';
import { GeminiService } from '../services/geminiService';
import { Transaction, TransactionType, Category, Asset, AssetType } from '../types';

interface SmartInputProps {
  onTransactionsParsed: (transactions: Partial<Transaction>[]) => void;
  onCancel: () => void;
  assets: Asset[];
  initialData?: Transaction | null;
}

const CATEGORY_EMOJIS: Record<string, string> = {
  [Category.FOOD]: '🍔',
  [Category.TRANSPORT]: '🚌',
  [Category.SHOPPING]: '🛍️',
  [Category.HOUSING]: '🏠',
  [Category.UTILITIES]: '⚡',
  [Category.HEALTH]: '🏥',
  [Category.ENTERTAINMENT]: '🎬',
  [Category.SALARY]: '💰',
  [Category.INVESTMENT]: '📈',
  [Category.TRANSFER]: '💸',
  [Category.OTHER]: '📦'
};

const SmartInput: React.FC<SmartInputProps> = ({ onTransactionsParsed, onCancel, assets, initialData }) => {
  const [mode, setMode] = useState<'select' | 'ocr' | 'text' | 'manual'>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isExternalTransfer, setIsExternalTransfer] = useState(false);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentMonths, setInstallmentMonths] = useState(2);
  const [isInterestFree, setIsInterestFree] = useState(true);

  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    type: TransactionType.EXPENSE,
    category: Category.FOOD,
    memo: '',
    merchant: '', 
    emoji: '🍔',
    assetId: assets[0]?.id || '',
    toAssetId: ''
  });

  useEffect(() => {
    if (initialData) {
      setMode('manual');
      const isExternal = initialData.type === TransactionType.TRANSFER && !initialData.toAssetId;
      setIsExternalTransfer(isExternal);
      
      // Check if it was an installment (existing logic check)
      if (initialData.installment) {
        setIsInstallment(true);
        setInstallmentMonths(initialData.installment.totalMonths);
        setIsInterestFree(initialData.installment.isInterestFree);
      }

      setManualForm({
        date: initialData.date,
        amount: initialData.amount.toString(),
        type: initialData.type,
        category: initialData.category as Category,
        memo: initialData.memo,
        merchant: initialData.merchant || '',
        emoji: initialData.emoji || CATEGORY_EMOJIS[initialData.category as string] || '📦',
        assetId: initialData.assetId,
        toAssetId: initialData.toAssetId || ''
      });
    }
  }, [initialData]);

  const handleCategoryChange = (cat: Category) => {
    setManualForm(prev => ({
      ...prev,
      category: cat,
      emoji: CATEGORY_EMOJIS[cat] || '📦'
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
        emoji: manualForm.emoji,
        assetId: manualForm.assetId,
        toAssetId: (manualForm.type === TransactionType.TRANSFER && !isExternalTransfer) ? manualForm.toAssetId : undefined
    };

    // Add Installment Metadata if applicable
    if (isInstallment && manualForm.type === TransactionType.EXPENSE && installmentMonths > 1) {
       transactionData.installment = {
         totalMonths: installmentMonths,
         isInterestFree: isInterestFree,
         monthlyAmount: Math.floor(totalAmount / installmentMonths) // Approximate
       };
       // Append info to memo for clarity in list
       if (!transactionData.memo.includes('Installment')) {
           transactionData.memo += ` (${installmentMonths}M Installment)`;
       }
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
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden w-full max-w-full mx-auto flex flex-col">
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

      <div className="p-4 sm:p-5 overflow-y-auto max-h-[80vh] sm:max-h-none scroll-smooth">
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
            {/* 1. Type Selector - Top Priority, Full Width */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {Object.values(TransactionType).map((t) => (
                 <button
                   key={t}
                   onClick={() => setManualForm({
                      ...manualForm, 
                      type: t,
                      category: t === TransactionType.TRANSFER ? Category.TRANSFER : manualForm.category,
                      emoji: t === TransactionType.TRANSFER ? CATEGORY_EMOJIS[Category.TRANSFER] : manualForm.emoji
                   })}
                   className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${manualForm.type === t 
                     ? (t === TransactionType.INCOME ? 'bg-white text-emerald-600 shadow-sm' : t === TransactionType.EXPENSE ? 'bg-white text-rose-600 shadow-sm' : 'bg-white text-blue-600 shadow-sm')
                     : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   {t}
                 </button>
              ))}
            </div>

            {/* 2. Core Row: Date & Amount (50/50 split) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                <input type="date" value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Amount</label>
                <div className="relative">
                  <input type="number" placeholder="0" value={manualForm.amount} onChange={e => setManualForm({...manualForm, amount: e.target.value})} className="w-full h-10 pl-3 pr-7 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-black text-slate-800"/>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₩</span>
                </div>
              </div>
            </div>

            {/* 3. Account Row: Linked logic (From -> To for transfers, else Single Account) */}
            <div className={`grid gap-3 ${manualForm.type === TransactionType.TRANSFER && !isExternalTransfer ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  {manualForm.type === TransactionType.TRANSFER ? 'From Account' : 'Account'}
                </label>
                <select value={manualForm.assetId} onChange={e => setManualForm({...manualForm, assetId: e.target.value})} className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold">
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>

              {manualForm.type === TransactionType.TRANSFER && !isExternalTransfer && (
                <div className="space-y-1 animate-in slide-in-from-left-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">To Account</label>
                  <select value={manualForm.toAssetId} onChange={e => setManualForm({...manualForm, toAssetId: e.target.value})} className="w-full h-10 px-3 bg-blue-50/50 border border-blue-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-semibold text-blue-700">
                    <option value="">Select Target</option>
                    {assets.map(a => <option key={a.id} value={a.id} disabled={a.id === manualForm.assetId}>{a.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* 4. Categorization Row: Category & Emoji (Compressed) */}
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Category & Merchant</label>
                <div className="flex gap-2">
                  <select value={manualForm.category} onChange={e => handleCategoryChange(e.target.value as Category)} className="w-1/3 h-10 px-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[10px] font-bold appearance-none">
                    {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" placeholder={manualForm.type === TransactionType.TRANSFER ? "Recipient" : "Merchant"} value={manualForm.merchant} onChange={e => setManualForm({...manualForm, merchant: e.target.value})} className="flex-1 h-10 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs"/>
                </div>
              </div>
              <div className="col-span-1 space-y-1 text-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 block">Icon</label>
                <input type="text" value={manualForm.emoji} onChange={e => setManualForm({...manualForm, emoji: e.target.value})} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-center text-lg"/>
              </div>
            </div>

            {/* 5. Detail Row: Options & Installment (Expanded Logic) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <div className="flex bg-white/60 p-0.5 rounded-lg mb-2">
                  {manualForm.type === TransactionType.TRANSFER ? (
                    <>
                      <button onClick={() => setIsExternalTransfer(false)} className={`flex-1 py-1 text-[9px] font-black rounded-md transition-all ${!isExternalTransfer ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>INTERNAL</button>
                      <button onClick={() => setIsExternalTransfer(true)} className={`flex-1 py-1 text-[9px] font-black rounded-md transition-all ${isExternalTransfer ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>EXTERNAL</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setIsInstallment(false)} className={`flex-1 py-1 text-[9px] font-black rounded-md transition-all ${!isInstallment ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400'}`}>LUMP SUM</button>
                      <button onClick={() => setIsInstallment(true)} className={`flex-1 py-1 text-[9px] font-black rounded-md transition-all ${isInstallment ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>INSTALLMENT</button>
                    </>
                  )}
                </div>
                
                {isInstallment && manualForm.type === TransactionType.EXPENSE && (
                  <div className="animate-in fade-in space-y-2">
                     {/* Months Slider */}
                     <div className="flex items-center gap-2">
                       <input type="range" min="2" max="24" value={installmentMonths} onChange={e => setInstallmentMonths(Number(e.target.value))} className="flex-1 h-1.5 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"/>
                       <span className="text-[10px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded min-w-[2rem] text-center">{installmentMonths}M</span>
                     </div>
                     {/* Interest Toggle */}
                     <div className="flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-slate-100">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Interest Free</span>
                        <div 
                           onClick={() => setIsInterestFree(!isInterestFree)}
                           className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${isInterestFree ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                           <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${isInterestFree ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                     </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Memo</label>
                <input type="text" placeholder="Optional note..." value={manualForm.memo} onChange={e => setManualForm({...manualForm, memo: e.target.value})} className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs"/>
              </div>
            </div>

            {/* 6. Action Footer - Floating look */}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setMode('select')} className="flex-1 py-3 text-slate-400 bg-slate-100 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors">Cancel</button>
              <button 
                onClick={handleManualSubmit}
                className="flex-[2] py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-blue-100 hover:shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0 transition-all uppercase tracking-tighter"
              >
                {initialData ? 'Update Transaction' : 'Confirm & Save'}
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
