import React, { useMemo } from 'react';
import { Transaction, Asset, RecurringTransaction, TransactionType, AssetType } from '../../types';
import TransactionItem from '../TransactionItem';
import { FinanceCalculator } from '../../services/financeCalculator';

interface OverviewTabProps {
    transactions: Transaction[];
    assets: Asset[];
    recurring: RecurringTransaction[];
    monthlyBudget: number;
    onOpenBudgetModal: () => void;
    onNavigateToTransactions: () => void;
    onNavigateToAssets: () => void;
    onNavigateToWeb?: () => void;
    onEditTransaction: (tx: Transaction) => void;
    onDeleteTransaction: (tx: Transaction) => void;
    onFilterChange: (filter: 'today' | 'week' | 'month') => void;
    activityFilter: 'today' | 'week' | 'month';
}

const OverviewTab: React.FC<OverviewTabProps> = ({
    transactions, assets, recurring, monthlyBudget,
    onOpenBudgetModal, onNavigateToTransactions, onNavigateToAssets, onEditTransaction, onDeleteTransaction,
    onFilterChange, activityFilter
}) => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // --- Statistics ---
    const monthlyStats = useMemo(() => {
        const income = transactions
            .filter(t => t.date.startsWith(currentMonth) && t.type === TransactionType.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = transactions
            .filter(t => t.date.startsWith(currentMonth) && t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);
        return { income, expense };
    }, [transactions, currentMonth]);

    const totalNetWorth = useMemo(() => assets.reduce((sum, a) => sum + a.balance, 0), [assets]);
    const totalMonthlyFixed = useMemo(() => recurring.reduce((sum, r) => sum + r.amount, 0), [recurring]);

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

    // --- Safe To Spend Calculation (Refactored) ---
    const safeToSpend = useMemo(() => {
        const budget = monthlyBudget;

        // 1. Remaining Fixed Bills (Non-Credit Card Recurring)
        const remainingFixedBills = recurring.reduce((sum, bill) => {
            // If bill is due later this month
            if (bill.dayOfMonth > today.getDate()) return sum + bill.amount;
            return sum;
        }, 0);

        // 2. Upcoming Credit Card Payments (Using FinanceCalculator)
        const upcomingCardPayments = assets
            .filter(a => a.type === AssetType.CREDIT_CARD)
            .reduce((sum, card) => {
                // Calculate Statement Balance (Next Bill)
                const { statementBalance } = FinanceCalculator.calculateCreditCardBalances(card, transactions, today);
                // Only count if payment day is in the future relative to today?
                // Logic check: Statement Balance is what is "Due" for the *previous* cycle usually.
                // If today < PaymentDay, we still owe it.
                // Dashboard logic was: if (card.paymentDay > today.getDate()) return sum + dueAmount;
                // We will keep that logic but use accurate statementBalance
                if (card.creditDetails?.billingCycle.paymentDay && card.creditDetails.billingCycle.paymentDay > today.getDate()) {
                    return sum + statementBalance;
                }
                return sum;
            }, 0);

        return budget - monthlyStats.expense - remainingFixedBills - upcomingCardPayments;
    }, [monthlyBudget, monthlyStats.expense, recurring, assets, transactions, today]);

    // --- Activity List ---
    const getStartOfWeek = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(date.setDate(diff));
        start.setHours(0, 0, 0, 0);
        return start;
    };

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

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Safe to Spend Card */}
                <div onClick={onOpenBudgetModal} className="bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="text-8xl">🛡️</span></div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2 text-blue-100"><div className="flex items-center gap-2"><span>🛡️</span><span className="font-semibold text-sm uppercase tracking-wider">Safe to Spend</span></div></div>
                        <h2 className="text-4xl font-bold mb-1">{safeToSpend.toLocaleString()} <span className="text-xl font-normal opacity-80">KRW</span></h2>
                        <p className="text-sm text-blue-100 opacity-90">Remaining after upcoming bills & card payments.</p>
                    </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center cursor-pointer hover:bg-slate-50" onClick={onNavigateToAssets}>
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
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-slate-500 mb-2"><span>📊</span><span className="text-xs font-bold uppercase">Top Category</span></div>
                        <p className="text-lg font-bold text-slate-900 truncate">{categoryDataOverview[0]?.name || 'N/A'}</p>
                    </div>
                </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 onClick={onNavigateToTransactions} className="font-bold text-lg text-slate-800 hover:text-blue-600 cursor-pointer flex items-center gap-2 transition-colors group">Activity<span className="opacity-0 group-hover:opacity-100 text-sm">↗️</span></h3>
                    <button onClick={() => { const o: any[] = ['today', 'week', 'month']; onFilterChange(o[(o.indexOf(activityFilter) + 1) % o.length]); }} className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full capitalize">{activityFilter}</button>
                </div>
                <div className="space-y-0 relative">
                    {filteredActivityTransactions.length === 0 ? (
                        <p className="text-center text-slate-400 py-4 text-sm">No transactions found.</p>
                    ) : (
                        filteredActivityTransactions.slice(0, 10).map((t) => (
                            <TransactionItem
                                key={t.id}
                                transaction={t}
                                asset={assets.find(a => a.id === t.assetId)}
                                toAsset={t.toAssetId ? assets.find(a => a.id === t.toAssetId) : undefined}
                                onEdit={onEditTransaction}
                                onDelete={onDeleteTransaction}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default OverviewTab;
