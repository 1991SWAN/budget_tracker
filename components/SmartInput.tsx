import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, Category, Asset } from '../types';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';

interface SmartInputProps {
  onTransactionsParsed: (transactions: Partial<Transaction>[]) => void;
  onCancel: () => void;
  assets: Asset[];
  initialData?: Transaction | null;
  transactions?: Transaction[]; // For Autocomplete history
}

const SmartInput: React.FC<SmartInputProps> = ({ onTransactionsParsed, onCancel, assets, initialData, transactions = [] }) => {
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

    const transactionData: Partial<Transaction> = {
      date: manualForm.date,
      amount: totalAmount,
      type: manualForm.type,
      category: manualForm.category,
      memo: manualForm.memo,
      merchant: manualForm.merchant,
      assetId: manualForm.assetId,
      toAssetId: (manualForm.type === TransactionType.TRANSFER && !isExternalTransfer) ? manualForm.toAssetId : undefined
    };

    if (isInstallment && manualForm.type === TransactionType.EXPENSE) {
      const existing = initialData?.installment;
      transactionData.installment = {
        totalMonths: installmentMonths,
        currentMonth: existing ? existing.currentMonth : 1,
        // @ts-ignore
        isInterestFree: !!isInterestFree,
        // @ts-ignore
        is_interest_free: !!isInterestFree,
        remainingBalance: existing ? existing.remainingBalance : totalAmount
      };

    } else if (initialData?.installment && !isInstallment) {
      transactionData.installment = null as any;
    }

    onTransactionsParsed([transactionData]);
  };

  const getTitle = () => {
    if (loading) return "Processing...";
    if (mode === 'manual') return initialData ? 'Edit Entry' : 'New Entry';
    return 'Smart Input';
  };

  return (
    <Dialog
      isOpen={true}
      onClose={onCancel}
      title={getTitle()}
      maxWidth="lg"
      footer={mode === 'manual' ? (
        <>
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
        </>
      ) : undefined}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted animate-pulse font-medium">Gemini is analyzing...</p>
        </div>
      ) : (
        <div className="space-y-4">
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
                <Input
                  label="Date"
                  type="date"
                  value={manualForm.date}
                  onChange={e => setManualForm({ ...manualForm, date: e.target.value })}
                />
                <Select
                  label={manualForm.type === TransactionType.TRANSFER ? 'From' : 'Account'}
                  value={manualForm.assetId}
                  onChange={e => setManualForm({ ...manualForm, assetId: e.target.value })}
                  options={assets.map(a => ({ label: a.name, value: a.id }))}
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
                          .map(a => ({ label: a.name, value: a.id }))
                      ]}
                      className="bg-blue-50 border-blue-100 text-blue-700"
                    />
                  </div>
                )}

                <div className="col-span-1">
                  <Input
                    label={manualForm.type === TransactionType.TRANSFER ? 'Recipient' : 'Merchant'}
                    type="text"
                    list="merchant-suggestions"
                    value={manualForm.merchant}
                    onChange={e => setManualForm({ ...manualForm, merchant: e.target.value })}
                    placeholder="Where?"
                  />
                  <datalist id="merchant-suggestions">
                    {uniqueMerchants.map((m, i) => <option key={i} value={m} />)}
                  </datalist>
                </div>

                <Input
                  label="Memo"
                  value={manualForm.memo}
                  onChange={e => setManualForm({ ...manualForm, memo: e.target.value })}
                  placeholder="Note"
                />
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
            </div>
          )}

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-xl text-xs font-bold text-center border border-destructive/20">
              ⚠️ {error}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
};

export default SmartInput;
