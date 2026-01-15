import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from './contexts/ToastContext';
import ErrorBoundary from "./components/ErrorBoundary";

import { useTransactionSearch } from "./hooks/useTransactionSearch";

import FilterBar from "./components/FilterBar";
import TransactionList from "./components/TransactionList";
import { useTransferReconciler } from './hooks/useTransferReconciler';
import { ReconciliationModal } from './components/ReconciliationModal';
import { Button } from './components/ui/Button';

import { Transaction, Asset, View, TransactionType, Category, RecurringTransaction, SavingsGoal, BillType, AssetType } from './types';
import { StorageService } from './services/storageService';
import { SupabaseService, supabase } from './services/supabaseService';
import { ImportService } from './services/importService';
import { ImportWizardModal } from './components/import/ImportWizardModal';
import Dashboard from './components/Dashboard';
import AssetManager from './components/AssetManager';
import SmartInput from './components/SmartInput';
import { AppShell } from './components/layout/AppShell';
import { TransferNotificationToast } from './components/ui/TransferNotificationToast';
import { SettingsView } from './components/settings/SettingsView';

import { CategorySettings } from './components/settings/CategorySettings';
import { ImportSettings } from './components/settings/ImportSettings';


import { useTransactionManager } from './hooks/useTransactionManager';
import { useCategoryManager } from './hooks/useCategoryManager';
import { useModalClose } from './hooks/useModalClose';


import { useAuth } from './contexts/AuthContext';
import { LoginView } from './components/LoginView';

