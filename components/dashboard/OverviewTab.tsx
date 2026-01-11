import React, { useMemo } from 'react';
import { Transaction, Asset, RecurringTransaction, TransactionType, AssetType } from '../../types';
import TransactionItem from '../TransactionItem';
import { FinanceCalculator } from '../../services/financeCalculator';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useCategoryManager } from '../../hooks/useCategoryManager';
import { useBudgetManager } from '../../hooks/useBudgetManager';

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

    if (budgetStatus.length === 0) return null;

    return (
        <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Budget Status</h3>
            <div className="space-y-4">
                {budgetStatus.map((item) => (
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
                ))}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Safe to Spend Card */}
                {/* Hero card uses custom gradient background but wraps content safely */}
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
                    <Card className="flex flex-col justify-center cursor-pointer hover:bg-slate-50 border-slate-100" padding="default" onClick={onNavigateToAssets}>
                        <div className="flex items-center gap-2 text-muted mb-2"><span>💼</span><span className="text-xs font-bold uppercase">Net Worth</span></div>
                        <p className="text-xl font-bold text-primary">{totalNetWorth.toLocaleString()}</p>
                    </Card>
                    <Card className="flex flex-col justify-center border-slate-100">
                        <div className="flex items-center gap-2 text-muted mb-2"><span>📉</span><span className="text-xs font-bold uppercase">Expenses</span></div>
                        <p className="text-xl font-bold text-primary">{monthlyStats.expense.toLocaleString()}</p>
                    </Card>
                    <Card className="flex flex-col justify-center border-slate-100">
                        <div className="flex items-center gap-2 text-muted mb-2"><span>🗓️</span><span className="text-xs font-bold uppercase">Fixed Bills</span></div>
                        <p className="text-xl font-bold text-primary">{totalMonthlyFixed.toLocaleString()}</p>
                    </Card>
                    <Card className="flex flex-col justify-center border-slate-100">
                        <div className="flex items-center gap-2 text-muted mb-2"><span>📊</span><span className="text-xs font-bold uppercase">Top Category</span></div>
                        <p className="text-lg font-bold text-primary truncate">{categoryDataOverview[0]?.name || 'N/A'}</p>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Activity & Budget */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Budget Status Widget (NEW) */}
                    <BudgetStatusWidget transactions={transactions} />

                    {/* Activity Feed */}
                    <div>
                        <div className="flex items-center justify-between mb-4 px-1">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">⚡</span>
                                <h3 className="text-xl font-bold text-primary">Activity</h3>
                            </div>
                            <div className="flex bg-slate-100 p-1 rounded-full">
                                {(['today', 'week', 'month'] as const).map(f => (
                                    <Button
                                        key={f}
                                        onClick={() => onFilterChange(f)}
                                        variant="ghost"
                                        className={`px-3 py-1 text-xs font-bold rounded-full capitalize transition-all shadow-none ${activityFilter === f ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-slate-600'}`}
                                    >
                                        {f}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {filteredActivityTransactions.slice(0, 5).map(tx => (
                                <Card key={tx.id} className="border-slate-100 overflow-hidden" noPadding>
                                    <TransactionItem
                                        transaction={tx}
                                        asset={assets.find(a => a.id === tx.assetId)}
                                        toAsset={tx.toAssetId ? assets.find(a => a.id === tx.toAssetId) : undefined}
                                        onEdit={onEditTransaction}
                                        onDelete={onDeleteTransaction}
                                    />
                                </Card>
                            ))}
                            {filteredActivityTransactions.length === 0 && (
                                <Card className="text-center py-10 text-muted border-slate-100 border-dashed bg-slate-50/50">
                                    No activity found for this period.
                                </Card>
                            )}
                        </div>

                        <div className="mt-4 text-center">
                            <Button variant="ghost" size="sm" onClick={onNavigateToTransactions} className="w-full">
                                View All Transactions →
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Monthly Overview */}
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-800">Monthly Flow</h3>
                            <button onClick={onOpenBudgetModal} className="text-xs text-primary font-bold hover:underline">
                                Edit Budget
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-500">Income</span>
                                    <span className="font-bold text-emerald-600">{monthlyStats.income.toLocaleString()}</span>
                                </div>
                                <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-full opacity-80" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-500">Expenses</span>
                                    <span className="font-bold text-red-500">{monthlyStats.expense.toLocaleString()}</span>
                                </div>
                                <div className="h-2 bg-red-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 w-full opacity-80" />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-500">Budget Limit</span>
                                    <span className="font-bold text-slate-900">{monthlyBudget.toLocaleString()}</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full w-full opacity-80 ${monthlyStats.expense > monthlyBudget ? 'bg-red-500' : 'bg-blue-500'}`}
                                        style={{ width: `${Math.min((monthlyStats.expense / monthlyBudget) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Top Spending Categories */}
                    <Card className="p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Top Spending</h3>
                        <div className="space-y-3">
                            {categoryDataOverview.slice(0, 5).map((cat, idx) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                                        <span className="text-slate-600 font-medium text-sm">{cat.name}</span>
                                    </div>
                                    <span className="font-bold text-slate-900 text-sm">{cat.value.toLocaleString()}</span>
                                </div>
                            ))}
                            {categoryDataOverview.length === 0 && (
                                <div className="text-center py-4 text-slate-400 text-sm">No expenses yet.</div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default OverviewTab;
