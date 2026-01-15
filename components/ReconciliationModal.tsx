import React from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Asset, Transaction, CategoryItem } from '../types';
import TransactionItem from './TransactionItem';

// Interfaces matching the hook
interface TransferCandidate {
    withdrawal: Transaction;
    deposit: Transaction;
    score: number;
    timeDiff: number;
}

interface SingleCandidate {
    transaction: Transaction;
    targetAsset: Asset;
    matchReason: string;
}

interface ReconciliationModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: TransferCandidate[];
    singleCandidates?: SingleCandidate[];
    assets: Asset[];
    categories: CategoryItem[];
    onLink: (candidate: TransferCandidate) => void;
    onConvert?: (candidate: SingleCandidate) => void;
    onIgnore: (id: string, isSingle?: boolean) => void;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
    isOpen,
    onClose,
    candidates,
    singleCandidates = [],
    assets,
    categories,
    onLink,
    onConvert,
    onIgnore
}) => {
    if (!isOpen) return null;

    // Combine and Sort by Date (Most recent first)
    // We map them to a common structure for display, but keep original data
    const allItems = [
        ...candidates.map(c => ({ type: 'pair' as const, date: c.withdrawal.date, data: c })),
        ...singleCandidates.map(c => ({ type: 'single' as const, date: c.transaction.date, data: c }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Link Transfers"
            maxWidth="2xl"
        >
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 mb-4">
                    💡 Found <strong>{allItems.length}</strong> items. Review and link them to clean up your transaction list.
                </div>

                {allItems.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">
                        No candidates found.
                    </div>
                ) : (
                    allItems.map((item, index) => {
                        if (item.type === 'pair') {
                            const candidate = item.data as TransferCandidate;
                            const { withdrawal, deposit } = candidate;
                            const dateStr = new Date(item.date).toLocaleDateString();
                            const timeDiff = Math.round(candidate.timeDiff / (1000 * 60)); // minutes

                            return (
                                <div key={`pair-${index}`} className="bg-slate-50 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                                    {/* Header: Date & Time Gap */}
                                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                            {dateStr}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {timeDiff} min gap
                                        </span>
                                    </div>

                                    <div className="p-0">
                                        {/* Withdrawal (Source) */}
                                        <div className="pointer-events-none">
                                            <TransactionItem
                                                transaction={withdrawal}
                                                asset={assets.find(a => a.id === withdrawal.assetId)}
                                                categories={categories}
                                                onEdit={() => { }}
                                                onDelete={() => { }}
                                            />
                                        </div>

                                        {/* Separator */}
                                        {/* Separator Removed for compactness */}


                                        {/* Deposit (Destination) */}
                                        <div className="pointer-events-none">
                                            <TransactionItem
                                                transaction={deposit}
                                                asset={assets.find(a => a.id === deposit.assetId)}
                                                categories={categories}
                                                onEdit={() => { }}
                                                onDelete={() => { }}
                                            />
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="p-3 bg-slate-100 border-t border-slate-200/60 flex justify-end gap-3">
                                        <Button
                                            variant="ghost"
                                            onClick={() => onIgnore(candidate.withdrawal.id, false)}
                                            size="sm"
                                            className="text-slate-400 hover:text-slate-600 hover:bg-white"
                                        >
                                            Ignore
                                        </Button>
                                        <Button
                                            variant="primary"
                                            onClick={() => onLink(candidate)}
                                            size="sm"
                                            className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 px-6 rounded-xl"
                                        >
                                            Link Transactions
                                        </Button>
                                    </div>
                                </div>
                            );
                        } else {
                            // Single Candidate
                            const candidate = item.data as SingleCandidate;
                            const { transaction, targetAsset } = candidate;
                            const dateStr = new Date(item.date).toLocaleDateString();

                            return (
                                <div key={`single-${index}`} className="bg-slate-50 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                                    {/* Header: Date & Tag */}
                                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                            {dateStr}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                            Smart Payment
                                        </span>
                                    </div>

                                    <div className="p-0">
                                        {/* Source Transaction */}
                                        <div className="pointer-events-none">
                                            <TransactionItem
                                                transaction={transaction}
                                                asset={assets.find(a => a.id === transaction.assetId)}
                                                categories={categories}
                                                onEdit={() => { }}
                                                onDelete={() => { }}
                                            />
                                        </div>

                                        {/* Separator - Arrowish */}
                                        {/* Separator Removed for compactness */}


                                        {/* Target Asset Info (Mocking TransactionItem style for consistency) */}
                                        <div className="px-4 py-3 flex items-center gap-3 opacity-60">
                                            <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-lg shadow-sm grayscale">
                                                💳
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-slate-700">To: {targetAsset.name}</div>
                                                <div className="text-xs text-slate-400">{targetAsset.institution}</div>
                                            </div>
                                            <div className="font-bold text-slate-400">
                                                (Auto-Link)
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="p-3 bg-slate-100 border-t border-slate-200/60 flex justify-end gap-3">
                                        <Button
                                            variant="ghost"
                                            onClick={() => onIgnore(transaction.id, true)}
                                            size="sm"
                                            className="text-slate-400 hover:text-slate-600 hover:bg-white"
                                        >
                                            Ignore
                                        </Button>
                                        <Button
                                            variant="primary"
                                            onClick={() => onConvert && onConvert(candidate)}
                                            size="sm"
                                            className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 px-6 rounded-xl"
                                        >
                                            Confirm Transfer
                                        </Button>
                                    </div>
                                </div>
                            );
                        }
                    })
                )}
            </div>

            <div className="mt-6 flex justify-end">
                <Button variant="outline" onClick={onClose}>
                    Done
                </Button>
            </div>
        </Dialog>
    );
};
