import React, { useMemo } from 'react';
import { Card } from '../ui/Card';
import { Asset, Transaction, TransactionType, AssetType } from '../../types';

interface FinancialHealthWidgetProps {
    monthlyBudget: number;
    monthlyExpense: number;
    assets: Asset[];
    transactions: Transaction[];
}

export const FinancialHealthWidget: React.FC<FinancialHealthWidgetProps> = ({
    monthlyBudget,
    monthlyExpense,
    assets,
    transactions
}) => {
    const scoreData = useMemo(() => {
        // 1. Budget Adherence (40 points max)
        // If expense < budget, full points. Else proportional deduction.
        const budgetRatio = monthlyExpense / Math.max(1, monthlyBudget);
        let budgetScore = 40;
        if (budgetRatio > 1) {
            budgetScore = Math.max(0, 40 - (budgetRatio - 1) * 100);
        }

        // 2. Savings Rate (30 points max)
        // Ideal: 20% of income saved. (Assuming Budget ~= Income for simplicity or using Inflow)
        // Let's use Income - Expense from transactions
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyIncome = transactions
            .filter(t => t.date.startsWith(currentMonth) && t.type === TransactionType.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);

        const savings = monthlyIncome - monthlyExpense;
        const savingsRate = monthlyIncome > 0 ? savings / monthlyIncome : 0;
        const savingsScore = Math.min(30, Math.max(0, (savingsRate / 0.20) * 30)); // 20% savings = 30 points

        // 3. Liquidity / Cash Buffer (30 points max)
        // Do we have enough cash assets to cover 1 month of budget?
        const cashAssets = assets
            .filter(a => a.type === AssetType.CHECKING || a.type === AssetType.SAVINGS || a.type === AssetType.CASH)
            .reduce((sum, a) => sum + a.balance, 0);

        const liquidityRatio = cashAssets / Math.max(1, monthlyBudget);
        const liquidityScore = Math.min(30, Math.max(0, liquidityRatio * 30)); // 1 month buffer = 30 points

        const totalScore = Math.round(budgetScore + savingsScore + liquidityScore);

        let grade = 'B';
        let color = 'text-blue-500';
        let message = 'Good job!';

        if (totalScore >= 90) { grade = 'S'; color = 'text-purple-500'; message = 'Excellent!'; }
        else if (totalScore >= 80) { grade = 'A'; color = 'text-emerald-500'; message = 'Great!'; }
        else if (totalScore >= 70) { grade = 'B'; color = 'text-blue-500'; message = 'Good'; }
        else if (totalScore >= 50) { grade = 'C'; color = 'text-orange-500'; message = 'Fair'; }
        else { grade = 'D'; color = 'text-red-500'; message = 'Needs Attention'; }

        return { totalScore, grade, color, message, details: { budgetScore, savingsScore, liquidityScore } };
    }, [monthlyBudget, monthlyExpense, assets, transactions]);

    const circumference = 2 * Math.PI * 40; // radius 40
    const dashoffset = circumference - (scoreData.totalScore / 100) * circumference;

    return (
        <Card className="p-6 flex flex-col items-center justify-center relative overflow-hidden h-full">

            {/* Background Blob */}
            <div className={`absolute top-0 right-0 w-24 h-24 bg-current opacity-5 rounded-full blur-3xl -mr-6 -mt-6 ${scoreData.color}`} />

            <div className="relative w-24 h-24 flex items-center justify-center mb-2">
                {/* SVG Radial Progress */}
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="48"
                        cy="48"
                        r="36"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        className="text-slate-100"
                    />
                    <circle
                        cx="48"
                        cy="48"
                        r="36"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 36}
                        strokeDashoffset={(2 * Math.PI * 36) - (scoreData.totalScore / 100) * (2 * Math.PI * 36)}
                        strokeLinecap="round"
                        className={`${scoreData.color} transition-all duration-1000 ease-out`}
                    />
                </svg>
                <div className="absolute flex flex-col items-center">
                    <span className={`text-2xl font-black ${scoreData.color}`}>{scoreData.grade}</span>
                    <span className="text-[10px] font-bold text-slate-400">RANK</span>
                </div>
            </div>

            <div className="text-center w-full">
                <div className="text-lg font-bold text-slate-800 mb-0">{scoreData.totalScore} <span className="text-xs font-medium text-slate-400">/ 100</span></div>
                <div className={`text-sm font-bold opacity-80 mb-4 ${scoreData.color}`}>{scoreData.message}</div>

                {/* Micro Stats */}
                <div className="flex gap-4 text-xs text-slate-500">
                    <div className="flex flex-col items-center">
                        <span className="font-bold">{Math.round(scoreData.details.budgetScore)}/40</span>
                        <span>Budget</span>
                    </div>
                    <div className="w-px bg-slate-200 h-8" />
                    <div className="flex flex-col items-center">
                        <span className="font-bold">{Math.round(scoreData.details.savingsScore)}/30</span>
                        <span>Saving</span>
                    </div>
                    <div className="w-px bg-slate-200 h-8" />
                    <div className="flex flex-col items-center">
                        <span className="font-bold">{Math.round(scoreData.details.liquidityScore)}/30</span>
                        <span>Cash</span>
                    </div>
                </div>
            </div>
        </Card>
    );
};
