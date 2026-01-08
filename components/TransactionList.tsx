import React from 'react';
import { Transaction, Asset } from '../types';
import TransactionItem from './TransactionItem';

interface TransactionListProps {
    transactions: Transaction[];
    assets: Asset[];
    onEdit: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;
    searchTerm: string; // Used for "Empty State" messaging if needed
}

// Helper to format Human Readable Date Labels
const getDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';

    // Format: "May 20, Mon" (Simple JS date formatting)
    const d = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
        month: 'long',
        day: 'numeric',
        weekday: 'short'
    };
    return d.toLocaleDateString('en-US', options);
};

const TransactionList: React.FC<TransactionListProps> = ({
    transactions,
    assets,
    onEdit,
    onDelete
}) => {
    // 1. Group by Date
    const grouped: Record<string, Transaction[]> = {};

    // Assuming transactions are already sorted desc by date from App.tsx/Supabase
    // If not, we might need to sort here, but better to sort at source.
    transactions.forEach(tx => {
        if (!grouped[tx.date]) grouped[tx.date] = [];
        grouped[tx.date].push(tx);
    });

    const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a)); // Ensure Descending

    // Empty State
    if (dates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="text-4xl mb-2">🍃</div>
                <p className="font-bold text-sm">No transactions found</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            {dates.map(date => {
                const dateLabel = getDateLabel(date);
                const dayTxs = grouped[date];

                // Calculate Daily Total (Optional UI enhancement)
                const dailyTotal = dayTxs.reduce((sum, t) => {
                    if (t.type === 'INCOME') return sum + t.amount;
                    if (t.type === 'EXPENSE') return sum - t.amount;
                    return sum;
                }, 0);

                return (
                    <div key={date} className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {/* Sticky Header */}
                        <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm px-1 py-2 mb-2 flex justify-between items-end border-b border-slate-200/50">
                            <span className="text-sm font-black text-slate-400 uppercase tracking-widest pl-1">
                                {dateLabel}
                            </span>
                            <span className={`text-xs font-bold ${dailyTotal > 0 ? 'text-emerald-500' : dailyTotal < 0 ? 'text-slate-400' : 'text-slate-300'}`}>
                                {dailyTotal !== 0 ? (dailyTotal > 0 ? '+' : '') + dailyTotal.toLocaleString() : ''}
                            </span>
                        </div>

                        {/* List Group */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                            {dayTxs.map(tx => (
                                <TransactionItem
                                    key={tx.id}
                                    transaction={tx}
                                    asset={assets.find(a => a.id === tx.assetId)}
                                    toAsset={tx.toAssetId ? assets.find(a => a.id === tx.toAssetId) : undefined}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default TransactionList;
