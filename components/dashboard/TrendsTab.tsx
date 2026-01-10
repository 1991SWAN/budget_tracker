import React, { useState, useMemo } from 'react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    BarChart, Bar, XAxis, CartesianGrid, Legend
} from 'recharts';
import { Transaction, TransactionType } from '../../types';
import { Card } from '../ui/Card';

interface TrendsTabProps {
    transactions: Transaction[];
}

type Timeframe = 'weekly' | 'monthly';
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

const TrendsTab: React.FC<TrendsTabProps> = ({ transactions }) => {
    const [flowTimeframe, setFlowTimeframe] = useState<Timeframe>('monthly');
    const [trendTimeframe, setTrendTimeframe] = useState<Timeframe>('monthly');
    const [categoryTimeframe, setCategoryTimeframe] = useState<Timeframe>('monthly');

    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date();

    // --- Helpers ---
    const getStartOfWeek = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(date.setDate(diff));
        start.setHours(0, 0, 0, 0);
        return start;
    };

    const generateChartData = (txs: Transaction[], period: Timeframe) => {
        const income = txs.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
        const expense = txs.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);

        const catMap: Record<string, number> = {};
        txs.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
            const c = t.category || 'Other';
            catMap[c] = (catMap[c] || 0) + t.amount;
        });
        const categories = Object.entries(catMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

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

    // --- Data Memos ---
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

    const weeklyData = useMemo(() => generateChartData(weeklyTransactions, 'weekly'), [weeklyTransactions]);
    const monthlyData = useMemo(() => generateChartData(monthlyTransactions, 'monthly'), [monthlyTransactions]);

    // --- Derived for Financial Flow ---
    const financialFlow = useMemo(() => {
        let data = flowTimeframe === 'weekly' ? weeklyData : monthlyData;
        const isDeficit = data.expense > data.income;
        const base = isDeficit ? data.expense : (data.income > 0 ? data.income : 1);
        return { ...data, isDeficit, base };
    }, [flowTimeframe, weeklyData, monthlyData]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

            {/* 1. New Financial Flow Analysis (Income Bar) */}
            <Card className="border-slate-100">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-lg text-primary flex items-center gap-2"><span>💸</span> Financial Flow</h3>
                        <p className="text-sm text-muted mt-1">
                            {financialFlow.isDeficit
                                ? <span className="text-destructive font-bold">Deficit Warning: Spending exceeds Income!</span>
                                : <span>You have used <strong>{Math.round((financialFlow.expense / financialFlow.base) * 100)}%</strong> of your income.</span>}
                        </p>
                    </div>
                    <button
                        onClick={() => setFlowTimeframe(prev => prev === 'monthly' ? 'weekly' : 'monthly')}
                        className="text-xs font-medium text-muted bg-slate-100 px-3 py-1.5 rounded-full capitalize hover:text-primary transition-colors"
                    >
                        {flowTimeframe}
                    </button>
                </div>

                {/* 2-Color Bar Viz */}
                <div className="w-full h-8 bg-surface rounded-xl overflow-hidden flex relative border border-slate-100">
                    <div
                        className="h-full bg-destructive flex items-center justify-center text-[10px] font-bold text-white transition-all duration-1000 cursor-pointer group relative"
                        style={{ width: `${Math.min((financialFlow.expense / financialFlow.base) * 100, 100)}%` }}
                    >
                        <div className="absolute bottom-full mb-1 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            Expense: {financialFlow.expense.toLocaleString()}
                        </div>
                        {financialFlow.expense > 0 && ((financialFlow.expense / financialFlow.base) > 0.1) && `${Math.round((financialFlow.expense / financialFlow.base) * 100)}%`}
                    </div>

                    {!financialFlow.isDeficit && (
                        <div
                            className="h-full bg-secondary flex items-center justify-center text-[10px] font-bold text-white transition-all duration-1000 cursor-pointer group relative"
                            style={{ flex: 1 }}
                        >
                            <div className="absolute bottom-full mb-1 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                Savings: {(financialFlow.income - financialFlow.expense).toLocaleString()}
                            </div>
                            {((financialFlow.income - financialFlow.expense) / financialFlow.base > 0.1) &&
                                `${Math.round(((financialFlow.income - financialFlow.expense) / financialFlow.base) * 100)}%`}
                        </div>
                    )}
                </div>

                <div className="flex justify-between mt-2 text-xs font-medium text-muted">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive"></div> Expense</span>
                        {!financialFlow.isDeficit && <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-secondary"></div> Savings</span>}
                    </div>
                    <div>Total Income: <span className="text-secondary font-bold">{financialFlow.income.toLocaleString()}</span></div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 2. Spending Trend Chart */}
                <Card className="h-80 border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-primary">Spending Trend</h3>
                        <button
                            onClick={() => setTrendTimeframe(prev => prev === 'monthly' ? 'weekly' : 'monthly')}
                            className="text-xs font-medium text-muted bg-slate-100 px-3 py-1.5 rounded-full capitalize hover:text-primary transition-colors"
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
                </Card>

                {/* 3. Category Breakdown */}
                <Card className="h-80 flex flex-col border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-primary">By Category</h3>
                        <button
                            onClick={() => setCategoryTimeframe(prev => prev === 'monthly' ? 'weekly' : 'monthly')}
                            className="text-xs font-medium text-muted bg-slate-100 px-3 py-1.5 rounded-full capitalize hover:text-primary transition-colors"
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
                </Card>
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
    );
};

export default TrendsTab;