const App: React.FC = () => {
  const { user, isLoading } = useAuth();

  console.log(`[App] Render: isLoading=${isLoading}, user=${user?.id}`);

  const [view, setView] = useState<View>('dashboard');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const { addToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<number>(0);
  const [showSmartInput, setShowSmartInput] = useState(false);


  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterAssets, setFilterAssets] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string, end: string } | null>(null);

  // Reload data when user changes (Login/Logout)


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
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Modal Close Support
  const modalRef = useRef<HTMLDivElement>(null);
  useModalClose(!!modalType, () => {
    setModalType(null);
    setPendingImportFile(null); // Clear file on close
  }, modalRef);

  // --- History / Navigation Handling ---
  const navigateTo = useCallback((newView: View) => {
    setView(newView);
    window.history.pushState({ view: newView }, '', '');
  }, []);

  useEffect(() => {
    // Initial history state
    window.history.replaceState({ view: 'dashboard' }, '', '');

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.view) {
        setView(event.state.view);
      } else {
        // Fallback to dashboard if history is empty (e.g. first load)
        setView('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Hooks must be at top level
  // Note: We moved search filtering to the main filter block below to combine logic
  // const searchedTransactions = useTransactionSearch(transactions, searchTerm); 

  const { addTransaction: handleAddTransaction, addTransactions: handleAddTransactions, updateTransaction: handleUpdateTransaction, deleteTransaction: handleDeleteTransaction, deleteTransactions: handleDeleteTransactions } = useTransactionManager(transactions, setTransactions, assets, setAssets);
  const { categories } = useCategoryManager();

  // --- Main Filtering Logic ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // 1. Search (Name, Memo, Amount)
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        const assetName = assets.find(a => a.id === t.assetId)?.name.toLowerCase() || '';
        const categoryName = categories.find(c => c.id === t.category)?.name.toLowerCase() || t.category.toLowerCase();

        const matchesSearch =
          (t.merchant && t.merchant.toLowerCase().includes(lowerTerm)) ||
          (t.memo && t.memo.toLowerCase().includes(lowerTerm)) ||
          t.amount.toString().includes(lowerTerm) ||
          assetName.includes(lowerTerm) ||
          categoryName.includes(lowerTerm);

        if (!matchesSearch) return false;
      }

      // 2. Date Range
      if (dateRange) {
        if (t.date < dateRange.start || t.date > dateRange.end) return false;
      }

      // 3. Type Filter
      if (filterType !== 'ALL' && t.type !== filterType) return false;

      // 4. Category Filter (Multi-select OR)
      if (filterCategories.length > 0) {
        // Check both ID and Name (for legacy compatibility)
        const matchesCat = filterCategories.includes(t.category) ||
          categories.some(c => c.id === t.category && filterCategories.includes(c.name));
        if (!matchesCat) return false;
      }

      // 5. Asset Filter (Multi-select OR)
      if (filterAssets.length > 0) {
        if (!filterAssets.includes(t.assetId)) return false;
      }

      return true;
    });
  }, [transactions, searchTerm, dateRange, filterType, filterCategories, filterAssets, assets, categories]);

  const loadData = async () => {
    try {
      console.log('[App] loadData called. User ID:', user?.id);

      // 1. Auth check - We already have 'user' from Context, so we can skip a blocking getSession() call
      // preventing potential hangs on refresh.
      if (!user) {
        console.log("[App] No user in context. Skipping data load.");
        return;
      }

      const [txs, assts, recs, gls] = await Promise.all([
        SupabaseService.getTransactions(),
        SupabaseService.getAssets(),
        SupabaseService.getRecurring(),
        SupabaseService.getGoals()
      ]);

      console.log(`[App] Data Loaded: Txs=${txs.length}, Assets=${assts.length}`);

      setTransactions(txs);
      setAssets(assts);
      setRecurring(recs);
      setGoals(gls);

      // Load Profile for Settings/Budget
      const profile = await SupabaseService.getProfile();
      if (profile) {
        setMonthlyBudget(profile.monthlyBudget);
      } else {
        // Fallback to 0 if no profile set (User requested to remove 2.5M default)
        setMonthlyBudget(0);
      }
    } catch (e) {
      addToast('Failed to load data from cloud', 'error');
    }
  };

  // Reload data when user changes (Login/Logout)
  useEffect(() => {
    console.log('[App] useEffect triggered. User:', user?.id);
    if (user) {
      // Add a small delay to ensure Auth Session is fully propagated to Supabase Client headers
      // This prevents "Data 0" issues on page refresh
      const timer = setTimeout(() => {
        console.log('[App] Timeout finished. Calling loadData...');
        loadData();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // Clear data on logout
      setTransactions([]);
      setAssets([]);
      setRecurring([]);
      setGoals([]);
    }
  }, [user]);

  // V3 Transfer Reconciliation Hook
  const {
    candidates: transferCandidates,
    handleLink: linkTransfer,
    handleIgnore: ignoreTransfer,
    scanCandidates
  } = useTransferReconciler(transactions, assets, loadData);

  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);



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
          id: ptx.id || crypto.randomUUID(),
          date: ptx.date || new Date().toISOString().split('T')[0],
          timestamp: ptx.timestamp || Date.now(),
          amount: ptx.amount || 0,
          type: ptx.type || TransactionType.EXPENSE,
          category: ptx.category || Category.OTHER,
          memo: ptx.memo || ptx.merchant || 'Smart Entry',
          // emoji: ptx.emoji,
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

  const handleUpdateParsed = (txs: Partial<Transaction>[]) => {
    if (editingTransaction && txs.length > 0) {
      const updated = { ...editingTransaction, ...txs[0] } as Transaction;
      console.log('App Update Parsed:', updated.installment);
      handleUpdateTransaction(editingTransaction, updated);
    }
    setShowSmartInput(false);
    setEditingTransaction(null);
  };

  // --- Import Handlers ---
  const triggerImport = () => {
    // Set default asset ID if not already set or invalid
    if (!importAssetId || !assets.find(a => a.id === importAssetId)) {
      const defaultAcc = assets.find(a => a.type === AssetType.CHECKING) || assets[0];
      if (defaultAcc) setImportAssetId(defaultAcc.id);
    }
    setModalType('import');
  };

  const handleImportFile = (file: File) => {
    setPendingImportFile(file);
    triggerImport();
  };

  const handleImportConfirm = async (newTxs: Transaction[]) => {
    // 1. Process for duplicates & transfers
    // We fetch ALL existing transactions to ensure duplicate check is robust
    const { finalNewTxs, updatedExistingTxs } = ImportService.processImportedTransactions(newTxs, transactions);

    // 2. Save to Supabase (and State)
    if (finalNewTxs.length > 0) {
      await SupabaseService.saveTransactions(finalNewTxs);

      // Update local state
      setTransactions(prev => [...prev, ...finalNewTxs]);

      // Update balances
      const assetUpdates = new Map<string, number>();
      finalNewTxs.forEach(tx => {
        const val = tx.type === TransactionType.INCOME ? tx.amount : -tx.amount;
        assetUpdates.set(tx.assetId, (assetUpdates.get(tx.assetId) || 0) + val);
      });

      // Update Assets locally & remote
      const newAssets = [...assets];
      for (const [aId, diff] of assetUpdates.entries()) {
        const idx = newAssets.findIndex(a => a.id === aId);
        if (idx >= 0) {
          newAssets[idx] = { ...newAssets[idx], balance: newAssets[idx].balance + diff };
          SupabaseService.saveAsset(newAssets[idx]);
        }
      }
      setAssets(newAssets);
    }

    // 3. Handle Updates (Transfers Matched)
    if (updatedExistingTxs.length > 0) {
      for (const upTx of updatedExistingTxs) {
        await SupabaseService.saveTransaction(upTx);
      }
      // Update local state using map
      setTransactions(prev => prev.map(t => {
        const found = updatedExistingTxs.find(u => u.id === t.id);
        return found || t;
      }));
    }

    addToast(`Imported ${finalNewTxs.length} transactions (${updatedExistingTxs.length} matched as transfers)`, 'success');
  };

  const openAddBill = () => { setModalType('bill'); setSelectedItem(null); setFormData({ name: '', amount: '', dayOfMonth: 1, category: Category.UTILITIES, billType: BillType.SUBSCRIPTION }); };

  const openEditBill = (bill: RecurringTransaction) => { setModalType('bill'); setSelectedItem(bill); setFormData({ ...bill }); };
  const openPayBill = (bill: RecurringTransaction) => { setModalType('pay-bill'); setSelectedItem(bill); setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || ''); };
  const openAddGoal = () => { setModalType('goal'); setSelectedItem(null); setFormData({ name: '', targetAmount: '', emoji: '🎯', deadline: '' }); };
  const openEditGoal = (goal: SavingsGoal) => { setModalType('goal'); setSelectedItem(goal); setFormData({ ...goal }); };
  const openFundGoal = (goal: SavingsGoal) => { setModalType('fund-goal'); setSelectedItem(goal); setFormData({ amount: '' }); setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || ''); setDestinationAsset(''); };
  const openEditBudget = () => { setModalType('budget'); setFormData({ amount: monthlyBudget }); };
  const openPayCard = (card: Asset) => { setModalType('pay-card'); setSelectedItem(card); setFormData({ amount: Math.abs(card.balance) }); setPaymentAsset(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || ''); };
  const closeModal = () => { setModalType(null); setSelectedItem(null); setPaymentError(null); setPendingImportFile(null); };

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
        // emoji: '💳'
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
    if (!modalType || modalType === 'import') return null; // Import uses its own standalone wizard modal
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div ref={modalRef} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
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
          </div>
          <div className="space-y-4">
            {/* Replaced by ImportWizardModal below, removing old UI block */}

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
              <div className="bg-rose-50 text-destructive p-2 rounded-lg text-xs font-bold border border-rose-100 flex items-center gap-2">
                <span>⚠️</span> {paymentError}
              </div>
            )}

            {modalType !== 'import' && (
              <div className="flex gap-2 pt-4">
                {(modalType === 'bill' || modalType === 'goal') && selectedItem && <button onClick={() => {
                  if (modalType === 'bill') { SupabaseService.deleteRecurring(selectedItem.id); setRecurring(prev => prev.filter(r => r.id !== selectedItem.id)); }
                  if (modalType === 'goal') { SupabaseService.deleteGoal(selectedItem.id); setGoals(prev => prev.filter(g => g.id !== selectedItem.id)); }
                  closeModal();
                }} className="p-2 text-destructive hover:bg-rose-50 rounded-lg mr-auto text-xl">🗑️</button>}
                <button onClick={closeModal} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
                <button onClick={handleSubmit} className="flex-1 py-2 bg-primary text-white rounded-lg font-bold hover:bg-blue-700">
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


  // Auth Guard: Prevent rendering main app until authenticated
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleBudgetChange = async (amount: number) => {
    setMonthlyBudget(amount);
    await SupabaseService.saveProfile({ monthly_budget: amount });
  };

  return (
    <AppShell
      currentView={view}
      onNavigate={navigateTo}
      onImportClick={triggerImport}
      onImportFile={handleImportFile}
      onQuickAddClick={() => setShowSmartInput(true)}
    >
      {renderModals()}

      {/* Reconciliation Modal (V3) */}
      <ReconciliationModal
        isOpen={isReconciliationModalOpen}
        onClose={() => setIsReconciliationModalOpen(false)}
        candidates={transferCandidates}
        assets={assets}
        categories={categories}
        onLink={linkTransfer}
        onIgnore={ignoreTransfer}
      />

      {/* New Import Wizard */}
      {/* New Import Wizard */}
      {modalType === 'import' && (
        <ImportWizardModal
          isOpen={modalType === 'import'}
          onClose={() => setModalType(null)}
          onConfirm={handleImportConfirm}
          assetId={importAssetId}
          assetName={assets.find(a => a.id === importAssetId)?.name || 'Account'}
          assets={assets}
          categories={categories}
          initialFile={pendingImportFile || undefined}
        />
      )}

      {/* Hidden File Input (Ref kept for legacy compatibility if needed, but not used by Wizard) */}
      <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls" />

      {showSmartInput && (
        <SmartInput
          onTransactionsParsed={editingTransaction ? handleUpdateParsed : handleSmartParsed}
          onCancel={() => { setShowSmartInput(false); setEditingTransaction(null); }}
          assets={assets}
          categories={categories}
          initialData={editingTransaction}
          transactions={transactions}
          onDelete={handleDeleteTransaction}
        />
      )}

      {/* Baner: Transfer Suggestions */}


      {view === 'dashboard' && <Dashboard
        transactions={transactions}
        assets={assets}
        recurring={recurring}
        goals={goals}
        onRecurringChange={(action, item) => { if (action === 'delete' && item.id) { SupabaseService.deleteRecurring(item.id); setRecurring(prev => prev.filter(r => r.id !== item.id)); } else if (action === 'add') { const newItem = { ...item, id: Date.now().toString() }; SupabaseService.saveRecurring(newItem); setRecurring(prev => [...prev, newItem]); } else if (action === 'update') { SupabaseService.saveRecurring(item); setRecurring(prev => prev.map(r => r.id === item.id ? { ...r, ...item } : r)); } else if (action === 'pay') { handleAddTransaction({ id: 'bp-' + Date.now(), date: new Date().toISOString().split('T')[0], amount: item.amount, type: TransactionType.EXPENSE, category: item.category, memo: `Bill Pay: ${item.name}`, assetId: item.assetId, emoji: '⚡' }); } }}
        onGoalChange={(action, item) => { if (action === 'delete' && item.id) { SupabaseService.deleteGoal(item.id); setGoals(prev => prev.filter(g => g.id !== item.id)); } else if (action === 'add') { const newItem = { ...item, id: Date.now().toString() }; SupabaseService.saveGoal(newItem); setGoals(prev => [...prev, newItem]); } else if (action === 'update') { SupabaseService.saveGoal(item); setGoals(prev => prev.map(g => g.id === item.id ? { ...g, ...item } : g)); } else if (action === 'contribute') { const updated = { ...item, currentAmount: item.currentAmount + item.amount }; SupabaseService.saveGoal(updated); setGoals(prev => prev.map(g => g.id === item.id ? updated : g)); handleAddTransaction({ id: 'gc-' + Date.now(), date: new Date().toISOString().split('T')[0], amount: item.amount, type: TransactionType.TRANSFER, category: Category.INVESTMENT, memo: `Goal: ${item.name}`, assetId: item.assetId, toAssetId: item.toAssetId, emoji: '💰' }); } }}
        onAddTransaction={handleAddTransaction}
        onEditTransaction={(tx) => { setEditingTransaction(tx); setShowSmartInput(true); }} // Re-use smart input for editing
        onDeleteTransaction={handleDeleteTransaction}
        monthlyBudget={monthlyBudget}
        onBudgetChange={handleBudgetChange}
        onNavigateToTransactions={(range) => { if (range) setDateRange(range); navigateTo('transactions'); }}
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
            // emoji: '🔧'
          };
          await handleAddTransaction(tx);
        }
      }} onPay={openPayCard} />}
      {view === 'transactions' && <div className="space-y-4">
        {/* ... existing transaction view code ... */}
        <div className="flex flex-col gap-4">
          {/* Header & Actions */}
          {/* Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
            <div>
              <h1 className="text-3xl font-bold text-primary">Transactions</h1>
              <p className="text-muted">Review and manage your financial history.</p>
            </div>
            <div className="flex gap-2">

              {dateRange && (
                <button onClick={() => setDateRange(null)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold hover:bg-slate-200">
                  Clear Date
                </button>
              )}
            </div>
          </div>

          {/* Integrated Filter Toolbar */}
          <FilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            filterType={filterType}
            onTypeChange={setFilterType}
            filterCategories={filterCategories}
            onCategoriesChange={setFilterCategories}
            filterAssets={filterAssets}
            onAssetsChange={setFilterAssets}
            assets={assets}
            categories={categories}
          />
        </div>

        {/* Transaction List */}
        <ErrorBoundary>
          <TransactionList
            transactions={filteredTransactions}
            assets={assets}
            categories={categories}
            onEdit={(tx) => {
              setEditingTransaction(tx);
              setShowSmartInput(true);
            }}
            onDelete={handleDeleteTransaction}
            onDeleteTransactions={handleDeleteTransactions}
          />
        </ErrorBoundary>
      </div>}

      {view === 'settings' && <SettingsView onNavigate={navigateTo} />}

      {view === 'settings-categories' && <CategorySettings onNavigate={navigateTo} />}
      {view === 'settings-import' && <ImportSettings onNavigate={navigateTo} />}

      {/* Global Transfer Notification Toast */}
      <TransferNotificationToast
        count={transferCandidates.length}
        onReview={() => setIsReconciliationModalOpen(true)}
      />
    </AppShell>
  );
};

export default App;
// Force Re-bundle