import React, { useMemo } from 'react';
import { Transaction, Asset, RecurringTransaction, TransactionType, AssetType } from '../../types';
import TransactionItem from '../TransactionItem';
import { FinanceCalculator } from '../../services/financeCalculator';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useCategoryManager } from '../../hooks/useCategoryManager';
import { useBudgetManager } from '../../hooks/useBudgetManager';
import { FinancialHealthWidget } from './FinancialHealthWidget';

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

const BudgetStatusWidget = ({ transactions }: { transactions: Transaction[] }) => {
    const { categories } = useCategoryManager();
    const { budgets } = useBudgetManager();

    const budgetStatus = useMemo(() => {
        const currentMonth = new Date().toISOString().slice(0, 7);

        return categories
            .map(category => {
                const budget = budgets.find(b => b.category_id === category.id);
                if (!budget) return null;

                const spent = transactions
                    .filter(t =>
                        t.type === TransactionType.EXPENSE &&
                        t.date.startsWith(currentMonth) &&
                        (t.category === category.id || t.category === category.name)
                    )
                    .reduce((sum, t) => sum + t.amount, 0);

                return {
                    category,
                    budget: budget.amount,
                    spent,
                    percent: Math.min((spent / budget.amount) * 100, 100),
                    isOver: spent > budget.amount
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => b.percent - a.percent); // Sort by usage % descending
    }, [categories, budgets, transactions]);

    // If no budgets, show empty state (do not return null)
    const hasBudgets = budgetStatus.length > 0;

    return (
        <Card className="p-6 h-full flex flex-col">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Category Budgets</h3>
            <div className="space-y-4">
                <div className="space-y-4">
                    {hasBudgets ? (
                        budgetStatus.map((item) => (
                            <div key={item.category.id} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700 flex items-center gap-2">
                                        <span>{item.category.emoji}</span> {item.category.name}
                                    </span>
                                    <span className={item.isOver ? 'text-red-500 font-bold' : 'text-slate-500'}>
                                        {item.spent.toLocaleString()} / {item.budget.toLocaleString()}
                                    </span>
                                </div>
                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${item.isOver ? 'bg-red-500' :
                                            item.percent > 90 ? 'bg-amber-500' : 'bg-emerald-500'
                                            }`}
                                        style={{ width: `${item.percent}%` }}
                                    />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <span className="text-2xl block mb-2">🏷️</span>
                            <p className="text-sm font-medium">No budgets set.</p>
                            <p className="text-xs text-slate-400 mt-1">Add budgets in Settings.</p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

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
                const { statementBalance } = FinanceCalculator.calculateCreditCardBalances(card, transactions);

                if (card.creditDetails?.billingCycle.paymentDay && card.creditDetails.billingCycle.paymentDay > today.getDate()) {
                    return sum + statementBalance;
                }
                return sum;
            }, 0);

        return budget - monthlyStats.expense - remainingFixedBills - upcomingCardPayments;
    }, [monthlyBudget, monthlyStats.expense, recurring, assets, transactions, today]);
    // --- Daily Pacing & Burn Rate ---
    const { dailyCap, burnRateStatus, burnRateColor } = useMemo(() => {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1); // Include today

        const cap = Math.floor(Math.max(0, safeToSpend) / remainingDays);

        // Burn Rate (Simple 10% buffer logic)
        const budgetUsage = monthlyStats.expense / Math.max(1, monthlyBudget);
        const timeProgress = now.getDate() / daysInMonth;

        let status = 'On Track';
        let color = 'text-emerald-400';

        if (budgetUsage > timeProgress + 0.05) {
            status = 'Burning Fast 🔥';
            color = 'text-orange-400';
        } else if (budgetUsage < timeProgress - 0.05) {
            status = 'Saving 💰';
            color = 'text-blue-400';
        } else {
            status = 'On Track 👍';
            color = 'text-emerald-400';
        }

        return { dailyCap: cap, burnRateStatus: status, burnRateColor: color };
    }, [safeToSpend, monthlyStats.expense, monthlyBudget]);

    // --- Activity List Helpers ---
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
            {/* Bento Grid Layout - Hero Section */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 auto-rows-[minmax(160px,auto)]">

                {/* Safe to Spend - Hero Widget (2x2 -> 2x1) */}
                <div
                    onClick={onOpenBudgetModal}
                    className="col-span-2 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden group cursor-pointer hover:scale-[1.01] transition-all duration-300 h-full flex flex-col justify-between"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:rotate-12 duration-500">
                        <span className="text-9xl">🛡️</span>
                    </div>

                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <span className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-2xl">🛡️</span>
                                    <span className="font-bold text-xs uppercase tracking-widest">Safe to Spend</span>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full bg-white/10 ${burnRateColor}`}>
                                    {burnRateStatus}
                                </span>
                            </div>
                            <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-2">
                                {safeToSpend.toLocaleString()}
                                <span className="text-2xl lg:text-3xl font-medium opacity-60 ml-2">KRW</span>
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Daily Cap</span>
                                    <span className="text-xl font-bold text-white">{dailyCap.toLocaleString()} <span className="text-xs opacity-60 font-normal">KRW / day</span></span>
                                </div>
                                <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-full" style={{ width: '100%' }} />
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 font-medium ml-1">
                                Remaining after setting aside fixed bills.
                            </p>
                        </div>
                    </div>
                </div>



                {/* Financial Health Widget (Col 3 -> 1x1) */}
                <div className="col-span-1 h-full">
                    <FinancialHealthWidget
                        monthlyBudget={monthlyBudget}
                        monthlyExpense={monthlyStats.expense}
                        assets={assets}
                        transactions={transactions}
                    />
                </div>

                {/* Info Widgets Column (Col 4 - Merged for 1x1) */}
                <div className="col-span-1 h-full">
                    <Card className="h-full flex flex-col justify-between p-5 cursor-pointer hover:bg-slate-50 border-slate-100 group transition-all duration-300" onClick={onNavigateToAssets}>
                        <div className="flex items-center justify-between border-b border-slate-50 pb-4 mb-2">
                            <div className="flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-lg transition-colors duration-300">💼</span>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Net Worth</span>
                                    <span className="text-lg font-black text-slate-900 tracking-tight">{totalNetWorth.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-3">
                                <span className="w-10 h-10 rounded-xl bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center text-lg transition-colors duration-300">🗓️</span>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Fixed Bills</span>
                                    <span className="text-lg font-black text-slate-900 tracking-tight">{totalMonthlyFixed.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Middle Section: Flow & Budget */}

            {/* Middle Section: Flow & Budget */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                {/* Monthly Flow */}
                <Card className="p-6 lg:p-8 h-full flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <span className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">🌊</span>
                            <h3 className="text-lg font-bold text-slate-900">Monthly Flow</h3>
                        </div>
                        <Button
                            onClick={onOpenBudgetModal}
                            variant="ghost"
                            size="sm"
                            className="bg-slate-100 hover:bg-slate-200 text-xs rounded-full px-3"
                        >
                            Edit Budget
                        </Button>
                    </div>

                    <div className="space-y-5">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-500 font-bold text-xs uppercase">Income vs Expense</span>
                            </div>
                            <div className="flex items-end gap-2 h-24 mt-2">
                                <div className="w-1/2 bg-emerald-100 rounded-t-xl relative group flex flex-col justify-end overflow-hidden">
                                    <div className="w-full bg-emerald-500 absolute bottom-0 transition-all duration-500" style={{ height: '70%' }}></div>
                                    <span className="relative z-10 p-2 text-xs font-bold text-emerald-900 text-center">{monthlyStats.income.toLocaleString()}</span>
                                </div>
                                <div className="w-1/2 bg-rose-100 rounded-t-xl relative group flex flex-col justify-end overflow-hidden">
                                    <div className="w-full bg-rose-500 absolute bottom-0 transition-all duration-500 transform translate-y-0" style={{ height: `${Math.min((monthlyStats.expense / monthlyStats.income) * 100, 100)}%` }}></div>
                                    <span className="relative z-10 p-2 text-xs font-bold text-rose-900 text-center">{monthlyStats.expense.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>


                    </div>
                </Card>

                {/* Budget Status Widget */}
                <BudgetStatusWidget transactions={transactions} />
            </div>

            {/* Activity Feed (Full Width) */}
            <Card className="p-0 overflow-hidden">
                <div className="p-6 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">⚡</span>
                        <h3 className="text-xl font-bold text-slate-900">Recent Activity</h3>
                    </div>
                    <div className="flex bg-slate-100 p-1.5 rounded-full">
                        {(['today', 'week', 'month'] as const).map(f => (
                            <Button
                                key={f}
                                onClick={() => onFilterChange(f)}
                                variant="ghost"
                                className={`px-4 py-1.5 text-xs font-bold rounded-full capitalize transition-all shadow-none ${activityFilter === f ? 'bg-white text-slate-900 shadow-sm hover:bg-white' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {f}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="px-2">
                    {filteredActivityTransactions.slice(0, 5).map(tx => (
                        <div key={tx.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors rounded-xl mx-2">
                            <TransactionItem
                                transaction={tx}
                                asset={assets.find(a => a.id === tx.assetId)}
                                toAsset={tx.toAssetId ? assets.find(a => a.id === tx.toAssetId) : undefined}
                                onEdit={onEditTransaction}
                                onDelete={onDeleteTransaction}
                            />
                        </div>
                    ))}
                    {filteredActivityTransactions.length === 0 && (
                        <div className="text-center py-16 text-slate-400 border-slate-100 border-dashed bg-slate-50/30 m-4 rounded-2xl">
                            <span className="text-2xl block mb-2">📭</span>
                            <span className="text-sm font-medium">No activity found for this period.</span>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                    <Button variant="ghost" size="sm" onClick={onNavigateToTransactions} className="w-full text-slate-500 hover:text-slate-900 font-bold">
                        View All Transactions →
                    </Button>
                </div>
            </Card>
        </div >
    );
};

export default OverviewTab;
