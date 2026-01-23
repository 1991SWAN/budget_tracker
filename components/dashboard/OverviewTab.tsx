import React, { useMemo } from 'react';
import { Transaction, Asset, RecurringTransaction, TransactionType, AssetType } from '../../types';
import TransactionItem from '../TransactionItem';
import { FinanceCalculator } from '../../services/financeCalculator';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useCategoryManager } from '../../hooks/useCategoryManager';
import { useBudgetManager } from '../../hooks/useBudgetManager';
import { FinancialHealthWidget } from './FinancialHealthWidget';
import {
    ShieldCheck,
    Briefcase,
    CalendarClock,
    Waves,
    Zap,
    Inbox,
    Tag,
    ChevronRight,
    ArrowRight,
    Coins,
    Flame,
    Check
} from 'lucide-react';

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

const BudgetStatusWidget = ({ transactions, assets }: { transactions: Transaction[], assets: Asset[] }) => {
    const { categories } = useCategoryManager();
    const { budgets } = useBudgetManager();

    const budgetStatus = useMemo(() => {
        const currentMonth = new Date().toISOString().slice(0, 7);

        return categories
            .map(category => {
                const budget = budgets.find(b => b.category_id === category.id);
                if (!budget) return null;

                const spent = transactions
                    .filter(t => {
                        const isExpense = t.type === TransactionType.EXPENSE;
                        const isCorrectCategory = (t.category === category.id || t.category === category.name);
                        if (!isExpense || !isCorrectCategory) return false;

                        const card = assets.find(a => a.id === t.assetId && a.type === AssetType.CREDIT_CARD);
                        if (card) {
                            // Credit Card spending follows the current cycle
                            const { usageStartDate, usageEndDate } = FinanceCalculator.calculateCreditCardBalances(card, transactions);
                            const tDate = new Date(t.date);
                            return tDate >= usageStartDate && tDate <= usageEndDate;
                        } else {
                            // Cash/Bank follows calendar month
                            return t.date.startsWith(currentMonth);
                        }
                    })
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
    }, [categories, budgets, transactions, assets]);

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
                            <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
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
    const { categories } = useCategoryManager();
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // --- Statistics ---
    const monthlyStats = useMemo(() => {
        const income = transactions
            .filter(t => t.date.startsWith(currentMonth) && t.type === TransactionType.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);

        // 1. Non-Card Expenses (Calendar Month)
        const cashExpense = transactions
            .filter(t =>
                t.date.startsWith(currentMonth) &&
                t.type === TransactionType.EXPENSE &&
                !assets.find(a => a.id === t.assetId && a.type === AssetType.CREDIT_CARD)
            )
            .reduce((sum, t) => sum + t.amount, 0);

        // 2. Card Expenses (Current Billing Cycle / Usage Period)
        const cardExpense = assets
            .filter(a => a.type === AssetType.CREDIT_CARD)
            .reduce((sum, card) => {
                const { nextBill } = FinanceCalculator.calculateCreditCardBalances(card, transactions);
                return sum + nextBill;
            }, 0);

        return { income, expense: cashExpense + cardExpense };
    }, [transactions, currentMonth, assets]);

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

    // --- Safe To Spend Calculation (Budget-Centric) ---
    const safeToSpend = useMemo(() => {
        const budget = monthlyBudget;

        // 1. Remaining Fixed Bills (Non-Credit Card Recurring)
        const remainingFixedBills = recurring.reduce((sum, bill) => {
            // If bill is due later this month
            if (bill.dayOfMonth > today.getDate()) return sum + bill.amount;
            return sum;
        }, 0);

        // PHILOSOPHY: We only care about current active spending (monthlyStats.expense already includes card usage)
        // Past Debt (unpaid statement balance) is NOT subtracted here to focus on plan adherence.
        return budget - monthlyStats.expense - remainingFixedBills;
    }, [monthlyBudget, monthlyStats.expense, recurring, today]);
    // --- Daily Pacing & Burn Rate ---
    const { dailyCap, burnRateStatus, burnRateColor, burnRateIcon } = useMemo(() => {
        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1); // Include today

        const cap = Math.floor(Math.max(0, safeToSpend) / remainingDays);

        // Burn Rate (Simple 10% buffer logic)
        const budgetUsage = monthlyStats.expense / Math.max(1, monthlyBudget);
        const timeProgress = now.getDate() / daysInMonth;

        let status = 'On Track';
        let color = 'text-emerald-400';
        let icon = <Check size={12} />;

        if (budgetUsage > timeProgress + 0.05) {
            status = 'Burning Fast';
            color = 'text-orange-400';
            icon = <Flame size={12} />;
        } else if (budgetUsage < timeProgress - 0.05) {
            status = 'Saving';
            color = 'text-blue-400';
            icon = <Coins size={12} />;
        }

        return { dailyCap: cap, burnRateStatus: status, burnRateColor: color, burnRateIcon: icon };
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
                        <ShieldCheck size={120} />
                    </div>

                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <span className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                                        <ShieldCheck size={28} />
                                    </span>
                                    <span className="font-bold text-xs uppercase tracking-widest">Safe to Spend</span>
                                </div>
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 ${burnRateColor}`}>
                                    {burnRateIcon}
                                    {burnRateStatus}
                                </div>
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

                {/* Stats Grid Column (Net Worth & Fixed Bills split vertically) */}
                <div className="col-span-1 grid grid-rows-2 gap-4">
                    {/* Net Worth Card */}
                    <Card
                        className="flex flex-col justify-center p-4 cursor-pointer hover:bg-slate-50 border-slate-100 group transition-all duration-300"
                        onClick={onNavigateToAssets}
                    >
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-indigo-600 transition-colors duration-300">
                                <Briefcase size={16} />
                            </span>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Net Worth</span>
                                <span className="text-base font-black text-slate-900 tracking-tight leading-tight">{totalNetWorth.toLocaleString()}</span>
                            </div>
                        </div>
                    </Card>

                    {/* Fixed Bills Card */}
                    <Card
                        className="flex flex-col justify-center p-4 border-slate-100 group transition-all duration-300"
                    >
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center text-amber-600 transition-colors duration-300">
                                <CalendarClock size={16} />
                            </span>
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block leading-tight">Fixed Bills</span>
                                <span className="text-base font-black text-slate-900 tracking-tight leading-tight">{totalMonthlyFixed.toLocaleString()}</span>
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
                            <span className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
                                <Waves size={24} />
                            </span>
                            <h3 className="text-lg font-bold text-slate-900">Monthly Flow</h3>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-500 font-bold text-xs uppercase text-[10px] tracking-wider">Cash Flow (Income vs Expense)</span>
                            </div>
                            <div className="flex items-end gap-4 h-28 mt-4">
                                {(() => {
                                    const maxVal = Math.max(monthlyStats.income, monthlyStats.expense, 1);
                                    const incomeHeight = (monthlyStats.income / maxVal) * 100;
                                    const expenseHeight = (monthlyStats.expense / maxVal) * 100;

                                    return (
                                        <>
                                            {/* Income Bar */}
                                            <div
                                                className="w-1/2 bg-emerald-100 rounded-t-2xl relative group flex flex-col justify-end overflow-hidden transition-all duration-500 hover:shadow-lg hover:shadow-emerald-500/10 cursor-default"
                                                style={{ height: `${Math.max(incomeHeight, 20)}%` }}
                                            >
                                                <div className="w-full bg-emerald-500 absolute bottom-0 h-full"></div>

                                                {/* Label - Always visible but subtle */}
                                                <div className="absolute top-2 w-full text-center z-10">
                                                    <span className="text-[9px] block text-white/80 uppercase font-black tracking-widest transition-opacity group-hover:opacity-100">Income</span>
                                                </div>

                                                {/* Amount - Reveal on hover with glass feel */}
                                                <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 backdrop-blur-[2px] bg-emerald-600/20">
                                                    <div className="text-center px-2">
                                                        <span className="text-sm font-black text-white drop-shadow-md">
                                                            {monthlyStats.income.toLocaleString()}
                                                            <span className="text-[10px] ml-0.5 opacity-70">₩</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expense Bar */}
                                            <div
                                                className="w-1/2 bg-rose-100 rounded-t-2xl relative group flex flex-col justify-end overflow-hidden transition-all duration-500 hover:shadow-lg hover:shadow-rose-500/10 cursor-default"
                                                style={{ height: `${Math.max(expenseHeight, 20)}%` }}
                                            >
                                                <div className="w-full bg-rose-500 absolute bottom-0 h-full"></div>

                                                {/* Label - Always visible but subtle */}
                                                <div className="absolute top-2 w-full text-center z-10">
                                                    <span className="text-[9px] block text-white/80 uppercase font-black tracking-widest transition-opacity group-hover:opacity-100">Expense</span>
                                                </div>

                                                {/* Amount - Reveal on hover with glass feel */}
                                                <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 backdrop-blur-[2px] bg-rose-600/20">
                                                    <div className="text-center px-2">
                                                        <span className="text-sm font-black text-white drop-shadow-md">
                                                            {monthlyStats.expense.toLocaleString()}
                                                            <span className="text-[10px] ml-0.5 opacity-70">₩</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Budget Status Widget */}
                <BudgetStatusWidget transactions={transactions} assets={assets} />
            </div>

            {/* Activity Feed (Full Width) */}
            <Card className="p-0 overflow-hidden border-slate-200/60 shadow-sm">
                <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-50">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
                            <Zap size={20} fill="currentColor" />
                        </span>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Recent Activity</h3>
                    </div>
                    <div className="flex bg-slate-100/80 p-1 rounded-full backdrop-blur-sm">
                        {(['today', 'week', 'month'] as const).map(f => (
                            <Button
                                key={f}
                                onClick={() => onFilterChange(f)}
                                variant="ghost"
                                className={`px-4 py-1.5 text-[11px] font-bold rounded-full capitalize transition-all shadow-none h-7 ${activityFilter === f ? 'bg-white text-slate-900 shadow-sm hover:bg-white' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {f}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-slate-50">
                    {(() => {
                        const activity = filteredActivityTransactions.slice(0, 15);
                        if (activity.length === 0) {
                            return (
                                <div className="text-center py-20 text-slate-400">
                                    <Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <span className="text-sm font-medium">No activity found for this period.</span>
                                </div>
                            );
                        }

                        // Group by date
                        const groups: { date: string, items: Transaction[] }[] = [];
                        activity.forEach(tx => {
                            const lastGroup = groups[groups.length - 1];
                            if (lastGroup && lastGroup.date === tx.date) {
                                lastGroup.items.push(tx);
                            } else {
                                groups.push({ date: tx.date, items: [tx] });
                            }
                        });

                        return groups.map((group) => {
                            const dayTotal = group.items.reduce((sum, t) =>
                                sum + (t.type === TransactionType.INCOME ? t.amount : t.type === TransactionType.EXPENSE ? -t.amount : 0), 0
                            );

                            return (
                                <div key={group.date}>
                                    {/* Date Header matching TransactionList style */}
                                    <div className="bg-slate-50/50 px-5 py-2 flex justify-between items-center border-y border-slate-100/50">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-0.5 h-3 bg-indigo-500 rounded-full" />
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                {group.date === todayStr ? 'Today' : group.date}
                                            </span>
                                        </div>
                                        {dayTotal !== 0 && (
                                            <span className={`text-[11px] font-black tabular-nums ${dayTotal > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {dayTotal > 0 ? '+' : ''}{dayTotal.toLocaleString()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Items */}
                                    <div className="bg-white">
                                        {group.items.map(tx => (
                                            <div key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                                <TransactionItem
                                                    transaction={tx}
                                                    asset={assets.find(a => a.id === tx.assetId)}
                                                    toAsset={tx.toAssetId ? assets.find(a => a.id === tx.toAssetId) : undefined}
                                                    categories={categories}
                                                    onEdit={onEditTransaction}
                                                    onDelete={onDeleteTransaction}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>

                <div className="p-4 bg-slate-50/30 border-t border-slate-100">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onNavigateToTransactions}
                        className="w-full text-slate-500 hover:text-slate-900 font-bold text-xs group"
                    >
                        View All History
                        <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                    </Button>
                </div>
            </Card>
        </div >
    );
};

export default OverviewTab;
