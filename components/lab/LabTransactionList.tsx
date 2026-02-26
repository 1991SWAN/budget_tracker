import React, { useMemo, useState, useCallback } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { Transaction, Asset, CategoryItem } from '../../types';
import LabTransactionItem from './LabTransactionItem';
import { EmptyState } from '../ui/EmptyState';
import { Inbox } from 'lucide-react';
import { RegularCandidate } from '../../hooks/useRegularExpenseDetector';

interface LabTransactionListProps {
    transactions: Transaction[];
    assets: Asset[];
    categories: CategoryItem[];
    onEdit: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;
    selectedTxIds: Set<string>;

    // Lab Specific
    candidateTxIds: Set<string>;
    candidates: RegularCandidate[];
    onRegisterRegular: (candidate: RegularCandidate) => void;
}

// Helper to format Human Readable Date Labels
const getDateLabel = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';

    const d = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
        month: 'long',
        day: 'numeric',
        weekday: 'short'
    };

    if (d.getFullYear() !== currentYear) {
        options.year = 'numeric';
    }

    return d.toLocaleDateString('en-US', options);
};

const LabTransactionList: React.FC<LabTransactionListProps> = ({
    transactions,
    assets,
    categories,
    onEdit,
    onDelete,
    selectedTxIds,
    candidateTxIds,
    candidates,
    onRegisterRegular
}) => {
    // Deduplication Set (Memoized)
    const presentTxIds = useMemo(() => new Set(transactions.map(t => t.id)), [transactions]);

    const { sortedData, groupCounts, groupLabels, groupDailyTotals } = useMemo(() => {
        const filtered = transactions.filter(tx => {
            if (tx.type !== 'TRANSFER') return true;
            const hasPartner = !!tx.linkedTransactionId;
            if (!hasPartner) return true;
            const partnerExists = presentTxIds.has(tx.linkedTransactionId!);
            if (!partnerExists) return true;
            if (tx.id > tx.linkedTransactionId!) return false;
            return true;
        });

        const sorted = filtered.sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date);
            return (b.timestamp || 0) - (a.timestamp || 0);
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
                counts.push(currentCount);
                labels.push(currentGroupDate);
                dailyTotals.push(currentTotal);
                currentGroupDate = tx.date;
                currentCount = 1;
                currentTotal = (tx.type === 'INCOME' ? tx.amount : tx.type === 'EXPENSE' ? -tx.amount : 0);
            } else {
                currentCount++;
                currentTotal += (tx.type === 'INCOME' ? tx.amount : tx.type === 'EXPENSE' ? -tx.amount : 0);
            }
            if (index === sorted.length - 1) {
                counts.push(currentCount);
                labels.push(currentGroupDate);
                dailyTotals.push(currentTotal);
            }
        });

        return { sortedData: sorted, groupCounts: counts, groupLabels: labels, groupDailyTotals: dailyTotals };
    }, [transactions, presentTxIds]);


    const virtuosoContext = useMemo(() => ({
        categories,
        assets,
        onEdit,
        onDelete,
        selectedTxIds,
        presentTxIds,
        candidateTxIds,
        candidates,
        onRegisterRegular
    }), [categories, assets, onEdit, onDelete, selectedTxIds, presentTxIds, candidateTxIds, candidates, onRegisterRegular]);

    if (sortedData.length === 0) {
        return (
            <EmptyState
                icon={<Inbox className="w-12 h-12 opacity-20" />}
                title="No transactions found"
                description="Try changing filters or add a new transaction."
                className="py-20"
            />
        );
    }

    return (
        <div className="h-[calc(100vh-280px)] w-full relative">
            <div className="h-full bg-white md:rounded-3xl border-y md:border border-slate-200 shadow-sm overflow-hidden transition-all">
                <GroupedVirtuoso
                    style={{ height: '100%' }}
                    groupCounts={groupCounts}
                    context={virtuosoContext}
                    groupContent={(index) => {
                        const dateStr = groupLabels[index];
                        const dateLabel = getDateLabel(dateStr);
                        const dailyTotal = groupDailyTotals[index];

                        return (
                            <div className="bg-slate-50/98 backdrop-blur-sm px-5 py-2 border-y border-slate-100/60 flex justify-between items-center sticky top-0 z-10">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-0.5 h-3 bg-indigo-500 rounded-full" />
                                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                        {dateLabel}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total</span>
                                    <span className="text-xs font-bold text-slate-700 tabular-nums tracking-tight">
                                        {dailyTotal !== 0 ? (dailyTotal > 0 ? '+' : '') + dailyTotal.toLocaleString() : '0'}
                                    </span>
                                </div>
                            </div>
                        );
                    }}
                    itemContent={(index, _, __, context) => {
                        const tx = sortedData[index];
                        if (!tx) return <></>;

                        const isCandidate = context.candidateTxIds.has(tx.id);
                        // Find data if it's the MOST RECENT one for the group (we only want one expansion per group if possible, but simplest is showing on all instances for testing)
                        // Actually, let's just show it on all instances that are tagged.
                        const candidateData = context.candidates.find(c => c.transactionIds.includes(tx.id));

                        return (
                            <LabTransactionItem
                                transaction={tx}
                                asset={context.assets.find(a => a.id === tx.assetId)}
                                toAsset={tx.toAssetId ? context.assets.find(a => a.id === tx.toAssetId) : undefined}
                                fromAsset={tx.linkedTransactionSourceAssetId ? context.assets.find(a => a.id === tx.linkedTransactionSourceAssetId) : undefined}
                                categories={context.categories}
                                onEdit={context.onEdit}
                                onDelete={context.onDelete}
                                isSelected={context.selectedTxIds.has(tx.id)}
                                // Lab Props
                                isCandidate={isCandidate}
                                candidateData={candidateData}
                                onRegisterRegular={context.onRegisterRegular}
                            />
                        );
                    }}
                />
            </div>
        </div>
    );
};

export default LabTransactionList;
