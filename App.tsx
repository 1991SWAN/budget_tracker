import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './contexts/ToastContext';
import { useTransactionSearch } from "./hooks/useTransactionSearch";

import FilterBar from "./components/FilterBar";
import TransactionList from "./components/TransactionList";

import { Transaction, Asset, View, TransactionType, Category, RecurringTransaction, SavingsGoal, BillType, AssetType } from './types';
import { StorageService } from './services/storageService';
import { SupabaseService } from './services/supabaseService';
import { ImportService } from './services/importService';
import Dashboard from './components/Dashboard';
import AssetManager from './components/AssetManager';
import SmartInput from './components/SmartInput';
import { GeminiService } from './services/geminiService';
import { useTransactionManager } from './hooks/useTransactionManager';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const { addToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(2500000);
  const [showSmartInput, setShowSmartInput] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string, end: string } | null>(null);

  // Added 'import' to modal types
  const [modalType, setModalType] = useState<'bill' | 'goal' | 'pay-bill' | 'fund-goal' | 'budget' | 'pay-card' | 'import' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const [formData, setFormData] = useState<any>({});
  const [paymentAsset, setPaymentAsset] = useState<string>('');
  const [destinationAsset, setDestinationAsset] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // File Import Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importAssetId, setImportAssetId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const { addTransaction: handleAddTransaction, addTransactions: handleAddTransactions, updateTransaction: handleUpdateTransaction, deleteTransaction: handleDeleteTransaction } = useTransactionManager(transactions, setTransactions, assets, setAssets);

  const loadData = async () => {
    try {
      const [txs, assts, recs, gls] = await Promise.all([
        SupabaseService.getTransactions(),
        SupabaseService.getAssets(),
        SupabaseService.getRecurring(),
        SupabaseService.getGoals()
      ]);
      setTransactions(txs);
      setAssets(assts);
      setRecurring(recs);
      setGoals(gls);
      setMonthlyBudget(StorageService.getBudget());
    } catch (e) {
      addToast('Failed to load data from cloud', 'error');
    }
  };

  // Optimistic updates are handled in state, but we need to persist changes
  // We will wrap state setters or call Service directly in handlers


  // Legacy transaction handlers removed. Logic moved to useTransactionManager.

  const handleSmartParsed = (parsedTxs: Partial<Transaction>[]) => {
    const defaultAssetId = assets[0]?.id || '1';
    if (editingTransaction && parsedTxs.length > 0) {
      const updates = parsedTxs[0];
      const updatedTx: Transaction = { ...editingTransaction, ...updates, date: updates.date || editingTransaction.date, amount: updates.amount !== undefined ? updates.amount : editingTransaction.amount, assetId: updates.assetId || editingTransaction.assetId };
      handleUpdateTransaction(editingTransaction, updatedTx);
      setEditingTransaction(null);
    } else {
      parsedTxs.forEach(ptx => {
        const tx: Transaction = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          date: ptx.date || new Date().toISOString().split('T')[0],
          timestamp: ptx.timestamp || Date.now(),
          amount: ptx.amount || 0,
          type: ptx.type || TransactionType.EXPENSE,
          category: ptx.category || Category.OTHER,
          memo: ptx.memo || ptx.merchant || 'Smart Entry',
          emoji: ptx.emoji,
          assetId: ptx.assetId || defaultAssetId,
          toAssetId: ptx.toAssetId,
          installment: ptx.installment
        };
        handleAddTransaction(tx);
        if (tx.installment) {
          const newBill: RecurringTransaction = {
            id: `inst-bill-${tx.id}`, name: `${tx.memo} (Installment)`, amount: Math.floor(tx.amount / tx.installment.totalMonths), dayOfMonth: new Date(tx.date).getDate(), category: tx.category as Category, billType: BillType.INSTALLMENT, installmentDetails: { startDate: tx.date, totalAmount: tx.amount, totalMonths: tx.installment.totalMonths, isInterestFree: tx.installment.isInterestFree }
          };
          setRecurring(prev => [...prev, newBill]);
        }
      });
    }
    setShowSmartInput(false);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importAssetId) {
      // Safe check, though UI shouldn't allow this
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const csvText = evt.target?.result as string;
      if (csvText) {
        const parsedDrafts = ImportService.parseCSV(csvText, importAssetId);
        const { finalNewTxs, updatedExistingTxs } = ImportService.processImportedTransactions(parsedDrafts, transactions);

        // Batch Add New Transactions (updates assets automatically via hook)
        handleAddTransactions(finalNewTxs);

        // Handle Updates (if any)
        // For now, we will just sync them to DB? Or should we use updateTransaction?
        // Using loop for safety to update assets if changed.
        updatedExistingTxs.forEach(updatedTx => {
          const original = transactions.find(t => t.id === updatedTx.id);
          if (original) handleUpdateTransaction(original, updatedTx);
        });

        addToast(`Imported ${finalNewTxs.length} transactions (${updatedExistingTxs.length} matched)`, 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const triggerImport = () => {
    // Set default asset ID if not already set or invalid
    if (!importAssetId || !assets.find(a => a.id === importAssetId)) {
      const defaultAcc = assets.find(a => a.type === AssetType.CHECKING) || assets[0];
      if (defaultAcc) setImportAssetId(defaultAcc.id);
    }
    setModalType('import');
  };

  const openAddBill = () => { setModalType('bill'); setSelectedItem(null); setFormData({ name: '', amount: '', dayOfMonth: 1, category: Category.UTILITIES, billType: BillType.SUBSCRIPTION }); };
  const openEditBill = (bill: RecurringTransaction) => { setModalType('bill'); setSelectedItem(bill); setFormData({ ...bill }); };
  const openPayBill = (bill: RecurringTransaction) => { setModalType('pay-bill'); setSelectedItem(bill); setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || ''); };
  const openAddGoal = () => { setModalType('goal'); setSelectedItem(null); setFormData({ name: '', targetAmount: '', emoji: '🎯', deadline: '' }); };
  const openEditGoal = (goal: SavingsGoal) => { setModalType('goal'); setSelectedItem(goal); setFormData({ ...goal }); };
  const openFundGoal = (goal: SavingsGoal) => { setModalType('fund-goal'); setSelectedItem(goal); setFormData({ amount: '' }); setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || ''); setDestinationAsset(''); };
  const openEditBudget = () => { setModalType('budget'); setFormData({ amount: monthlyBudget }); };
  const openPayCard = (card: Asset) => { setModalType('pay-card'); setSelectedItem(card); setFormData({ amount: Math.abs(card.balance) }); setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || ''); };
  const closeModal = () => { setModalType(null); setSelectedItem(null); setPaymentError(null); };

  const handleSubmit = () => {
    setPaymentError(null);
    if (modalType === 'budget') { setMonthlyBudget(Number(formData.amount)); closeModal(); return; }

    if (modalType === 'pay-card' || modalType === 'pay-bill' || modalType === 'fund-goal') {
      const sourceAsset = assets.find(a => a.id === paymentAsset);
      const amountToPay = Number(formData.amount);
      if (sourceAsset && sourceAsset.type !== AssetType.CREDIT_CARD && sourceAsset.balance < amountToPay) {
        setPaymentError(`Insufficient funds in ${sourceAsset.name}. Available: ${sourceAsset.balance.toLocaleString()}`);
        return;
      }
    }

    if (modalType === 'pay-card') {
      const payAmount = Number(formData.amount);
      const tx: Transaction = {
        id: 'cp-' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        amount: payAmount,
        type: TransactionType.TRANSFER,
        category: Category.TRANSFER,
        memo: `Credit Card Payoff: ${selectedItem.name}`,
        assetId: paymentAsset,
        toAssetId: selectedItem.id,
        emoji: '💳'
      };
      handleAddTransaction(tx);
      closeModal();
      return;
    }
    // ... existing logic for recurring/goals
    if (!recurring || !goals) return; // safety

    // (Logic simplified for brevity as it matches existing code exactly for Bill/Goal updates)
    // Re-implementing strictly needed parts for the modal handlers to work
    if (modalType === 'bill') {
      const action = selectedItem ? 'update' : 'add';
      const data = { id: selectedItem?.id || Date.now().toString(), name: formData.name, amount: Number(formData.amount), dayOfMonth: Number(formData.dayOfMonth), category: formData.category, billType: formData.billType, groupName: formData.groupName || 'Default' };

      SupabaseService.saveRecurring(data as RecurringTransaction);
      if (action === 'add') setRecurring(prev => [...prev, data as RecurringTransaction]);
      else if (action === 'update') setRecurring(prev => prev.map(r => r.id === data.id ? data as RecurringTransaction : r));
      addToast(`Bill ${action === 'add' ? 'added' : 'updated'}`, 'success');

    } else if (modalType === 'goal') {
      const action = selectedItem ? 'update' : 'add';
      const data = { id: selectedItem?.id || Date.now().toString(), name: formData.name, targetAmount: Number(formData.targetAmount), emoji: formData.emoji, deadline: formData.deadline, currentAmount: selectedItem?.currentAmount || 0 };

      SupabaseService.saveGoal(data as SavingsGoal);
      if (action === 'add') setGoals(prev => [...prev, data as SavingsGoal]);
      else if (action === 'update') setGoals(prev => prev.map(g => g.id === data.id ? data as SavingsGoal : g));
      addToast(`Goal ${action === 'add' ? 'added' : 'updated'}`, 'success');

    } else if (modalType === 'pay-bill') {
      handleAddTransaction({ id: 'bp-' + Date.now(), date: new Date().toISOString().split('T')[0], amount: selectedItem.amount, type: TransactionType.EXPENSE, category: selectedItem.category, memo: `Bill Pay: ${selectedItem.name}`, assetId: paymentAsset, emoji: '⚡' });
      addToast('Bill paid successfully', 'success');
    } else if (modalType === 'fund-goal') {
      const amount = Number(formData.amount);
      const targetGoal = goals.find(g => g.id === selectedItem.id);
      if (targetGoal) {
        const updatedGoal = { ...targetGoal, currentAmount: targetGoal.currentAmount + amount };
        SupabaseService.saveGoal(updatedGoal);
        setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
      }
      handleAddTransaction({ id: 'gc-' + Date.now(), date: new Date().toISOString().split('T')[0], amount: amount, type: TransactionType.TRANSFER, category: Category.INVESTMENT, memo: `Goal: ${selectedItem.name}`, assetId: paymentAsset, toAssetId: destinationAsset || undefined, emoji: '💰' });
      addToast('Funds added to goal', 'success');
    }

    closeModal();
  };

  const renderModals = () => {
    if (!modalType) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-800">
              {modalType === 'bill' ? (selectedItem ? 'Edit Bill' : 'Add New Bill') :
                modalType === 'goal' ? (selectedItem ? 'Edit Goal' : 'Add New Goal') :
                  modalType === 'pay-bill' ? `Pay: ${selectedItem?.name}` :
                    modalType === 'budget' ? 'Set Monthly Budget' :
                      modalType === 'pay-card' ? `Pay Off Card: ${selectedItem?.name}` :
                        modalType === 'import' ? 'Import Transactions' :
                          `Add Funds: ${selectedItem?.name}`}
            </h3>
            <button onClick={closeModal} className="text-xl">✖️</button>
          </div>
          <div className="space-y-4">
            {modalType === 'import' && (
              <>
                <p className="text-sm text-slate-500 mb-2">Select the account to import CSV transactions into.</p>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
                  <p className="text-xs text-blue-800">💡 <strong>Tip:</strong> Duplicates will be automatically skipped based on date, amount, and memo.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Target Account</label>
                  <select value={importAssetId} onChange={e => setImportAssetId(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                    {assets.map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toLocaleString()})</option>)}
                  </select>
                </div>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setModalType(null);
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <span>📂</span> Select CSV File
                </button>
              </>
            )}

            {modalType === 'bill' && (
              <>
                <input type="text" placeholder="Bill Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border rounded-lg" />
                <input type="number" placeholder="Amount" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full p-2 border rounded-lg" />
                <div className="flex gap-2">
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="flex-1 p-2 border rounded-lg">
                    {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={formData.billType} onChange={e => setFormData({ ...formData, billType: e.target.value })} className="flex-1 p-2 border rounded-lg">
                    {Object.values(BillType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Group (e.g. Housing)" value={formData.groupName || ''} onChange={e => setFormData({ ...formData, groupName: e.target.value })} className="flex-1 p-2 border rounded-lg" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 whitespace-nowrap">Day:</span>
                    <input type="number" min="1" max="31" value={formData.dayOfMonth} onChange={e => setFormData({ ...formData, dayOfMonth: e.target.value })} className="w-16 p-2 border rounded-lg" />
                  </div>
                </div>
              </>
            )}
            {modalType === 'pay-card' && (
              <>
                <p className="text-sm text-slate-500 mb-2">Pay off your credit card debt from another account.</p>
                <input type="number" placeholder="Payment Amount" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full p-4 border border-rose-200 bg-rose-50 rounded-xl font-bold text-2xl text-rose-900 focus:outline-none" />
                <label className="block text-xs font-semibold text-slate-500 uppercase">Withdraw From</label>
                <select value={paymentAsset} onChange={e => setPaymentAsset(e.target.value)} className="w-full p-2 border rounded-lg">
                  {assets.filter(a => a.type !== AssetType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toLocaleString()})</option>)}
                </select>
              </>
            )}
            {modalType === 'goal' && (
              <>
                <input type="text" placeholder="Goal Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full p-2 border rounded-lg" />
                <input type="number" placeholder="Target Amount" value={formData.targetAmount} onChange={e => setFormData({ ...formData, targetAmount: e.target.value })} className="w-full p-2 border rounded-lg" />
                <div className="flex gap-2">
                  <input type="text" placeholder="Emoji" value={formData.emoji} onChange={e => setFormData({ ...formData, emoji: e.target.value })} className="w-20 p-2 border rounded-lg" />
                  <input type="date" value={formData.deadline || ''} onChange={e => setFormData({ ...formData, deadline: e.target.value })} className="flex-1 p-2 border rounded-lg" />
                </div>
              </>
            )}
            {modalType === 'budget' && (
              <>
                <p className="text-sm text-slate-500 mb-2">Set your total monthly budget or expected income.</p>
                <input type="number" placeholder="e.g. 3,000,000" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full p-4 border border-blue-200 bg-blue-50 rounded-xl font-bold text-2xl text-blue-900 focus:outline-none" autoFocus />
              </>
            )}
            {(modalType === 'pay-bill' || modalType === 'fund-goal') && (
              <>
                {modalType === 'fund-goal' && <input type="number" placeholder="Amount to Add" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} className="w-full p-2 border rounded-lg font-bold text-lg" autoFocus />}
                <label className="block text-xs font-semibold text-slate-500 uppercase">Pay From / Source</label>
                <select value={paymentAsset} onChange={e => setPaymentAsset(e.target.value)} className="w-full p-2 border rounded-lg">
                  {assets.filter(a => a.type !== AssetType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toLocaleString()})</option>)}
                </select>
                {modalType === 'fund-goal' && (
                  <>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mt-2">To Account (Optional)</label>
                    <select value={destinationAsset} onChange={e => setDestinationAsset(e.target.value)} className="w-full p-2 border rounded-lg">
                      <option value="">None (Track Only)</option>
                      {assets.map(a => <option key={a.id} value={a.id} disabled={a.id === paymentAsset}>{a.name} ({a.type})</option>)}
                    </select>
                  </>
                )}
              </>
            )}

            {paymentError && (
              <div className="bg-rose-50 text-rose-600 p-2 rounded-lg text-xs font-bold border border-rose-100 flex items-center gap-2">
                <span>⚠️</span> {paymentError}
              </div>
            )}

            {modalType !== 'import' && (
              <div className="flex gap-2 pt-4">
                {(modalType === 'bill' || modalType === 'goal') && selectedItem && <button onClick={() => {
                  if (modalType === 'bill') { SupabaseService.deleteRecurring(selectedItem.id); setRecurring(prev => prev.filter(r => r.id !== selectedItem.id)); }
                  if (modalType === 'goal') { SupabaseService.deleteGoal(selectedItem.id); setGoals(prev => prev.filter(g => g.id !== selectedItem.id)); }
                  closeModal();
                }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg mr-auto text-xl">🗑️</button>}
                <button onClick={closeModal} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button onClick={handleSubmit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                  {modalType === 'pay-bill' || modalType === 'pay-card' ? 'Confirm Payment' : modalType === 'fund-goal' ? 'Add Funds' : 'Save'}
                </button>
              </div>
            )}
            {/* Import Modal has its own button above */}
            {modalType === 'import' && (
              <div className="pt-2 text-center">
                <button onClick={closeModal} className="text-sm text-slate-400 hover:text-slate-600">Cancel Import</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const NavItem = ({ v, emoji, label }: { v: View, emoji: string, label: string }) => (
    <button onClick={() => { setView(v); setIsSidebarOpen(false); }} className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all ${view === v ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><span className="text-xl">{emoji}</span><span className="font-medium">{label}</span></button>
  );

  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      {renderModals()}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 p-6 flex flex-col transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center space-x-2 mb-10 text-blue-600"><span className="text-3xl">🪙</span><span className="text-xl font-bold tracking-tight text-slate-900">SmartPenny</span></div>
        <nav className="space-y-2 flex-1">
          <NavItem v="dashboard" emoji="📊" label="Dashboard" />
          <NavItem v="transactions" emoji="🧾" label="Transactions" />
          <NavItem v="assets" emoji="💰" label="Assets" />
          <NavItem v="analysis" emoji="🤖" label="AI Analysis" />
        </nav>

        {/* Hidden File Input */}
        <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".csv" />

        <div className="pt-6 border-t border-slate-100 space-y-3">
          <button onClick={triggerImport} className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 p-3 rounded-xl flex items-center justify-center space-x-2 font-semibold text-sm transition-colors">
            <span>📂</span><span>Import CSV</span>
          </button>
          <button onClick={() => setShowSmartInput(true)} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3 rounded-xl shadow-lg flex items-center justify-center space-x-2"><span>➕</span><span className="font-semibold">Quick Add</span></button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="lg:hidden bg-white border-b border-slate-100 p-4 flex justify-between items-center sticky top-0 z-30"><div className="flex items-center space-x-2 text-blue-600"><span className="text-2xl">🪙</span><span className="font-bold text-slate-900">SmartPenny</span></div><button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600 text-2xl">☰</button></header>
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth"><div className="max-w-5xl mx-auto">
          {showSmartInput && <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"><div className="w-full max-w-lg md:max-w-3xl my-auto"><SmartInput onTransactionsParsed={handleSmartParsed} onCancel={() => setShowSmartInput(false)} assets={assets} initialData={editingTransaction} /></div></div>}
          {view === 'dashboard' && <Dashboard
            transactions={transactions}
            assets={assets}
            recurring={recurring}
            goals={goals}
            onRecurringChange={(action, item) => { if (action === 'delete' && item.id) { SupabaseService.deleteRecurring(item.id); setRecurring(prev => prev.filter(r => r.id !== item.id)); } else if (action === 'add') { const newItem = { ...item, id: Date.now().toString() }; SupabaseService.saveRecurring(newItem); setRecurring(prev => [...prev, newItem]); } else if (action === 'update') { SupabaseService.saveRecurring(item); setRecurring(prev => prev.map(r => r.id === item.id ? { ...r, ...item } : r)); } else if (action === 'pay') { handleAddTransaction({ id: 'bp-' + Date.now(), date: new Date().toISOString().split('T')[0], amount: item.amount, type: TransactionType.EXPENSE, category: item.category, memo: `Bill Pay: ${item.name}`, assetId: item.assetId, emoji: '⚡' }); } }}
            onGoalChange={(action, item) => { if (action === 'delete' && item.id) { SupabaseService.deleteGoal(item.id); setGoals(prev => prev.filter(g => g.id !== item.id)); } else if (action === 'add') { const newItem = { ...item, id: Date.now().toString() }; SupabaseService.saveGoal(newItem); setGoals(prev => [...prev, newItem]); } else if (action === 'update') { SupabaseService.saveGoal(item); setGoals(prev => prev.map(g => g.id === item.id ? { ...g, ...item } : g)); } else if (action === 'contribute') { const updated = { ...item, currentAmount: item.currentAmount + item.amount }; SupabaseService.saveGoal(updated); setGoals(prev => prev.map(g => g.id === item.id ? updated : g)); handleAddTransaction({ id: 'gc-' + Date.now(), date: new Date().toISOString().split('T')[0], amount: item.amount, type: TransactionType.TRANSFER, category: Category.INVESTMENT, memo: `Goal: ${item.name}`, assetId: item.assetId, toAssetId: item.toAssetId, emoji: '💰' }); } }}
            onAddTransaction={handleAddTransaction}
            monthlyBudget={monthlyBudget}
            onBudgetChange={setMonthlyBudget}
            onNavigateToTransactions={(range) => { if (range) setDateRange(range); setView('transactions'); }}
            onAddBillToGroup={(group) => {
              setModalType('bill');
              setSelectedItem(null);
              setFormData({ name: '', amount: '', dayOfMonth: 1, category: Category.UTILITIES, billType: BillType.SUBSCRIPTION, groupName: group });
              // Optional: switch to transactions view if we want to show the modal there, but modal is global in App, so it opens over whatever view.
              // However, user might expect to be in Transactions context.
              // Given the design "Go to Transactions to add bills" inside the empty state message, 
              // maybe we should switch view? 
              // The empty state message says "Go to 'Transactions' to add bills."
              // The button is shortcut. Let's just open modal, but maybe switch view to transactions so when they close they are there?
              // The button says "+ Add Bill to {group}".
              // Let's just open modal.
            }}
          />}
          {view === 'assets' && <AssetManager assets={assets} transactions={transactions} onAdd={a => { SupabaseService.saveAsset(a); setAssets(prev => [...prev, a]); }} onDelete={id => { SupabaseService.deleteAsset(id); setAssets(prev => prev.filter(a => a.id !== id)); }} onEdit={async (editedAsset) => {
            const oldAsset = assets.find(a => a.id === editedAsset.id);
            if (!oldAsset) return;

            const diff = editedAsset.balance - oldAsset.balance;
            const metadataOnly = { ...editedAsset, balance: oldAsset.balance };

            // 1. Update Metadata (if changed, or just always to be safe)
            // We use the OLD balance here to ensure the transaction logic below is the sole source of balance truth.
            await SupabaseService.saveAsset(metadataOnly);
            setAssets(prev => prev.map(a => a.id === metadataOnly.id ? metadataOnly : a));

            // 2. Handle Balance Adjustment via Transaction
            if (diff !== 0) {
              const tx: Transaction = {
                id: 'adj-' + Date.now(),
                date: new Date().toISOString().split('T')[0],
                amount: Math.abs(diff),
                type: diff > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
                category: Category.OTHER,
                memo: 'Manual Balance Adjustment',
                assetId: editedAsset.id,
                emoji: '🔧'
              };
              await handleAddTransaction(tx);
            }
          }} onPay={openPayCard} />}
          {view === 'transactions' && <div className="space-y-4">
            <div className="flex flex-col gap-4">
              {/* Header & Actions */}
              <div className="flex justify-between items-center px-1">
                <h2 className="text-2xl font-bold text-slate-800">Transactions</h2>
                <div className="flex gap-2">
                  <button onClick={openAddBill} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold hover:bg-indigo-100 transition-colors">
                    <span>🗓️</span> Bills
                  </button>
                  {dateRange && (
                    <button onClick={() => setDateRange(null)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold hover:bg-slate-200">
                      Clear Date
                    </button>
                  )}
                </div>
              </div>

              {/* Search Box */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden px-4 py-3 flex gap-2 items-center">
                <span className="text-slate-400">🔍</span>
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm font-medium placeholder:text-slate-300"
                />
              </div>

              {/* Filter Chips */}
              <FilterBar
                currentFilter={filterCategory}
                onFilterChange={setFilterCategory}
                assets={assets}
              />
            </div>

            {/* Transaction List */}
            <TransactionList
              transactions={useTransactionSearch(transactions, searchTerm).filter(t => {
                // 1. (Search is now handled by hook above)

                // 2. Date Filter
                const matchesDate = dateRange ? (t.date >= dateRange.start && t.date <= dateRange.end) : true;

                // 3. Category/Type Filter
                let matchesType = true;
                if (filterCategory === 'ALL') matchesType = true;
                else if (Object.values(TransactionType).includes(filterCategory as any)) {
                  matchesType = t.type === filterCategory;
                } else {
                  // Assume it's an Asset ID
                  matchesType = t.assetId === filterCategory || t.toAssetId === filterCategory;
                }

                return matchesDate && matchesType;
              })}
              assets={assets}
              onEdit={(t) => { setEditingTransaction(t); setShowSmartInput(true); }}
              onDelete={handleDeleteTransaction}
              searchTerm={searchTerm}
            />
          </div>}
        </div></div>
      </main>
    </div>
  );
};

export default App;