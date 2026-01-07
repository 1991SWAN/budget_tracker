import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction, Asset, View, TransactionType, Category, RecurringTransaction, SavingsGoal, BillType, AssetType } from './types';
import { StorageService } from './services/storageService';
import { ImportService } from './services/importService';
import Dashboard from './components/Dashboard';
import AssetManager from './components/AssetManager';
import SmartInput from './components/SmartInput';
import { GeminiService } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
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
    setTransactions(StorageService.getTransactions());
    setAssets(StorageService.getAssets());
    setRecurring(StorageService.getRecurringExpenses());
    setGoals(StorageService.getSavingsGoals());
    setMonthlyBudget(StorageService.getBudget());
  }, []);

  useEffect(() => { StorageService.saveTransactions(transactions); }, [transactions]);
  useEffect(() => { StorageService.saveAssets(assets); }, [assets]);
  useEffect(() => { StorageService.saveRecurringExpenses(recurring); }, [recurring]);
  useEffect(() => { StorageService.saveSavingsGoals(goals); }, [goals]);
  useEffect(() => { StorageService.saveBudget(monthlyBudget); }, [monthlyBudget]);

  const handleAddTransaction = (newTx: Transaction) => {
    setTransactions(prev => [newTx, ...prev]);
    updateAssetsWithTransaction(newTx);
  };

  const updateAssetsWithTransaction = (tx: Transaction, multiplier: number = 1) => {
      setAssets(prev => prev.map(a => {
        // Direct Impact
        if (a.id === tx.assetId && !tx.toAssetId) {
            const change = tx.type === TransactionType.INCOME ? tx.amount : -tx.amount;
            return { ...a, balance: a.balance + (change * multiplier) };
        }
        // Transfer Impact
        if (tx.type === TransactionType.TRANSFER) {
            if (a.id === tx.assetId) return { ...a, balance: a.balance - (tx.amount * multiplier) };
            if (a.id === tx.toAssetId) return { ...a, balance: a.balance + (tx.amount * multiplier) };
        }
        return a;
      }));
  };

  const handleUpdateTransaction = (oldTx: Transaction, newTx: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === newTx.id ? newTx : t));
    
    // Asset Rebalancing logic
    setAssets(prev => {
         const assetMap = new Map<string, Asset>(prev.map(a => [a.id, { ...a }]));
         const applyEffect = (tx: Transaction, mult: number) => {
             if (tx.type === TransactionType.TRANSFER) {
                 const f = assetMap.get(tx.assetId); if (f) f.balance -= tx.amount * mult;
                 const t = tx.toAssetId ? assetMap.get(tx.toAssetId) : null; if (t) t.balance += tx.amount * mult;
             } else {
                 const a = assetMap.get(tx.assetId);
                 if (a) {
                    const change = tx.type === TransactionType.INCOME ? tx.amount : -tx.amount;
                    a.balance += change * mult;
                 }
             }
        };
        applyEffect(oldTx, -1); applyEffect(newTx, 1);
        return Array.from(assetMap.values());
    });
  };

  /**
   * Safe Delete with Cascading Update for Linked Transfers
   */
  const handleDeleteTransaction = (tx: Transaction) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;

    let updatedTransactions = transactions.filter(t => t.id !== tx.id);
    let linkedTx: Transaction | undefined;

    // 1. Check for Linked Transaction (Transfer Partner)
    if (tx.linkedTransactionId) {
        linkedTx = transactions.find(t => t.id === tx.linkedTransactionId);
        if (linkedTx) {
            // Unlink the partner
            const unlinkedPartner: Transaction = {
                ...linkedTx,
                linkedTransactionId: undefined,
                toAssetId: undefined,
                // Revert type: If I was Transferring OUT, Partner was Transferring IN.
                // Partner becomes pure INCOME.
                type: linkedTx.amount > 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
                category: Category.OTHER, // Safest fallback
                memo: linkedTx.memo.replace(' (Transfer)', '') // Optional cleanup
            };
            
            updatedTransactions = updatedTransactions.map(t => t.id === unlinkedPartner.id ? unlinkedPartner : t);
            alert("This was a linked transfer. The counterpart transaction has been unlinked and set to 'Other'.");
        }
    }

    setTransactions(updatedTransactions);

    // 2. Update Assets (Reverse the effect of the deleted transaction)
    updateAssetsWithTransaction(tx, -1);
  };

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
            id: `inst-bill-${tx.id}`, name: `${tx.memo} (Installment)`, amount: tx.installment.monthlyAmount || Math.floor(tx.amount/tx.installment.totalMonths), dayOfMonth: new Date(tx.date).getDate(), category: tx.category as Category, billType: BillType.INSTALLMENT, installmentDetails: { startDate: tx.date, totalAmount: tx.amount, totalMonths: tx.installment.totalMonths, isInterestFree: tx.installment.isInterestFree }
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
            
            setTransactions(prev => {
                const updatedIds = new Set(updatedExistingTxs.map(t => t.id));
                const filteredPrev = prev.filter(t => !updatedIds.has(t.id));
                return [...finalNewTxs, ...updatedExistingTxs, ...filteredPrev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });

            finalNewTxs.forEach(tx => updateAssetsWithTransaction(tx));
            alert(`Success! Imported ${finalNewTxs.length} transactions.\nMatched ${updatedExistingTxs.length} transfers.`);
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
        // ... (existing implementation)
        const action = selectedItem ? 'update' : 'add';
        const data = { id: selectedItem?.id, name: formData.name, amount: Number(formData.amount), dayOfMonth: Number(formData.dayOfMonth), category: formData.category, billType: formData.billType };
        if (action === 'add') setRecurring(prev => [...prev, {...data, id: Date.now().toString()}]); 
        else if (action === 'update') setRecurring(prev => prev.map(r => r.id === data.id ? {...r, ...data} : r)); 
    } else if (modalType === 'goal') {
        // ... (existing implementation)
        const action = selectedItem ? 'update' : 'add';
        const data = { id: selectedItem?.id, name: formData.name, targetAmount: Number(formData.targetAmount), emoji: formData.emoji, deadline: formData.deadline };
        if (action === 'add') setGoals(prev => [...prev, {...data, id: Date.now().toString()}]);
        else if (action === 'update') setGoals(prev => prev.map(g => g.id === data.id ? {...g, ...data} : g));
    } else if (modalType === 'pay-bill') {
        handleAddTransaction({ id: 'bp-'+Date.now(), date: new Date().toISOString().split('T')[0], amount: selectedItem.amount, type: TransactionType.EXPENSE, category: selectedItem.category, memo: `Bill Pay: ${selectedItem.name}`, assetId: paymentAsset, emoji: '⚡' });
    } else if (modalType === 'fund-goal') {
        const amount = Number(formData.amount);
        setGoals(prev => prev.map(g => g.id === selectedItem.id ? {...g, currentAmount: g.currentAmount + amount} : g));
        handleAddTransaction({ id: 'gc-'+Date.now(), date: new Date().toISOString().split('T')[0], amount: amount, type: TransactionType.TRANSFER, category: Category.INVESTMENT, memo: `Goal: ${selectedItem.name}`, assetId: paymentAsset, toAssetId: destinationAsset || undefined, emoji: '💰' });
    }

    closeModal();
  };

  const renderModals = () => {
    if (!modalType) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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
                <input type="text" placeholder="Bill Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                <input type="number" placeholder="Amount" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-2 border rounded-lg" />
                <div className="flex gap-2">
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="flex-1 p-2 border rounded-lg">
                    {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={formData.billType} onChange={e => setFormData({...formData, billType: e.target.value})} className="flex-1 p-2 border rounded-lg">
                    {Object.values(BillType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-sm text-slate-500">Day of Month:</span>
                   <input type="number" min="1" max="31" value={formData.dayOfMonth} onChange={e => setFormData({...formData, dayOfMonth: e.target.value})} className="w-20 p-2 border rounded-lg" />
                </div>
              </>
            )}
            {modalType === 'pay-card' && (
              <>
                <p className="text-sm text-slate-500 mb-2">Pay off your credit card debt from another account.</p>
                <input type="number" placeholder="Payment Amount" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-4 border border-rose-200 bg-rose-50 rounded-xl font-bold text-2xl text-rose-900 focus:outline-none" />
                <label className="block text-xs font-semibold text-slate-500 uppercase">Withdraw From</label>
                <select value={paymentAsset} onChange={e => setPaymentAsset(e.target.value)} className="w-full p-2 border rounded-lg">
                   {assets.filter(a => a.type !== AssetType.CREDIT_CARD).map(a => <option key={a.id} value={a.id}>{a.name} ({a.balance.toLocaleString()})</option>)}
                </select>
              </>
            )}
            {modalType === 'goal' && (
              <>
                <input type="text" placeholder="Goal Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2 border rounded-lg" />
                <input type="number" placeholder="Target Amount" value={formData.targetAmount} onChange={e => setFormData({...formData, targetAmount: e.target.value})} className="w-full p-2 border rounded-lg" />
                <div className="flex gap-2">
                   <input type="text" placeholder="Emoji" value={formData.emoji} onChange={e => setFormData({...formData, emoji: e.target.value})} className="w-20 p-2 border rounded-lg" />
                   <input type="date" value={formData.deadline || ''} onChange={e => setFormData({...formData, deadline: e.target.value})} className="flex-1 p-2 border rounded-lg" />
                </div>
              </>
            )}
            {modalType === 'budget' && (
              <>
                <p className="text-sm text-slate-500 mb-2">Set your total monthly budget or expected income.</p>
                <input type="number" placeholder="e.g. 3,000,000" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-4 border border-blue-200 bg-blue-50 rounded-xl font-bold text-2xl text-blue-900 focus:outline-none" autoFocus />
              </>
            )}
            {(modalType === 'pay-bill' || modalType === 'fund-goal') && (
              <>
                {modalType === 'fund-goal' && <input type="number" placeholder="Amount to Add" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full p-2 border rounded-lg font-bold text-lg" autoFocus />}
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
                    if(modalType === 'bill') { setRecurring(prev => prev.filter(r => r.id !== selectedItem.id)); }
                    if(modalType === 'goal') { setGoals(prev => prev.filter(g => g.id !== selectedItem.id)); }
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
            {showSmartInput && <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"><div className="w-full max-w-lg md:max-w-3xl my-auto"><SmartInput onTransactionsParsed={handleSmartParsed} onCancel={() => setShowSmartInput(false)} assets={assets} initialData={editingTransaction}/></div></div>}
            {view === 'dashboard' && <Dashboard transactions={transactions} assets={assets} recurring={recurring} goals={goals} onRecurringChange={(action, item) => { if (action === 'delete' && item.id) setRecurring(prev => prev.filter(r => r.id !== item.id)); else if (action === 'add') setRecurring(prev => [...prev, {...item, id: Date.now().toString()}]); else if (action === 'update') setRecurring(prev => prev.map(r => r.id === item.id ? {...r, ...item} : r)); else if (action === 'pay') { handleAddTransaction({ id: 'bp-'+Date.now(), date: new Date().toISOString().split('T')[0], amount: item.amount, type: TransactionType.EXPENSE, category: item.category, memo: `Bill Pay: ${item.name}`, assetId: item.assetId, emoji: '⚡' }); } }} onGoalChange={(action, item) => { if (action === 'delete' && item.id) setGoals(prev => prev.filter(g => g.id !== item.id)); else if (action === 'add') setGoals(prev => [...prev, {...item, id: Date.now().toString()}]); else if (action === 'update') setGoals(prev => prev.map(g => g.id === item.id ? {...g, ...item} : g)); else if (action === 'contribute') { setGoals(prev => prev.map(g => g.id === item.id ? {...g, currentAmount: g.currentAmount + item.amount} : g)); handleAddTransaction({ id: 'gc-'+Date.now(), date: new Date().toISOString().split('T')[0], amount: item.amount, type: TransactionType.TRANSFER, category: Category.INVESTMENT, memo: `Goal: ${item.name}`, assetId: item.assetId, toAssetId: item.toAssetId, emoji: '💰' }); } }} onAddTransaction={handleAddTransaction} monthlyBudget={monthlyBudget} onBudgetChange={setMonthlyBudget} onNavigateToTransactions={(range) => { if(range) setDateRange(range); setView('transactions'); }}/>}
            {view === 'assets' && <AssetManager assets={assets} transactions={transactions} onAdd={a => setAssets(prev => [...prev, a])} onDelete={id => setAssets(prev => prev.filter(a => a.id !== id))} onEdit={a => setAssets(prev => prev.map(old => old.id === a.id ? a : old))}/>}
            {view === 'transactions' && <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">Transactions</h2>
                    {dateRange && (
                        <div className="flex items-center gap-2">
                             <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">
                                {dateRange.start} ~ {dateRange.end}
                             </span>
                             <button onClick={() => setDateRange(null)} className="text-xs bg-slate-200 text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-300">
                                Clear
                             </button>
                        </div>
                    )}
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4"><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500" /></div>
                    <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="p-4">Date</th><th className="p-4">Memo</th><th className="p-4">Asset</th><th className="p-4 text-right">Amount</th><th className="p-4">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{transactions.filter(t => {
                        const matchesSearch = t.memo.toLowerCase().includes(searchTerm.toLowerCase());
                        const matchesDate = dateRange ? (t.date >= dateRange.start && t.date <= dateRange.end) : true;
                        return matchesSearch && matchesDate;
                    }).map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/50 group"><td className="p-4 text-sm text-slate-600">{t.date}</td><td className="p-4 font-medium text-slate-900">{t.memo}</td><td className="p-4 text-sm text-slate-500">{assets.find(a => a.id === t.assetId)?.name}</td><td className={`p-4 text-right font-bold ${t.type === TransactionType.INCOME ? 'text-emerald-600' : t.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-blue-600'}`}>{t.type === TransactionType.INCOME ? '+' : t.type === TransactionType.EXPENSE ? '-' : ''}{t.amount.toLocaleString()}</td><td className="p-4 flex gap-2">
                            <button onClick={() => { setEditingTransaction(t); setShowSmartInput(true); }} className="text-slate-400 hover:text-blue-500 transition-colors p-1" title="Edit">✏️</button>
                            <button onClick={() => handleDeleteTransaction(t)} className="text-slate-400 hover:text-rose-500 transition-colors p-1" title="Delete">🗑️</button>
                        </td></tr>
                    ))}</tbody></table></div>
                </div>
            </div>}
        </div></div>
      </main>
    </div>
  );
};

export default App;