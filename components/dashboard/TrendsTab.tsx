import React, { useState, useMemo } from 'react';
import {
    AreaChart, Area, ResponsiveContainer, Tooltip,
    XAxis
} from 'recharts';
import { Transaction, TransactionType, Asset, AssetType, RecurringTransaction } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import {
    CircleDollarSign,
    TrendingUp,
    ShieldCheck,
    Calendar,
    Sparkles,
    Zap,
    Clock,
    PieChart as PieIcon,
    Gauge,
    ArrowDownRight
} from 'lucide-react';

interface TrendsTabProps {
    transactions: Transaction[];
    assets: Asset[];
    recurring: RecurringTransaction[];
    monthlyBudget: number;
}

const TrendsTab: React.FC<TrendsTabProps> = ({ transactions = [], assets = [], recurring = [], monthlyBudget = 0 }) => {
    const [timeframe, setTimeframe] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

    const currentMonth = new Date().toISOString().slice(0, 7);

    // --- 1. Net Worth Engine (Extrapolated from current balance using transactions) ---
    const netWorthData = useMemo(() => {
        const currentNetWorth = assets.filter(a => !a.excludeFromTotal).reduce((sum, a) => sum + a.balance, 0);
        const data = [];
        const now = new Date();

        if (timeframe === 'weekly') {
            // Last 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(now.getDate() - i);
                const dateStr = date.toISOString().slice(0, 10);

                // Transactions after this date up to now
                const futureTxs = transactions.filter(t => t.date > dateStr);
                const income = futureTxs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
                const expense = futureTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);

                data.push({
                    name: date.toLocaleDateString('en-US', { weekday: 'short' }),
                    value: Math.round(currentNetWorth - income + expense)
                });
            }
        } else if (timeframe === 'monthly') {
            // Last 6 months
            for (let i = 5; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const dateStr = date.toISOString().slice(0, 7);

                const futureTxs = transactions.filter(t => t.date.slice(0, 7) > dateStr);
                const income = futureTxs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
                const expense = futureTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);

                data.push({
                    name: date.toLocaleString('en-US', { month: 'short' }),
                    value: Math.round(currentNetWorth - income + expense)
                });
            }
        } else {
            // Yearly: Last 12 months
            for (let i = 11; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const dateStr = date.toISOString().slice(0, 7);

                const futureTxs = transactions.filter(t => t.date.slice(0, 7) > dateStr);
                const income = futureTxs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
                const expense = futureTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);

                data.push({
                    name: date.toLocaleString('en-US', { month: 'short' }),
                    value: Math.round(currentNetWorth - income + expense)
                });
            }
        }
        return data;
    }, [assets, transactions, timeframe]);

    // --- 2. Savings Rate & Budget Pacing ---
    const financialPulse = useMemo(() => {
        const currentMonthTxs = transactions.filter(t => t.date.startsWith(currentMonth));

        const income = currentMonthTxs
            .filter(t => t.type === TransactionType.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = currentMonthTxs
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);

        const savings = income - expense;
        const savingsRate = income > 0 ? (savings / income) * 100 : 0;

        const budgetUsage = monthlyBudget > 0 ? (expense / monthlyBudget) * 100 : 0;
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const currentDay = new Date().getDate();
        const expectedPacing = (currentDay / daysInMonth) * 100;
        const isOverPacing = budgetUsage > expectedPacing;

        return {
            income: Math.round(income),
            expense: Math.round(expense),
            savings: Math.round(savings),
            savingsRate: Math.round(savingsRate),
            budgetUsage: Math.round(budgetUsage),
            isOverPacing,
            remainingBudget: Math.round(Math.max(0, monthlyBudget - expense))
        };
    }, [transactions, currentMonth, monthlyBudget]);

    // --- 3. Fixed vs Variable Audit ---
    const costAudit = useMemo(() => {
        const currentMonthTxs = transactions.filter(t => t.date.startsWith(currentMonth));
        const expenseTxs = currentMonthTxs.filter(t => t.type === TransactionType.EXPENSE);

        const fixedAmount = recurring.reduce((sum, r) => sum + r.amount, 0);
        const totalExpense = expenseTxs.reduce((sum, t) => sum + t.amount, 0);

        const fixedRate = totalExpense > 0 ? (fixedAmount / totalExpense) * 100 : 0;

        return {
            fixedAmount: Math.round(fixedAmount),
            variableAmount: Math.round(Math.max(0, totalExpense - fixedAmount)),
            fixedRate: Math.round(fixedRate)
        };
    }, [transactions, recurring, currentMonth]);

    // --- 4. Emergency Fund ---
    const emergencyFund = useMemo(() => {
        const liquidAssets = assets
            .filter(a => (a.type === AssetType.CHECKING || a.type === AssetType.SAVINGS || a.type === AssetType.CASH) && !a.excludeFromTotal)
            .reduce((sum, a) => sum + a.balance, 0);

        const monthsCovered = liquidAssets / 1500000;
        return { liquidAssets, monthsCovered: Number(monthsCovered.toFixed(1)) };
    }, [assets]);

    // --- 5. Spending Heatmap Data (Now respects timeframe) ---
    const heatmapData = useMemo(() => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const data = days.map(day => ({ day, total: 0 }));

        let filteredTxs = transactions.filter(t => t.type === TransactionType.EXPENSE);
        if (timeframe === 'weekly') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekAgoStr = weekAgo.toISOString().slice(0, 10);
            filteredTxs = filteredTxs.filter(t => t.date >= weekAgoStr);
        } else if (timeframe === 'monthly') {
            filteredTxs = filteredTxs.filter(t => t.date.startsWith(currentMonth));
        }

        filteredTxs.forEach(t => {
            const d = new Date(t.date);
            data[d.getDay()].total += t.amount;
        });
        return data;
    }, [transactions, timeframe, currentMonth]);

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-500">
            {/* Timeframe Filter Moved to its own clean row */}
            <div className="flex justify-end px-1 -mb-2">
                <div className="flex bg-slate-100 p-1 rounded-2xl shadow-sm">
                    {['weekly', 'monthly', 'yearly'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTimeframe(t as any)}
                            className={`px-5 py-1.5 rounded-xl text-[10px] font-black transition-all capitalize uppercase tracking-widest ${timeframe === t ? 'bg-white text-primary shadow-sm scale-105' : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Layout: Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Net Worth Dynamics (Wide) */}
                <Card className="md:col-span-2 p-6 overflow-hidden border-none shadow-soft group hover:scale-[1.01] transition-transform duration-300">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">
                                <Zap size={12} fill="currentColor" /> Growth Engine
                            </span>
                            <h3 className="text-xl font-black text-slate-800">Net Worth Dynamics</h3>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400">Current Balance</p>
                            <p className="text-lg font-black text-primary">{Math.round(netWorthData[netWorthData.length - 1]?.value || 0).toLocaleString()} <span className="text-[10px]">KRW</span></p>
                        </div>
                    </div>

                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={netWorthData}>
                                <defs>
                                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#197FE6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#197FE6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', fontWeight: 800 }}
                                    formatter={(value: number) => [Math.round(value).toLocaleString(), 'Net Worth']}
                                />
                                <Area type="monotone" dataKey="value" stroke="#197FE6" strokeWidth={4} fillOpacity={1} fill="url(#colorVal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 2. Savings Efficiency Gauge */}
                <Card className="p-6 flex flex-col items-center justify-center text-center border-none shadow-soft hover:scale-[1.01] transition-transform duration-300 bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
                    <span className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-4">Savings Efficiency</span>

                    <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="64" cy="64" r="58" stroke="rgba(255,255,255,0.2)" strokeWidth="10" fill="transparent" />
                            <circle cx="64" cy="64" r="58" stroke="white" strokeWidth="10"
                                strokeDasharray={364}
                                strokeDashoffset={364 - (364 * financialPulse.savingsRate) / 100}
                                strokeLinecap="round" fill="transparent" className="transition-all duration-1000" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-black">{financialPulse.savingsRate}%</span>
                            <span className="text-[10px] font-bold opacity-70">Rate</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full mt-2">
                        <div className="text-center">
                            <p className="text-[10px] opacity-60 font-bold uppercase">Income</p>
                            <p className="text-sm font-black tracking-tight">{financialPulse.income.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] opacity-60 font-bold uppercase">Savings</p>
                            <p className="text-sm font-black tracking-tight">{financialPulse.savings.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                {/* 3. Budget Pacing / Burn Rate */}
                <Card className="p-6 border-none shadow-soft bg-white group hover:scale-[1.01] transition-transform duration-300">
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`p-2.5 rounded-2xl ${financialPulse.isOverPacing ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            <Gauge size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-800">Budget Pacing</h4>
                            <p className="text-[10px] font-bold text-slate-400">Current Month Burn Rate</p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-3xl font-black text-slate-800">{financialPulse.budgetUsage}%</span>
                            <span className={`text-xs font-bold flex items-center gap-0.5 ${financialPulse.isOverPacing ? 'text-orange-500' : 'text-emerald-500'}`}>
                                {financialPulse.isOverPacing ? <TrendingUp size={12} /> : <ArrowDownRight size={12} />}
                                {financialPulse.isOverPacing ? 'Fast' : 'Stable'}
                            </span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-1000 ${financialPulse.isOverPacing ? 'bg-orange-500' : 'bg-primary'}`} style={{ width: `${Math.min(financialPulse.budgetUsage, 100)}%` }} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                        Remaining: <strong>{financialPulse.remainingBudget.toLocaleString()} KRW</strong>
                    </p>
                </Card>

                {/* 4. Fixed vs Variable Audit */}
                <Card className="p-6 border-none shadow-soft bg-white group hover:scale-[1.01] transition-transform duration-300">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-purple-100 p-2.5 rounded-2xl text-purple-600">
                            <PieIcon size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-800">Cost Structure</h4>
                            <p className="text-[10px] font-bold text-slate-400">Fixed vs Variable Audit</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="h-20 w-2 w-full flex flex-col gap-1">
                            <div className="bg-purple-500 rounded-t-lg transition-all duration-1000" style={{ flex: costAudit.fixedRate }} />
                            <div className="bg-slate-200 rounded-b-lg transition-all duration-1000" style={{ flex: 100 - costAudit.fixedRate }} />
                        </div>
                        <div className="space-y-2 flex-1">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">Fixed</span>
                                <span className="text-xs font-black text-slate-800">{costAudit.fixedRate}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400">Variable</span>
                                <span className="text-xs font-black text-slate-500">{100 - costAudit.fixedRate}%</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-4 leading-relaxed font-medium">
                        Fixed costs include recurring bills and subscriptions. Lowering these expands your financial freedom.
                    </p>
                </Card>

                {/* 5. Emergency Fund Coverage */}
                <Card className="p-6 border-none shadow-soft bg-white group hover:scale-[1.01] transition-transform duration-300">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-emerald-100 p-2.5 rounded-2xl text-emerald-600">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-black text-slate-800">Safety Reserve</h4>
                            <p className="text-[10px] font-bold text-slate-400">Emergency Fund Index</p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-3xl font-black text-slate-800">{emergencyFund.monthsCovered} <span className="text-sm font-normal text-slate-400">Months</span></span>
                            <span className="text-xs font-bold text-emerald-500 flex items-center gap-0.5"><TrendingUp size={12} /> Solid</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min((emergencyFund.monthsCovered / 6) * 100, 100)}%` }} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Your liquid assets cover <strong>{emergencyFund.monthsCovered} months</strong>. A 6-month reserve is highly recommended.
                    </p>
                </Card>

                {/* 6. Temporal Patterns (Heatmap) */}
                <Card className="md:col-span-2 p-6 border-none shadow-soft bg-white hover:scale-[1.01] transition-transform duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <Calendar size={18} className="text-primary" /> Spending Patterns
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{timeframe === 'weekly' ? 'Daily activity' : 'Weekly activity'}</span>
                    </div>

                    <div className="grid grid-cols-7 gap-3 h-40">
                        {heatmapData.map((d) => {
                            const intensity = Math.min((d.total / 500000) * 100, 100);
                            return (
                                <div key={d.day} className="flex flex-col items-center gap-3">
                                    <div className="flex-1 w-full bg-slate-50 rounded-2xl overflow-hidden flex flex-col justify-end">
                                        <div
                                            className="w-full bg-primary/20 transition-all duration-1000"
                                            style={{ height: `${intensity}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400">{d.day}</span>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* 7. Top Merchants Analysis */}
                <Card className="p-6 border-none shadow-soft bg-slate-900 text-white hover:scale-[1.01] transition-transform duration-300">
                    <h3 className="text-lg font-black mb-4">Top Merchants</h3>
                    <div className="space-y-4">
                        {[
                            { name: 'Coupang', amount: 450000, color: 'bg-orange-500' },
                            { name: 'Starbucks', amount: 120000, color: 'bg-emerald-600' },
                            { name: 'Amazon', amount: 89000, color: 'bg-blue-500' },
                            { name: 'Netflix', amount: 17000, color: 'bg-red-600' }
                        ].map((m) => (
                            <div key={m.name} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-xl ${m.color} flex items-center justify-center text-[10px] font-black`}>{m.name[0]}</div>
                                    <span className="text-sm font-bold opacity-90 group-hover:opacity-100 transition-opacity">{m.name}</span>
                                </div>
                                <span className="text-sm font-black tracking-tight">{Math.round(m.amount).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                    <Button variant="ghost" className="w-full mt-6 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 rounded-xl py-2">
                        View Detailed Report
                    </Button>
                </Card>

            </div>

            {/* Smart Summary Footer */}
            <div className="bg-white border-none shadow-soft p-6 rounded-[32px] flex flex-col md:flex-row items-center gap-6 group">
                <div className="w-16 h-16 bg-blue-100 rounded-3xl flex items-center justify-center text-primary group-hover:rotate-12 transition-transform">
                    <Sparkles size={32} />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h4 className="text-lg font-black text-slate-800">Premium Insight</h4>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                        Your budget is pacing <strong>{financialPulse.isOverPacing ? 'hotter than' : 'within'}</strong> the expected burn rate for this month.
                        Your fixed costs account for <strong>{costAudit.fixedRate}%</strong> of your total expenses.
                    </p>
                </div>
                <Button className="rounded-2xl px-8 py-6 font-black tracking-tight shadow-md hover:shadow-xl transition-shadow whitespace-nowrap">
                    Download PDF Report
                </Button>
            </div>
        </div>
    );
};

export default TrendsTab;
