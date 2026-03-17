import React from 'react';
import { Transaction, Asset, CategoryItem, RecurringTransaction, BillType, Category } from '../../types';
import { useRegularExpenseDetector, RegularCandidate } from '../../hooks/useRegularExpenseDetector';
import LabTransactionList from './LabTransactionList';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Sparkles, Loader2, Info, Trash2, X } from 'lucide-react';
import { useLabController } from '../../hooks/useLabController';

interface LabTabProps {
    transactions: Transaction[]; // These are filtered by month (from App.tsx dashboard)
    assets: Asset[];
    categories: CategoryItem[];
    recurring: RecurringTransaction[];
    onRecurringChange: (action: 'add' | 'update' | 'delete' | 'pay', item: any) => void;
    onEditTransaction: (transaction: Transaction) => void;
}

const LabTab: React.FC<LabTabProps> = ({
    transactions, // Unused here, we fetch full history
    assets,
    categories,
    recurring,
    onRecurringChange,
    onEditTransaction
}) => {
    const {
        allTransactions,
        isLoading,
        selectedTxIds,
        handleInlineEdit,
        handleToggleDelete,
        handleConfirmDelete,
        clearSelection,
    } = useLabController();

    // 1. Run the Detection Hook on the FULL dataset
    const { candidates, candidateTxIds } = useRegularExpenseDetector(allTransactions, recurring);

    // 2. Handle Registration
    const handleRegisterRegular = (candidate: RegularCandidate) => {
        onRecurringChange('add', {
            name: candidate.name,
            amount: candidate.averageAmount,
            dayOfMonth: new Date(candidate.lastDate).getDate(),
            category: Category.OTHER, // Default, user can edit later
            billType: BillType.SUBSCRIPTION,
            groupName: 'Auto Detected' // Special group
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col relative">
            <Card padding="lg" className="bg-amber-50 border-amber-200">
                <div className="flex gap-3 items-center text-amber-900">
                    <Sparkles className="text-amber-500 shrink-0" />
                    <div className="min-w-0">
                        <h2 className="font-bold text-lg truncate">Lab: Regular Expense Auto-Detection</h2>
                        <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                            This is a testing ground for the auto-detection algorithm and Spreadsheet-like editing UI.
                            <br />
                            We scanned your entire transaction history and found <strong>{candidates.length}</strong> candidate(s).
                        </p>
                    </div>
                </div>
            </Card>

            <div className="px-1 py-2 flex items-center gap-2 text-slate-500 text-sm">
                <Info size={16} className="text-indigo-400" />
                <p><strong>Pro Tip:</strong> Click directly on Date, Category, Memo, or Amount below to edit instantly without opening a modal.</p>
            </div>

            {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 min-h-[300px]">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm font-medium">Analyzing full transaction history...</p>
                </div>
            ) : (
                <div className="flex-1">
                    <LabTransactionList
                        transactions={allTransactions}
                        assets={assets}
                        categories={categories}
                        onEdit={handleInlineEdit}
                        onDelete={handleToggleDelete}
                        selectedTxIds={selectedTxIds}
                        // Lab Props
                        candidateTxIds={candidateTxIds}
                        candidates={candidates}
                        onRegisterRegular={handleRegisterRegular}
                    />
                </div>
            )}

            {/* Floating Action Bar for Deletion */}
            {selectedTxIds.size > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8 fade-in duration-300">
                    <div className="bg-slate-900 text-white pl-5 pr-3 py-3 rounded-2xl shadow-xl flex items-center gap-5">
                        <span className="text-sm font-medium whitespace-nowrap">
                            {selectedTxIds.size} items selected
                        </span>
                        <div className="flex items-center gap-3 w-[1px] h-6 bg-slate-700/50 mx-1"></div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleConfirmDelete}
                                size="sm"
                                className="h-8 bg-rose-600 hover:bg-rose-500 text-white border-transparent shadow-sm flex items-center gap-1.5 rounded-xl px-3"
                            >
                                <Trash2 size={14} />
                                Delete
                            </Button>
                            <button
                                onClick={clearSelection}
                                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LabTab;
