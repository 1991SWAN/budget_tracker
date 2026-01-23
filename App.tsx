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
import { useAppData } from './hooks/useAppData';
import { useModalClose } from './hooks/useModalClose';
import { useModalManager } from './hooks/useModalManager';
import { ModalContainer } from './components/layout/ModalContainer';


import { useAuth } from './contexts/AuthContext';
import { LoginView } from './components/LoginView';

const App: React.FC = () => {
  const { user, isLoading } = useAuth();


  const [view, setView] = useState<View>('dashboard');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const { addToast } = useToast();
  // Refactored to useAppData
  const {
    assets, setAssets,
    transactions, setTransactions,
    recurring, setRecurring,
    goals, setGoals,
    monthlyBudget, setMonthlyBudget,
    hasMoreTransactions,
    fetchMoreTransactions,
    isFetchingMore,
    refreshData: loadData
  } = useAppData(user);

  // Modal Visibility State for Reconciliation (Restored)
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);
  const [showSmartInput, setShowSmartInput] = useState(false);


  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [filterSubExpense, setFilterSubExpense] = useState<'ALL' | 'REGULAR' | 'INSTALLMENT'>('ALL');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterAssets, setFilterAssets] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string, end: string } | null>(null);

  // Reload data when user changes (Login/Logout)


  // Added 'import' to modal types
  // Refactored to useModalManager
  const {
    modalType, setModalType,
    selectedItem, setSelectedItem,
    formData, setFormData,
    paymentAsset, setPaymentAsset,
    destinationAsset, setDestinationAsset,
    paymentError, setPaymentError,
    openAddBill, openEditBill, openPayBill,
    openAddGoal, openEditGoal, openFundGoal,
    openEditBudget, openPayCard, openImport,
    closeModal: hookCloseModal
  } = useModalManager(assets);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // File Import Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importAssetId, setImportAssetId] = useState<string>('');
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Modal Close Support
  const modalRef = useRef<HTMLDivElement>(null);

  const closeModal = () => {
    hookCloseModal();
    setPendingImportFile(null); // Clear file on close
  };

  useModalClose(!!modalType, closeModal, modalRef);

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

  const {
    addTransaction: handleAddTransaction,
    addTransactions: handleAddTransactions,
    updateTransaction: handleUpdateTransaction,
    updateTransactions: handleUpdateTransactions,
    deleteTransaction: handleDeleteTransaction,
    deleteTransactions: handleDeleteTransactions
  } = useTransactionManager(
    transactions,
    setTransactions,
    async () => {
      // Reload assets after transaction changes (DB Trigger has updated them)
      const freshAssets = await SupabaseService.getAssets();
      setAssets(freshAssets);
    }
  );
  const { categories } = useCategoryManager();

  const handleEditTransaction = useCallback((tx: Transaction) => {
    setEditingTransaction(tx);
    setShowSmartInput(true);
  }, []);

  // --- Server-Side Filtering (SSF) Logic ---
  useEffect(() => {
    // 300ms Debounce for filters
    const handler = setTimeout(() => {
      loadData({
        searchTerm,
        type: filterType,
        expenseType: filterSubExpense,
        categories: filterCategories,
        assets: filterAssets,
        dateRange
      });
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, filterType, filterSubExpense, filterCategories, filterAssets, dateRange]);

  const filteredTransactions = transactions; // Use results directly from server




  // V3 Transfer Reconciliation Hook
  const {
    candidates: transferCandidates,
    singleCandidates,
    handleLink: linkTransfer,
    handleConvert: convertTransfer,
    handleIgnore: ignoreTransfer,
    scanCandidates
  } = useTransferReconciler(transactions, assets, categories, loadData);

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
      const updates = txs.map(ptx => {
        const original = ptx.id === editingTransaction.id
          ? editingTransaction
          : transactions.find(t => t.id === ptx.id);

        if (!original) return null;
        return { ...original, ...ptx } as Transaction;
      }).filter(Boolean) as Transaction[];

      if (updates.length > 1) {
        handleUpdateTransactions(updates);
      } else if (updates.length === 1) {
        handleUpdateTransaction(editingTransaction, updates[0]);
      }
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
      const sourceId = crypto.randomUUID();
      const targetId = crypto.randomUUID();

      // 1. Source Transaction (Withdrawal from Bank)
      const sourceTx: Transaction = {
        id: sourceId,
        date: formData.date || new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        amount: payAmount,
        type: TransactionType.TRANSFER,
        category: formData.category || Category.TRANSFER,
        memo: formData.memo || `Credit Card Payoff: ${selectedItem.name}`,
        assetId: paymentAsset,
        toAssetId: selectedItem.id,
        linkedTransactionId: targetId
      };

      // 2. Target Transaction (Deposit/Debt reduction for Card)
      const targetTx: Transaction = {
        ...sourceTx,
        id: targetId,
        assetId: selectedItem.id,
        toAssetId: undefined,
        linkedTransactionId: sourceId
      };

      handleAddTransactions([sourceTx, targetTx]);
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
      const sourceId = crypto.randomUUID();
      const targetId = crypto.randomUUID();

      const sourceTx: Transaction = {
        id: sourceId,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        amount: amount,
        type: TransactionType.TRANSFER,
        category: Category.INVESTMENT,
        memo: `Goal: ${selectedItem.name}`,
        assetId: paymentAsset,
        toAssetId: destinationAsset || undefined,
        linkedTransactionId: targetId
      };

      if (sourceTx.toAssetId) {
        const targetTx: Transaction = {
          ...sourceTx,
          id: targetId,
          assetId: sourceTx.toAssetId,
          toAssetId: undefined,
          linkedTransactionId: sourceId
        };
        handleAddTransactions([sourceTx, targetTx]);
      } else {
        handleAddTransaction(sourceTx);
      }
      addToast('Funds added to goal', 'success');
    }

    closeModal();
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
      view={view}
      onNavigate={navigateTo}
      onImportClick={triggerImport}
      onImportFile={handleImportFile}
      onQuickAddClick={() => setShowSmartInput(true)}
      onAddAsset={() => window.dispatchEvent(new CustomEvent('open-asset-form'))}
    >
      <ModalContainer
        modalType={modalType}
        selectedItem={selectedItem}
        formData={formData}
        setFormData={setFormData}
        paymentAsset={paymentAsset}
        setPaymentAsset={setPaymentAsset}
        destinationAsset={destinationAsset}
        setDestinationAsset={setDestinationAsset}
        paymentError={paymentError}
        closeModal={closeModal}
        handleSubmit={handleSubmit}
        assets={assets}
        setRecurring={setRecurring}
        setGoals={setGoals}
        modalRef={modalRef}
      />

      {/* Reconciliation Modal (V3) */}
      <ReconciliationModal
        isOpen={isReconciliationModalOpen}
        onClose={() => setIsReconciliationModalOpen(false)}
        candidates={transferCandidates}
        singleCandidates={singleCandidates}
        assets={assets}
        categories={categories}
        onLink={linkTransfer}
        onConvert={convertTransfer}
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
      {view === 'assets' && <AssetManager assets={assets} transactions={transactions} onAdd={async (a) => {
        await SupabaseService.saveAsset(a);
        await SupabaseService.saveOpeningBalance({ asset_id: a.id, amount: a.initialBalance });
        setAssets(prev => [...prev, a]);
      }} onDelete={id => { SupabaseService.deleteAsset(id); setAssets(prev => prev.filter(a => a.id !== id)); }} onEdit={async (editedAsset) => {
        const oldAsset = assets.find(a => a.id === editedAsset.id);
        if (!oldAsset) return;

        const mode = (editedAsset as any)._adjustmentMode;
        const diff = editedAsset.balance - oldAsset.balance;

        if (mode === 'SETTING') {
          // 1. Historical Correction: Form already handled the shifting/logic
          const correctedAsset = { ...editedAsset };
          delete (correctedAsset as any)._adjustmentMode;
          await SupabaseService.saveAsset(correctedAsset);
          await SupabaseService.saveOpeningBalance({ asset_id: correctedAsset.id, amount: correctedAsset.initialBalance });
          setAssets(prev => prev.map(a => a.id === correctedAsset.id ? correctedAsset : a));
        } else {
          // 2. Spot Adjustment: Create transaction (Default behavior)
          const metadataOnly = { ...editedAsset, balance: oldAsset.balance };
          delete (metadataOnly as any)._adjustmentMode;
          await SupabaseService.saveAsset(metadataOnly);
          setAssets(prev => prev.map(a => a.id === metadataOnly.id ? metadataOnly : a));

          if (diff !== 0) {
            const tx: Transaction = {
              id: 'adj-' + Date.now(),
              date: new Date().toISOString().split('T')[0],
              amount: Math.abs(diff),
              type: diff > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
              category: Category.OTHER,
              memo: 'Manual Balance Adjustment',
              assetId: editedAsset.id,
            };
            await handleAddTransaction(tx);
          }
        }
      }} onPay={openPayCard}
        onClearHistory={async (assetId) => {
          try {
            await SupabaseService.deleteTransactionsByAsset(assetId);
            setTransactions(prev => prev.filter(t => t.assetId !== assetId && t.toAssetId !== assetId));

            // Also reset the asset balance in local state to its initialBalance (Source of Truth)
            const targetAsset = assets.find(a => a.id === assetId);
            setAssets(prev => prev.map(a => a.id === assetId ? { ...a, balance: targetAsset?.initialBalance || 0 } : a));

            addToast("History cleared and balance reset to 0.", 'success');
          } catch (e) {
            console.error("Failed to clear history", e);
            addToast("Failed to clear history. Please try again.", 'error');
          }
        }}
      />}
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
            filterSubExpense={filterSubExpense}
            onSubExpenseChange={setFilterSubExpense}
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
            onEdit={handleEditTransaction}
            onDelete={handleDeleteTransaction}
            onDeleteTransactions={handleDeleteTransactions}
            searchTerm={searchTerm}
            onLoadMore={fetchMoreTransactions}
            hasMore={hasMoreTransactions}
            isFetchingMore={isFetchingMore}
          />
        </ErrorBoundary>
      </div>}

      {view === 'settings' && <SettingsView onNavigate={navigateTo} />}

      {view === 'settings-categories' && <CategorySettings onNavigate={navigateTo} />}
      {view === 'settings-import' && <ImportSettings onNavigate={navigateTo} />}

      {/* Global Transfer Notification Toast */}
      <TransferNotificationToast
        count={transferCandidates.length + singleCandidates.length}
        onReview={() => setIsReconciliationModalOpen(true)}
      />
    </AppShell>
  );
};

export default App;
// Force Re-bundle