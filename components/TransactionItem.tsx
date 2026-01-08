import React from 'react';
import { Transaction, TransactionType, Asset } from '../types';
import { CATEGORY_EMOJIS } from '../constants';

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
    const isExpense = transaction.type === TransactionType.EXPENSE;
    const isIncome = transaction.type === TransactionType.INCOME;
    const isTransfer = transaction.type === TransactionType.TRANSFER;

    const formattedAmount = transaction.amount.toLocaleString();

    // Determine sign and color
    let amountSign = '';
    let amountColor = 'text-slate-800'; // Default
    if (isExpense) {
        amountSign = '-';
        amountColor = 'text-rose-600';
    } else if (isIncome) {
        amountSign = '+';
        amountColor = 'text-emerald-600';
    } else if (isTransfer) {
        amountColor = 'text-blue-600';
    }

    // Determine Icon
    const emoji = transaction.emoji || CATEGORY_EMOJIS[transaction.category as string] || '📦';

    return (
        <div
            className="group flex items-center p-3 bg-white hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors cursor-pointer"
            onClick={() => onEdit(transaction)}
        >
            {/* 1. Icon Box */}
            <div className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full text-xl shrink-0 mr-3">
                {emoji}
            </div>

            {/* 2. Main Info (Memo + Asset) */}
            <div className="flex-1 min-w-0 mr-2">
                <p className="font-bold text-slate-800 text-sm truncate leading-tight mb-0.5">
                    {transaction.memo}
                </p>
                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                    {isTransfer && <span className="text-xs">💸</span>}
                    <span>{asset?.name || 'Unknown Asset'}</span>
                    {isTransfer && toAsset && (
                        <>
                            <span className="text-slate-300">→</span>
                            <span>{toAsset.name}</span>
                        </>
                    )}
                </p>
            </div>

            {/* 3. Amount & Actions */}
            <div className="text-right shrink-0">
                <p className={`font-bold text-sm ${amountColor}`}>
                    {amountSign}{formattedAmount} <span className="text-[10px] text-slate-400">KRW</span>
                </p>

                {/* Hidden delete button that appears on hover/swipe logic could go here, 
            but for now we keep it simple or use long-press/context menu in future. 
            For this phase, let's add a small delete button that shows on group hover on desktop
        */}
                <div className="hidden group-hover:flex justify-end mt-1">
                    <button
                        className="text-[10px] text-rose-400 hover:text-rose-600 uppercase font-bold tracking-wider"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this transaction?')) onDelete(transaction);
                        }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransactionItem;
