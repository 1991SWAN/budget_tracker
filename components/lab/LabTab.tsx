import React, { useState, useEffect, useCallback } from 'react';
import { Transaction, Asset, CategoryItem, RecurringTransaction, BillType, Category } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useRegularExpenseDetector, RegularCandidate } from '../../hooks/useRegularExpenseDetector';
import LabTransactionList from './LabTransactionList';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Sparkles, Loader2, Info, Trash2, X } from 'lucide-react';
import { SupabaseService } from '../../services/supabaseService';

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
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
    const { addToast } = useToast();

    // Fetch ALL historical data for the lab to work properly
    useEffect(() => {
        let isMounted = true;
        const fetchAll = async () => {
            setIsLoading(true);
            try {
                // Fetch up to 1000 transactions for testing
                const data = await SupabaseService.getTransactions(1000, 0);
                if (isMounted) setAllTransactions(data);
            } catch (err) {
                console.error("Failed to fetch full history for Lab:", err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };
        fetchAll();
        return () => { isMounted = false; };
    }, []);

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

    // 3. Handle Inline Editing (Update Local UI instantly + Global DB)
    const handleInlineEdit = useCallback(async (updatedTx: Transaction) => {
        // 1. Optimistic UI Update locally
        setAllTransactions(prev => prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx));

        // 2. Fire Global update directly to DB instead of opening the modal in App.tsx
        try {
            await SupabaseService.saveTransaction(updatedTx);
            console.log('Inline edit saved successfully to DB:', updatedTx.id);
        } catch (error) {
            console.error('Failed to save inline edit:', error);
            // Optionally, we could revert the optimistic update here if needed.
        }
    }, []);

    // 4. Handle Multi-Select Delete (Toggle)
    const handleToggleDelete = useCallback((tx: Transaction) => {
        setSelectedTxIds(prev => {
            const next = new Set(prev);
            if (next.has(tx.id)) {
                next.delete(tx.id);
            } else {
                next.add(tx.id);
            }
            return next;
        });
    }, []);

    // 5. Confirm Muti-Delete
    const handleConfirmDelete = async () => {
        if (selectedTxIds.size === 0) return;

        try {
            await SupabaseService.deleteTransactions(Array.from(selectedTxIds));
            setAllTransactions(prev => prev.filter(tx => !selectedTxIds.has(tx.id)));
            setSelectedTxIds(new Set());
            addToast(`Successfully deleted transactions.`, 'success');
        } catch (error) {
            console.error('Failed to delete transactions:', error);
            addToast('Failed to delete transactions.', 'error');
        }
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
                                onClick={() => setSelectedTxIds(new Set())}
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
