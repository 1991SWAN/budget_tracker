import React from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Asset, Transaction, CategoryItem } from '../types';
import TransactionItem from './TransactionItem';

// Valid Candidate Interface (imported or redefined locally to match hook)
interface TransferCandidate {
    withdrawal: Transaction;
    deposit: Transaction;
    score: number;
    timeDiff: number;
}

interface ReconciliationModalProps {
    isOpen: boolean;
    onClose: () => void;
    candidates: TransferCandidate[];
    assets: Asset[];
    categories: CategoryItem[];
    onLink: (candidate: TransferCandidate) => void;
    onIgnore: (candidate: TransferCandidate) => void;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
    isOpen,
    onClose,
    candidates,
    assets,
    categories,
    onLink,
    onIgnore
}) => {
    if (!isOpen) return null;

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Link Transfers"
            maxWidth="2xl"
        >
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 mb-4">
                    💡 SmartPenny found <strong>{candidates.length}</strong> potential transfer pairs.
                    Review and link them to clean up your transaction list.
                </div>

                {candidates.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">
                        No candidates found.
                    </div>
                ) : (
                    candidates.map((candidate, index) => {
                        const { withdrawal, deposit } = candidate;
                        const dateStr = new Date(withdrawal.date).toLocaleDateString();
                        const timeDiff = Math.round(candidate.timeDiff / (1000 * 60)); // minutes

                        return (
                            <div key={`${withdrawal.id}-${deposit.id}`} className="bg-slate-50 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
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
                                    {/* Withdrawal Item (Source) */}
                                    <div className="pointer-events-none">
                                        <TransactionItem
                                            transaction={withdrawal}
                                            asset={assets.find(a => a.id === withdrawal.assetId)}
                                            categories={categories}
                                            onEdit={() => { }}
                                            onDelete={() => { }}
                                        />
                                    </div>

                                    {/* Visual Separator/Margin instead of Chain Icon */}
                                    <div className="mx-4 my-1 border-t border-dashed border-slate-100"></div>

                                    {/* Deposit Item (Destination) */}
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

                                {/* Action Footer */}
                                <div className="p-3 bg-slate-100 border-t border-slate-200/60 flex justify-end gap-3">
                                    <Button
                                        variant="ghost"
                                        onClick={() => onIgnore(candidate)}
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
