import React, { useMemo } from 'react';
import { Transaction, Asset, RecurringTransaction, TransactionType, AssetType } from '../../types';
import TransactionItem from '../TransactionItem';
import { FinanceCalculator } from '../../services/financeCalculator';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

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
                const { statementBalance } = FinanceCalculator.calculateCreditCardBalances(card, transactions);

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
    );
};

export default OverviewTab;
