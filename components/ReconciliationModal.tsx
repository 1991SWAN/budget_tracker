import React from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Asset, Transaction } from '../types';

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
    onLink: (candidate: TransferCandidate) => void;
    onIgnore: (candidate: TransferCandidate) => void;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
    isOpen,
    onClose,
    candidates,
    assets,
    onLink,
    onIgnore
}) => {
    if (!isOpen) return null;

    const getAssetName = (id: string) => assets.find(a => a.id === id)?.name || 'Unknown Asset';

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
                        const amountStr = withdrawal.amount.toLocaleString();

                        return (
                            <div key={`${withdrawal.id}-${deposit.id}`} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

                                    {/* Transfer Details */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="font-bold text-slate-800 text-lg">
                                                {amountStr}
                                            </span>
                                            <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-1 rounded-full">
                                                {dateStr}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 text-sm">
                                            {/* From */}
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold">
                                                    Out
                                                </div>
                                                <span className="font-medium text-slate-700">
                                                    {getAssetName(withdrawal.assetId)}
                                                </span>
                                            </div>

                                            <span className="text-slate-300">→</span>

                                            {/* To */}
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
                                                    In
                                                </div>
                                                <span className="font-medium text-slate-700">
                                                    {getAssetName(deposit.assetId)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-2 pl-1">
                                            Memo: {withdrawal.memo} / {deposit.memo}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            variant="ghost"
                                            onClick={() => onIgnore(candidate)}
                                            size="sm"
                                            className="text-slate-400 hover:text-slate-600"
                                        >
                                            Ignore
                                        </Button>
                                        <Button
                                            variant="primary"
                                            onClick={() => onLink(candidate)}
                                            size="sm"
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            Link
                                        </Button>
                                    </div>
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
