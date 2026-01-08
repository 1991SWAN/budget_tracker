import React, { useState, useMemo, useEffect } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Legend, CartesianGrid
} from 'recharts';
import { Transaction, TransactionType, Asset, RecurringTransaction, SavingsGoal, Category, BillType, AssetType } from '../types';
import TransactionItem from './TransactionItem';

interface DashboardProps {
  transactions: Transaction[];
  assets: Asset[];
  recurring: RecurringTransaction[];
  goals: SavingsGoal[];
  onRecurringChange?: (action: 'add' | 'update' | 'delete' | 'pay', item: any) => void;
  onGoalChange: (action: 'add' | 'update' | 'delete' | 'contribute', item: any) => void;
  onAddTransaction: (tx: Transaction) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
  monthlyBudget: number;
  onBudgetChange: (amount: number) => void;
  onNavigateToTransactions: (range?: { start: string, end: string }) => void;
  onAddBillToGroup?: (group: string) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

type DashboardTab = 'overview' | 'trends' | 'planning';
type Timeframe = 'weekly' | 'monthly';

const Dashboard: React.FC<DashboardProps> = ({ transactions, assets, recurring, goals, onRecurringChange, onGoalChange,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  monthlyBudget, onBudgetChange, onNavigateToTransactions, onAddBillToGroup }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [billFilter, setBillFilter] = useState<BillType>(BillType.SUBSCRIPTION);

  // Restored activityFilter state
  const [activityFilter, setActivityFilter] = useState<'today' | 'week' | 'month'>('today');

  // Local Timeframes for Trends Sections
  const [flowTimeframe, setFlowTimeframe] = useState<Timeframe>('monthly');
  const [trendTimeframe, setTrendTimeframe] = useState<Timeframe>('monthly');
  const [categoryTimeframe, setCategoryTimeframe] = useState<Timeframe>('monthly');

  const [billGroup, setBillGroup] = useState<string>('All');

  // 1. Constants & Helpers
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(date.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  };

  // Load custom groups from localStorage
  const [billGroups, setBillGroups] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('smartpenny_custom_groups');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to load bill groups", e);
      return [];
    }
  });

  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupInput, setNewGroupInput] = useState('');

  useEffect(() => {
    localStorage.setItem('smartpenny_custom_groups', JSON.stringify(billGroups));
  }, [billGroups]);

  const handleAddGroup = () => {
    if (newGroupInput.trim() && !billGroups.includes(newGroupInput.trim())) {
      const newGroup = newGroupInput.trim();
      setBillGroups([...billGroups, newGroup]);
      setBillGroup(newGroup);
      setNewGroupInput('');
      setIsAddingGroup(false);
    }
  };

  const handleDeleteGroup = (groupToDelete: string) => {
    const updatedGroups = billGroups.filter(g => g !== groupToDelete);
    setBillGroups(updatedGroups);
    if (billGroup === groupToDelete) {
      setBillGroup('All');
    }
  };

  const [modalType, setModalType] = useState<'bill' | 'goal' | 'pay-bill' | 'fund-goal' | 'budget' | 'pay-card' | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const [formData, setFormData] = useState<any>({});
  const [paymentAsset, setPaymentAsset] = useState<string>(assets.find(a => a.type !== AssetType.CREDIT_CARD)?.id || '');
  const [destinationAsset, setDestinationAsset] = useState<string>('');
  const [paymentError, setPaymentError] = useState<string | null>(null); // For insufficient funds

  const totalNetWorth = useMemo(() => assets.reduce((sum, a) => sum + a.balance, 0), [assets]);
  const totalMonthlyFixed = useMemo(() => recurring.reduce((sum, r) => sum + r.amount, 0), [recurring]);

  // Credit Card Specific: Next Settlement Balances
  const creditCardBills = useMemo(() => {
    return assets.filter(a => a.type === AssetType.CREDIT_CARD).map(card => {
      // Calculation could be improved to look at Billing Day vs Payment Day
      // For now, due amount is the current debt.
      return {
        ...card,
        dueAmount: Math.abs(card.balance)
      };
    });
  }, [assets]);

  const monthlyStats = useMemo(() => {
    const income = transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense };
  }, [transactions, currentMonth]);

  const safeToSpend = useMemo(() => {
    const budget = monthlyBudget;
    const remainingFixedBills = recurring.reduce((sum, bill) => {
      if (bill.dayOfMonth > today.getDate()) return sum + bill.amount;
      return sum;
    }, 0);
    // Include credit card payments in "fixed" if due this month
    const upcomingCardPayments = creditCardBills.reduce((sum, card) => {
      if (card.paymentDay && card.paymentDay > today.getDate()) return sum + card.dueAmount;
      return sum;
    }, 0);

    return budget - monthlyStats.expense - remainingFixedBills - upcomingCardPayments;
  }, [monthlyBudget, monthlyStats.expense, recurring, creditCardBills]);

  // Financial Flow Calculation (Income vs Outflow)
  // Depends on flowTimeframe, currentMonth, getStartOfWeek
  const financialFlow = useMemo(() => {
    let filteredTxs = transactions;
    if (flowTimeframe === 'weekly') {
      const start = getStartOfWeek(new Date());
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      filteredTxs = transactions.filter(t => { const d = new Date(t.date); return d >= start && d < end; });
    } else {
      filteredTxs = transactions.filter(t => t.date.startsWith(currentMonth));
    }

    const income = filteredTxs.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
    // Transfer Excluded from Bar as requested
    // const transfer = ...

    const isDeficit = expense > income;
    // Base is Income. If deficit, Base is Expense (so bar is full red).
    const base = isDeficit ? expense : (income > 0 ? income : 1);

    return { income, expense, isDeficit, base };
  }, [transactions, flowTimeframe, currentMonth]);

  const categoryDataOverview = useMemo(() => {
    const data: Record<string, number> = {};
    transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === TransactionType.EXPENSE)
      .forEach(t => {
        const cat = t.category || 'Other';
        data[cat] = (data[cat] || 0) + t.amount;
      });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, currentMonth]);

  const filteredBills = useMemo(() => {
    let bills = recurring.filter(b => (b.billType || BillType.SUBSCRIPTION) === billFilter);
    return bills.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  }, [recurring, billFilter]);


  const filteredActivityTransactions = useMemo(() => {
    if (activityFilter === 'today') {
      return transactions.filter(t => t.date === todayStr);
    } else if (activityFilter === 'week') {
      const start = getStartOfWeek(new Date());
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return transactions.filter(t => {
        const d = new Date(t.date);
        return d >= start && d < end;
      });
    } else {
      return transactions.filter(t => t.date.startsWith(currentMonth));
    }
  }, [transactions, activityFilter, todayStr, currentMonth]);

  const weeklyTransactions = useMemo(() => {
    const start = getStartOfWeek(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d >= start && d < end;
    });
  }, [transactions]);

  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(currentMonth));
  }, [transactions, currentMonth]);

  const generateChartData = (txs: Transaction[], period: Timeframe) => {
    const income = txs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    const catMap: Record<string, number> = {};
    txs.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      const c = t.category || 'Other';
      catMap[c] = (catMap[c] || 0) + t.amount;
    });
    const categories = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    let trend: { label: string | number, amount: number }[] = [];
    if (period === 'monthly') {
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      trend = new Array(daysInMonth).fill(0).map((_, i) => ({ label: `${i + 1}`, amount: 0 }));
      txs.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
        const d = parseInt(t.date.split('-')[2]);
        if (trend[d - 1]) trend[d - 1].amount += t.amount;
      });
      trend = trend.slice(0, today.getDate());
    } else {
      const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      trend = weekDays.map(day => ({ label: day, amount: 0 }));
      txs.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
        const d = new Date(t.date);
        let dayIndex = d.getDay() - 1;
        if (dayIndex === -1) dayIndex = 6;
        if (trend[dayIndex]) trend[dayIndex].amount += t.amount;
      });
    }
    return { income, expense, categories, trend };
  };

  const weeklyData = useMemo(() => generateChartData(weeklyTransactions, 'weekly'), [weeklyTransactions]);
  const monthlyData = useMemo(() => generateChartData(monthlyTransactions, 'monthly'), [monthlyTransactions]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case Category.FOOD: return '🍔';
      case Category.TRANSPORT: return '🚌';
      case Category.SHOPPING: return '🛍️';
      case Category.HOUSING: return '🏠';
      case Category.UTILITIES: return '⚡';
      case Category.HEALTH: return '🏥';
      case Category.ENTERTAINMENT: return '🎬';
      case Category.SALARY: return '💰';
      case Category.TRANSFER: return '💸';
      default: return '📦';
    }
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
    if (modalType === 'budget') { onBudgetChange(Number(formData.amount)); closeModal(); return; }

    // Insufficient Funds Check for payments
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
        date: todayStr,
        amount: payAmount,
        type: TransactionType.TRANSFER,
        category: Category.TRANSFER,
        memo: `Credit Card Payoff: ${selectedItem.name}`,
        assetId: paymentAsset,
        toAssetId: selectedItem.id,
        // emoji: '💳'
      };
      onAddTransaction(tx);
      closeModal();
      return;
    }
    if (!onRecurringChange || !onGoalChange) return;
    if (modalType === 'bill') {
      const action = selectedItem ? 'update' : 'add';
      onRecurringChange(action, { id: selectedItem?.id, name: formData.name, amount: Number(formData.amount), dayOfMonth: Number(formData.dayOfMonth), category: formData.category, billType: formData.billType });
    } else if (modalType === 'goal') {
      const action = selectedItem ? 'update' : 'add';
      onGoalChange(action, {
        id: selectedItem?.id,
        name: formData.name,
        targetAmount: Number(formData.targetAmount),
        emoji: formData.emoji,
        deadline: formData.deadline || new Date().toISOString().split('T')[0],
        currentAmount: selectedItem?.currentAmount || 0
      });
    } else if (modalType === 'pay-bill') {
      onRecurringChange('pay', { id: selectedItem.id, name: selectedItem.name, amount: selectedItem.amount, category: selectedItem.category, assetId: paymentAsset });
    } else if (modalType === 'fund-goal') {
      onGoalChange('contribute', { id: selectedItem.id, name: selectedItem.name, amount: Number(formData.amount), assetId: paymentAsset, toAssetId: destinationAsset || undefined });
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
                        `Add Funds: ${selectedItem?.name}`}
            </h3>
            <button onClick={closeModal} className="text-xl">✖️</button>
          </div>
          <div className="space-y-4">
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
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">Day of Month:</span>
                  <input type="number" min="1" max="31" value={formData.dayOfMonth} onChange={e => setFormData({ ...formData, dayOfMonth: e.target.value })} className="w-20 p-2 border rounded-lg" />
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
                <p className="text-sm text-slate-500 mb-2">Set your total monthly budget or expected income. This calculates your "Safe to Spend" amount.</p>
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

            <div className="flex gap-2 pt-4">
              {(modalType === 'bill' || modalType === 'goal') && selectedItem && <button onClick={() => { if (modalType === 'bill' && onRecurringChange) onRecurringChange('delete', { id: selectedItem.id }); if (modalType === 'goal' && onGoalChange) onGoalChange('delete', { id: selectedItem.id }); closeModal(); }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg mr-auto text-xl">🗑️</button>}
              <button onClick={closeModal} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button onClick={handleSubmit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                {modalType === 'pay-bill' || modalType === 'pay-card' ? 'Confirm Payment' : modalType === 'fund-goal' ? 'Add Funds' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div onClick={openEditBudget} className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="text-8xl">🛡️</span></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2 text-blue-100"><div className="flex items-center gap-2"><span>🛡️</span><span className="font-semibold text-sm uppercase tracking-wider">Safe to Spend</span></div></div>
            <h2 className="text-4xl font-bold mb-1">{safeToSpend.toLocaleString()} <span className="text-xl font-normal opacity-80">KRW</span></h2>
            <p className="text-sm text-blue-100 opacity-90">Remaining after upcoming bills & card payments.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-500 mb-2"><span>💼</span><span className="text-xs font-bold uppercase">Net Worth</span></div>
            <p className="text-xl font-bold text-slate-900">{totalNetWorth.toLocaleString()}</p>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-500 mb-2"><span>📉</span><span className="text-xs font-bold uppercase">Expenses</span></div>
            <p className="text-xl font-bold text-slate-900">{monthlyStats.expense.toLocaleString()}</p>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-500 mb-2"><span>🗓️</span><span className="text-xs font-bold uppercase">Fixed Bills</span></div>
            <p className="text-xl font-bold text-slate-900">{totalMonthlyFixed.toLocaleString()}</p>
          </div>
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center cursor-pointer hover:bg-slate-50" onClick={() => setActiveTab('trends')}>
            <div className="flex items-center gap-2 text-slate-500 mb-2"><span>📊</span><span className="text-xs font-bold uppercase">Top Category</span></div>
            <p className="text-lg font-bold text-slate-900 truncate">{categoryDataOverview[0]?.name || 'N/A'}</p>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h3 onClick={() => onNavigateToTransactions()} className="font-bold text-lg text-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-2 transition-colors group">Activity<span className="opacity-0 group-hover:opacity-100 text-sm">↗️</span></h3>
          <button onClick={() => { const o: any[] = ['today', 'week', 'month']; setActivityFilter(o[(o.indexOf(activityFilter) + 1) % o.length]); }} className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full capitalize">{activityFilter}</button>
        </div>
        <div className="space-y-0 relative">
          {/* Add a subtle line connector for visual flow if desired, or just list items */}
          {filteredActivityTransactions.slice(0, 10).map((t) => (
            <TransactionItem
              key={t.id}
              transaction={t}
              asset={assets.find(a => a.id === t.assetId)}
              toAsset={t.toAssetId ? assets.find(a => a.id === t.toAssetId) : undefined}
              onEdit={onEditTransaction}
              onDelete={onDeleteTransaction}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const renderPlanning = () => {
    // Generate days for the current month
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

        {/* 1. Visual Calendar Strip */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><span>🗓️</span> Monthly Schedule</h3>
            <div className="text-sm text-slate-400 font-medium">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-4 pt-2 px-2 scrollbar-hide snap-x">
            {days.map(day => {
              const isToday = day === today.getDate();
              // Find bills due on this day
              const billsOnDay = recurring.filter(r => r.dayOfMonth === day);
              const hasBill = billsOnDay.length > 0;

              return (
                <div key={day} className={`flex-shrink-0 w-14 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 border snap-center transition-all ${isToday ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                  <span className="text-xs font-medium uppercase">{new Date(today.getFullYear(), today.getMonth(), day).toLocaleString('default', { weekday: 'short' })}</span>
                  <span className={`text-xl font-bold ${isToday ? 'text-white' : 'text-slate-800'}`}>{day}</span>
                  <div className="h-1.5 flex gap-0.5">
                    {hasBill && <div className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-rose-400'}`}></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Split View: Upcoming Bills & Goals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Upcoming Bills List */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-96 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-800"><span>📫</span><h3 className="font-bold text-lg">Upcoming Bills</h3></div>
            </div>

            {/* Tabs for Bill Groups */}
            <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 scrollbar-hide items-center relative">
              {['All', ...billGroups].map(group => (
                <button
                  key={group}
                  onClick={() => setBillGroup(group)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${billGroup === group
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                >
                  {group}
                  {group !== 'All' && billGroup === group && (
                    <span
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                      className="ml-1 hover:bg-indigo-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                    >
                      ✕
                    </span>
                  )}
                </button>
              ))}

              <div className="relative">
                <button
                  onClick={() => setIsAddingGroup(!isAddingGroup)}
                  className="px-2 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center w-8 h-8"
                >
                  ➕
                </button>
                {isAddingGroup && (
                  <div className="absolute top-0 left-full ml-2 bg-white p-2 rounded-xl shadow-xl border border-slate-100 flex items-center gap-2 z-10 w-48 animate-in fade-in zoom-in duration-200 origin-left">
                    <input
                      type="text"
                      autoFocus
                      placeholder="Group Name"
                      value={newGroupInput}
                      onChange={(e) => setNewGroupInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddGroup(); if (e.key === 'Escape') setIsAddingGroup(false); }}
                      className="w-full text-xs p-1.5 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                    />
                    <button onClick={handleAddGroup} className="bg-indigo-600 text-white p-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700">Add</button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto pr-2 scrollbar-thin flex-1">
              {recurring
                .filter(bill => billGroup === 'All' || (bill.groupName || 'Default') === billGroup)
                .sort((a, b) => {
                  const aDiff = a.dayOfMonth - today.getDate();
                  const bDiff = b.dayOfMonth - today.getDate();
                  if ((aDiff >= 0 && bDiff >= 0) || (aDiff < 0 && bDiff < 0)) return a.dayOfMonth - b.dayOfMonth;
                  return aDiff >= 0 ? -1 : 1;
                })
                .map((bill) => (
                  <div key={bill.id} className="flex flex-col p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer group" onClick={() => openEditBill(bill)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 flex flex-col items-center justify-center rounded-lg text-xs font-bold ${bill.dayOfMonth === today.getDate() ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                          <span className="text-[9px] uppercase">Day</span>{bill.dayOfMonth}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{bill.name}</p>
                          <p className="text-[10px] text-slate-500">{bill.groupName || 'Default'} • {bill.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-800 block text-sm">{bill.amount.toLocaleString()}</span>
                        <button onClick={(e) => { e.stopPropagation(); openPayBill(bill); }} className="px-3 py-1 mt-1 bg-white border border-slate-200 text-[10px] font-bold text-slate-600 rounded-md hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors">Pay</button>
                      </div>
                    </div>
                  </div>
                ))}
              {recurring.length === 0 && <div className="text-center text-slate-400 py-10">No bills added yet.</div>}
              {recurring.length > 0 && recurring.filter(bill => billGroup === 'All' || (bill.groupName || 'Default') === billGroup).length === 0 && (
                <div className="text-center text-slate-400 py-10 flex flex-col items-center gap-2">
                  <p>No bills in <strong>{billGroup}</strong>.</p>
                  {billGroup !== 'All' && (
                    <button
                      onClick={() => onAddBillToGroup && onAddBillToGroup(billGroup)}
                      className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition-colors"
                    >
                      + Add Bill to {billGroup}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Goals Tracker */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-96 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-800"><span>🎯</span><h3 className="font-bold text-lg">Goals Tracker</h3></div>
              <button onClick={openAddGoal} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-lg">➕</button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-2 scrollbar-thin">
              {goals.map((goal) => (
                <div key={goal.id} className="group p-1">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEditGoal(goal)}>
                      <span className="text-3xl bg-slate-50 p-2 rounded-xl">{goal.emoji}</span>
                      <div>
                        <p className="font-bold text-slate-700">{goal.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Target: {goal.targetAmount.toLocaleString()} KRW</p>
                      </div>
                    </div>
                    <button onClick={() => openFundGoal(goal)} className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">+ Add Funds</button>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex items-center px-0.5">
                    <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)}%` }}></div>
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] font-bold text-slate-400">
                    <span>{Math.round((goal.currentAmount / goal.targetAmount) * 100)}%</span>
                    <span>{goal.currentAmount.toLocaleString()} / {goal.targetAmount.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {goals.length === 0 && <div className="text-center text-slate-400 py-10">No goals set yet.</div>}
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="flex flex-col h-full relative">
      {renderModals()}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl mb-6 self-start">
        {['overview', 'trends', 'planning'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{tab}</button>
        ))}
      </div>
      <div className="flex-1 pb-12">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'trends' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* 1. New Financial Flow Analysis (Income Bar) */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><span>💸</span> Financial Flow</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {financialFlow.isDeficit
                      ? <span className="text-rose-500 font-bold">Deficit Warning: Spending exceeds Income!</span>
                      : <span>You have used <strong>{Math.round((financialFlow.expense / financialFlow.base) * 100)}%</strong> of your income.</span>}
                  </p>
                </div>
                {/* Local Toggle for Flow */}
                <button
                  onClick={() => setFlowTimeframe(prev => prev === 'monthly' ? 'weekly' : 'monthly')}
                  className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full capitalize hover:bg-slate-200 transition-colors"
                >
                  {flowTimeframe}
                </button>
              </div>

              {/* 2-Color Bar Viz (Expense vs Income) */}
              <div className="w-full h-8 bg-slate-50 rounded-xl overflow-hidden flex relative border border-slate-100">
                {/* Expense Segment (Red) */}
                <div
                  className="h-full bg-rose-500 flex items-center justify-center text-[10px] font-bold text-white transition-all duration-1000 cursor-pointer group relative"
                  style={{ width: `${(financialFlow.expense / financialFlow.base) * 100}%` }}
                >
                  {/* Hover Tooltip */}
                  <div className="absolute bottom-full mb-1 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    Expense: {financialFlow.expense.toLocaleString()}
                  </div>
                  {financialFlow.expense > 0 && ((financialFlow.expense / financialFlow.base) > 0.1) && `${Math.round((financialFlow.expense / financialFlow.base) * 100)}%`}
                </div>

                {/* Remaining Segment (Green/White) - Savings */}
                {!financialFlow.isDeficit && (
                  <div
                    className="h-full bg-emerald-400 flex items-center justify-center text-[10px] font-bold text-white transition-all duration-1000 cursor-pointer group relative"
                    style={{ flex: 1 }} // Take remaining space
                  >
                    {/* Hover Tooltip */}
                    <div className="absolute bottom-full mb-1 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Savings: {(financialFlow.income - financialFlow.expense).toLocaleString()}
                    </div>
                    {/* Only show % if decent size */}
                    {((financialFlow.income - financialFlow.expense) / financialFlow.base > 0.1) &&
                      `${Math.round(((financialFlow.income - financialFlow.expense) / financialFlow.base) * 100)}%`}
                  </div>
                )}
              </div>

              {/* Legend with Total Income context */}
              <div className="flex justify-between mt-2 text-xs font-medium text-slate-500">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Expense</span>
                  {!financialFlow.isDeficit && <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Savings</span>}
                </div>
                <div>Total Income: <span className="text-emerald-600 font-bold">{financialFlow.income.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 2. Spending Trend Chart (Local Toggle) */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-80">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg text-slate-800">Spending Trend</h3>
                  <button
                    onClick={() => setTrendTimeframe(prev => prev === 'monthly' ? 'weekly' : 'monthly')}
                    className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full capitalize hover:bg-slate-200 transition-colors"
                  >
                    {trendTimeframe}
                  </button>
                </div>
                <ResponsiveContainer width="100%" height="80%" key={`trend-bar-${trendTimeframe}`}>
                  <BarChart data={trendTimeframe === 'weekly' ? weeklyData.trend : monthlyData.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 3. Category Breakdown (Local Toggle) */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-80 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-slate-800">By Category</h3>
                  <button
                    onClick={() => setCategoryTimeframe(prev => prev === 'monthly' ? 'weekly' : 'monthly')}
                    className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full capitalize hover:bg-slate-200 transition-colors"
                  >
                    {categoryTimeframe}
                  </button>
                </div>
                <div className="flex items-center justify-center flex-1">
                  <ResponsiveContainer width="100%" height="100%" key={`category-pie-${categoryTimeframe}`}>
                    <PieChart>
                      <Pie
                        data={categoryTimeframe === 'weekly' ? weeklyData.categories : monthlyData.categories}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {(categoryTimeframe === 'weekly' ? weeklyData.categories : monthlyData.categories).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value.toLocaleString()} contentStyle={{ borderRadius: '12px' }} />
                      <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 4. Insights */}
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white p-6 rounded-3xl shadow-lg flex items-start gap-4">
              <div className="bg-white/20 p-3 rounded-full text-2xl">✨</div>
              <div>
                <h3 className="font-bold text-lg mb-1">Smart Insight</h3>
                <p className="text-white/90 text-sm leading-relaxed">
                  Analysis for <strong>{trendTimeframe}</strong> view:
                  {trendTimeframe === 'monthly'
                    ? " Your top spending category is Food. Try reducing dining out."
                    : " You spent 20% less this week compared to last week. Good job!"}
                </p>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'planning' && renderPlanning()}
      </div>
    </div>
  );
};

export default Dashboard;
