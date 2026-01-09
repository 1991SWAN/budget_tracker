import React from 'react';
import { Transaction, TransactionType, Asset } from '../types';

interface TransactionItemProps {
    transaction: Transaction;
    asset?: Asset;
    toAsset?: Asset; // For transfers
    onEdit: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({
    transaction,
    asset,
    toAsset,
    onEdit,
    onDelete
}) => {
    const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);
    const isExpense = transaction.type === TransactionType.EXPENSE;
    const isIncome = transaction.type === TransactionType.INCOME;
    const isTransfer = transaction.type === TransactionType.TRANSFER;

    const formattedAmount = transaction.amount.toLocaleString();

    // Determine sign and color
    let amountSign = '';
    let amountColor = 'text-slate-900'; // Default black for cleaner look
    if (isExpense) {
        amountSign = '-';
        amountColor = 'text-rose-600'; // Color-coded (Red for expense)
    } else if (isIncome) {
        amountSign = '+';
        amountColor = 'text-emerald-600';
    } else if (isTransfer) {
        amountColor = 'text-blue-600';
    }

    // Date Logic
    const dateObj = new Date(transaction.date);
    const mm = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const dd = dateObj.getDate().toString().padStart(2, '0');

    return (
        <div
            className="group grid grid-cols-[auto_1fr_auto] gap-4 items-center p-5 bg-white hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-all cursor-pointer"
            onClick={() => onEdit(transaction)}
        >
            {/* 1. Date Box (Replaces Icon) */}
            <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-50 rounded-2xl border border-slate-100 shrink-0 shadow-sm">
                <span className="text-[9px] uppercase font-bold text-slate-400 leading-none mb-1">Date</span>
                <span className="text-sm font-black text-slate-700 leading-none">{mm}.{dd}</span>
            </div>

            {/* 2. Main Info (Merchant, Text Category, Asset) */}
            <div className="min-w-0 flex flex-col justify-center gap-1.5">
                <p className="font-bold text-slate-900 text-[16px] truncate leading-tight tracking-tight">
                    {transaction.merchant || transaction.memo}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium overflow-hidden">
                    {/* Category Text Badge */}
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md font-bold tracking-wide uppercase text-[10px] shrink-0">
                        {transaction.category}
                    </span>
                    {transaction.installment && (
                        <div className="flex gap-1 shrink-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-slate-50 text-slate-500 border-slate-200">
                                {transaction.installment.totalMonths}개월
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${transaction.installment.isInterestFree
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                : 'bg-rose-50 text-rose-600 border-rose-100'
                                }`}>
                                {transaction.installment.isInterestFree ? '무이자' : '이자'}
                            </span>
                        </div>
                    )}
                    <span className="truncate text-slate-400 shrink min-w-0">
                        {asset?.name || 'Unknown'}
                    </span>
                    {isTransfer && toAsset && (
                        <span className="shrink-0 flex items-center text-slate-300">
                            <span className="mx-1">→</span>
                            <span className="truncate text-slate-400">{toAsset.name}</span>
                        </span>
                    )}
                </div>
            </div>

            {/* 3. Amount & Actions */}
            <div className="text-right shrink-0 flex flex-col items-end justify-center">
                <p className={`font-bold text-lg tabular-nums tracking-tight ${amountColor}`}>
                    {amountSign}{formattedAmount}
                    <span className="text-[11px] ml-1 text-slate-400 font-normal">KRW</span>
                </p>
                {/* Monthly Installment Amount Display */}
                {transaction.installment && transaction.installment.totalMonths > 1 && (
                    <p className="text-[11px] font-bold text-slate-500 mt-1">
                        (월 {Math.round(transaction.amount / transaction.installment.totalMonths).toLocaleString()})
                    </p>
                )}

                <div className="flex flex-col items-end mt-0.5">
                    {transaction.installment && (
                        <div className="flex items-center gap-1">
                            <p className="text-[10px] text-slate-400 font-medium">
                                {transaction.installment.currentMonth}/{transaction.installment.totalMonths}회차
                            </p>
                        </div>
                    )}
                </div>

                <div className="h-4 flex items-center mt-1">
                    <button
                        className={`opacity-0 group-hover:opacity-100 transition-all text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${isConfirmingDelete
                            ? 'bg-rose-600 text-white opacity-100 scale-105'
                            : 'text-rose-500 hover:text-rose-700 bg-rose-50'
                            }`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isConfirmingDelete) {
                                onDelete(transaction);
                            } else {
                                setIsConfirmingDelete(true);
                                setTimeout(() => setIsConfirmingDelete(false), 3000); // Reset after 3s
                            }
                        }}
                    >
                        {isConfirmingDelete ? 'Confirm?' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransactionItem;
