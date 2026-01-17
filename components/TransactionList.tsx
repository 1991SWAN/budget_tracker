import React, { useMemo, useState, useCallback } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { Transaction, Asset, CategoryItem } from '../types';
import TransactionItem from './TransactionItem';
import { Card } from './ui/Card';
import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';

interface TransactionListProps {
    transactions: Transaction[];
    assets: Asset[];
    categories: CategoryItem[];
    onEdit: (tx: Transaction) => void;
    onDelete: (tx: Transaction) => void;
    onDeleteTransactions?: (ids: string[]) => void;
    searchTerm: string;
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

    // Add year if not current year
    if (d.getFullYear() !== currentYear) {
        options.year = 'numeric';
    }

    return d.toLocaleDateString('en-US', options);
};

const TransactionList: React.FC<TransactionListProps> = ({
    transactions,
    assets,
    categories,
    onEdit,
    onDelete,
    onDeleteTransactions
}) => {
    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const isSelectionMode = selectedIds.size > 0;
    const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false);

    // Handlers
    const handleToggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (selectedIds.size === transactions.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(transactions.map(t => t.id)));
        }
    }, [selectedIds.size, transactions]);

    const handleLongPress = useCallback((id: string) => {
        // Enter selection mode and select the item
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        // Vibration (Short)
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    }, []);

    const handleCancelSelection = useCallback(() => {
        setSelectedIds(new Set());
        setIsConfirmingBulkDelete(false);
    }, []);

    const handleBulkDelete = useCallback(() => {
        if (onDeleteTransactions) {
            onDeleteTransactions(Array.from(selectedIds));
            handleCancelSelection(); // Exit mode
        }
    }, [selectedIds, onDeleteTransactions, handleCancelSelection]);


    // Deduplication Set (Memoized)
    const presentTxIds = useMemo(() => new Set(transactions.map(t => t.id)), [transactions]);

    const { sortedData, groupCounts, groupLabels, groupDailyTotals } = useMemo(() => {
        // V3 Deduplication & Sorting Strategy:
        // We filter out "Destination" transfers if their partner "Source" is also in the list.
        // This must be done BEFORE sorting and grouping to ensure virtualization and counts are accurate.

        const filtered = transactions.filter(tx => {
            if (tx.type !== 'TRANSFER') return true;

            const hasPartner = !!tx.linkedTransactionId;
            if (!hasPartner) return true;

            const partnerExists = presentTxIds.has(tx.linkedTransactionId!);
            if (!partnerExists) return true;

            // Strict Deduplication:
            // We only hide ONE half of the pair. 
            // We'll use a stable sort basis (ID comparison) to decide which one to hide.
            // Hide the one that is lexicographically "after" the partner to ensure consistency.
            if (tx.id > tx.linkedTransactionId!) {
                return false;
            }
            return true;
        });

        // Sort transactions by Date Descending
        const sorted = filtered.sort((a, b) => {
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
    }, [transactions, presentTxIds]); // presentTxIds added to dependencies




    // Memoize Context to prevent Virtuoso Item re-renders
    const virtuosoContext = useMemo(() => ({
        categories,
        assets,
        onEdit,
        onDelete,
        selectedIds,
        isSelectionMode,
        handleToggleSelection,
        handleLongPress,
        presentTxIds
    }), [categories, assets, onEdit, onDelete, selectedIds, isSelectionMode, handleToggleSelection, handleLongPress, presentTxIds]);

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
        <div className="h-[calc(100vh-280px)] w-full relative">
            {/* Selection Header Overlay (Optional - currently using bottom bar heavily) */}

            {/* Minimal List Container */}
            <div className={`h-full bg-white md:rounded-3xl border-y md:border border-slate-200 shadow-sm overflow-hidden transition-all ${isSelectionMode ? 'pb-20' : ''}`}>
                <GroupedVirtuoso
                    key={transactions.length}
                    style={{ height: '100%' }}
                    groupCounts={groupCounts}
                    context={virtuosoContext}
                    groupContent={(index) => {
                        const dateStr = groupLabels[index];
                        const dateLabel = getDateLabel(dateStr);
                        const dailyTotal = groupDailyTotals[index];

                        return (
                            <div className="bg-slate-50/95 backdrop-blur-md px-6 py-2 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    {dateLabel}
                                </span>
                                <span className={`text-xs font-bold ${dailyTotal > 0 ? 'text-emerald-600' : dailyTotal < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                    {dailyTotal !== 0 ? (dailyTotal > 0 ? '+' : '') + dailyTotal.toLocaleString() : '-'}
                                </span>
                            </div>
                        );
                    }}
                    itemContent={(index, _, __, context) => {
                        const tx = sortedData[index];
                        if (!tx) return <></>;
                        const {
                            categories,
                            assets,
                            onEdit,
                            onDelete,
                            selectedIds,
                            isSelectionMode,
                            handleToggleSelection,
                            handleLongPress,
                            presentTxIds
                        } = context;

                        const isSelected = selectedIds.has(tx.id);

                        return (
                            <div className={`border-b border-slate-50 last:border-0 transition-colors ${isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'}`}>
                                <TransactionItem
                                    transaction={tx}
                                    asset={assets.find(a => a.id === tx.assetId)}
                                    toAsset={tx.toAssetId ? assets.find(a => a.id === tx.toAssetId) : undefined}
                                    fromAsset={tx.linkedTransactionSourceAssetId ? assets.find(a => a.id === tx.linkedTransactionSourceAssetId) : undefined}
                                    categories={categories}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    // Selection Props
                                    isSelectionMode={isSelectionMode}
                                    isSelected={isSelected}
                                    onToggleSelect={() => handleToggleSelection(tx.id)}
                                    onLongPress={() => handleLongPress(tx.id)}
                                    // Deduplication Prop
                                    presentTxIds={presentTxIds}
                                />
                            </div>
                        );
                    }}
                />
            </div>

            {/* Bottom Floating Action Bar (Selection Mode) */}
            {isSelectionMode && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 min-w-[300px] w-[90%] md:w-[400px] bg-slate-900/90 backdrop-blur-xl text-white rounded-2xl shadow-2xl border border-slate-700/50 p-2 flex items-center justify-between z-50 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-3 px-3">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 font-bold text-xs">
                            {selectedIds.size}
                        </div>
                        <span className="text-sm font-medium text-slate-200">Selected</span>
                    </div>

                    <div className="flex items-center gap-2">
                        {isConfirmingBulkDelete ? (
                            <>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setIsConfirmingBulkDelete(false)}
                                    className="text-slate-300 hover:text-white hover:bg-white/10"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleBulkDelete}
                                    className="bg-rose-600 hover:bg-rose-700 text-white border-none"
                                >
                                    Confirm Delete
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelSelection}
                                    className="text-slate-300 hover:text-white hover:bg-white/10 h-8 text-xs font-medium"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => setIsConfirmingBulkDelete(true)}
                                    className="bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 transition-all h-8 text-xs"
                                >
                                    Delete ({selectedIds.size})
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionList;
