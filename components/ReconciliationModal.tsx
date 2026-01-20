import React, { useState } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { Asset, Transaction, CategoryItem } from '../types';
import TransactionItem from './TransactionItem';
import { Link2, CreditCard, Sparkles, CheckCircle2, History } from 'lucide-react';

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
    const [activeTab, setActiveTab] = useState<'LINK' | 'CREDIT'>('LINK');

    if (!isOpen) return null;

    // Filter items based on tab
    const filteredCandidates = candidates.sort((a, b) => new Date(b.withdrawal.date).getTime() - new Date(a.withdrawal.date).getTime());
    const filteredSingles = singleCandidates.sort((a, b) => new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime());

    const totalCount = candidates.length + singleCandidates.length;

    const TabButton = ({ id, label, icon: Icon, count }: { id: 'LINK' | 'CREDIT', label: string, icon: any, count: number }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all duration-300 relative ${activeTab === id
                ? 'bg-white text-slate-900 shadow-lg shadow-slate-200 ring-1 ring-slate-100'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
        >
            <Icon size={16} />
            <span className="text-sm">{label}</span>
            {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === id ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {count}
                </span>
            )}
        </button>
    );

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Link Transfers"
            maxWidth="2xl"
        >
            <div className="flex flex-col h-full -mt-2">
                {/* Intro Info */}
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-3 mb-6 transition-all hover:bg-white hover:shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
                        <Sparkles size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800 leading-tight">Smart Discovery</p>
                        <p className="text-xs text-slate-500 font-medium">Found {totalCount} cleaning opportunities for your records.</p>
                    </div>
                </div>

                {/* Custom Tabs */}
                <div className="bg-slate-100/50 p-1 rounded-2xl flex gap-1 mb-6 border border-slate-100">
                    <TabButton
                        id="LINK"
                        label="Transaction Links"
                        icon={Link2}
                        count={candidates.length}
                    />
                    <TabButton
                        id="CREDIT"
                        label="Credit Payments"
                        icon={CreditCard}
                        count={singleCandidates.length}
                    />
                </div>

                {/* Content Area */}
                <div className="space-y-6 max-h-[55vh] overflow-y-auto px-1 custom-scrollbar">
                    {activeTab === 'LINK' ? (
                        filteredCandidates.length === 0 ? (
                            <div className="text-center text-slate-400 py-16 space-y-3">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                                    <CheckCircle2 size={32} />
                                </div>
                                <p className="text-sm font-bold">No transfer pairs found.</p>
                            </div>
                        ) : (
                            filteredCandidates.map((candidate, index) => (
                                <div key={`pair-${index}`} className="group relative bg-white border border-slate-100 rounded-[28px] overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-200">
                                    {/* Header */}
                                    <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-50 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <History size={12} className="text-slate-400" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                {new Date(candidate.withdrawal.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-100 px-2.5 py-1 rounded-full shadow-sm">
                                            {Math.round(candidate.timeDiff / (1000 * 60))} MIN OFFSET
                                        </span>
                                    </div>

                                    <div className="p-0 divide-y divide-slate-50">
                                        <div className="pointer-events-none opacity-90 transition-opacity group-hover:opacity-100">
                                            <TransactionItem
                                                transaction={candidate.withdrawal}
                                                asset={assets.find(a => a.id === candidate.withdrawal.assetId)}
                                                categories={categories}
                                                onEdit={() => { }}
                                                onDelete={() => { }}
                                            />
                                        </div>
                                        <div className="pointer-events-none opacity-90 transition-opacity group-hover:opacity-100">
                                            <TransactionItem
                                                transaction={candidate.deposit}
                                                asset={assets.find(a => a.id === candidate.deposit.assetId)}
                                                categories={categories}
                                                onEdit={() => { }}
                                                onDelete={() => { }}
                                            />
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 px-6">
                                        <button
                                            onClick={() => onIgnore(candidate.withdrawal.id, false)}
                                            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors"
                                        >
                                            Dismiss
                                        </button>
                                        <Button
                                            variant="primary"
                                            onClick={() => onLink(candidate)}
                                            size="sm"
                                            className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 px-8 rounded-full transform active:scale-95 transition-all font-bold text-xs"
                                        >
                                            Link Transfer
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        filteredSingles.length === 0 ? (
                            <div className="text-center text-slate-400 py-16 space-y-3">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                                    <CheckCircle2 size={32} />
                                </div>
                                <p className="text-sm font-bold">No credit payments detected.</p>
                            </div>
                        ) : (
                            filteredSingles.map((candidate, index) => (
                                <div key={`single-${index}`} className="group relative bg-white border border-slate-100 rounded-[28px] overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-200">
                                    <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-50 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <History size={12} className="text-slate-400" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                {new Date(candidate.transaction.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                                            CARD PAYMENT
                                        </span>
                                    </div>

                                    <div className="p-0">
                                        <div className="pointer-events-none">
                                            <TransactionItem
                                                transaction={candidate.transaction}
                                                asset={assets.find(a => a.id === candidate.transaction.assetId)}
                                                categories={categories}
                                                onEdit={() => { }}
                                                onDelete={() => { }}
                                            />
                                        </div>
                                        <div className="px-5 py-4 flex items-center gap-4 bg-emerald-50/20">
                                            <div className="flex-1">
                                                <div className="text-xs font-black text-slate-400 uppercase tracking-tight mb-0.5">Target Asset</div>
                                                <div className="text-sm font-bold text-slate-800">{candidate.targetAsset.name}</div>
                                                <div className="text-[10px] text-slate-500 font-medium">{candidate.targetAsset.institution}</div>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-emerald-600">
                                                <Sparkles size={14} />
                                                <span className="text-[10px] font-black uppercase">Auto-Match</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 px-6">
                                        <button
                                            onClick={() => onIgnore(candidate.transaction.id, true)}
                                            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors"
                                        >
                                            Dismiss
                                        </button>
                                        <Button
                                            variant="primary"
                                            onClick={() => onConvert && onConvert(candidate)}
                                            size="sm"
                                            className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 px-8 rounded-full transform active:scale-95 transition-all font-bold text-xs"
                                        >
                                            Confirm Transfer
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>

                <div className="mt-8 flex justify-center">
                    <button
                        onClick={onClose}
                        className="text-sm font-bold text-slate-400 hover:text-slate-950 transition-colors py-2 px-8"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Dialog>
    );
};
