import React, { useMemo } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { Transaction, Asset, CategoryItem } from '../types';
import TransactionItem from './TransactionItem';
import { Card } from './ui/Card';
import { EmptyState } from './ui/EmptyState';

interface TransactionListProps {
    transactions: Transaction[];
    assets: Asset[];
    categories: CategoryItem[];
    onEdit: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;
    searchTerm: string;
}

// Helper to format Human Readable Date Labels
const getDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';

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
    categories,
    onEdit,
    onDelete
}) => {
    const { sortedData, groupCounts, groupLabels, groupDailyTotals } = useMemo(() => {
        // Sort transactions by Date Descending
        const sorted = [...transactions].sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return (b.timestamp || 0) - (a.timestamp || 0); // stable sort within day
        });

        const counts: number[] = [];
        const labels: string[] = [];
        const dailyTotals: number[] = [];

        if (sorted.length === 0) return { sortedData: [], groupCounts: [], groupLabels: [], groupDailyTotals: [] };

        let currentGroupDate = sorted[0].date;
        let currentCount = 0;
        let currentTotal = 0;

        sorted.forEach((tx, index) => {
            if (tx.date !== currentGroupDate) {
                // Push previous group
                counts.push(currentCount);
                labels.push(currentGroupDate);
                dailyTotals.push(currentTotal);

                // Start new group
                currentGroupDate = tx.date;
                currentCount = 1;
                currentTotal = (tx.type === 'INCOME' ? tx.amount : tx.type === 'EXPENSE' ? -tx.amount : 0);
            } else {
                currentCount++;
                currentTotal += (tx.type === 'INCOME' ? tx.amount : tx.type === 'EXPENSE' ? -tx.amount : 0);
            }

            // Handle last item
            if (index === sorted.length - 1) {
                counts.push(currentCount);
                labels.push(currentGroupDate);
                dailyTotals.push(currentTotal);
            }
        });

        return { sortedData: sorted, groupCounts: counts, groupLabels: labels, groupDailyTotals: dailyTotals };
    }, [transactions]);


    // Empty State
    if (sortedData.length === 0) {
        return (
            <EmptyState
                icon="🍃"
                title="No transactions found"
                description="Try changing filters or add a new transaction."
                className="py-20"
            />
        );
    }

    return (
        <div className="h-[calc(100vh-280px)] bg-surface rounded-3xl border border-slate-200/50 max-w-3xl mx-auto backdrop-blur-sm">
            {/* Height calculation expects header/filters above. Adjust as needed or use flex-grow in parent */}
            <GroupedVirtuoso
                style={{ height: '100%' }}
                groupCounts={groupCounts}
                context={{ categories, assets, onEdit, onDelete }}
                groupContent={(index) => {
                    const dateStr = groupLabels[index];
                    const dateLabel = getDateLabel(dateStr);
                    const dailyTotal = groupDailyTotals[index];

                    return (
                        <div className="bg-surface/95 backdrop-blur-md px-5 py-3 border-b border-slate-200/50 flex justify-between items-end sticky top-0 z-10 shadow-sm transition-all">
                            <span className="text-xs font-black text-muted uppercase tracking-widest pl-1">
                                {dateLabel}
                            </span>
                            <span className={`text-xs font-bold ${dailyTotal > 0 ? 'text-emerald-600' : dailyTotal < 0 ? 'text-destructive' : 'text-muted'}`}>
                                {dailyTotal !== 0 ? (dailyTotal > 0 ? '+' : '') + dailyTotal.toLocaleString() : ''}
                            </span>
                        </div>
                    );
                }}
                itemContent={(index, _, __, context) => {
                    const tx = sortedData[index];
                    if (!tx) return <></>; // Safety fallback
                    const { categories, assets, onEdit, onDelete } = context;

                    return (
                        <Card className="mx-3 my-1 border-slate-100 overflow-hidden first:mt-2 last:mb-4" noPadding>
                            <TransactionItem
                                transaction={tx}
                                asset={assets.find(a => a.id === tx.assetId)}
                                toAsset={tx.toAssetId ? assets.find(a => a.id === tx.toAssetId) : undefined}
                                categories={categories}
                                onEdit={onEdit}
                                onDelete={onDelete}
                            />
                        </Card>
                    );
                }}
            />
        </div>
    );
};

export default TransactionList;
